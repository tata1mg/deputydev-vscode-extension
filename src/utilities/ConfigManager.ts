import * as vscode from 'vscode';
import { api } from "../services/api/axios";
import { API_ENDPOINTS } from "../services/api/endpoints";
import { AuthService } from '../services/auth/AuthService';
import { refreshCurrentToken } from '../services/refreshToken/refreshCurrentToken';

export class ConfigManager {
  private context: vscode.ExtensionContext;
  private outputChannel: vscode.LogOutputChannel;
  private readonly CONFIG_ESSENTIALS_KEY = 'essentialConfigData';
  private readonly CONFIG_KEY = 'configData';
  private configEssentials: any = {};
  private configData: any = {};

  private _onDidUpdateConfig = new vscode.EventEmitter<void>();
  public readonly onDidUpdateConfig = this._onDidUpdateConfig.event;

  constructor(context: vscode.ExtensionContext, outputChannel: vscode.LogOutputChannel) {
    this.context = context;
    this.outputChannel = outputChannel;
  }

  /**
   * Fetches and stores the essential config data in workspace state and constant.
   */
  public async fetchAndStoreConfigEssentials(): Promise<void> {
    try {
      const response = await api.get(API_ENDPOINTS.CONFIG_ESSENTIALS, {params: {consumer: "VSCODE_EXT"}});
      this.outputChannel.info(`CONFIG_ESSENTIALS response: ${JSON.stringify(response.data)}`);
      if (response.data && response.data.is_success) {
        this.configEssentials = response.data.data;
        await this.context.workspaceState.update(this.CONFIG_ESSENTIALS_KEY, this.configEssentials);
        this.outputChannel.info("CONFIG_ESSENTIALS successfully stored.");
      } else {
        this.outputChannel.error("Failed to fetch CONFIG_ESSENTIALS: Invalid response format.");
      }
    } catch (error) {
      this.outputChannel.error(`Error fetching CONFIG_ESSENTIALS: ${error}`);
    }
  }

  /**
   * Fetches and stores the general config data in workspace state and constant.
   */
  public async fetchAndStoreConfig(): Promise<void> {
    try {
      const authService = new AuthService();
      const auth_token = await authService.loadAuthToken();
      const headers = {
        "Authorization": `Bearer ${auth_token}`
      }
      const response = await api.get(API_ENDPOINTS.CONFIG, { params: {consumer: "VSCODE_EXT"}, headers });
      if (response.data && response.data.is_success) {
        refreshCurrentToken(response.headers)
        this.configData = response.data.data;
        await this.context.workspaceState.update(this.CONFIG_KEY, this.configData);
        this.outputChannel.appendLine(`main CONFIG fetched: ${JSON.stringify(this.configData, null, 2)}`);
        this._onDidUpdateConfig.fire();
      } else {
        this.outputChannel.error("Failed to fetch CONFIG: Invalid response format.");
      }
    } catch (error) {
      this.outputChannel.error(`Error fetching CONFIG: ${error}`);
    }
  }

  /**
   * Retrieves the stored essential config data from constant or returns a specific value if a key is provided.
   */
  public getConfigEssentials(key?: string): any {
    return key ? this.configEssentials[key] : this.configEssentials;
  }

  /**
   * Retrieves the stored general config data from constant or returns a specific value if a key is provided.
   */
  public getConfig(key?: string): any {
    return key ? this.configData[key] : this.configData;
  }
}
