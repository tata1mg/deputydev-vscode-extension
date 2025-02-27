export const API_ENDPOINTS = {
    GET_SESSION: "/end_user/v1/get-session",
    VERIFY_AUTH_TOKEN: "/end_user/v1/verify-auth-token",
    QUERY_SOLVER: "/end_user/query_solver/v1/solve-user-query",
    STORE_AUTH_TOKEN: "/v1/auth/store_token",
    LOAD_AUTH_TOKEN: "/v1/auth/load_token",
    RELEVANT_CHUNKS: "/v1/relevant_chunks",
    UPDATE_VECTOR_DB: "/v1/update_chunks",
    PAST_SESSIONS: "/end_user/history/v1/sessions",
    PAST_CHATS: "/end_user/history/v1/chats",
    DELETE_SESSION: "/end_user/history/v1/delete_session",
} as const;