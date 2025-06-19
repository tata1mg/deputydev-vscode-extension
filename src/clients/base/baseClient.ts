import { EventEmitter } from 'events';
import { WebSocketConnection } from './connections/webSocketConnection';

export class BaseHttpEndpoint {
  constructor(
    public httpHost: string,
    public endpoint: string,
    public method: string,
    public defaultExtraHeaders: Record<string, string>,
  ) {}
}

export class BaseWebsocketEndpoint {
  webSocketConnection: WebSocketConnection;

  onMessage = new EventEmitter();
  onOpen = new EventEmitter();
  onClose = new EventEmitter();
  onError = new EventEmitter();

  defaultMessageHandlers: Array<(data: any) => Promise<void>> = [];

  constructor(
    public wsHost: string,
    public endpoint: string,
    public defaultExtraHeaders: Record<string, string>,
    messageHandlers: Array<(data: any) => Promise<void>> = [],
  ) {
    // initialize the websocket connection
    this.defaultMessageHandlers = messageHandlers;
    this.webSocketConnection = new WebSocketConnection({
      baseUrl: wsHost,
      endpoint: endpoint,
      authToken: '',
      extraHeaders: defaultExtraHeaders,
      onMessage: async (data) => {
        await this.handleMessageForDefaultHandlersAndEmit(data);
      },
      onOpen: () => {
        this.onOpen.emit('open');
      },
      onClose: (code, reason) => {
        this.onClose.emit('close', { code, reason });
      },
      onError: (err) => {
        this.onError.emit('error', err);
      },
      reconnectAttempts: 5,
      reconnectBackoffMs: 1000,
      heartbeatIntervalMs: 3000,
    });
  }

  async handleMessageForDefaultHandlersAndEmit(data: any): Promise<void> {
    await Promise.all(this.defaultMessageHandlers.map((handler) => handler(data)));
    // Emit 'message' event asynchronously
    setImmediate(() => {
      this.onMessage.emit('message', data);
    });
  }

  close(): void {
    if (this.webSocketConnection) {
      this.webSocketConnection.close();
    }
  }

  async sendMessageWithRetry(message: any, retryCount: number = 3, retryDelayMs: number = 1000): Promise<void> {
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        await this.webSocketConnection.send(message);
        return;
      } catch (error) {
        if (attempt < retryCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        } else {
          throw error;
        }
      }
    }
  }
}

export class BaseClient {
  private readonly httpHost?: string;
  private readonly wsHost?: string;
  private readonly defaultWebsocketMessageHandlers!: Array<(data: any) => Promise<void>>;

  constructor(
    httpHost?: string,
    wsHost?: string,
    defaultWebsocketMessageHandlers: Array<(data: any) => Promise<void>> = [],
  ) {
    this.httpHost = httpHost?.endsWith('/') ? httpHost.slice(0, -1) : httpHost;
    this.wsHost = wsHost?.endsWith('/') ? wsHost.slice(0, -1) : wsHost;
    this.defaultWebsocketMessageHandlers = defaultWebsocketMessageHandlers;
  }

  createHttpEndpoint(endpoint: string, method: string, defaultExtraHeaders: Record<string, string>): BaseHttpEndpoint {
    if (!this.httpHost) {
      throw new Error('HTTP host is not defined');
    }
    return new BaseHttpEndpoint(this.httpHost, endpoint, method, defaultExtraHeaders);
  }

  createWebsocketEndpoint(
    endpoint: string,
    defaultExtraHeaders: Record<string, string> = {},
    messageHandlers: Array<(data: any) => Promise<void>> = [],
  ): BaseWebsocketEndpoint {
    if (!this.wsHost) {
      throw new Error('WebSocket host is not defined');
    }
    return new BaseWebsocketEndpoint(this.wsHost, endpoint, defaultExtraHeaders, [
      ...messageHandlers,
      ...this.defaultWebsocketMessageHandlers,
    ]);
  }
}
