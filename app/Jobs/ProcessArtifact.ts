import type { JobHandlerContract, Job } from '@ioc:Rlanz/Queue'
import Env from '@ioc:Adonis/Core/Env'
import Artifact from 'App/Models/Artifact'
import axios from 'axios'
import SnapshotArtifactService from 'App/Services/SnapshotArtifactService'

export enum ProcessOperation {
  FETCH = 1,
  PIN = 2,
  UNPIN = 3,
  SNAPSHOT = 4
}

export type ProcessArtifactPayload = {
  operations: ProcessOperation[];
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

        for(let operation of payload.operations) {
          switch(operation) {
            case ProcessOperation.FETCH:
              await opFetch(artifact);
              break;
            case ProcessOperation.PIN:
              await opPin(artifact);
              break;
            case ProcessOperation.UNPIN:
              await opUnpin(artifact);
              break;
            case ProcessOperation.SNAPSHOT:
              await opSnapshot(artifact);
              break;
          }
      }
    }

  }

  /**
   * This is an optional method that gets called if it exists when the retries has exceeded and is marked failed.
   */
  public async failed() {
    console.error('Job failed (retries reached)');
  }
}

async function opFetch(artifact: Artifact) {
  await fetchIPFS(artifact.metadataUri)
  await fetchIPFS(artifact.artifactUri)
}

async function opPin(artifact: Artifact) {
    // 1. pin the metadata
    const metadataPinned = await pinIPFS(artifact.metadataUri)

    // 2. pin the artifact payload
    const artifactPinned = await pinIPFS(artifact.artifactUri)
  
    artifact.isFetched = (metadataPinned && artifactPinned)
    artifact.isPinned = (metadataPinned && artifactPinned)
    await artifact.save()
}

function opUnpin(artifact: Artifact) {
  console.warn(`ProcessArtifact: opUnpin not implemented yet: `, artifact);
}

async function opSnapshot(artifact: Artifact) {
  console.log(`ProcessArtifact: snapshotting artifact ${artifact.artifactUri}`);

  const snapshotService = new SnapshotArtifactService()
  await snapshotService.snapshot(artifact, 'screenshot.png')

}


/**
 * Fetch an IPFS URI
 * @param uri The IPFS URI to fetch
 * @returns Whether the fetch operation was successful
 */
async function fetchIPFS(uri: string): Promise<boolean> {
  const ipfsHost = Env.get('IPFS_HOST')
  const ipfsPort = Env.get('IPFS_PORT')
  const timeout = 30000; // Set timeout duration in milliseconds (30000ms = 30 seconds)

  try {

    console.log(`Attempting to fetch IPFS URI: ${uri}`);

    // Remove "ipfs://" prefix and any URI attributes
    const cleanUri = uri.replace('ipfs://', '').split('?')[0];

    // Pin the content
    const pinResponse = await axios.post(`http://${ipfsHost}:${ipfsPort}/api/v0/get?arg=${cleanUri}`,
                                        null,
                                        { timeout });

    // If the fetch operation was not successful, return false
    if (pinResponse.status !== 200) {
      console.log(`Failed to fetch IPFS URI: ${cleanUri}`);
      return false;
    }

    console.log(`Successfully fetched IPFS URI: ${cleanUri}`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`Request timed out while fetching IPFS URI: ${uri}`);
    } else {
      console.error(`Error fetching IPFS URI: ${uri}`, error);
    }
    return false;
  }
}


/**
 * Pin an IPFS URI
 * @param uri The IPFS URI to pin
 * @returns Whether the pin operation was successful
 */
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