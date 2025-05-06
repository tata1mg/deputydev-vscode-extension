// required for essential config fetching
export const CLIENT = 'VSCODE_EXT';
export const CLIENT_VERSION = '2.7.0';
export const DD_HOST = 'https://api.deputydev.ai';
// export const DD_HOST = 'http://localhost:8084';

// move this to config based, please add these in config.json
export const WS_TIMEOUT = 1800000;

export const MAX_PORT_ATTEMPTS = 20;
export const DEFAULT_TERMINAL_TIMEOUT = 15_000;

export const BINARY_BG_PING_INTERVAL_MS = 1000;
// local binary host
let BINARY_PORT: number | null = null;

export function setBinaryPort(port: number) {
  BINARY_PORT = port;
}

export function getBinaryPort(): number | null {
  // return 8001;
  return BINARY_PORT;
}

export function getBinaryHost(): string {
  const port = getBinaryPort();
  return `http://127.0.0.1:${port}`;
}

export function getBinaryWsHost(): string {
  const port = getBinaryPort();
  return `ws://127.0.0.1:${port}`;
}
