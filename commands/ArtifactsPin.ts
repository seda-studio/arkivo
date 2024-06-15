import { BaseCommand } from '@adonisjs/core/build/standalone'
import { Queue } from '@ioc:Rlanz/Queue';
import { ProcessArtifactPayload, ProcessOperation } from 'App/Jobs/ProcessArtifact'


export default class ArtifactPin extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'artifacts:pin'

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Fetches and Pins already existing artifacts records'

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

    const artifacts = await Artifact.query()
      .where('is_fetched ', false)
      .andWhere('is_pinned', false);

      // for each result, dispatch a job to process the artifact

      for (let artifact of artifacts) {

        const payload: ProcessArtifactPayload = {
          operation: ProcessOperation.FETCH_AND_PIN,
          chain: artifact.chain,
          contractAddress: artifact.contractAddress,
          tokenId: artifact.tokenId
        }

        await Queue.dispatch('App/Jobs/ProcessArtifact', payload);
        this.logger.info('Token sent for processing: ' + artifact.tokenId);
      }

  }


}
