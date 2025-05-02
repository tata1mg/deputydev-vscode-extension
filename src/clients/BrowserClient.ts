import * as vscode from 'vscode';
import { getEssentialConfig } from '../config/configSetGet';
import { CLIENT } from '../config';
export class BrowserClient {
  public async initiateExtensionLogin(supabaseSessionId: string) {
    console.log('opening browser');
    const client_url = getEssentialConfig()['DD_BROWSER_HOST'];
    const authUrl = `${client_url}/external-auth?supabase_session_id=${supabaseSessionId}&is_external_auth_request=${CLIENT}`;
    await vscode.env.openExternal(vscode.Uri.parse(authUrl));
  }
}
