import { AxiosError } from 'axios';
import { sendForceUpgrade, sendNotVerified } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { refreshCurrentToken } from '../refreshToken/refreshCurrentToken';
import { CLIENT_VERSION } from '../../config';

export class ApiErrorHandler {
  public handleApiError(error: unknown): void {
    const logger = SingletonLogger.getInstance();

    if (this.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const errorHeaders = axiosError.response?.headers;
      const errorData = axiosError.response?.data;
      const errorCode = errorData?.error_code || errorData?.meta?.error_code || axiosError.code;
      const errorType = errorData?.error_type || errorData?.meta?.error_name || axiosError.name;
      const errorSubType = errorData?.error_subtype;
      const message = errorData?.error_message || errorData?.meta?.message || axiosError.message;
      const stack = errorData?.traceback || errorData?.meta?.stack || axiosError.stack;
      logger.error(
        `API Error | name=${errorType} | code=${errorCode} | subtype=${errorSubType} | message="${message}" | method=${axiosError.config?.method} | url=${axiosError.config?.url} | status=${axiosError.response?.status}`,
      );
      logger.error(`API Error | data=${JSON.stringify(errorData)}`);
      logger.error(`API Error | stack=${stack}`);
      if (errorHeaders && errorHeaders.new_session_data) {
        // refreshing token in case of exceptions
        refreshCurrentToken(errorHeaders);
      }
      if (errorCode === 101) {
        sendForceUpgrade({
          url: errorData.meta?.client_download_link,
          upgradeVersion: errorData.meta?.upgrade_version,
          currentVersion: CLIENT_VERSION,
        });
      }
      if (axiosError.response?.status === 400 && errorData?.error?.message === 'NOT_VERIFIED') {
        sendNotVerified();
      }
    } else {
      const raw = error as any;
      logger.error(`Error | name=${raw?.name} | message="${raw?.message || 'Unknown error'}" | code=${raw?.code}`);
      logger.error(`Error | stack=${raw?.stack}`);
    }

    throw error;
  }

  private isAxiosError(error: any): error is AxiosError {
    return error && typeof error === 'object' && 'isAxiosError' in error && error.isAxiosError === true;
  }
}
