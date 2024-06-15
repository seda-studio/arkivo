import type { JobHandlerContract, Job } from '@ioc:Rlanz/Queue'
import Env from '@ioc:Adonis/Core/Env'
import Artifact from 'App/Models/Artifact'
import axios from 'axios'

export enum ProcessOperation {
  FETCH = 1,
  FETCH_AND_PIN = 2,
  PIN = 3,
  UNPIN = 4,
  SNAPSHOT = 5
}

export type ProcessArtifactPayload = {
  operation: ProcessOperation;
  chain: string,
  contractAddress: string,
  tokenId: string,
}

export default class ProcessArtifact implements JobHandlerContract {
	constructor(public job: Job) {
    this.job = job
  }

  /**
   * Base Entry point
   */
  public async handle(payload: ProcessArtifactPayload) {
    console.log('Processing artifact: ', payload);


    const artifact = await Artifact
      .query()
      .where('chain', payload.chain)
      .andWhere('contract_address', payload.contractAddress)
      .andWhere('token_id', payload.tokenId)
      .first()

      if(artifact) {

        // 1. pin the metadata
        const metadataPinned = await pinIPFS(artifact.metadataUri)

        // 2. pin the artifact payload
        const artifactPinned = await pinIPFS(artifact.artifactUri)

        artifact.isFetched = (metadataPinned && artifactPinned)
        artifact.isPinned = (metadataPinned && artifactPinned)
        await artifact.save()
      }

  }

  /**
   * This is an optional method that gets called if it exists when the retries has exceeded and is marked failed.
   */
  public async failed() {}
}

async function pinIPFS(uri: string): Promise<boolean> {
  const ipfsHost = Env.get('IPFS_HOST')
  const ipfsPort = Env.get('IPFS_PORT')
  const timeout = 30000; // Set timeout duration in milliseconds (30000ms = 30 seconds)

  try {

    console.log(`Attempting to pin IPFS URI: ${uri}`);

    // Remove "ipfs://" prefix and any URI attributes
    const cleanUri = uri.replace('ipfs://', '').split('?')[0];

    // Pin the content
    const pinResponse = await axios.post(`http://${ipfsHost}:${ipfsPort}/api/v0/pin/add?arg=${cleanUri}`,
                                        null,
                                        { timeout });

    // If the pin operation was not successful, return false
    if (pinResponse.status !== 200) {
      console.log(`Failed to pin IPFS URI: ${cleanUri}`);
      return false;
    }

    console.log(`Successfully pinned IPFS URI: ${cleanUri}`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`Request timed out while pinning IPFS URI: ${uri}`);
    } else {
      console.error(`Error pinning IPFS URI: ${uri}`, error);
    }
    return false;
  }
}