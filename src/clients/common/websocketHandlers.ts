import { WebSocketClient, BASE_URL } from "./websocketClient";
import { getAuthToken } from "../../utilities/contextManager";
import { API_ENDPOINTS } from "../../services/api/endpoints";

// Updated interface for RelevantChunksParams (includes new backend fields)

export interface RelevantChunksParams {
  repo_path: string;
  query: string;
  focus_chunks?: string[];
  focus_files?: string[];
  focus_directories?: string[];
  perform_chunking?: boolean;
}

// Updated interface for UpdateVectorStoreParams (includes new backend field)
export interface UpdateVectorStoreParams {
  repo_path: string;
  chunkable_files?: string[];
}

const fetchAuthToken = (): string | null => {
  const authToken = getAuthToken();
  if (!authToken) {
    console.error("[WebSocket] Missing auth token. Ensure user is logged in.");
    return null;
  }
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
  const authToken = fetchAuthToken();
  if (!authToken) {
    throw new Error("Authentication token is required");
  }

  const client = new WebSocketClient(BASE_URL, API_ENDPOINTS.RELEVANT_CHUNKS);
  try {
    return await client.send({
      ...params,
      auth_token: authToken,
    });
  } catch (error) {
    console.error("Error fetching relevant chunks:", error);
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
  const authToken = fetchAuthToken();
  if (!authToken) {
    throw new Error("Authentication token is required while updating vector store.");
  }

  console.log("updateVectorStore with params:", params);
  const client = new WebSocketClient(BASE_URL, API_ENDPOINTS.UPDATE_VECTOR_DB);

  if (waitForResponse) {
    try {
      return await client.send({
        ...params,
        auth_token: authToken,
      });
    } catch (error) {
      console.error("Error updating vector store:", error);
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
        console.error("Error updating vector store (fire-and-forget):", error);
      });
    return { status: "sent" };
  }
};

export const updateVectorStoreWithResponse = async (
  params: UpdateVectorStoreParams
): Promise<any> => {
  const authToken = fetchAuthToken();
  if (!authToken) {
    throw new Error("Authentication token is required while updating vector store with response. , authToken: " + authToken);
  }

  console.log("updateVectorStoreWithResponse with params:", params);
  const client = new WebSocketClient(BASE_URL, API_ENDPOINTS.UPDATE_VECTOR_DB);

  try {
    const result = await client.send({
      ...params,
      auth_token: authToken,
      sync: true
    });
    console.log("✅ Response received from WebSocket:", result);
    return result;
  } catch (error) {
    console.error("❌ Error updating vector store:", error);
    throw error;
  } finally {
    client.close();
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
  console.warn(
    "subscribeToRelevantChunks is deprecated. Use async fetchRelevantChunks instead."
  );
};

export const subscribeToVectorStoreUpdates = (
  callback: (data: any) => void
): void => {
  console.warn(
    "subscribeToVectorStoreUpdates is deprecated. Use async updateVectorStore instead."
  );
};
