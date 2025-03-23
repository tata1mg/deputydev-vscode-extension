import axios from "axios";
import { UsageTrackingRequest} from "../../types";
import {RUDDERSTACK_WRITE_KEY , RUDDERSTACK_URL } from "../../config";

export class UsageTrackingService {
  public async trackUsage(payload: UsageTrackingRequest): Promise<void> {
    console.log(`Usage Tracking Payload: ${JSON.stringify(payload)}`);
    axios.post(RUDDERSTACK_URL, payload, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${RUDDERSTACK_WRITE_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
    });
  }
}
