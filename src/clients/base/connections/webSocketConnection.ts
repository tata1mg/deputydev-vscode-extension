import { WebSocket, RawData } from 'ws';
import { CLIENT, CLIENT_VERSION } from '../../../config';

interface WebSocketConnectionOptions {
    baseUrl: string;
    endpoint: string;
    authToken: string;
    extraHeaders?: Record<string, string>;
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
    private reconnectAttempts = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;

    private connectionReady!: Promise<void>;
    private resolveConnectionReady!: () => void;
    private rejectConnectionReady!: (err: Error) => void;
    private isManuallyClosed = false;


    constructor(options: WebSocketConnectionOptions) {
        this.options = options;
        this.url = `${options.baseUrl}${options.endpoint}`;
        this.createConnectionPromise();
        this.initSocket();
    }

    private createConnectionPromise() {
        this.connectionReady = new Promise<void>((resolve, reject) => {
            this.resolveConnectionReady = resolve;
            this.rejectConnectionReady = reject;
        });
    }


    private initSocket() {
        this.socket = new WebSocket(this.url, {
            headers: {
                Authorization: `Bearer ${this.options.authToken}`,
                'X-Client': CLIENT,
                'X-Client-Version': CLIENT_VERSION,
                ...(this.options.extraHeaders || {}),
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
        if (this.isManuallyClosed) return;

        const maxAttempts = this.options.reconnectAttempts ?? 5;
        if (this.reconnectAttempts >= maxAttempts) {
            this.rejectConnectionReady(new Error('Max reconnect attempts reached'));
            return;
        }

        const backoff = (this.options.reconnectBackoffMs ?? 1000) * Math.pow(2, this.reconnectAttempts++);
        this.reconnectTimer = setTimeout(() => {
            this.createConnectionPromise();
            this.initSocket();
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
            throw new Error('Cannot send message: WebSocket is closed manually');
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
