import { WebSocketClient } from "./websocketClient";
import { API_ENDPOINTS } from "../../services/api/endpoints";
import { AuthService } from "../../services/auth/AuthService";
import { getBinaryWsHost } from "../../config";
import { SingletonLogger } from "../../utilities/Singleton-logger";
// Updated interface for RelevantChunksParams (includes new backend fields)

export interface RelevantChunksParams {
  repo_path: string;
  query: string;
  focus_chunks?: string[];
  focus_files?: string[];
  focus_directories?: string[];
  perform_chunking?: boolean;
  session_id?: number;
  session_type?: string;
}

// Updated interface for UpdateVectorStoreParams (includes new backend field)
export interface UpdateVectorStoreParams {
  repo_path: string;
  chunkable_files?: string[];
}

const fetchAuthToken = async () => {
  const authService = new AuthService();
  const authToken = await authService.loadAuthToken();
  return authToken;
};

/**
 * Fetch relevant chunks using WebSocket in a request–response pattern.
 * @param params Parameters for the request.
 * @returns Promise resolving to the response data.
 */

export const fetchRelevantChunks = async (
  params: RelevantChunksParams
): Promise<any> => {
  const authToken = await fetchAuthToken();
  const logger = SingletonLogger.getInstance();
  if (!authToken) {
    throw new Error("Authentication token is required");
  }
  const Websocket_host = getBinaryWsHost();
  // console.log("websocket host:", Websocket_host);
  const client = new WebSocketClient(Websocket_host, API_ENDPOINTS.RELEVANT_CHUNKS, authToken);
  try {
    return await client.send({
      ...params
    });
  } catch (error) {
    logger.error("Error fetching relevant chunks");
    // console.error("Error fetching relevant chunks:", error);
    throw error;
  } finally {
    client.close();
  }
};

/**
 * Update vector store using WebSocket in a request–response pattern.
 * @param params Parameters for the request.
 * @returns Promise resolving to the response data.
 */

export const updateVectorStore = async (
  params: UpdateVectorStoreParams,
  waitForResponse: boolean = false
): Promise<any> => {
  const authToken = await fetchAuthToken();
  const logger = SingletonLogger.getInstance();
  if (!authToken) {
    throw new Error("Authentication token is required while updating vector store.");
  }

  // console.log("updateVectorStore with params:", params);
  const client = new WebSocketClient(getBinaryWsHost(), API_ENDPOINTS.UPDATE_VECTOR_DB, authToken);

  if (waitForResponse) {
    try {
      return await client.send({
        ...params
      });
    } catch (error) {
      logger.error("Error updating vector store");
      // console.error("Error updating vector store:", error);
      throw error;
    } finally {
      client.close();
    }
  } else {
    // Fire-and-forget mode: send the message and do not wait for a response.
    client
      .send({
        ...params,
        auth_token: authToken,
      })
      .catch((error) => {
        logger.error("Error updating vector store");
        // console.error("Error updating vector store (fire-and-forget):", error);
      });
    return { status: "sent" };
  }
};

export const updateVectorStoreWithResponse = async (
  params: UpdateVectorStoreParams
): Promise<any> => {
  const authToken = await fetchAuthToken();
  const logger = SingletonLogger.getInstance();
  if (!authToken) {
    throw new Error("Authentication token is required while updating vector store with response. , authToken: " + authToken);
  }

  // console.log("updateVectorStoreWithResponse with params:", params);
  const client = new WebSocketClient(getBinaryWsHost(), API_ENDPOINTS.UPDATE_VECTOR_DB, authToken);

  let attempts = 0;
  while (attempts < 3) {
    try {
      const result = await client.send({
        ...params,
        sync: true
      });
      logger.info("Response received from binary WebSocket:", result);
      // console.log("✅ Response received from WebSocket:", result);
      return result;
    } catch (error) {
      attempts++;
      // console.error(`❌ Error updating vector store (attempt ${attempts}):`, error);
      if (attempts === 3) {
        logger.error("Error updating vector store after 3 attempts");
        throw new Error(`Failed to update vector store after 3 attempts: ${error}`);
      }
    }
  }
};

// export const updateVectorStoreFireAndForget = (
//   params: UpdateVectorStoreParams
// ): void => {
//   const authToken = fetchAuthToken();
//   if (!authToken) {
//     throw new Error("Authentication token is required
//   }

//   console.log("🚀 updateVectorStoreFireAndForget with params:", params);
//   const client = new WebSocketClient(BASE_URL, API_ENDPOINTS.UPDATE_VECTOR_DB);

//   client
//     .send({
//       ...params,
//       auth_token: authToken,
//     })
//     .catch((error) => {
//       console.error("❌ Error updating vector store (fire-and-forget):", error);
//     });

//   client.close(); // Close WebSocket immediately after sending
//   console.log("✅ Fire-and-forget request sent and WebSocket closed.");
// };

// Keeping these for backward compatibility, with deprecation warnings
export const subscribeToRelevantChunks = (
  callback: (data: any) => void
): void => {
  // console.warn(
  //   "subscribeToRelevantChunks is deprecated. Use async fetchRelevantChunks instead."
  // );
};

export const subscribeToVectorStoreUpdates = (
  callback: (data: any) => void
): void => {
  // console.warn(
  //   "subscribeToVectorStoreUpdates is deprecated. Use async updateVectorStore instead."
  // );
};
