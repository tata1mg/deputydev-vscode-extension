import { AxiosError } from "axios";
import { sendForceUgradeData } from "../../utilities/contextManager";


export class ApiErrorHandler {
    public handleApiError(error: unknown): void {
        const axiosError = error as AxiosError<any>;
        if (axiosError.response?.data) {
            const errorData = axiosError.response.data;
            if (errorData.meta?.error_code === 101) {
                sendForceUgradeData({
                    url: errorData.meta?.client_download_link,
                    upgradeVersion: errorData.meta?.upgrade_version
                })
                throw error;
            }
        }
        throw error;
    }
}