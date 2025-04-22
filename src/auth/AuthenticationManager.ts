import { BrowserClient } from "../clients/BrowserClient";
import { AuthService } from "../services/auth/AuthService";
import { ConfigManager } from "../utilities/ConfigManager";
import { Logger } from "../utilities/Logger";
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';

export class AuthenticationManager {
    authService = new AuthService();
    browserClient = new BrowserClient();
    constructor(
        private context: vscode.ExtensionContext,
        private configManager: ConfigManager,
        private logger: Logger
    ) { }

    public async pollSession(supabaseSessionId: string) {
        const configData = this.context.workspaceState.get("essentialConfigData") as any;
        if (!configData) {
            this.logger.error("Authentication failed, please try again later.");
            return "AUTHENTICATION_FAILED"
        }
        const maxAttempts: number = configData.POLLING_MAX_ATTEMPTS;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await this.authService.getSession(supabaseSessionId);

                if (response.data.status === 'AUTHENTICATED') {
                    if (response.data.encrypted_session_data) {
                        const result = await this.authService.storeAuthToken(response.data.encrypted_session_data)
                        if (result === "success") {
                            const userData = {
                                email: response.data.user_email,
                                userName: response.data.user_name
                            }
                            this.context.globalState.update("userData", userData);
                            this.configManager.fetchAndStoreConfig();
                            this.context.workspaceState.update("authToken", response.data.encrypted_session_data);
                            this.context.workspaceState.update("isAuthenticated", true);
                            vscode.commands.executeCommand("setContext", "deputydev.isAuthenticated", true);
                            return response.data.status;
                        } else {
                            this.context.workspaceState.update("isAuthenticated", false);
                            vscode.commands.executeCommand("setContext", "deputydev.isAuthenticated", false);
                            return 'NOT_AUTHENTICATED';
                        }
                    } else {
                        this.context.workspaceState.update("isAuthenticated", false);
                        vscode.commands.executeCommand("setContext", "deputydev.isAuthenticated", false);
                        return 'NOT_AUTHENTICATED';
                    }
                }
            } catch (error) {
                this.context.workspaceState.update("isAuthenticated", false);
                vscode.commands.executeCommand("setContext", "deputydev.isAuthenticated", false);
                this.logger.error('Error while polling session');
                return 'AUTHENTICATION_FAILED';
            }

            // Wait for 3 seconds before the next attempt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        this.logger.error("Authentication failed, please try again later.");
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
                const userData = {
                    email: response.data.user_email,
                    userName: response.data.user_name
                }
                this.context.globalState.update("userData", userData)
                this.context.workspaceState.update("isAuthenticated", true);
                this.context.workspaceState.update("isAuthenticated", true);
                return true;
                // return false;
            } else if (response.data.status === 'EXPIRED') {
                if (response.data.encrypted_session_data) {
                    const result = await this.authService.storeAuthToken(response.data.encrypted_session_data)
                    if (result === "success") {
                        const userData = {
                            email: response.data.user_email,
                            userName: response.data.user_name
                        }
                        this.context.globalState.update("userData", userData)
                        this.context.workspaceState.update("authToken", response.data.encrypted_session_data);
                        this.context.workspaceState.update("isAuthenticated", true);
                        this.context.workspaceState.update("isAuthenticated", true);
                        return true;
                        // return false;
                    }
                } else {
                    this.context.workspaceState.update("isAuthenticated", false);
                    vscode.commands.executeCommand("setContext", "deputydev.isAuthenticated", false);
                    return false;
                    // return true;
                }
            } else {
                this.context.workspaceState.update("isAuthenticated", false);
                vscode.commands.executeCommand("setContext", "deputydev.isAuthenticated", false);
                return false;
                // return true;
            }
        } catch (error) {
            this.context.workspaceState.update("isAuthenticated", false);
            vscode.commands.executeCommand("setContext", "deputydev.isAuthenticated", false);
            this.logger.error("Authentication failed, please try again later.")
            throw error
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