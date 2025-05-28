import axios from 'axios';
import { getMainConfig } from '../../config/configSetGet';


interface UsageTrackingRequestForBackend {
  event_type: string;
  event_data: Record<string, any>;
  session_id: number;
  client: string;
  client_version: string;
  timestamp: string;
  user_team_id: number;
}

export class UsageTrackingService {
  public async trackUsage(payload: UsageTrackingRequestForBackend): Promise<void> {
    const RUDDERSTACK_URL = getMainConfig()['RUDDER']['DATA_PLANE_URL'];
    const RUDDERSTACK_WRITE_KEY = getMainConfig()['RUDDER']['WRITE_KEY'];
    axios.post(RUDDERSTACK_URL, payload, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${RUDDERSTACK_WRITE_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });
  }
}
