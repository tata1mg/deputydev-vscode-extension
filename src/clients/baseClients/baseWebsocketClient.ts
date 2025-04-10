import { WebSocket, RawData } from "ws";
import { CLIENT, CLIENT_VERSION } from "../../config";


export class BaseWebSocketClient {
  private socket: WebSocket;
  private url: string;
  private responsePromise: Promise<any>;
  private resolveResponse!: (value: any) => void;
  private rejectResponse!: (reason: any) => void;
  private timeout: NodeJS.Timeout | null = null;
  private timeoutDuration: number = 1800000; // 30 minutes timeout

  constructor(
    baseUrl: string,
    endpoint: string,
    authToken: string,
    messageHandler: (event: RawData) => "RESOLVE" | "REJECT" | "WAIT" | "REJECT_AND_RETRY",
    extraHeaders?: Record<string, string>
  ) {
    this.url = `${baseUrl}${endpoint}`;
    this.socket = new WebSocket(this.url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-Client": CLIENT,
        "X-Client-Version": CLIENT_VERSION,
        ...(extraHeaders || {}),
      },
    });

    // Create a promise that will be resolved when we get a response
    this.responsePromise = new Promise((resolve, reject) => {
      this.resolveResponse = resolve;
      this.rejectResponse = reject;
    });

    this.setupEventListeners(messageHandler);
    this.setupTimeout();
  }

  private setupEventListeners(
    messageHandler: (event: RawData) => "RESOLVE" | "REJECT" | "WAIT" | "REJECT_AND_RETRY"
  ) {
    this.socket.on("open", () => {
    });

    this.socket.on("message", async (event: RawData) => {
      try {
        const messageData = JSON.parse(event.toString());

        let messgaeHandlerResult = await messageHandler(event);
        if (messgaeHandlerResult === "RESOLVE") {
          this.resolveResponse(messageData);
          this.close();
        } else if (messgaeHandlerResult === "REJECT") {
          this.rejectResponse(new Error("Some error"));
          this.close();
        } else if (messgaeHandlerResult === "REJECT_AND_RETRY") {
          this.rejectResponse("RETRY_NEEDED");
          this.close();
        }
      } catch (error) {
        // console.error("❌ Error parsing WebSocket message:", error);
        this.rejectResponse(error);
        this.close();
      }
    });

    this.socket.on("close", (code, reason) => {
      // console.log("WebSocket closed with code:", code, "and reason:", reason);
      // Only reject if we haven't resolved yet
      if (this.timeout !== null) {
        this.rejectResponse(
          new Error(`WebSocket closed unexpectedly: ${reason}`)
        );
      }
    });
  }

  private setupTimeout() {
    this.timeout = setTimeout(() => {
      this.rejectResponse(new Error("WebSocket request timed out"));
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
          } else if (
            this.socket.readyState === WebSocket.CLOSED ||
            this.socket.readyState === WebSocket.CLOSING
          ) {
            reject(new Error("WebSocket closed before sending message"));
          } else {
            setTimeout(checkReadyState, 100);
          }
        };

        this.socket.on("open", () => resolve());
        this.socket.on("error", (error) => reject(error));

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

    if (
      this.socket.readyState !== WebSocket.CLOSED &&
      this.socket.readyState !== WebSocket.CLOSING
    ) {
      this.socket.close();
    }
  }
}
