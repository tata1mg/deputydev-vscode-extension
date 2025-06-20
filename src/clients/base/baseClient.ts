import { EventEmitter } from 'events';
import { WebSocketConnection } from './connections/webSocketConnection';
import { BaseHandlerMiddleware } from './baseHandlerMiddleware';

export class BaseHttpEndpoint {
  constructor(
    httpHost: string,
    endpoint: string,
    method: string,
    extraHeadersFetcher?: () => Promise<Record<string, string>>,
    messageHandlers: Array<(response: any) => Promise<void>> = [],
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
    wsHost: string,
    endpoint: string,
    extraHeadersFetcher?: () => Promise<Record<string, string>>,
    messageHandlers: Array<(data: any) => Promise<void>> = [],
  ) {
    // initialize the websocket connection
    this.defaultMessageHandlers = messageHandlers;
    this.webSocketConnection = new WebSocketConnection({
      baseUrl: wsHost,
      endpoint: endpoint,
      extraHeadersFetcher: extraHeadersFetcher,
      onMessage: async (data) => {
        console.log('Received message in baseClient:', data);
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
    console.log('Emitting message event with data:', data);
    this.onMessage.emit('message', data);
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
  private readonly defaultHandlerMiddlewares!: Array<BaseHandlerMiddleware>;
  private readonly extraHeadersFetcher?: () => Promise<Record<string, string>>;

  constructor(
    httpHost?: string,
    wsHost?: string,
    extraHeadersFetcher?: () => Promise<Record<string, string>>,
    defaultHandlerMiddlewares: Array<BaseHandlerMiddleware> = [],
  ) {
    this.httpHost = httpHost?.endsWith('/') ? httpHost.slice(0, -1) : httpHost;
    this.wsHost = wsHost?.endsWith('/') ? wsHost.slice(0, -1) : wsHost;
    this.defaultHandlerMiddlewares = defaultHandlerMiddlewares;
    this.extraHeadersFetcher = extraHeadersFetcher;
  }

  createHttpEndpoint(
    endpoint: string,
    method: string,
    extraHeadersFetcher?: () => Promise<Record<string, string>>,
    handlerMiddlewares: Array<BaseHandlerMiddleware> = [],
  ): BaseHttpEndpoint {
    if (!this.httpHost) {
      throw new Error('HTTP host is not defined');
    }

    const httpResponseHandlers = [...this.defaultHandlerMiddlewares, ...handlerMiddlewares].map((middleware) => {
      return async (data: any) => {
        await middleware.handleHttpResponse(data);
      };
    });
    return new BaseHttpEndpoint(this.httpHost, endpoint, method, extraHeadersFetcher, httpResponseHandlers);
  }

  createWebsocketEndpoint(
    endpoint: string,
    extraHeadersFetcher?: () => Promise<Record<string, string>>,
    handlerMiddlewares: Array<BaseHandlerMiddleware> = [],
  ): BaseWebsocketEndpoint {
    if (!this.wsHost) {
      throw new Error('WebSocket host is not defined');
    }

    // get a new function thhat fetches and combines extra headers
    const combinedExtraHeadersFetcher = async () => {
      const headers = this.extraHeadersFetcher ? await this.extraHeadersFetcher() : {};
      const extraHeaders = extraHeadersFetcher ? await extraHeadersFetcher() : {};
      return { ...headers, ...extraHeaders };
    };

    // create list of websocket handlers
    const websocketHandlers = [...this.defaultHandlerMiddlewares, ...handlerMiddlewares].map((middleware) => {
      return async (data: any) => {
        await middleware.handleWsMessage(data);
      };
    });

    return new BaseWebsocketEndpoint(this.wsHost, endpoint, combinedExtraHeadersFetcher, [...websocketHandlers]);
  }
}
