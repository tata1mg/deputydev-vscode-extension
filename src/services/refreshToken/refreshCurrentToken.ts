import { AuthService } from "../auth/AuthService";

export async function refreshCurrentToken(responseHeaders: any) {
    if (responseHeaders) {
        const refreshedAuthToken = responseHeaders["new_session_data"];
        if (refreshedAuthToken) {
            console.log("refreshed auth token", refreshedAuthToken)
            try {
                const authService = new AuthService();
                const result = await authService.storeAuthToken(refreshedAuthToken);
                if (result === "success") {
                    return;
                }
            } catch (error) {
                console.error("Error while updating refreshed Token: ", error)
            }
        }
    }
}