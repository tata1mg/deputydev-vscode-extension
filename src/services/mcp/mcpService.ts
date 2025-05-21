import { binaryApi } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { MCPServerToolInvokePayload } from "../../types";

export class MCPService {
    private logger: ReturnType<typeof SingletonLogger.getInstance>;
    constructor() {
        this.logger = SingletonLogger.getInstance();
    }
    private apiErrorHandler = new ApiErrorHandler();
    public async getServers(): Promise<any> {
        try {
            const response = await binaryApi().get(API_ENDPOINTS.GET_ALL_MCP_SERVERS);
            console.log(response)
            return response.data.servers;
        } catch (error) {
            this.logger.error('Error while getting servers');
            this.apiErrorHandler.handleApiError(error);
        }
    }

    public async syncServers(): Promise<any> {
        try {
            const response = await binaryApi().post(API_ENDPOINTS.SYNC_MCP_SERVERS);
            console.log("***********syncing servers************", response)
            return response;
        } catch (error) {
            this.logger.error('Error while syncing servers');
            this.apiErrorHandler.handleApiError(error);
        }
    }

    public async enableServer(serverName: string): Promise<any> {
        try {
            let endpoint;
            if (serverName) {
                endpoint = `v1/servers/${serverName}/enable`;
            } else {
                throw new Error("Server name not provided");
            }
            const response = await binaryApi().patch(endpoint);
            return response;
        } catch (error) {
            this.logger.error('Error while enabling server');
            this.apiErrorHandler.handleApiError(error);
        }
    }

    public async disableServer(serverName: string): Promise<any> {
        try {
            let endpoint;
            if (serverName) {
                endpoint = `v1/servers/${serverName}/disable`;
            } else {
                throw new Error("Server name not provided");
            }
            const response = await binaryApi().patch(endpoint);
            return response;
        } catch (error) {
            this.logger.error('Error while disabling server');
            this.apiErrorHandler.handleApiError(error);
        }
    }

    public async restartServer(serverName: string): Promise<any> {
        try {
            let endpoint;
            if (serverName) {
                endpoint = `v1/servers/${serverName}/restart`;
            } else {
                throw new Error("Server name not provided");
            }
            const response = await binaryApi().patch(endpoint);
            return response;
        } catch (error) {
            this.logger.error('Error while disabling server');
            this.apiErrorHandler.handleApiError(error);
        }
    }

    public async invokeServerTool(payload: MCPServerToolInvokePayload) {
        try {
            const response = await binaryApi().post(API_ENDPOINTS.INVOKE_MCP_SERVER_TOOL, payload);
            return response;
        } catch (error){
            this.logger.error('Error while invoking server tool');
            this.apiErrorHandler.handleApiError(error);
        }
    }
}