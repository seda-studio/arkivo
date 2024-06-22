import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import { Queue } from '@ioc:Rlanz/Queue';
import Env from '@ioc:Adonis/Core/Env'
import Artifact from 'App/Models/Artifact'
import { ProcessArtifactPayload, ProcessOperation } from 'App/Jobs/ProcessArtifact'

const QUEUE_SNAPSHOT = Env.get('QUEUE_NAME_SNAPSHOT')

export default class ArtifactsSnapshot extends BaseCommand {
  /**
   * Command name is used to run the command
   */
  public static commandName = 'artifacts:snapshot'

  @args.string({ description: 'Chain (tezos, ethereum, solana, etc)' })
  public chain: string

  @args.string({ description: 'Contract address' })
  public contract: string

  @args.string({ description: 'Token Id' })
  public token_id: string

  @flags.boolean({ alias: 'a', description: 'Snapshot all artifacts' })
  public all: boolean

  /**
   * Command description is displayed in the "help" output
   */
  public static description = 'Take a snapshot of an artifact'

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

    if (this.all) {

      this.logger.info('Snapshoting all artifacts');
      const artifacts = await Artifact.query()
        .where('chain', 'tezos')

      for (let artifact of artifacts) {

          const payload: ProcessArtifactPayload = {
            operations: [ProcessOperation.SNAPSHOT],
            chain: artifact.chain,
            contractAddress: artifact.contractAddress,
            tokenId: artifact.tokenId
          }

          await Queue.dispatch('App/Jobs/ProcessArtifact', payload, {queueName: QUEUE_SNAPSHOT});
          this.logger.info('Token sent for processing: ' + artifact.chain + ' / ' + artifact.contractAddress + ' / ' + artifact.tokenId);
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
        this.logger.log('Snapshoting: ' + artifact.chain + ' / ' + artifact.contractAddress + ' / ' + artifact.tokenId);

        const payload: ProcessArtifactPayload = {
          operations: [ProcessOperation.SNAPSHOT],
          chain: artifact.chain,
          contractAddress: artifact.contractAddress,
          tokenId: artifact.tokenId
        }

        await Queue.dispatch('App/Jobs/ProcessArtifact', payload, {queueName: QUEUE_SNAPSHOT});
        this.logger.info('Token sent for processing: ' + artifact.tokenId);

      } else {
        this.logger.error('Cannot Snapshot. Artifact not found: ' + this.chain + ' / ' + this.contract + ' / ' + this.token_id);
      }
    }
  }
}
