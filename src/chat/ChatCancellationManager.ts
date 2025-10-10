// ChatCancellationManager.ts
import { api } from '../services/api/axios';
import { AuthService } from '../services/auth/AuthService';
import { SESSION_TYPE } from '../constants';
import { CLIENT, CLIENT_VERSION } from '../config';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { refreshCurrentToken } from '../services/refreshToken/refreshCurrentToken';
import { API_ENDPOINTS } from '../services/api/endpoints';
import { ErrorTrackingManager } from '../analyticsTracking/ErrorTrackingManager';
import { ApiErrorHandler } from '../services/api/apiErrorHandler';

interface CancellableTask {
  abortController: AbortController;
  asyncIterator?: AsyncIterableIterator<any>;
}

const activeApiChatTasks = new Set<CancellableTask>();
const authService = new AuthService();
const logger = SingletonLogger.getInstance();

export function registerApiChatTask(task: CancellableTask) {
  activeApiChatTasks.add(task);
}

export function unregisterApiChatTask(task: CancellableTask) {
  activeApiChatTasks.delete(task);
}

export async function cancelChat(sessionId: number): Promise<void> {
  try {
    const authToken = await authService.loadAuthToken();
    if (!authToken) {
      return;
    }

    const response = await api.post(
      API_ENDPOINTS.CANCEL_CHAT,
      {},
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId.toString(),
          'X-Session-Type': SESSION_TYPE,
          'X-Client': CLIENT,
          'X-Client-Version': CLIENT_VERSION,
        },
      },
    );
    refreshCurrentToken(response.headers);
  } catch (error) {
    const errorTrackingManager = new ErrorTrackingManager();
    const apiErrorHandler = new ApiErrorHandler();
    errorTrackingManager.trackGeneralError({
      error,
      errorType: 'CHAT_CANCELLATION_ERROR',
      errorSource: 'BACKEND',
      sessionId,
    });
    apiErrorHandler.handleApiError(error);
    logger.error(' Backend cancellation failed:', error);
    throw error;
  }
}
