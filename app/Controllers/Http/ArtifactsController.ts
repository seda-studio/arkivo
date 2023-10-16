import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Artifact from 'App/Models/Artifact'
import Tag from 'App/Models/Tag'
import { Queue } from '@ioc:Rlanz/Queue';

export default class ArtifactsController {

    public async store({}: HttpContextContract) {
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
        artifact.creatorAddress = 'tz1dd2tmTJFRJh8ycLuZeMpKLquJYkMypu2Q'
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

        if(chain && contractAddress && tokenId) {

            const artifact = await Artifact
                .query()
                .where('chain', chain)
                .andWhere('contract_address', contractAddress)
                .andWhere('token_id', tokenId)
                .first()

            if (artifact) {
            {
                Queue.dispatch('App/Jobs/ProcessArtifact', { chain: chain, contractAddress: contractAddress, tokenId});
                return "Job queued OK";
            }
        }

        return "Not Found";

    }

    }
}
