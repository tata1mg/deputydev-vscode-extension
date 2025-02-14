import * as vscode from 'vscode';

export class BrowserClient {
    public async initiateExtensionLogin(supabaseSessionId: string) {
        const isExternalAuthRequest = "DeputyDev Extension"
        console.log("opening browser");
        const authUrl = `http://localhost:3000/external-auth?supabase_session_id=${supabaseSessionId}&is_external_auth_request=${isExternalAuthRequest}`;
        await vscode.env.openExternal(vscode.Uri.parse(authUrl));
    }
}