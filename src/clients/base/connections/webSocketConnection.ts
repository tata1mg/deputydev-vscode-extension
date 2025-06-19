import { WebSocket, RawData } from 'ws';
import { CLIENT, CLIENT_VERSION } from '../../../config';

interface WebSocketConnectionOptions {
  baseUrl: string;
  endpoint: string;
  extraHeadersFetcher?: () => Promise<Record<string, string>>;
  onMessage?: (data: any) => Promise<void>;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
  onError?: (err: Error) => void;
  reconnectAttempts?: number;
  reconnectBackoffMs?: number;
  heartbeatIntervalMs?: number;
}

export class WebSocketConnection {
  private socket!: WebSocket;
  private readonly url: string;
  private readonly options: WebSocketConnectionOptions;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private connectionReady?: Promise<void>;
  private resolveConnectionReady!: () => void;
  private rejectConnectionReady!: (err: Error) => void;
  private isManuallyClosed = false;

  constructor(options: WebSocketConnectionOptions) {
    this.options = options;
    this.url = `${options.baseUrl}${options.endpoint}`;
  }

  async connect() {
    this.createConnectionPromise();
    await this.initSocket();
  }

  private createConnectionPromise() {
    this.connectionReady = new Promise<void>((resolve, reject) => {
      this.resolveConnectionReady = resolve;
      this.rejectConnectionReady = reject;
    });
  }

  private async initSocket() {
    let latestExtraHeaders = {};
    try {
      latestExtraHeaders = (await this.options.extraHeadersFetcher?.()) || {};
    } catch (error: any) {
      this.options.onError?.(error);
    }
    this.socket = new WebSocket(this.url, {
      headers: {
        'X-Client': CLIENT,
        'X-Client-Version': CLIENT_VERSION,
        ...(latestExtraHeaders || {}),
      },
    });

    this.socket.on('open', () => {
      this.resolveConnectionReady();
      this.options.onOpen?.();
      this.startHeartbeat();
    });

    this.socket.on('message', (event: RawData) => {
      try {
        const data = JSON.parse(event.toString());
        this.options.onMessage?.(data);
      } catch (err) {
        this.options.onError?.(new Error(`Failed to parse WebSocket message: ${err}`));
      }
    });

    this.socket.on('close', (code, reason) => {
      this.stopHeartbeat();
      this.rejectConnectionReady(new Error(`WebSocket closed: ${reason.toString()}`));
      this.options.onClose?.(code, reason.toString());
      this.createConnectionPromise();
      this.tryReconnect();
    });

    this.socket.on('error', (err) => {
      this.options.onError?.(err);
    });
  }
  private tryReconnect() {
    console.log('tryReconnect called');
    if (this.isManuallyClosed) {
      console.log('Reconnect aborted: connection was manually closed');
      return;
    }

    let currentReconnectAttempts = 0;

    const maxAttempts = this.options.reconnectAttempts ?? 5;
    console.log(`Current reconnectAttempts: ${currentReconnectAttempts}, maxAttempts: ${maxAttempts}`);
    if (currentReconnectAttempts >= maxAttempts) {
      console.log('Max reconnect attempts reached');
      this.rejectConnectionReady(new Error('Max reconnect attempts reached'));
      return;
    }

    const backoff = (this.options.reconnectBackoffMs ?? 1000) * Math.pow(2, currentReconnectAttempts++);
    console.log(`Reconnecting in ${backoff} ms (attempt ${currentReconnectAttempts})`);
    this.reconnectTimer = setTimeout(async () => {
      if (this.isManuallyClosed) {
        console.log('Reconnect aborted: connection was manually closed');
        return;
      }
      console.log('Attempting to reconnect...');
      this.createConnectionPromise();
      await this.initSocket();
    }, backoff);
  }

  private startHeartbeat() {
    const interval = this.options.heartbeatIntervalMs ?? 30000;
    this.heartbeatTimer = setInterval(() => {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.ping?.();
      }
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async send(data: object) {
    if (this.connectionReady === undefined) {
      await this.connect();
    }

    if (this.isManuallyClosed) {
      // log that websocket was manually closed
      // reconnect
      console.warn('WebSocket was manually closed, reconnecting...');
      this.isManuallyClosed = false;
      this.tryReconnect();
    }

    try {
      await this.connectionReady;
      this.socket.send(JSON.stringify(data));
    } catch (err) {
      throw new Error(`Failed to send message: ${err}`);
    }
  }

  close() {
    this.isManuallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
    this.rejectConnectionReady(new Error('WebSocket was manually closed'));
  }
}
