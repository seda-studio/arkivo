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

const ipfsGateway = Env.get('IPFS_GATEWAY')
const ipfsGatewayHost = new URL(ipfsGateway).hostname;

export default class SnapshotArtifactService {
    snapshotData: ISnapshotDataV1;
    extNetCalls: boolean = false;
    dryRun: boolean = false;

    extOrigins: IOrigin[] = [];

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
                screenshot: ''
            }
        };
    }

    async snapshot(artifact: Artifact, dryRun: boolean): Promise<void> {

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
        const context = await browser.newContext();
        const page = await browser.newPage();

        // Subscribe to 'request' and 'response' events.
        page.on('request', (request: Request) => this.processRequest(request));
        page.on('response', (response: Response) => this.processResponse(response));
        page.on('console', msg => this.processConsole(msg));

        await page.goto(pageUrl);

        // Wait a few seconds
        await page.waitForTimeout(30000);

        // capture screenshot
        const buffer = await page.screenshot();
        this.snapshotData.snapshot.screenshot = buffer.toString('base64');

        console.log('extOrigins:', this.extOrigins);

        if(!dryRun) {
            await artifact.related('snapshots').create({
                version: this.snapshotData.version,
                data: this.snapshotData
            });

            // update artifact networked status if necessary
            if (!artifact.isNetworked && this.extNetCalls) {
                console.log(`Artifact ${artifact.id} is networked`);
                artifact.isNetworked = true;
                await artifact.save();
            }

            // create or update origins
            const origins = await Origin.updateOrCreateMany(['scheme','domain','port'], this.extOrigins);


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
        const external = (url.hostname != ipfsGatewayHost) && !(url.protocol.startsWith('blob'));

        if (external) {
            this.extNetCalls = true;

            this.extOrigins.push({
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

        const external = url.hostname != ipfsGatewayHost;

        // only capture response body from external network calls
        if (url.hostname != ipfsGatewayHost) {

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
        urlStr = `${ipfsGateway}/${urlStr}`;

        const url = new URL(urlStr);

        if (artifact.platform == 'HEN') {
            console.log('HEN platform detected');
            url.searchParams.set('creator', artifact.artistAddress);
            url.searchParams.set('viewer', '');
            url.searchParams.set('objkt', artifact.tokenId);
        }

        return url.toString();
    }

}


