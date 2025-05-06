import { AuthService } from '../auth/AuthService';
import { SingletonLogger } from '../../utilities/Singleton-logger';

export async function refreshCurrentToken(responseHeaders: any) {
  const logger = SingletonLogger.getInstance();
  if (responseHeaders) {
    const refreshedAuthToken = responseHeaders['new_session_data'];
    if (refreshedAuthToken) {
      // console.log("refreshed auth token", refreshedAuthToken)
      try {
        const authService = new AuthService();
        const result = await authService.storeAuthToken(refreshedAuthToken);
        if (result === 'success') {
          logger.info('Successfully updated refreshed token');
          return;
        }
      } catch (error) {
        logger.error('Error while updating refreshed Token');
        // console.error("Error while updating refreshed Token: ", error)
      }
    }
  }
}
