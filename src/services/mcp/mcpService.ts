import { MCPServerToolApprovePayload, MCPServerToolInvokePayload } from '../../types';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { MCP_CONFIG_PATH } from '../../config';

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
      return response.data;
    } catch (error) {
      try {
        this.logger.error('Error while syncing servers');
        this.apiErrorHandler.handleApiError(error); // TODO: this throws error internally. This shall be refctored
        return { data: [] }; // Return an empty array if there's an error
      } catch (innerError) {
        return { data: [] }; // Return an empty array if there's an error
      }
    }
  }

  public async syncServers(): Promise<any> {
    try {
      const data = {
        config_path: MCP_CONFIG_PATH,
      };
      const response = await binaryApi().post(API_ENDPOINTS.SYNC_MCP_SERVERS, data);
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

  public async invokeMcpTool(payload: MCPServerToolInvokePayload) {
    try {
      const response = await binaryApi().post(API_ENDPOINTS.INVOKE_MCP_SERVER_TOOL, payload);
      return response.data;
    } catch (error) {
      this.logger.error('Error while invoking MCP tool');
      this.apiErrorHandler.handleApiError(error);
    }
  }

  public async approveMcpTool(payload: MCPServerToolApprovePayload) {
    try {
      const response = await binaryApi().post(API_ENDPOINTS.APPROVE_MCP_TOOL, payload);
      return response.data;
    } catch (error) {
      this.logger.error('Error while approving MCP tool');
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
