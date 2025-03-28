import axios from "axios";
import { UsageTrackingRequest} from "../../types";
import { getMainConfig } from "../../config/configSetGet";

export class UsageTrackingService {
  public async trackUsage(payload: UsageTrackingRequest): Promise<void> {
    console.log("****Usage Tracking Payload*******", payload)
    const RUDDERSTACK_URL = getMainConfig()["RUDDER"]["DATA_PLANE_URL"];
    const RUDDERSTACK_WRITE_KEY = getMainConfig()["RUDDER"]["WRITE_KEY"];
    axios.post(RUDDERSTACK_URL, payload, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${RUDDERSTACK_WRITE_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
    });
  }
}
