import axios from "axios";
import { UsageTrackingRequest } from "../../types";

const RUDDERSTACK_WRITE_KEY = "***REMOVED***"; // Replace with your actual write key
const RUDDERSTACK_URL = "https://rudderapi.1mg.com/v1/track";

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
