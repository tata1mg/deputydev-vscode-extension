import { WebSocket, RawData } from 'ws';
import { sendProgress } from '../../utilities/contextManager';
import { CLIENT_VERSION, CLIENT, WS_TIMEOUT } from '../../config';

export class WebSocketClient {
  private socket: WebSocket;
  private url: string;
  private responsePromise: Promise<any>;
  private resolveResponse!: (value: any) => void;
  private rejectResponse!: (reason: any) => void;
  private timeout: NodeJS.Timeout | null = null;
  private timeoutDuration: number = WS_TIMEOUT; // 30 minutes timeout

  constructor(baseUrl: string, endpoint: string, authToken: string) {
    this.url = `${baseUrl}${endpoint}`;
    this.socket = new WebSocket(this.url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'X-Client': CLIENT,
        'X-Client-Version': CLIENT_VERSION,
      },
    });

    // Create a promise that will be resolved when we get a response
    this.responsePromise = new Promise((resolve, reject) => {
      this.resolveResponse = resolve;
      this.rejectResponse = reject;
    });

    this.setupEventListeners();
    this.setupTimeout();
  }

  private setupEventListeners() {
    this.socket.on('open', () => {
      // console.log(`✅ Connected to WebSocket: ${this.url}`);
    });

    this.socket.on('message', (event: RawData) => {
      try {
        const messageData = JSON.parse(event.toString());
        //   console.log("Received WebSocket message:", messageData);
        // Check if the response is an array (relevant chunks)
        // Check if response has relevant_chunks key
        if (messageData.relevant_chunks && Array.isArray(messageData.relevant_chunks)) {
          this.resolveResponse(messageData);
          this.close();
        } else if (messageData.status === 'In Progress') {
          sendProgress({
            repo: messageData.repo_path as string,
            progress: messageData.progress as number,
            status: messageData.status as string,
          });
        }
        // Check if the response is an object (update vector store)
        else if (messageData.status === 'Completed') {
          sendProgress({
            repo: messageData.repo_path as string,
            progress: messageData.progress as number,
            status: messageData.status as string,
          });
          this.resolveResponse(messageData.status);
          this.close();
        } else if (messageData.status === 'Failed') {
          sendProgress({
            repo: messageData.repo_path as string,
            progress: messageData.progress as number,
            status: messageData.status as string,
          });
          this.rejectResponse(new Error('WebSocket request timed out'));
          this.close();
        } else {
          // console.warn("Received unknown message format:", messageData);
        }
      } catch (error) {
        // console.error("❌ Error parsing WebSocket message:", error);
        this.rejectResponse(error);
        this.close();
      }
    });

    this.socket.on('close', (code, reason) => {
      // console.log(`⚠️ WebSocket closed: ${this.url} (Code: ${code}, Reason: ${reason})`);
      // Only reject if we haven't resolved yet
      if (this.timeout !== null) {
        this.rejectResponse(new Error(`WebSocket closed unexpectedly: ${reason}`));
      }
    });
  }

  private setupTimeout() {
    this.timeout = setTimeout(() => {
      this.rejectResponse(new Error('WebSocket request timed out'));
      this.close();
    }, this.timeoutDuration);
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
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.socket.readyState !== WebSocket.CLOSED && this.socket.readyState !== WebSocket.CLOSING) {
      this.socket.close();
    }
  }
}
