import Env from '@ioc:Adonis/Core/Env'
import { chromium, ConsoleMessage, Request, Response } from 'playwright';
import Artifact from 'App/Models/Artifact'
import Origin from 'App/Models/Origin'
import { URL } from 'url';
import { ISnapshotDataV1, HttpType } from 'App/Models/interfaces/SnapshotDataV1';


interface IOrigin {
    scheme: string;
    domain: string;
    port: number;
}

const IPFS_GATEWAY = Env.get('IPFS_GATEWAY')
const IPFS_GATEWAY_HOST = new URL(IPFS_GATEWAY).hostname;
const SNAPSHOT_DURATION = 10000;

const DEFAULT_VIEWPORT_WIDTH = 2000;
const DEFAULT_VIEWPORT_HEIGHT = 2000;

export default class SnapshotArtifactService {
    snapshotData: ISnapshotDataV1;
    extNetCalls: boolean = false;
    dryRun: boolean = false;

    extOriginsMap: Map<string, IOrigin> = new Map();

    getOrigins(): IOrigin[] {
        return Array.from(this.extOriginsMap.values());
      }
    
    addOrigin(origin: IOrigin): void {
        const key = JSON.stringify(origin);
        this.extOriginsMap.set(key, origin);
    }

    constructor() {
        this.snapshotData = {
            version: 1,
            timestamp: Date.now(),
            artifact: {
                chain: '',
                contractAddress: '',
                tokenId: '',
                title: '',
                description: '',
                artist: ''
            },
            snapshot: {
                net: [],
                consoleMessages: [],
                screenshot: '',
                screenshotDelay: SNAPSHOT_DURATION,
                viewport: {
                    width: 0,
                    height: 0
                },
                browser: {
                    name: '',
                    version: ''
                }
            }
        };
    }

    async snapshot(artifact: Artifact, dryRun: boolean): Promise<void> {

        const START_TIME = Date.now();

        // populate artifact info in snapshot data
        this.snapshotData.artifact.chain = artifact.chain;
        this.snapshotData.artifact.contractAddress = artifact.contractAddress;
        this.snapshotData.artifact.tokenId = artifact.tokenId;
        this.snapshotData.artifact.title = artifact.title;
        this.snapshotData.artifact.description = artifact.description || '';
        this.snapshotData.artifact.artist = artifact.artistAddress;

        // strip ipfs prefix from url
        let url = artifact.artifactUri;
        
        const pageUrl = this.formatPlatformUrl(artifact, url);


        console.log(`Attempting to snapshot IPFS URI: ${pageUrl}`);
        const browser = await chromium.launch();
        const context = await browser.newContext({
            viewport: { width: DEFAULT_VIEWPORT_WIDTH,
                        height: DEFAULT_VIEWPORT_HEIGHT
                      }
        });

        const browserName = browser.browserType().name();
        const browserVersion = browser.version();

        this.snapshotData.snapshot.browser.name = browserName;
        this.snapshotData.snapshot.browser.version = browserVersion;
        this.snapshotData.snapshot.viewport.width = DEFAULT_VIEWPORT_WIDTH;
        this.snapshotData.snapshot.viewport.height = DEFAULT_VIEWPORT_HEIGHT;

        console.log(`Browser: ${browserName} - ${browserVersion}`);

        
        const page = await context.newPage();

        // Subscribe to 'request' and 'response' events.
        page.on('request', (request: Request) => this.processRequest(request));
        page.on('response', (response: Response) => this.processResponse(response));
        page.on('console', msg => this.processConsole(msg));

        await page.goto(pageUrl);


        // check if the page contains any <script> tags (should work for both HTML and SVG)
        let hasScripts = false;
        const scriptTags = await page.$$eval('script', scripts => scripts.length);
        hasScripts = scriptTags > 0;

        const TIME_LEFT = SNAPSHOT_DURATION - (Date.now() - START_TIME);

        // Wait for the remaining time
        await page.waitForTimeout(TIME_LEFT);

        // capture screenshot
        console.log(`Taking screenshot...`);
        const buffer = await page.screenshot({ timeout: 60000 });
        this.snapshotData.snapshot.screenshot = buffer.toString('base64');


        console.log('extOrigins:', this.getOrigins());

        if(!dryRun) {
            await artifact.related('snapshots').create({
                version: this.snapshotData.version,
                data: this.snapshotData
            });

            let saveRequired = false;

            // update artifact networked status if necessary
            if (!artifact.isNetworked && this.extNetCalls) {
                console.log(`Artifact ${artifact.id} is networked`);
                artifact.isNetworked = true;
                saveRequired = true;
            }

            // update artifact script status if necessary
            if(!artifact.isScript && hasScripts) {
                console.log(`Artifact contains scripts`);
                artifact.isScript = true;
                saveRequired = true;
            }

            if(saveRequired) {
                await artifact.save();
            }

            // create or update origins
            const origins = await Origin.updateOrCreateMany(['scheme','domain','port'], this.getOrigins());


            await artifact
                .related('origins')
                .sync(origins.map(origin => origin.id));


        } else {
            console.log('Dry run enabled. Skipping snapshot creation and artifact update');
        }

        // playwright cleanup
        await page.close();
        await context.close();
        await browser.close();
    }

    processConsole(msg: ConsoleMessage): void {
        let messageText = msg.text();

        if (messageText == '[Object]') {
            messageText = JSON.stringify(msg.args());
        }

        this.snapshotData.snapshot.consoleMessages.push({
            timestamp: Date.now(),
            level: msg.type(),
            text: messageText
        });
    }

    private processRequest(request: Request) {
        const url = new URL(request.url());

        // remove the trailing : from the protocol (https://developer.mozilla.org/en-US/docs/Web/API/URL/protocol)
        const protocol = url.protocol.replace(':', '');

        // check if the request is different from the ipfs gateway (potentially external call)
        // and not a blob request (since blob calls result in different hostnames but are not external calls)
        // if both checks pass, mark the artifact as networked
        const external = (url.hostname != IPFS_GATEWAY_HOST) && !(url.protocol.startsWith('blob'));

        if (external) {
            this.extNetCalls = true;

            this.addOrigin({
                scheme: protocol,
                domain: url.hostname,
                port: url.port ? parseInt(url.port) : (protocol === 'https' ? 443 : 80)
            });


        }

        let postData = request.postData();
        if (postData) {
            postData = JSON.stringify(postData);
        }

        this.snapshotData.snapshot.net.push({
            type: HttpType.REQUEST,
            timestamp: Date.now(),
            external: external,
            data: {
                url: request.url(),
                method: request.method(),
                type: 'http',
                protocol: url.protocol,
                host: url.hostname,
                path: url.pathname,
                query: url.search,
                fragment: url.hash,
                headers: request.headers(),
                postData: postData
            }
        });
    }


    private async processResponse(response: Response) {
        let body = '';

        const url = new URL(response.url());

        const external = url.hostname != IPFS_GATEWAY_HOST;

        // only capture response body from external network calls
        if (url.hostname != IPFS_GATEWAY_HOST) {

            try {
                body = (await response.body()).toString(); // Convert Buffer to string
                body = body.replace(/"/g, '\\"');          // escape double quotes
                body = JSON.stringify(body); // Sanitize body
            } catch (error) {

            }
        }

        this.snapshotData.snapshot.net.push({
            type: HttpType.RESPONSE,
            timestamp: Date.now(),
            external: external,
            data: {
                url: response.url(),
                status: response.status(),
                headers: response.headers(),
                body: body
            }
        });
    }


    // utility function to format the request URL according to the HEN platform
    private formatPlatformUrl(artifact: Artifact, urlStr: string): string {

        urlStr = urlStr.replace('ipfs://', '');
        urlStr = `${IPFS_GATEWAY}/${urlStr}`;

        const url = new URL(urlStr);

        if (artifact.platform == 'HEN') {
            console.log('HEN platform detected');
            url.searchParams.set('creator', artifact.artistAddress);
            url.searchParams.set('viewer', '');
            url.searchParams.set('objkt', artifact.tokenId);
        }

        return url.toString();
    }


    private async checkSVGScripts(page: any): Promise<boolean> { 

        const svgHandle = await page.$('svg');

        if (svgHandle) {
          // Check if there is any <script> tag anywhere inside the SVG
          const scriptTags = await svgHandle.$$eval('script', scripts => scripts.length);
      
          if (scriptTags > 0) {
            console.log(`SVG contains ${scriptTags} <script> tag(s).`);
            return true;
          } else {
            console.log('SVG does not contain any <script> tags.');
          }
        } else {
          console.log('No SVG element found.');
        }

        return false;

    }

}


