import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import { Queue } from '@ioc:Rlanz/Queue';
import axios from 'axios'

let offset = 0;
let limit = 100;

function getQuery() {

  return `
  query artifact_metadata {
    tokens(where: {_or: [{mime_type: {_eq: "application/x-directory"}}, {mime_type: {_eq: "image/svg+xml"}}], fa2_address: {_eq: "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton"}}, order_by: {minted_at: asc}, offset: ${offset}, limit: ${limit}) {
      token_id
      name
      artifact_uri
      metadata {
        uri
      }
      mime_type
      description
      tags {
        tag
      }
      artist_address
  
      fa2_address
      platform
    }
  }

  `;
}


export default class FetchArtifacts extends BaseCommand {

  /**
   * Command name is used to run the command
   */
  public static commandName = 'fetch:artifacts'

  @args.string({ description: 'Artifact platform' })
  public platform: string

  @flags.boolean({ alias: 'p', description: 'Pin payloads' })
  public pin: boolean

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Fetches artifacts\' metadata from the specified platform, optionally pinning their payloads'

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

    const { default: Artifact } = await import ('App/Models/Artifact')
    const { default: Tag } = await import ('App/Models/Tag')

    this.logger.info('Preparing to fetch artifact metadata from: ' + this.platform)


    // this.logger.debug(query);

    while( true ) {

      let query = getQuery();

      const response = await makeGraphQLRequest(query);

      if(response && response.data && response.data.data && response.data.data.tokens && response.data.data.tokens.length > 0) {


        for(const token of response.data.data.tokens) {
          // this.logger.info('Processing token: ' + token.token_id);

          this.logger.debug(token.artifact_uri);

          const artifactExists = await Artifact.query()
            .where('chain', 'tezos')
            .andWhere('contract_address', token.fa2_address)
            .andWhere('token_id', token.token_id)
            .first()


          if(!artifactExists) {
            const artifact = new Artifact()

            artifact.chain = "tezos"
            artifact.contractAddress = token.fa2_address
            artifact.tokenId = token.token_id
            artifact.metadataUri = token.metadata.uri
            artifact.artifactUri = token.artifact_uri
            artifact.displayUri = token.artifact_uri
            artifact.title = token.name
            artifact.description = token.description
            artifact.creatorAddress = token.artist_address
            artifact.mimeType = token.mime_type
            artifact.artifactSize = 0
            artifact.isFetched = false
            artifact.isPinned = false
            artifact.isNetworked = false
    
            await artifact.save()


            const tags = await Tag.updateOrCreateMany('tag', token.tags.map(tag => ({ tag: tag.tag })) )
    
    
            await artifact
                .related('tags')
                .attach(tags.map(tag => tag.id));

            
            const tokenId = artifact.tokenId;

            await Queue.dispatch('App/Jobs/ProcessArtifact', { chain: artifact.chain, contractAddress: artifact.contractAddress, tokenId});
            this.logger.info('Token sent for processing: ' + token.token_id);
          }


        }
      } else {
        this.logger.info('No more tokens to process');
        break;
      }

      offset += limit;
    }

  }
}


async function makeGraphQLRequest(query: string) {
  try {


    // TODO: use .env variable for the endpoint
    // alternative instance (Teia): https://teztok.teia.rocks/v1/graphql
    // const response = await axios.post('https://teztok.teia.rocks/v1/graphql', {
    // const response = await axios.post('https://graphiql.teztok.com/v1/graphql', {
    const response = await axios.post('http://192.168.1.33:8080/v1/graphql', {
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


/**
 * 
 * 
 * 
 * 
 */