import { CLIENT_VERSION } from '../../config';
import { sendForceUpgrade } from '../../utilities/contextManager';
import { BaseHandlerMiddleware } from '../base/baseHandlerMiddleware';

class ForceUpgradeHandlerMiddleware extends BaseHandlerMiddleware {
  private handle(upgradeVersion: string, clientDownloadLink: string): void {
    sendForceUpgrade({
      url: clientDownloadLink,
      upgradeVersion: upgradeVersion,
      currentVersion: CLIENT_VERSION,
    });
  }

  public async handleWsMessage(message: any): Promise<void> {
    if (message.type === 'STREAM_ERROR' && message.status === 'INVALID_CLIENT_VERSION') {
      this.handle(message.message.upgrade_version, message.message.client_download_link);
    }
  }
}

export const ForceUpgradeHandler = new ForceUpgradeHandlerMiddleware();
