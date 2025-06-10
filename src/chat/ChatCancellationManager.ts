// ChatCancellationManager.ts
import { api } from '../services/api/axios';
import { AuthService } from '../services/auth/AuthService';
import { getSessionId } from '../utilities/contextManager';
import { SESSION_TYPE } from '../constants';
import { CLIENT, CLIENT_VERSION } from '../config';

interface CancellableTask {
  abortController: AbortController;
  asyncIterator?: AsyncIterableIterator<any>;
}

const activeApiChatTasks = new Set<CancellableTask>();
const authService = new AuthService();
let currentConnectionId: string | null = null;

export function registerApiChatTask(task: CancellableTask) {
  activeApiChatTasks.add(task);
}

export function unregisterApiChatTask(task: CancellableTask) {
  activeApiChatTasks.delete(task);
}

export function cancelAllApiChats() {
  activeApiChatTasks.forEach((task) => {
    task.abortController.abort();
    if (task.asyncIterator && typeof task.asyncIterator.return === 'function') {
      task.asyncIterator.return(undefined); // ✅ Fix: provide argument
    }
  });
  activeApiChatTasks.clear();
}

export async function cancelBackendLLMTask() {
  console.log("called here")
  try {
    const authToken = await authService.loadAuthToken();
    if (!authToken) {
      return;
    }

    const sessionId = getSessionId();
    if (!sessionId) {
      return;
    }


    const response = await api.post('/end_user/v2/code-gen/cancel', {}, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId.toString(),
        'X-Session-Type': SESSION_TYPE,
        'X-Client': CLIENT,
        'X-Client-Version': CLIENT_VERSION
      }
    });
  } catch (error) {
    console.log(' Backend cancellation failed:', error);
  }
}
