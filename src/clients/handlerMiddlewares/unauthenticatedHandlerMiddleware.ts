import { sendNotVerified } from '../../utilities/contextManager';
import { BaseHandlerMiddleware } from '../base/baseHandlerMiddleware';

class UnauthenticatedHandlerMiddleware extends BaseHandlerMiddleware {
  public async handleWsMessage(message: any): Promise<void> {
    if (message.type === 'STREAM_ERROR' && message.status === 'NOT_VERIFIED') {
      sendNotVerified();
    }
  }
}

export const UnauthenticatedHandler = new UnauthenticatedHandlerMiddleware();
