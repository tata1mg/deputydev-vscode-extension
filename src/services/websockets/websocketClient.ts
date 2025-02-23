import { WebSocket, RawData } from 'ws'; // ✅ Use `ws` for Node.js WebSocket support

const BASE_URL = "ws://localhost:9000";
import { API_ENDPOINTS } from "../api/endpoints";

//  WebSocket Client: Singleton class for persistent WebSocket connections.
class WebSocketClient {
    private socket!: WebSocket;
    private url: string;
    private eventListeners: { [key: string]: ((data: any) => void)[] } = {};
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private reconnectDelay: number = 5000; // Start with 5 sec delay

    constructor(baseUrl: string, endpoint: string) {
        this.url = `${baseUrl}${endpoint}`;
        this.connect();
    }

    private connect() {
        console.log(`🔄 Connecting to WebSocket: ${this.url}`);

        this.socket = new WebSocket(this.url);

        this.socket.on('open', () => {
            console.log(`✅ Connected to WebSocket: ${this.url}`);
            this.reconnectAttempts = 0; // Reset attempts after successful connection
        });

        this.socket.on('message', (event) => this.handleMessage(event));

        this.socket.on('error', (error) =>
            console.error("❌ WebSocket Error:", error)
        );

        this.socket.on('close', (code, reason) => {
            console.warn(`⚠️ WebSocket disconnected from ${this.url} (Code: ${code}, Reason: ${reason})`);
            this.reconnect();
        });
    }

    private reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("❌ Max reconnect attempts reached. Stopping reconnection.");
            return;
        }

        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff (max 30 sec)
        console.warn(`⚠️ Attempting reconnect in ${delay / 1000}s...`);

        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
            this.reattachEventListeners();
        }, delay);
    }

    send(data: object) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.warn("⚠️ WebSocket is not open yet. Cannot send message.");
        }
    }

    private handleMessage(event: RawData) {
        const messageData = JSON.parse(event.toString());
        if (this.eventListeners[messageData.type]) {
            this.eventListeners[messageData.type].forEach((callback) =>
                callback(messageData.payload)
            );
        }
    }

    addEventListener(eventType: string, callback: (data: any) => void) {
        if (!this.eventListeners[eventType]) {
            this.eventListeners[eventType] = [];
        }
        this.eventListeners[eventType].push(callback);
    }

    removeEventListener(eventType: string, callback: (data: any) => void) {
        this.eventListeners[eventType] =
            this.eventListeners[eventType]?.filter((cb) => cb !== callback) || [];
    }

    private reattachEventListeners() {
        Object.keys(this.eventListeners).forEach((eventType) => {
            this.eventListeners[eventType].forEach((callback) => {
                this.addEventListener(eventType, callback);
            });
        });
    }
}

// ✅ Use `ws`-based WebSocket instances
export const relevantChunksSocket = new WebSocketClient(
    BASE_URL,
    API_ENDPOINTS.RELEVANT_CHUNKS
);
export const updateVectorStoreSocket = new WebSocketClient(
    BASE_URL,
    API_ENDPOINTS.UPDATE_VECTOR_DB
);
