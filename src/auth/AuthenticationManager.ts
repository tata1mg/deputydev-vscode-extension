import { BrowserClient } from "../clients/BrowserClient";
import { AuthService } from "../services/auth/AuthService";
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';

export class AuthenticationManager {
    authService = new AuthService();
    browserClient = new BrowserClient();
    constructor(
        private context: vscode.ExtensionContext,
    ) {}

    public async pollSession(supabaseSessionId: string) {
        const maxAttempts: number = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await this.authService.getSession(supabaseSessionId);

                if (response.data.status === 'AUTHENTICATED') {
                    if (response.data.encrypted_session_data) {
                        const result = await this.authService.storeAuthToken(response.data.encrypted_session_data)
                        if (result === "success") {
                            this.context.workspaceState.update("authToken", response.data.encrypted_session_data);
                            return response.data.status;
                        } else {
                            return 'NOT_AUTHENTICATED';
                        }
                    } else {
                        return 'NOT_AUTHENTICATED';
                    }
                }
            } catch (error) {
                console.error('Error while polling session:', error);
                return 'NOT_AUTHENTICATED';
            }

            // Wait for 3 seconds before the next attempt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.error("Authentication failed, please try again later.");
        return 'NOT_AUTHENTICATED';
    };

    public async validateCurrentSession() {
        // Extracting auth token from user's machine
        const authToken: string = await this.authService.loadAuthToken()

        if (!authToken) {
            return false;
        }

        try {
            const response = await this.authService.verifyAuthToken(authToken)
            if (response.data.status === 'VERIFIED') {
                return true;
                // return false;
            } else if (response.data.status === 'EXPIRED') {
                if (response.data.encrypted_session_data) {
                    const result = await this.authService.storeAuthToken(response.data.encrypted_session_data)
                    if (result === "success") {
                        this.context.workspaceState.update("authToken", response.data.encrypted_session_data);
                        return true;
                        // return false;
                    }
                } else {
                    return false;
                    // return true;
                }
            } else {
                return false;
                // return true;
            }
        } catch (error) {
            console.error("Authentication failed, please try again later.")
            return false;
        }
    }

    public async initiateAuthentication() {

        // If current session is not valid
        const supabaseSessionId: string = uuidv4();
        this.browserClient.initiateExtensionLogin(supabaseSessionId)

        // Poll Session
        return await this.pollSession(supabaseSessionId)
    }
}