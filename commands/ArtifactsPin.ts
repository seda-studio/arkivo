import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import { Queue } from '@ioc:Rlanz/Queue';
import Env from '@ioc:Adonis/Core/Env'
import { ProcessArtifactPayload, ProcessOperation } from 'App/Jobs/ProcessArtifact'

export default class ArtifactPin extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'artifacts:pin'


  @args.string({ description: 'Blockchain (tezos, ethereum, solana, etc)' })
  public chain: string

  @args.string({ description: 'Contract address' })
  public contract: string

  @args.string({ description: 'Token Id' })
  public token_id: string

  @flags.boolean({ alias: 'a', description: 'Force pin all artifacts' })
  public all: boolean

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

    const QUEUE_IPFS = Env.get('QUEUE_NAME_IPFS');

    const { default: Artifact } = await import ('App/Models/Artifact')

    let artifacts;
    
    if(this.all) {
      artifacts = await Artifact.query();

      // for each result, dispatch a job to process the artifact

      for (let artifact of artifacts) {

        const payload: ProcessArtifactPayload = {
          operations: [ ProcessOperation.PIN ],
          chain: artifact.chain,
          contractAddress: artifact.contractAddress,
          tokenId: artifact.tokenId
        }

        await Queue.dispatch('App/Jobs/ProcessArtifact', payload, {queueName: QUEUE_IPFS});
        this.logger.info('Token sent for processing: ' + artifact.tokenId);
      }

    } else {

      this.logger.log('chain: [' + this.chain + ']');
      this.logger.log('contract: [' + this.contract + ']');
      this.logger.log('token_id: [' + this.token_id + ']');

      const artifact = await Artifact.query()
        .where('chain', 'tezos')
        .andWhere('contract_address', this.contract)
        .andWhere('token_id', this.token_id)
        .first()

        if (artifact) {
          const payload: ProcessArtifactPayload = {
            operations: [ ProcessOperation.PIN ],
            chain: artifact.chain,
            contractAddress: artifact.contractAddress,
            tokenId: artifact.tokenId
          }

          await Queue.dispatch('App/Jobs/ProcessArtifact', payload, {queueName: QUEUE_IPFS});
          this.logger.info('Token sent for processing: ' + artifact.tokenId);
        }

    }

  }


}
