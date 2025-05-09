import { WebSocket, RawData } from 'ws';
import { CLIENT, CLIENT_VERSION } from '../../config';

type MessageHandler = (event: RawData) => 'RESOLVE' | 'REJECT' | 'WAIT' | 'REJECT_AND_RETRY';

export class BaseWebSocketClient {
  private static connections: Map<string, WebSocket> = new Map();
  private socket: WebSocket;
  private url: string;
  private responsePromise: Promise<any>;
  private resolveResponse!: (value: any) => void;
  private rejectResponse!: (reason: any) => void;
  private currentMessageHandler: MessageHandler | null = null;
  private messageListener: ((event: RawData) => void) | null = null;

  constructor(
    baseUrl: string,
    endpoint: string,
    authToken: string,
    messageHandler: MessageHandler,
    extraHeaders?: Record<string, string>,
  ) {
    this.url = `${baseUrl}${endpoint}`;
    this.responsePromise = new Promise((resolve, reject) => {
      this.resolveResponse = resolve;
      this.rejectResponse = reject;
    });

    const existingSocket = BaseWebSocketClient.connections.get(this.url);
    // console.log("*******existing socket ***********", existingSocket)
    // console.log("*******existing socket ready state ***********", existingSocket?.readyState)

    if (existingSocket && existingSocket.readyState === WebSocket.OPEN) {
      // console.log("reusing the same websocket connection");
      this.socket = existingSocket;
    } else {
      // console.log("using new connection");
      this.socket = new WebSocket(this.url, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Client': CLIENT,
          'X-Client-Version': CLIENT_VERSION,
          ...(extraHeaders || {}),
        },
      });

      BaseWebSocketClient.connections.set(this.url, this.socket);
    }

    this.setupEventListeners(messageHandler);
  }

  private setupEventListeners(messageHandler: MessageHandler) {
    this.currentMessageHandler = messageHandler;

    // Store the listener function
    this.messageListener = (event: RawData) => {
      try {
        const messageData = JSON.parse(event.toString());
        const result = this.currentMessageHandler!(event);

        if (result === 'RESOLVE') {
          this.resolveResponse(messageData);
        } else if (result === 'REJECT') {
          this.rejectResponse(new Error('Some error'));
        } else if (result === 'REJECT_AND_RETRY') {
          this.rejectResponse('RETRY_NEEDED');
        }
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
        this.rejectResponse(error);
        this.close();
      }
    };

    this.socket.on('message', this.messageListener);

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.close();
    });

    this.socket.on('close', () => {
      console.log('WebSocket connection closed');
      this.close();
    });
  }

  updateMessageHandler(messageHandler: MessageHandler) {
    this.currentMessageHandler = messageHandler;
    // Remove existing message listener and add new one
    if (this.messageListener) {
      this.socket.removeListener('message', this.messageListener);
    }
    this.setupEventListeners(messageHandler);
  }

  async send(data: object): Promise<any> {
    // Wait for the socket to be ready
    if (this.socket.readyState !== WebSocket.OPEN) {
      await new Promise<void>((resolve, reject) => {
        const checkReadyState = () => {
          if (this.socket.readyState === WebSocket.OPEN) {
            resolve();
          } else if (this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
            reject(new Error('WebSocket closed before sending message'));
          } else {
            setTimeout(checkReadyState, 100);
          }
        };

        this.socket.on('open', () => resolve());
        this.socket.on('error', (error) => reject(error));

        // Check immediately in case it's already open
        checkReadyState();
      });
    }

    // Send the data
    this.socket.send(JSON.stringify(data));

    // Return the promise that will resolve when we get a response
    return this.responsePromise;
  }

  close() {
    if (this.socket.readyState !== WebSocket.CLOSED && this.socket.readyState !== WebSocket.CLOSING) {
      this.socket.close();
      BaseWebSocketClient.connections.delete(this.url);
    }
  }
}
