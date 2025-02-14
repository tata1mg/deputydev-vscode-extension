import { BrowserClient } from "../clients/BrowserClient";
import { AuthService } from "../services/auth/AuthService";
import { v4 as uuidv4 } from 'uuid';

export class AuthenticationManager {
    authService = new AuthService();
    browserClient = new BrowserClient();

    public async pollSession(supabaseSessionId: string) {
        const maxAttempts: number = 10;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const response = await this.authService.getSession(supabaseSessionId);
                console.log("response", response, response.data.status)

                if (response.data.status === 'AUTHENTICATED') {
                    return response.data.status;
                } else {
                    console.log('User is not authenticated, polling again...');
                }
            } catch (error) {
                console.error('Error checking session:', error);
            }

            // Wait for 3 seconds before the next attempt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log('Max attempts reached, authentication failed. stopping polling.');
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
            console.log("response", response)
            if (response.data.status === 'VERIFIED') {
                return true;
                // return false;
            } else if (response.data.status === 'EXPIRED') {
                const result = await this.authService.storeAuthToken(response.data.encrypted_session_data)
                if (result === 'success') {
                    return true;
                    // return false;
                }
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    public async initiateAuthentication() {

        // If current session is not valid
        const supabaseSessionId: string = uuidv4();
        this.browserClient.initiateExtensionLogin(supabaseSessionId)

        // Poll Session
        return this.pollSession(supabaseSessionId)
    }
}