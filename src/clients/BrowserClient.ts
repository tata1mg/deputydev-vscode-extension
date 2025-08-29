import * as vscode from 'vscode';
import { getEssentialConfig } from '../config/configSetGet';
import { CLIENT } from '../config';
export class BrowserClient {
  public async initiateExtensionLogin(uniqueSessionId: string) {
    console.log('opening browser');
    const client_url = getEssentialConfig()['BROWSER_HOST'];
    const authUrl = `${client_url}/external-auth?unique_session_id=${uniqueSessionId}&is_external_auth_request=${CLIENT}`;
    await vscode.env.openExternal(vscode.Uri.parse(authUrl));
  }
}
