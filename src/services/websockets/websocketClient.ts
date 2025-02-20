const BASE_URL = "ws://localhost:9000";
import { API_ENDPOINTS } from "../api/endpoints";

//  WebSocket Client: Singleton class for persistent WebSocket connections.

class WebSocketClient {
    private socket: WebSocket;
    private url: string;
    private eventListeners: { [key: string]: ((data: any) => void)[] } = {};

    constructor(baseUrl: string, endpoint: string) {
        this.url = `${baseUrl}${endpoint}`;
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () =>
            console.log(`✅ Connected to WebSocket: ${this.url}`);
        this.socket.onmessage = (event) => this.handleMessage(event);
        this.socket.onerror = (error) =>
            console.error("❌ WebSocket Error:", error);
        this.socket.onclose = () => this.reconnect(); // Auto-reconnect

        this.setupPing();
    }

    //  Ensures WebSocket stays alive with periodic pings.
    private setupPing() {
        setInterval(() => {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: "ping" }));
            }
        }, 30000); // Ping every 30 seconds
    }

    //  Reconnect WebSocket on unexpected disconnection.

    private reconnect() {
        console.warn(`⚠️ WebSocket disconnected: Reconnecting to ${this.url}...`);
        setTimeout(() => {
            this.socket = new WebSocket(this.url);
        }, 5000); // Reconnect after 5 seconds
    }

    // Sends data through WebSocket.

    send(data: object) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.warn("⚠️ WebSocket is not open yet.");
        }
    }

    //  Handles incoming messages.

    private handleMessage(event: MessageEvent) {
        const messageData = JSON.parse(event.data);
        if (this.eventListeners[messageData.type]) {
            this.eventListeners[messageData.type].forEach((callback) =>
                callback(messageData.payload)
            );
        }
    }

    //  Adds event listeners for messages.

    addEventListener(eventType: string, callback: (data: any) => void) {
        if (!this.eventListeners[eventType]) {
            this.eventListeners[eventType] = [];
        }
        this.eventListeners[eventType].push(callback);
    }

    //  Removes event listeners.

    removeEventListener(eventType: string, callback: (data: any) => void) {
        this.eventListeners[eventType] =
            this.eventListeners[eventType]?.filter((cb) => cb !== callback) || [];
    }
}

// Persistent WebSocket instances
export const relevantChunksSocket = new WebSocketClient(
    BASE_URL,
    API_ENDPOINTS.RELEVANT_CHUNKS
);
export const updateVectorStoreSocket = new WebSocketClient(
    BASE_URL,
    API_ENDPOINTS.UPDATE_VECTOR_DB
);
