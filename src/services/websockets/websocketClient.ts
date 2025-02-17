import { API_ENDPOINTS } from "../api/endpoints";

const BASE_URL = 'ws://localhost:8000';


class WebSocketClient {
    private socket: WebSocket;
    private url: string;

    constructor(baseUrl: string, endpoint: string) {
        this.url = `${baseUrl}${endpoint}`;
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => console.log(`Connected to WebSocket: ${this.url}`);
        this.socket.onmessage = (event) => console.log(`Received: ${event.data}`);
        this.socket.onerror = (error) => console.error("WebSocket Error:", error);
        this.socket.onclose = () => console.log("WebSocket disconnected");
    }

    send(data: object) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        } else {
            console.warn("WebSocket is not open yet.");
        }
    }

    close() {
        this.socket.close();
    }
}

// Initialize WebSocket connections
export const relevantChunksSocket = new WebSocketClient(BASE_URL , API_ENDPOINTS.RELEVANTCHUNKS);
export const updateVectorStoreSocket = new WebSocketClient(BASE_URL , API_ENDPOINTS.UPDATEVECTORDB);