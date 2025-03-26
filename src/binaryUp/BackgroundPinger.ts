import { API_ENDPOINTS } from '../services/api/endpoints';
import { ServerManager } from './ServerManager'; // Adjust path as needed
import * as vscode from 'vscode';
import { binaryApi } from '../services/api/axios';
import { BINARY_BG_PING_INTERVAL_MS } from '../config';
import { SidebarProvider } from '../panels/SidebarProvider';
import { ConfigManager } from '../utilities/ConfigManager';
import { Logger } from '../utilities/Logger';
export class BackgroundPinger {
    private sideBarProvider: SidebarProvider;
    private serverManager: ServerManager;
    private outputChannel: vscode.OutputChannel;
    private logger: Logger;
    private configManager: ConfigManager;
    private interval: NodeJS.Timeout | null = null;
    private failureCount: number = 0;

    constructor(sideBarProvider: SidebarProvider ,serverManager: ServerManager, outputChannel: vscode.OutputChannel, logger:Logger, configManager: ConfigManager) {
        this.sideBarProvider = sideBarProvider;
        this.serverManager = serverManager;
        this.outputChannel = outputChannel;
        this.logger = logger;
        this.configManager = configManager;
    }

    public start(): void {
        if (this.interval) {
            this.outputChannel.appendLine('🟡 Background pinger already running.');
            return;
        }

        this.outputChannel.appendLine('🔁 Starting background server pinger...');
        const BINARI_MAX_FAILURES = this.configManager.getAllConfigEssentials()["BINARY"]["max_alive_retry"]

        this.interval = setInterval(async () => {
            try {
                const response = await binaryApi().get(API_ENDPOINTS.PING);
                if (response.status === 200) {
                    // this.outputChannel.appendLine('✅ Ping successful.');
                    this.failureCount = 0;
                    return;
                }
            } catch (err) {
                this.failureCount++;
                this.logger.warn(`Ping failed (${this.failureCount}/${BINARI_MAX_FAILURES}).`);
                this.outputChannel.appendLine(`⚠️ Ping failed (${this.failureCount}/${BINARI_MAX_FAILURES}).`);
            }

            if (this.failureCount >= BINARI_MAX_FAILURES) {
                this.logger.error('Too many ping failures. Restarting server...');
                this.outputChannel.appendLine('❌ Too many ping failures. Restarting server...');
                this.failureCount = 0;
                this.sideBarProvider.setViewType("loader");
                await this.serverManager.ensureBinaryExists();
                const server_status =  await this.serverManager.startServer();
                if(server_status){
                    await this.sideBarProvider.initiateBinary();
                    this.sideBarProvider.setViewType("chat");

                }else{
                    this.sideBarProvider.setViewType("error");
                }
            }
        }, BINARY_BG_PING_INTERVAL_MS);
    }

    public stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.outputChannel.appendLine('🛑 Background pinger stopped.');
        }
    }
}
