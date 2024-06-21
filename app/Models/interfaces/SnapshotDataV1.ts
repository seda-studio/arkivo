
export interface IHttpRequest {
    method: string;
    type: string;
    protocol?: string;
    host?: string;
    path?: string;
    query?: string;
    fragment?: string;
    headers?: Record<string, string>;
    postData?: string | null;
}

export interface IHttpResponse {
    url: string;
    status: number;
    headers?: Record<string, string>;
    body: string;
}

export enum HttpType {
    REQUEST = 1,
    RESPONSE = 2
}

export interface IConsoleMessage {
    timestamp: number;
    level: string;
    text: string;
}

export interface INetworkData {
    type: HttpType;
    external: boolean;
    timestamp: number;
    data: IHttpRequest | IHttpResponse;
}

export interface ISnapshotDataV1 {
    version: 1;
    timestamp: number;
    net: INetworkData[];
    consoleMessages: IConsoleMessage[];
    screenshot: string; // base64
}