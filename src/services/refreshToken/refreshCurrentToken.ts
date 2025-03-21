import { AxiosResponseHeaders } from "axios";

export function refreshCurrentToken(responseHeaders: any) {
    if (responseHeaders) {
        const refreshedAuthToken = responseHeaders["new_session_data"];
        if (refreshedAuthToken) {
            console.log("refreshed auth token", refreshedAuthToken)
        }
    }
}