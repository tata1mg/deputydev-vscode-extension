import { AxiosError } from "axios";
import { sendForceUgradeData, sendForceUpgrade } from "../../utilities/contextManager";
import { SingletonLogger } from "../../utilities/Singleton-logger";

export class ApiErrorHandler {
  public handleApiError(error: unknown): void {
    const logger = SingletonLogger.getInstance();

    if (this.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const errorData = axiosError.response?.data;
      // console.error( errorData);
      // console.error(error)
      const errorCode = errorData?.meta?.error_code || axiosError.code 
      const errorName = errorData?.meta?.error_name || axiosError.name;
      const message = errorData?.meta?.message || axiosError.message;
      const stack = errorData?.meta?.stack || axiosError.stack;
      // console.error("API Error", axiosError.response);
      // console.error("API Error raw", error);
      // console.error("API Error raw json", JSON.stringify(error));
      logger.error(`API Error | name=${errorName} | code=${errorCode} | message="${message}" | method=${axiosError.config?.method} | url=${axiosError.config?.url} | status=${axiosError.response?.status}`);
      logger.error(`API Error | data=${JSON.stringify(errorData)}`);
      logger.error(`API Error | stack=${stack}`);
      if (errorCode === 101) {
        sendForceUpgrade();
        sendForceUgradeData({
          url: errorData.meta?.client_download_link,
          upgradeVersion: errorData.meta?.upgrade_version
        });
      }
    } else {
      const raw = error as any;
      logger.error(`Error | name=${raw?.name} | message="${raw?.message || 'Unknown error'}" | code=${raw?.code}`);
      logger.error(`Error | stack=${raw?.stack}`);
    }

    throw error;
  }

  private isAxiosError(error: any): error is AxiosError {
    return (
      error &&
      typeof error === 'object' &&
      'isAxiosError' in error &&
      error.isAxiosError === true
    );
  }
}
