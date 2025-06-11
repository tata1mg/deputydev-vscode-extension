import { API_ENDPOINTS } from '../services/api/endpoints';
import { ServerManager } from './ServerManager'; // Adjust path as needed
import * as vscode from 'vscode';
import { binaryApi } from '../services/api/axios';
import { BINARY_BG_PING_INTERVAL_MS } from '../config';
import { SidebarProvider } from '../panels/SidebarProvider';
import { ConfigManager } from '../utilities/ConfigManager';
import { Logger } from '../utilities/Logger';

export class BackgroundPinger implements vscode.Disposable {
  private context: vscode.ExtensionContext;
  private sideBarProvider: SidebarProvider;
  private serverManager: ServerManager;
  private outputChannel: vscode.OutputChannel;
  private logger: Logger;
  private configManager: ConfigManager;
  private interval: NodeJS.Timeout | null = null;
  private failureCount: number = 0;
  private inProgress = false;

  constructor(
    context: vscode.ExtensionContext,
    sideBarProvider: SidebarProvider,
    serverManager: ServerManager,
    outputChannel: vscode.OutputChannel,
    logger: Logger,
    configManager: ConfigManager,
  ) {
    this.context = context;
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
    const BINARI_MAX_FAILURES = this.configManager.getAllConfigEssentials()['BINARY']['max_alive_retry'];

    this.interval = setInterval(async () => {
      if (this.inProgress) {
        return;
      }
      this.inProgress = true;

      try {
        const response = await binaryApi().get(API_ENDPOINTS.PING);
        if (response.status === 200) {
          // this.outputChannel.appendLine('✅ Ping successful.');
          this.failureCount = 0;
          return;
        } else {
          // Treat any non-200 as failure
          throw new Error(`Ping returned unexpected status ${response.status}`);
        }
      } catch (err) {
        this.failureCount++;
        this.logger.warn(`Ping failed (${this.failureCount}/${BINARI_MAX_FAILURES}).`);
        this.outputChannel.appendLine(`⚠️ Ping failed (${this.failureCount}/${BINARI_MAX_FAILURES}).`);
      } finally {
        this.inProgress = false;
      }

      if (this.failureCount >= BINARI_MAX_FAILURES) {
        this.logger.error('Too many ping failures. Restarting server...');
        this.outputChannel.appendLine('❌ Too many ping failures. Restarting server...');
        this.failureCount = 0;
        // fetch latest config
        this.sideBarProvider.setViewType('loader');
        this.stop();
        await this.configManager.fetchAndStoreConfigEssentials();
        await this.serverManager.ensureBinaryExists();
        const serverStatus = await this.serverManager.startServer();
        if (serverStatus) {
          const isAuthenticated = this.context.workspaceState.get('isAuthenticated');
          if (isAuthenticated) {
            try {
              await this.sideBarProvider.initiateBinary();
              this.sideBarProvider.setViewType('chat'); //TODO: return to last view type
            } catch (error) {
              this.logger.error('Error initiating binary:', error);
              this.outputChannel.appendLine('❌ Error initiating binary.');
              this.sideBarProvider.setViewType('auth');
            }
          } else {
            this.sideBarProvider.setViewType('auth');
          }
        } else {
          this.sideBarProvider.setViewType('error');
        }
        this.start();
        this.logger.info('Background server pinger restarted.');
        this.outputChannel.appendLine('🔁 Background server pinger restarted.');
      }
    }, BINARY_BG_PING_INTERVAL_MS);
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.logger.info('Background pinger stopped.');
      this.outputChannel.appendLine('🛑 Background pinger stopped.');
    }
  }

  public dispose(): void {
    this.stop();
  }
}
