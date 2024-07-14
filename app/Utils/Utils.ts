
import Env from '@ioc:Adonis/Core/Env'
import Logger from '@ioc:Adonis/Core/Logger'

const IPFS_GATEWAY = Env.get('IPFS_GATEWAY')

export function truncAddress(address: string) {

    return address.slice(0, 6) + "..." + address.slice(-4)
}


export function stripProtocolFromUri(uri: string) : string {
    let cleanUri = uri;
    cleanUri.replace('ipfs://', '').split('?')[0];
    return cleanUri;
}

// This function is used to get a working URI, using an actual host suitable for the protocol
export function getWorkingUri(uri: string) : string {

    // extract the initial text before "://"
    const uriParts = uri.split('://');
    const protocol = uriParts[0];
    const path = uriParts[1];

    Logger.debug('Protocol: ' + protocol);
    Logger.debug('Path: ' + path);


    switch (protocol) {
        case 'ipfs':
            return IPFS_GATEWAY + "/" + path;
        default:
            Logger.warn('Unknown protocol: ' + protocol);
            return uri;
    }
    
}