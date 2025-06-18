import { AxiosError } from 'axios';
import { sendForceUpgrade, sendNotVerified } from '../../utilities/contextManager';
import { SingletonLogger } from '../../utilities/Singleton-logger';
import { CLIENT_VERSION } from '../../config';

export class ApiErrorHandler {
  public handleApiError(error: unknown): void {
    const logger = SingletonLogger.getInstance();

    if (this.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const errorData = axiosError.response?.data;
      const errorCode = errorData?.meta?.error_code || axiosError.code || errorData.error_code;
      const errorName = errorData?.meta?.error_name || axiosError.name || errorData.error_type;
      const message = errorData?.meta?.message || axiosError.message || errorData.error_message;
      const stack = errorData?.meta?.stack || axiosError.stack || errorData.traceback;
      logger.error(
        `API Error | name=${errorName} | code=${errorCode} | message="${message}" | method=${axiosError.config?.method} | url=${axiosError.config?.url} | status=${axiosError.response?.status}`,
      );
      logger.error(`API Error | data=${JSON.stringify(errorData)}`);
      logger.error(`API Error | stack=${stack}`);
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
