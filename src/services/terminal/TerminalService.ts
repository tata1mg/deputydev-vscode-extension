import { api, binaryApi } from '../api/axios';
import { API_ENDPOINTS } from '../api/endpoints';
import { ApiErrorHandler } from '../api/apiErrorHandler';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { ErrorTrackingManager } from '../../analyticsTracking/ErrorTrackingManager';
import { AuthService } from '../auth/AuthService';
import { SESSION_TYPE } from '../../constants';
import { getSessionId } from '../../utilities/contextManager';
import { getOSName } from '../../utilities/osName';
import { getShell } from '../../terminal/utils/shell';
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

export class TerminalService {
  private logger: ReturnType<typeof SingletonLogger.getInstance>;
  constructor() {
    this.logger = SingletonLogger.getInstance();
  }
  private apiErrorHandler = new ApiErrorHandler();
  private errorTrackingManager = new ErrorTrackingManager();

  async editTerminalCommand(data: { user_query: string; old_command: string }) {
    try {
      const { user_query, old_command } = data;
      const authToken = await fetchAuthToken();
      const headers = {
        Authorization: `Bearer ${authToken}`,
        'X-Session-Type': SESSION_TYPE,
        'X-Session-Id': getSessionId(),
      };
      const payload = {
        query: user_query,
        old_terminal_command: old_command,
        os_name: await getOSName(),
        shell: getShell(),
      };
      const response = await api.post(API_ENDPOINTS.TERMINAL_COMMAND_EDIT, payload, {
        headers,
      });
      refreshCurrentToken(response.headers);
      return response.data.data.terminal_command;
    } catch (error) {
      this.logger.error('Error updating terminal command:');
      this.apiErrorHandler.handleApiError(error);
      this.errorTrackingManager.trackGeneralError(error, 'TERMINAL_COMMAND_EDIT_ERROR', 'BACKEND');
      throw error;
    }
  }
}
