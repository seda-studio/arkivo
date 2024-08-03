import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import axios from 'axios'
import Artifact from 'App/Models/Artifact'
import Tag from 'App/Models/Tag'
import Logger from '@ioc:Adonis/Core/Logger'
import Env from '@ioc:Adonis/Core/Env';
import Identity from 'App/Models/Identity'


let offset = 0;
let limit = 100;

export default class UpdateMetadata extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'artifacts:updateMetadata'

  @flags.boolean({ alias: 'a', description: 'Update all artifacts' })
  public all: boolean

  @flags.string({ alias: 'b', description: 'Blockchain' })
  public blockchain: string

  @flags.string({ alias: 'p', description: 'NFT platform' })
  public platform: string

  @flags.string({ alias: 'c', description: 'Contract Address' })
  public contractAddress: string

  @flags.string({ alias: 't', description: 'Artifact Token Id' })
  public tokenId: string

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

    const { default: Artifact } = await import('App/Models/Artifact')


    Logger.info('Preparing to fetch artifact metadata from: ' + this.platform)


    if (this.all) {

      while (true) {

        const response = await makeGraphQLRequest(getGraphQLTeiaAllInteractives());

        if (response && response.data && response.data.data && response.data.data.tokens && response.data.data.tokens.length > 0) {


          for (const token of response.data.data.tokens) {

            let artifact = await Artifact.query()
              .where('chain', 'tezos')
              .andWhere('contract_address', token.fa2_address)
              .andWhere('token_id', token.token_id)
              .first()


            if (artifact) {
              await createOrUpdateArtifact(artifact, token);
            } else {
              this.logger.info('No artifact found for: ' + token.fa2_address + ' / ' + token.token_id)
            }

          }


        } else {
          this.logger.info('No more tokens to process');
          break;
        }


        offset += limit;
      }

    } else if (this.blockchain && this.platform && this.contractAddress && this.tokenId) {

      let query = getGraphQLTeiaByTokenId(this.tokenId);

      const response = await makeGraphQLRequest(query);

      if (response && response.data && response.data.data && response.data.data.tokens && response.data.data.tokens.length > 0) {

        const token = response.data.data.tokens[0];

        let artifact = await Artifact.query()
          .where('chain', 'tezos')
          .andWhere('contract_address', token.fa2_address)
          .andWhere('token_id', token.token_id)
          .first()

        if (artifact) {
          await createOrUpdateArtifact(artifact, token);
        } else {
          this.logger.info('No artifact found for: ' + token.fa2_address + ' / ' + token.token_id)
        }

      } else {
        this.logger.info('No tokens found for: ' + this.contractAddress + ' / ' + this.tokenId);
      }
    }
  }
}


export async function createOrUpdateArtifact(artifact: Artifact, token: any) {

  Logger.info('Updating artifact metadata: ' + token.fa2_address + ' / ' + token.token_id)

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
  artifact.isBurned = false
  artifact.isRestricted = false

  if (artifact.editions == 0) {
    artifact.isBurned = true;
  }

  await artifact.save()

  const tags = await Tag.updateOrCreateMany('tag', token.tags.map(tag => ({ tag: tag.tag })))


  await artifact
    .related('tags')
    .sync(tags.map(tag => tag.id));


  await createOrUpdateArtistProfile(token.artist_address);

}


export async function createOrUpdateArtistProfile(address: string) {

  Logger.info('Updating artist profile: ' + address)

  let artist = await Identity.query()
    .where('account', address)
    .first();

    if (!artist) {
      artist = new Identity();
    }

  const response = await makeGraphQLRequest(getArtistProfileData(address));

  if (response && response.data && response.data.data && response.data.data.tzprofiles && response.data.data.tzprofiles.length > 0) {

    const profile = response.data.data.tzprofiles[0];

    artist.account = profile.account;
    artist.alias = profile.alias;
    artist.description = profile.description;
    artist.discord = profile.discord;
    artist.domainName = profile.domain_name;
    artist.ethereum = profile.ethereum;
    artist.github = profile.github;
    artist.logo = profile.logo;
    artist.twitter = profile.twitter;
    artist.website = profile.website;

    await artist.save();
    
  }
}


async function makeGraphQLRequest(query: string) {

  const teztok_endpoint = Env.get('TEZTOK_ENDPOINT');

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



function getGraphQLTeiaAllInteractives() {
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
    `
};

function getGraphQLTeiaByTokenId(tokenId: string) {
  return `
    query artifact_metadata {
      tokens(where: {token_id: {_eq: "${tokenId}"}, fa2_address: {_eq: "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton"}}) {
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
    `
};

function getArtistProfileData(address: string) {

  return `
  query artistInfo($address: String = "${address}") {
        tzprofiles(where: {account: {_eq: $address}}) {
              account
              alias
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
  `
};