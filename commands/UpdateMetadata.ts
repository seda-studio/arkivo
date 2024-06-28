import { BaseCommand, args} from '@adonisjs/core/build/standalone'
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
    }
  }

  `;
}

export default class UpdateMetadata extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'artifacts:updateMetadata'


  @args.string({ description: 'Artifact platform' })
  public platform: string


  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Update all token metadata for the specified platform'

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

  
    this.logger.info('Preparing to fetch artifact metadata from: ' + this.platform)
  
  
    // this.logger.debug(query);
  
    while( true ) {
  
      let query = getQuery();
  
      const response = await makeGraphQLRequest(query);
  
      if(response && response.data && response.data.data && response.data.data.tokens && response.data.data.tokens.length > 0) {
  
  
        for(const token of response.data.data.tokens) {
  
          let artifact = await Artifact.query()
            .where('chain', 'tezos')
            .andWhere('contract_address', token.fa2_address)
            .andWhere('token_id', token.token_id)
            .first()
  

            if(artifact) {
              

              this.logger.info('Updating artifact metadata: ' + token.fa2_address + ' / ' + token.token_id)

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
      
              await artifact.save()
  
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