
// required for essential config fetching
export const CLIENT = "VSCODE_EXT";
export const CLIENT_VERSION = "0.0.1";
export const DD_HOST = "https://api.deputydev.ai";
export const DD_HOST_WS = "wss://cnkilg390a.execute-api.ap-south-1.amazonaws.com";
// export const DD_HOST = "http://localhost:8084";
// export const DD_HOST_WS = "ws://localhost:8084";


// from essential config
export const POLLING_MAX_ATTEMPTS = 10;
export const WS_TIMEOUT = 1800000;
export const DD_BROWSER_HOST = "https://deputydev.ai";


export const FIRST_PING_ATTEMPTS = 150;
export const MAX_PORT_ATTEMPTS = 20;


// local binary host
let BINARY_PORT: number | null = null;

export function setBinaryPort(port: number) {
  BINARY_PORT = port;
}

export function getBinaryPort(): number | null {
  return BINARY_PORT;
}



export function getBinaryHost(): string {
    const port = getBinaryPort();
    console.log(`this is the binary host of the exnetion`);
    console.log(`http://localhost:${port}`);
    return `http://localhost:${port}`;
  }

  export function getBinaryWsHost(): string {
    const port = getBinaryPort();
    return `ws://localhost:${port}`;
  }