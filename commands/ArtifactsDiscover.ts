import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import { Queue } from '@ioc:Rlanz/Queue';
import Env from '@ioc:Adonis/Core/Env';
import axios from 'axios'
import { ProcessArtifactPayload, ProcessOperation } from 'App/Jobs/ProcessArtifact'
import Artifact from 'App/Models/Artifact'
import Tag from 'App/Models/Tag'
import { createOrUpdateArtistProfile } from './UpdateMetadata';

let offset = 0;
let limit = 100;

function getQuery() {

  return `
  query artifact_metadata {
    tokens(where: {_or: [{mime_type: {_eq: "application/x-directory"}}, {mime_type: {_eq: "image/svg+xml"}}], fa2_address: {_eq: "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton"}}, order_by: {minted_at: asc}, offset: ${offset}, limit: ${limit}) {
      token_id
      name
      artifact_uri
      metadata_uri
      thumbnail_uri
      mime_type
      description
      tags {
        tag
      }
      artist_address
  
      fa2_address
      platform
      minted_at
      editions
    }
  }

  `;
}


export default class ArtifactsDiscover extends BaseCommand {

  /**
   * Command name is used to run the command
   */
  public static commandName = 'artifacts:discover'

  @args.string({ description: 'Artifact platform' })
  public platform: string

  @flags.boolean({ alias: 'p', description: 'Pin payloads' })
  public pin: boolean

  @flags.boolean({ alias: 's', description: 'Snapshot artifacts' })
  public snapshot: boolean

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Discovers new artifacts\' metadata from the specified platform, optionally pinning their payloads'

  public static settings = {
    /**
     * Set the following value to true, if you want to load the application
     * before running the command. Don't forget to call `node ace generate:manifest` 
     * afterwards.
     */
    loadApp: true,

    /**
     * Set the following value to true, if you want this command to keep running until
     * you manually decide to exit the process. Don't forget to call 
     * `node ace generate:manifest` afterwards.
     */
    stayAlive: false,
  }

  public async run() {

    const QUEUE_IPFS = Env.get('QUEUE_NAME_IPFS');
    const { default: Artifact } = await import ('App/Models/Artifact')

    this.logger.info('Preparing to fetch artifact metadata from: ' + this.platform)


    // this.logger.debug(query);

    while( true ) {

      let query = getQuery();

      const teia_teztok_endpoint = Env.get('TEIA_TEZTOK_ENDPOINT');

      const response = await makeGraphQLRequest(query, teia_teztok_endpoint);

      if(response && response.data && response.data.data && response.data.data.tokens && response.data.data.tokens.length > 0) {


        for(const tokenData of response.data.data.tokens) {

          const artifactExists = await Artifact.query()
            .where('chain', 'tezos')
            .andWhere('contract_address', tokenData.fa2_address)
            .andWhere('token_id', tokenData.token_id)
            .first()


          if(!artifactExists) {
            const artifact = new Artifact()

            await this.createOrUpdateArtifact(artifact, tokenData);
            await createOrUpdateArtistProfile(artifact.artistAddress);

            if(this.pin || this.snapshot) {
              let ops: ProcessOperation[] = [];

              if(this.pin) {
                ops.push(ProcessOperation.FETCH);
                ops.push(ProcessOperation.PIN);
              }

              if(this.snapshot) {
                ops.push(ProcessOperation.SNAPSHOT);
              }


              const payload: ProcessArtifactPayload = {
                operations: ops,
                chain: artifact.chain,
                contractAddress: artifact.contractAddress,
                tokenId: artifact.tokenId
              }

              await Queue.dispatch('App/Jobs/ProcessArtifact', payload, {queueName: QUEUE_IPFS});
              this.logger.info('Token sent for processing: ' + payload.tokenId);
            }

          }


        }
      } else {
        this.logger.info('No more tokens to process');
        break;
      }

      offset += limit;
    }

  }


  // TODO: this code is duplicated in UpdateMetadata.ts (FIX IT)
  private async createOrUpdateArtifact(artifact: Artifact, token: any) {

    artifact.chain = "tezos"
    artifact.contractAddress = token.fa2_address
    artifact.tokenId = token.token_id
    artifact.platform = token.platform
    artifact.metadataUri = token.metadata_uri
    artifact.artifactUri = token.artifact_uri
    artifact.displayUri = token.artifact_uri
    artifact.thumbnailUri = token.thumbnail_uri
    artifact.title = token.name
    artifact.description = token.description
    artifact.artistAddress = token.artist_address
    artifact.mimeType = token.mime_type
    artifact.mintedAt = token.minted_at
    artifact.artifactSize = 0
    artifact.editions = token.editions
    artifact.isFetched = false
    artifact.isPinned = false
    artifact.isNetworked = false
    artifact.isBurned = false
    artifact.isRestricted = false
  
    if (artifact.editions == 0) {
      artifact.isBurned = true;
    }

    await artifact.save()

    const tags = await Tag.updateOrCreateMany('tag', token.tags.map(tag => ({ tag: tag.tag })) )


    await artifact
        .related('tags')
        .attach(tags.map(tag => tag.id));


  }


}



async function makeGraphQLRequest(query: string, teztok_endpoint: string) {

  try {
    const response = await axios.post(teztok_endpoint, {
      query: query,
    });


    // console.log(response.data.data.tokens);


    // Handle the response data here
    // this.logger.info('Indexer response: ' + response.data);

    return response;
  } catch (error) {
    // Handle any errors that occur during the request
    console.error(error);
  }
}
