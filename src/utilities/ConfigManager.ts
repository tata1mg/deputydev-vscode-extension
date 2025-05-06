import * as vscode from 'vscode';
import { api } from '../services/api/axios';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { AuthService } from '../services/auth/AuthService';
import { refreshCurrentToken } from '../services/refreshToken/refreshCurrentToken';
import { CLIENT } from '../config';
import * as os from 'os';
import { setEssentialConfig, setMainConfig } from '../config/configSetGet';
import { Logger } from './Logger';

export class ConfigManager {
  private context: vscode.ExtensionContext;
  private readonly CONFIG_ESSENTIALS_KEY = 'essentialConfigData';
  private readonly CONFIG_KEY = 'configData';
  private configEssentials: any = {};
  private configData: any = {};
  private logger: Logger;
  private outputChannel: vscode.LogOutputChannel;

  private _onDidUpdateConfig = new vscode.EventEmitter<void>();
  public readonly onDidUpdateConfig = this._onDidUpdateConfig.event;

  constructor(context: vscode.ExtensionContext, logger: Logger, outputChannel: vscode.LogOutputChannel) {
    this.context = context;
    this.logger = logger;
    this.outputChannel = outputChannel;
  }

  /**
   * Returns mapped OS and architecture values expected by the backend.
   */

  /**
   * Fetches and stores the essential config data in workspace state and constant.
   */
  public async fetchAndStoreConfigEssentials(): Promise<void> {
    try {
      const Os = os.platform();
      const Arch = os.arch();

      const response = await api.get(API_ENDPOINTS.CONFIG_ESSENTIALS, {
        params: {
          consumer: CLIENT,
          os: Os,
          arch: Arch,
        },
      });
      // this.outputChannel.info(`CONFIG_ESSENTIALS response: ${JSON.stringify(response.data)}`);
      if (response.data && response.data.is_success) {
        this.configEssentials = response.data.data;
        this.context.workspaceState.update(this.CONFIG_ESSENTIALS_KEY, this.configEssentials);
        setEssentialConfig(this.configEssentials);
        this.logger.info(`Fetched essential config`);
        this.outputChannel.info('CONFIG_ESSENTIALS successfully stored.');
      } else {
        // this.outputChannel.error("Failed to fetch CONFIG_ESSENTIALS: Invalid response format.");
      }
    } catch (error) {
      this.logger.error(`Error fetching configs`);
      // this.outputChannel.error(`Error fetching CONFIG_ESSENTIALS: ${error}`);
    }
  }

  /**
   * Fetches and stores the general config data in workspace state and constant.
   */
  public async fetchAndStoreConfig(): Promise<void> {
    try {
      const Os = os.platform();
      const Arch = os.arch();

      const authService = new AuthService();
      const auth_token = await authService.loadAuthToken();
      const headers = {
        Authorization: `Bearer ${auth_token}`,
      };
      // const response = await api.get(API_ENDPOINTS.CONFIG, { params: {consumer: CLIENT}, headers });
      const response = await api.get(API_ENDPOINTS.CONFIG, {
        params: {
          consumer: CLIENT,
          os: Os,
          arch: Arch,
        },
        headers,
      });
      if (response.data && response.data.is_success) {
        refreshCurrentToken(response.headers);
        this.configData = response.data.data;
        this.context.workspaceState.update(this.CONFIG_KEY, this.configData);
        setMainConfig(this.configData);
        this.logger.deleteLogsOlderThan(this.configData['VSCODE_LOGS_RETENTION_DAYS']);
        this.logger.info(`fetched main config`);
        // this.outputChannel.appendLine(`main CONFIG fetched: ${JSON.stringify(this.configData, null, 2)}`);
        this._onDidUpdateConfig.fire();
      } else {
        // this.outputChannel.error("Failed to fetch CONFIG: Invalid response format.");
      }
    } catch (error) {
      this.logger.error(`Error fetching main config`);
      // this.outputChannel.error(`Error fetching CONFIG: ${error}`);
    }
  }

  /**
   * Retrieves the entire essential config data from constant.
   */
  public getAllConfigEssentials(): Record<string, any> {
    return this.configEssentials;
  }

  /**
   * Retrieves a specific value from the essential config data using the provided key.
   * Falls back to workspace state if not present in memory.
   */
  public getConfigEssentialByKey(key: string): any {
    const value = this.configEssentials[key];
    if (value !== undefined) {
      return value;
    }

    const stored = this.context.workspaceState.get<Record<string, any>>(this.CONFIG_ESSENTIALS_KEY);
    return stored ? stored[key] : undefined;
  }

  /**
   * Retrieves the entire general config data from constant.
   */
  public getAllConfig(): Record<string, any> {
    return this.configData;
  }

  /**
   * Retrieves a specific value from the general config data using the provided key.
   * Falls back to workspace state if not present in memory.
   */
  public getConfigByKey(key: string): any {
    const value = this.configData[key];
    if (value !== undefined) {
      return value;
    }

    const stored = this.context.workspaceState.get<Record<string, any>>(this.CONFIG_KEY);
    return stored ? stored[key] : undefined;
  }
}
