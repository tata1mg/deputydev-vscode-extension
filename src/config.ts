
// required for essential config fetching
export const CLIENT = "VSCODE_EXT";
export const CLIENT_VERSION = "0.0.1";
export const DD_HOST = "http://localhost:8084";


// from essential config 
export const POLLING_MAX_ATTEMPTS = 10; 
export const WS_TIMEOUT = 1800000;



// local binary host

import { getExistingPort } from "./binaryUp/BinaryPort";
export function getBinaryHost(): string {
    const port = getExistingPort();
    return `http://localhost:${port}`;
  }
  
  export function getBinaryWsHost(): string {
    const port = getExistingPort();
    return `ws://localhost:${port}`;
  }