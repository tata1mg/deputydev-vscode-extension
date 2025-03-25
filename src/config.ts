// required for essential config fetching
export const CLIENT = "VSCODE_EXT";
export const CLIENT_VERSION = "0.0.1";
export const DD_HOST = "https://api.deputydev.ai";
export const DD_HOST_WS = "wss://cnkilg390a.execute-api.ap-south-1.amazonaws.com";
// export const DD_HOST = "http://localhost:8084";
// export const DD_HOST_WS = "ws://localhost:8084";


// move this to config based, please add these in config.json
export const POLLING_MAX_ATTEMPTS = 10;
export const WS_TIMEOUT = 1800000;


export const MAX_PORT_ATTEMPTS = 20;
export const RUDDERSTACK_WRITE_KEY = "123"; // this is a dummy key
export const RUDDERSTACK_URL = "https://rudderapi.1mg.com/v1/track";

export const BINARY_BG_PING_INTERVAL_MS = 5000;
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

let MainConfig: object | {} = {};
let EssentialConfig: object | {} = {};


export function setMainConfig(config: any) {
  MainConfig = config;
}

export function setEssentialConfig(config: any) {
  EssentialConfig = config;
}


export function getMainConfig(): any {
  return MainConfig;
}

export function getEssentialConfig(): any {
  return EssentialConfig;
}

