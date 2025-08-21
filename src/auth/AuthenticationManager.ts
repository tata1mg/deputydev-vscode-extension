import { BrowserClient } from '../clients/BrowserClient';
import { AuthService } from '../services/auth/AuthService';
import { ConfigManager } from '../utilities/ConfigManager';
import { SingletonLogger } from '../utilities/Singleton-logger';
import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import { AuthStatus } from '../types';
export class AuthenticationManager {
  authService = new AuthService();
  browserClient = new BrowserClient();
  private logger: ReturnType<typeof SingletonLogger.getInstance>;

  constructor(
    private context: vscode.ExtensionContext,
    private configManager: ConfigManager,
  ) {
    this.logger = SingletonLogger.getInstance();
  }

  public async pollSession(supabaseSessionId: string) {
    const configData: any = this.context.workspaceState.get('essentialConfigData');
    const maxAttempts = configData?.POLLING_MAX_ATTEMPTS;
    if (!maxAttempts) {
      this.logger.error('Authentication failed, please try again later.');
      return 'AUTHENTICATION_FAILED';
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.authService.getSession(supabaseSessionId);

        if (response.data.status === AuthStatus.AUTHENTICATED) {
          if (response.data.encrypted_session_data) {
            const result = await this.authService.storeAuthToken(response.data.encrypted_session_data);
            if (result === 'success') {
              const userData = {
                email: response.data.user_email,
                userName: response.data.user_name,
              };
              this.configManager.fetchAndStoreConfig();
              this.context.secrets.store('authToken', response.data.encrypted_session_data);
              this.setAuthState(true, userData);
              return response.data.status;
            } else {
              this.setAuthState(false);
              return 'NOT_AUTHENTICATED';
            }
          } else {
            this.setAuthState(false);
            return 'NOT_AUTHENTICATED';
          }
        }
      } catch (error) {
        this.setAuthState(false);
        this.logger.error('Error while polling session');
        return 'AUTHENTICATION_FAILED';
      }

      // Wait for 3 seconds before the next attempt
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    this.logger.error('Authentication failed, please try again later.');
    return 'AUTHENTICATION_FAILED';
  }

  public async validateCurrentSession() {
    // Extracting auth token from user's machine
    const authToken: string = await this.authService.loadAuthToken();

    if (!authToken) {
      return false;
    }

    try {
      const response = await this.authService.verifyAuthToken(authToken);
      if (response.data.status === AuthStatus.VERIFIED) {
        const userData = {
          email: response.data.user_email,
          userName: response.data.user_name,
        };
        this.setAuthState(true, userData);
        return true;
      } else if (response.data.status === AuthStatus.EXPIRED) {
        if (response.data.encrypted_session_data) {
          const result = await this.authService.storeAuthToken(response.data.encrypted_session_data);
          if (result === 'success') {
            const userData = {
              email: response.data.user_email,
              userName: response.data.user_name,
            };
            this.setAuthState(true, userData);
            this.context.secrets.store('authToken', response.data.encrypted_session_data);
            return true;
          }
        } else {
          this.setAuthState(false);
          return false;
        }
      } else {
        this.setAuthState(false);
        return false;
      }
    } catch (error) {
      this.setAuthState(false);
      this.logger.error('Authentication failed, please try again later.');
      throw error;
    }
  }

  public async initiateAuthentication() {
    // If current session is not valid
    const supabaseSessionId: string = uuidv4();
    this.browserClient.initiateExtensionLogin(supabaseSessionId);

    // Poll Session
    return await this.pollSession(supabaseSessionId);
  }

  private setAuthState(isAuth: boolean, userData?: { email: string; userName: string }) {
    this.context.workspaceState.update('isAuthenticated', isAuth);
    vscode.commands.executeCommand('setContext', 'deputydev.isAuthenticated', isAuth);
    if (isAuth) {
      this.logger.info('User is authenticated');
    } else {
      this.logger.info('User is not authenticated');
    }
    if (userData) {
      this.context.globalState.update('userData', userData);
    }
  }
}
