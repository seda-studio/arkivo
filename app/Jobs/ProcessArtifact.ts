import type { JobHandlerContract, Job } from '@ioc:Rlanz/Queue'
import Env from '@ioc:Adonis/Core/Env'
import Artifact from 'App/Models/Artifact'
import axios from 'axios'
import SnapshotArtifactService from 'App/Services/SnapshotArtifactService'
import { Queue } from '@ioc:Rlanz/Queue';

const QUEUE_SNAPSHOT = Env.get('QUEUE_NAME_SNAPSHOT')

const MAX_SNAPSHOT_HANDLES_BEFORE_EXIT = 5;

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
  params?: { [key: string]: any }
}

export default class ProcessArtifact implements JobHandlerContract {

  static snapshotHandleCount = 0;

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

        // if there are multiple operations along with a snapshot, we need to re-queue the snapshot operation at the end of processing
        // this ensures fast processing of other batch operations, keeping snapshot operation in its own (slower) queue
        // Importantly, snapshots are only queued after all other operations in a job are completed, because the snapshot may require
        // ops like fetching to be completed first.
        let requeueSnapshot = false;
        if(payload.operations.length > 1 && payload.operations.includes(ProcessOperation.SNAPSHOT)) {
          requeueSnapshot = true;
          // remove the snapshot op from the list
          let snapshotIndex = payload.operations.indexOf(ProcessOperation.SNAPSHOT);
          payload.operations.splice(snapshotIndex, 1);
        }


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
              ProcessArtifact.snapshotHandleCount++;
              await opSnapshot(artifact, payload.params);

              if (ProcessArtifact.snapshotHandleCount >= MAX_SNAPSHOT_HANDLES_BEFORE_EXIT) {
                console.log('Snapshot Handle function called ' + MAX_SNAPSHOT_HANDLES_BEFORE_EXIT + ' times. Exiting...');
                process.exit();
              }

              break;
          }
      }

      if(requeueSnapshot) {
        const snapshotPayload: ProcessArtifactPayload = {
          operations: [ProcessOperation.SNAPSHOT],
          chain: artifact.chain,
          contractAddress: artifact.contractAddress,
          tokenId: artifact.tokenId
        }

        await Queue.dispatch('App/Jobs/ProcessArtifact', snapshotPayload, {queueName: QUEUE_SNAPSHOT});
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

    // 3. retrieve artifact size
    const artifact_size = await getIPFSFileSize(artifact.artifactUri)
  
    artifact.isFetched = (metadataPinned && artifactPinned)
    artifact.isPinned = (metadataPinned && artifactPinned)
    artifact.artifactSize = artifact_size

    await artifact.save()
}

function opUnpin(artifact: Artifact) {
  console.warn(`ProcessArtifact: opUnpin not implemented yet: `, artifact);
}

async function opSnapshot(artifact: Artifact, params: { [key: string]: any } = {}) {

  const dryRun = params && params.dryRun ? params.dryRun : false;
  
  if (dryRun) {
    console.log(`ProcessArtifact: DRY-RUN snapshotting artifact ${artifact.artifactUri}`);
  } else {
    console.log(`ProcessArtifact: snapshotting artifact ${artifact.artifactUri}`);
  }

  const snapshotService = new SnapshotArtifactService()
  await snapshotService.snapshot(artifact, dryRun)

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


/**
 * Get the size of an IPFS file
 * @param uri The IPFS URI of the file
 * @returns The size of the file in bytes
 */
async function getIPFSFileSize(uri: string): Promise<number> {
  const ipfsHost = Env.get('IPFS_HOST')
  const ipfsPort = Env.get('IPFS_PORT')
  const timeout = 30000; // Set timeout duration in milliseconds (30000ms = 30 seconds)

  try {

    console.log(`Attempting to get size of IPFS file: ${uri}`);

    // Remove "ipfs://" prefix and any URI attributes
    const cleanUri = uri.replace('ipfs://', '').split('?')[0];

    // Get the file size
    const sizeResponse = await axios.post(`http://${ipfsHost}:${ipfsPort}/api/v0/files/stat?arg=/ipfs/${cleanUri}`,
                                        { timeout });

    // If the size operation was not successful, return -1
    if (sizeResponse.status !== 200 || !sizeResponse.data || !sizeResponse.data.CumulativeSize) {
      console.log(`Failed to get size of IPFS file: ${cleanUri}`);
      return -1;
    }

    console.log(`Successfully got size of IPFS file: ${cleanUri} - ${sizeResponse.data.CumulativeSize} bytes`);
    return sizeResponse.data.CumulativeSize;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error(`Request timed out while getting size of IPFS file: ${uri}`);
    } else {
      console.error(`Error getting size of IPFS file: ${uri}`, error);
    }
    return -1;
  }
}