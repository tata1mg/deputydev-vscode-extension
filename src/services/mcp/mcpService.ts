import * as os from 'os';
import * as path from 'path';
import { MCPServerToolInvokePayload } from '../../types';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { cp } from 'fs';

export class MCPService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  private apiErrorHandler = new ApiErrorHandler();

  public async getAllMcpServers(): Promise<any> {
    try {
      const response = await binaryApi().get(API_ENDPOINTS.GET_ALL_MCP_SERVERS);
      return response.data;
    } catch (error) {
      this.logger.error('Error while syncing servers');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async getActiveServerTools(): Promise<any> {
    try {
      const response = await binaryApi().get(API_ENDPOINTS.GET_ACTIVE_SERVER_TOOLS);
      console.log('Active Server Tools:', response.data);
      return response.data;
    } catch (error) {
      this.logger.error('Error while syncing servers');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async syncServers(): Promise<any> {
    try {
      console.log('**********syncing from method**********');
      const homeDir = os.homedir();
      const config_path = path.join(homeDir, '.deputydev', 'mcp_settings.json');
      const data = {
        config_path: config_path,
      };
      const response = await binaryApi().post(API_ENDPOINTS.SYNC_MCP_SERVERS, data);
      console.log(response.data);
      return response.data;
    } catch (error) {
      this.logger.error('Error while syncing servers');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async enableServer(serverName: string): Promise<any> {
    try {
      let endpoint;
      if (serverName) {
        endpoint = `/v1/mcp/servers/${serverName}/enable`;
      } else {
        throw new Error('Server name not provided');
      }
      const response = await binaryApi().patch(endpoint);
      return response.data;
    } catch (error) {
      this.logger.error('Error while enabling server');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async disableServer(serverName: string): Promise<any> {
    try {
      let endpoint;
      if (serverName) {
        endpoint = `/v1/mcp/servers/${serverName}/disable`;
      } else {
        throw new Error('Server name not provided');
      }
      const response = await binaryApi().patch(endpoint);
      return response.data;
    } catch (error) {
      this.logger.error('Error while disabling server');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async restartServer(serverName: string): Promise<any> {
    try {
      let endpoint;
      if (serverName) {
        endpoint = `/v1/mcp/servers/${serverName}/restart`;
      } else {
        throw new Error('Server name not provided');
      }
      const response = await binaryApi().patch(endpoint);
      console.log(response.data);
      return response.data;
    } catch (error) {
      this.logger.error('Error while restarting server');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async invokeServerTool(payload: MCPServerToolInvokePayload) {
    try {
      const response = await binaryApi().post(API_ENDPOINTS.INVOKE_MCP_SERVER_TOOL, payload);
      return response.data;
    } catch (error) {
      this.logger.error('Error while invoking server tool');
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
