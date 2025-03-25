import { binaryApi } from "../api/axios";
import { API_ENDPOINTS } from "../api/endpoints";
import { ApiErrorHandler } from "../api/apiErrorHandler";

export class FocusChunksService {
  private apiErrorHandler = new ApiErrorHandler();
  public async getFocusChunks(payload: unknown): Promise<any> {
    console.log(`get focus chunks ${JSON.stringify(payload)}`)
    let response;
    try {
      response = await binaryApi().post(
        API_ENDPOINTS.FOCUS_CHUNKS,
        payload
      );
      return response.data;
    } catch (error) {
      this.apiErrorHandler.handleApiError(error);
    }
  }
}
