import { API_ENDPOINTS } from '../services/api/endpoints';
import { ServerManager } from './ServerManager'; // Adjust path as needed
import * as vscode from 'vscode';
import { binaryApi } from '../services/api/axios';
import { BINARY_BG_PING_INTERVAL_MS, getBinaryHost, getBinaryWsHost } from '../config';
import { SidebarProvider } from '../panels/SidebarProvider';
import { ConfigManager } from '../utilities/ConfigManager';
import { Logger } from '../utilities/Logger';
import { AuthenticationManager } from '../auth/AuthenticationManager';
import { IndexingService } from '../services/indexing/indexingService';
import { RelevantCodeSearcherToolService } from '../services/tools/relevantCodeSearcherTool/relevantCodeSearcherToolServivce';
import { BinaryClient } from '../clients/binaryClient';
import { sendNotVerified, sendVerified } from '../utilities/contextManager';

export class BackgroundPinger implements vscode.Disposable {
  private context: vscode.ExtensionContext;
  private sideBarProvider: SidebarProvider;
  private serverManager: ServerManager;
  private outputChannel: vscode.LogOutputChannel;
  private logger: Logger;
  private configManager: ConfigManager;
  private indexingService: IndexingService;
  private relevantCodeSearcherToolService: RelevantCodeSearcherToolService;
  private authenticationManager: AuthenticationManager;
  private interval: NodeJS.Timeout | null = null;
  private failureCount: number = 0;
  private inProgress = false;

  constructor(
    context: vscode.ExtensionContext,
    sideBarProvider: SidebarProvider,
    serverManager: ServerManager,
    outputChannel: vscode.LogOutputChannel,
    logger: Logger,
    configManager: ConfigManager,
    authenticationManager: AuthenticationManager,
    indexingService: IndexingService,
    relevantCodeSearcherToolService: RelevantCodeSearcherToolService,
  ) {
    this.context = context;
    this.sideBarProvider = sideBarProvider;
    this.serverManager = serverManager;
    this.outputChannel = outputChannel;
    this.logger = logger;
    this.configManager = configManager;
    this.authenticationManager = authenticationManager;
    this.indexingService = indexingService;
    this.relevantCodeSearcherToolService = relevantCodeSearcherToolService;
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
          // Successful ping, reset failure count
          this.failureCount = 0;
          this.inProgress = false;
          return; // early return
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

        this.sideBarProvider.setViewType('loader');
        this.stop();

        try {
          await this.configManager.fetchAndStoreConfigEssentials();
          await this.serverManager.ensureBinaryExists();
          const serverStatus = await this.serverManager.startServer();

          if (serverStatus) {
            const binaryClient = new BinaryClient(getBinaryHost(), getBinaryWsHost());

            this.indexingService.init(binaryClient);
            this.relevantCodeSearcherToolService.init(binaryClient);

            try {
              const status = await this.authenticationManager.validateCurrentSession();
              this.outputChannel.info(`Authentication result: ${status}`);

              if (status) {
                await this.configManager.fetchAndStoreConfig();
                this.sideBarProvider.initiateBinary();
                sendVerified();
                this.logger.info('User is authenticated.');
              } else {
                this.logger.info('User is not authenticated.');
                sendNotVerified();
              }
            } catch (error) {
              this.logger.error('Authentication failed, Please try again');
              this.outputChannel.error(`Authentication failed: ${error}`);
              sendNotVerified();
            }
          }
        } catch (error) {
          this.logger.error(`Error during server restart: ${error}`);
          this.outputChannel.appendLine(`❌ Error during server restart: ${error}`);
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
