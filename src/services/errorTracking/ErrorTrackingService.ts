import axios from 'axios';
import { getMainConfig } from '../../config/configSetGet';
import { ErrorTrackingRequestForBackend } from '../../types';

export class ErrorTrackingService {
  public async trackErrorEvent(payload: ErrorTrackingRequestForBackend): Promise<void> {
    const RUDDERSTACK_URL = getMainConfig()['RUDDER']['DATA_PLANE_URL'];
    const RUDDERSTACK_WRITE_KEY = getMainConfig()['RUDDER']['WRITE_KEY_ERROR_TRACKING'];
    axios.post(RUDDERSTACK_URL, payload, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${RUDDERSTACK_WRITE_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
  }
}
