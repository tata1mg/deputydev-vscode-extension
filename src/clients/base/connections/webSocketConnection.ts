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
  private isReconnecting = false;
  private currentReconnectAttempts = 0;

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
  private async tryReconnect() {
    if (this.isManuallyClosed || this.isReconnecting) return;

    this.isReconnecting = true;

    const maxAttempts = this.options.reconnectAttempts ?? 5;

    if (this.currentReconnectAttempts >= maxAttempts) {
      this.rejectConnectionReady(new Error('Max reconnect attempts reached'));
      this.isReconnecting = false;
      return;
    }

    const backoff = (this.options.reconnectBackoffMs ?? 1000) * Math.pow(2, this.currentReconnectAttempts++);

    this.reconnectTimer = setTimeout(async () => {
      if (this.isManuallyClosed) {
        this.isReconnecting = false;
        return;
      }

      try {
        this.createConnectionPromise();
        await this.initSocket();
        this.currentReconnectAttempts = 0;
      } catch (err) {
        console.error('Reconnect failed:', err);
        this.tryReconnect(); // next attempt
      } finally {
        this.isReconnecting = false;
      }
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
    if (this.isManuallyClosed) {
      console.warn('WebSocket was manually closed, reconnecting...');
      this.isManuallyClosed = false;
      await this.connect(); // ensure we await full connection before sending
    }

    if (!this.connectionReady) {
      await this.connect();
    }

    try {
      await this.connectionReady; // must be fresh
      if (this.socket.readyState !== WebSocket.OPEN) {
        throw new Error('Socket is not open');
      }
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
    this.currentReconnectAttempts = 0;
    this.rejectConnectionReady(new Error('WebSocket was manually closed'));
  }
}
