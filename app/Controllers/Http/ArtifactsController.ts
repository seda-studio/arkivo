import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Artifact from 'App/Models/Artifact'
import Identity from 'App/Models/Identity'
import Tag from 'App/Models/Tag'
import Env from '@ioc:Adonis/Core/Env'
import { Queue } from '@ioc:Rlanz/Queue';
import axios from 'axios'
import { ProcessArtifactPayload, ProcessOperation } from 'App/Jobs/ProcessArtifact'
import Logger from '@ioc:Adonis/Core/Logger'
import { truncAddress, getWorkingUri, normalizeString } from 'App/Utils/Utils';

const teztok_endpoint = Env.get('TEZTOK_ENDPOINT');

export default class ArtifactsController {

    public async index({ view, request }: HttpContextContract) {

        const qs = request.qs();

        // check if it has a page parameter, and if not, send a redirect with the parameter
        if (!qs.page) {
            qs.page = 1;
        }

        const searchQuery = request.input('search')
        const netOnly = request.input('netonly')


        let artifacts;

        if (searchQuery) {
            const normalizedSearchQuery = normalizeString(searchQuery);
            const normalizedSearchTerms = normalizedSearchQuery.split(/\s+/);

            const placeholders = normalizedSearchTerms.map(() => 'normalize(alias, NFKD) ILIKE ?').join(' OR ');
            const queryValues = normalizedSearchTerms.map(value => `%${value}%`);
            
            const artist = await Identity.query()
                            .whereRaw(`(${placeholders})`, queryValues)
                            .first();

            const artistAddress = artist ? artist.account : '';
        
            const titlePlaceholders = normalizedSearchTerms.map(() => 'normalize(title, NFKD) ILIKE ?').join(' OR ');
            const descriptionPlaceholders = normalizedSearchTerms.map(() => 'normalize(description, NFKD) ILIKE ?').join(' OR ');
            
            artifacts = await Artifact.query()
                .where((query) => {
                    query.whereRaw(`(${titlePlaceholders})`, queryValues)
                        .orWhereRaw(`(${descriptionPlaceholders})`, queryValues)
                        .orWhere('artistAddress', artistAddress)
                })
                .if(netOnly, (query) => {
                    query.andWhere('isNetworked', true)
                })
                .andWhere('isBurned', false)
                .orderBy('minted_at', 'desc')
                .paginate(qs.page, 9);
        } else {
            artifacts = await Artifact.query()
                .if(netOnly, (query) => {
                    query.andWhere('isNetworked', true)
                })
                .where('isBurned', false)
                .orderBy('minted_at', 'desc')
                .paginate(qs.page, 9);
        }

        artifacts.searchQuery = searchQuery;
        artifacts.netOnly = netOnly


        await Promise.all(artifacts.map(async (artifact) => {


            artifact.artifactUri = getWorkingUri(artifact.artifactUri);

            if (artifact.mimeType == 'image/svg+xml') {
                artifact.thumbnailUri = "/images/svg-placeholder.png";
            }
            else {
                artifact.thumbnailUri = getWorkingUri(artifact.thumbnailUri);
            }

            // populate artist alias
            await populateArtistAlias(artifact);

            artifact.publicURL = getPublicArtifactURL(artifact);
        }));

        return view.render('artifacts', { artifacts })
    }


    public async show(ctx: HttpContextContract) {

        const { view, params } = ctx;

        // const artifact = await Artifact.query().where('id', params.id).preload('tags').firstOrFail()
        const artifact = await Artifact.query()
                            .where('id', params.id)
                            .preload('tags')
                            .preload('snapshots')
                            .firstOrFail();

        artifact.artifactUri = getPlatformSpecificUri(artifact);


        console.log('Platform specific URI: ' + artifact.artifactUri);


        artifact.mintedAt.toFormat('yyyy-MM-dd HH:mm:ss');

        // populate artist alias
        await populateArtistAlias(artifact);

        // iterate snapshots and count how many net calls were external, using: net.type == 1 && net.external
        for (let i = 0; i < artifact.snapshots.length; i++) {
            let snapshot = artifact.snapshots[i];
            snapshot.externalCalls = snapshot.data.snapshot.net.filter((net) => net.type == 1 && net.external);
        }


        return view.render('artifact', { artifact })
    }

    public async showPlatformToken(ctx: HttpContextContract) {

        const { params } = ctx

        console.log('Platform: ' + params.platform + ' Token ID: ' + params.tokenId);

        const artifact = await Artifact.query().where('platform', params.platform).andWhere('token_id', params.tokenId)
                                        .firstOrFail();


        params.id = artifact.id;

        return this.show(ctx);
        
    }



    public async showFQNToken(ctx: HttpContextContract) {

        const { params } = ctx

        console.log('Chain: ' + params.chain + ' Contract Address: ' + params.contractAddress + ' Token ID: ' + params.tokenId);

        const artifact = await Artifact.query()
                                .where('chain', params.chain)  
                                .andWhere('contract_address', params.contractAddress)
                                .andWhere('token_id', params.tokenId)
                                .firstOrFail();


        params.id = artifact.id;

        return this.show(ctx);    
    }

    

    public async store({ }: HttpContextContract) {
        const artifact = new Artifact()

        artifact.chain = 'tezos'
        artifact.contractAddress = 'KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton'
        artifact.tokenId = '88917115'
        artifact.metadataUri = 'ipfs://QmSEpSs54tf1eCC1UHPqGFrcNd6kuheEnNKF98tDd5cEt6'
        artifact.artifactUri = "ipfs://QmbbNqz6Ek8C2KUFm4x49pLo56kpAii8Nvo5L8Z5sMEviL"
        artifact.displayUri = 'ipfs://QmNrhZHUaEqxhyLfqoq1mtHSipkWHeT31LNHb1QEbDHgnc'
        artifact.title = 'Blank Genesis'
        artifact.description = 'An intentionally blank genesis OBJKT by Filipe Farinha, (@ktorn on Twitter)'
        artifact.mimeType = 'image/png'
        artifact.artistAddress = 'tz1dd2tmTJFRJh8ycLuZeMpKLquJYkMypu2Q'
        artifact.artifactSize = 0
        artifact.isFetched = false
        artifact.isPinned = false
        artifact.isNetworked = false

        await artifact.save()


        const tags = await Tag.updateOrCreateMany('tag', [{ tag: 'genesis' }, { tag: 'blank' }])


        await artifact
            .related('tags')
            .attach(tags.map(tag => tag.id))

        return artifact;
    }

    public async fetch({ request }: HttpContextContract) {

        const chain = request.input('chain')
        const contractAddress = request.input('contractAddress')
        const tokenId = request.input('tokenId')

        if (chain && contractAddress && tokenId) {

            const artifact = await Artifact
                .query()
                .where('chain', chain)
                .andWhere('contract_address', contractAddress)
                .andWhere('token_id', tokenId)
                .first()

            if (artifact) {
                {

                    const payload: ProcessArtifactPayload = {
                        operations: [ProcessOperation.FETCH, ProcessOperation.PIN],
                        chain: chain,
                        contractAddress: contractAddress,
                        tokenId: tokenId
                    }


                    Queue.dispatch('App/Jobs/ProcessArtifact', payload);
                    return "Job queued OK";
                }
            }

            return "Not Found";

        }

    }
}


async function populateArtistAlias(artifact: Artifact) {

    let query = getArtistAliasQuery(artifact.artistAddress);
    const response = await makeGraphQLRequest(query);

    if (response && response.data && response.data.data && response.data.data.tzprofiles && response.data.data.tzprofiles.length > 0) {

        const alias = response.data.data.tzprofiles[0].alias;

        artifact.artistAlias = alias;
    } else {
        Logger.debug('No artist alias found for address: ' + artifact.artistAddress);
        artifact.artistAlias = truncAddress(artifact.artistAddress);
    }

}

function getArtistAliasQuery(address: string) {

    return `
    query artistInfo($address: String = "${address}") {
          tzprofiles(where: {account: {_eq: $address}}) {
                account
                alias
                contract
                description
                discord
                domain_name
                ethereum
                github
                logo
                twitter
                website
            }
        }
    `;
}


async function makeGraphQLRequest(query: string) {
    try {
        // TODO: use .env variable for the endpoint
        // alternative instance (Teia): https://teztok.teia.rocks/v1/graphql
        // const response = await axios.post('https://teztok.teia.rocks/v1/graphql', {
        // const response = await axios.post('https://graphiql.teztok.com/v1/graphql', {
        // const response = await axios.post('http://192.168.1.33:8080/v1/graphql', {
        const response = await axios.post(teztok_endpoint, {
            query: query,
        });


        //   console.log(query);

        //   console.log(JSON.stringify(response.data, null, 2));



        // Handle the response data here
        // this.logger.info('Indexer response: ' + response.data);

        return response;
    } catch (error) {
        // Handle any errors that occur during the request
        console.error(error);
    }
}


function getPlatformSpecificUri(artifact: Artifact) {
    let stringUri = getWorkingUri(artifact.artifactUri);

    // turn workingUri into a URL object
    const url = new URL(stringUri);

    if (artifact.platform == 'HEN') {
        // add viwer and objkt query parameters
        url.searchParams.set('creator', artifact.artistAddress);
        url.searchParams.set('viewer', '');
        url.searchParams.set('objkt', artifact.tokenId);
    }

    return url.toString();
}


function getPublicArtifactURL(artifact: Artifact) {

    if(artifact.platform == 'HEN') {
        return `HEN/${artifact.tokenId}`;
    }

    return `${artifact.chain}/${artifact.contractAddress}/${artifact.tokenId}`;
}   