export const API_ENDPOINTS = {
    GET_SESSION: "/end_user/v1/auth/get-session",
    VERIFY_AUTH_TOKEN: "/end_user/v1/auth/verify-auth-token",
    QUERY_SOLVER: "/end_user/v2/code-gen/generate-code",
    STORE_AUTH_TOKEN: "/v1/auth/store_token",
    LOAD_AUTH_TOKEN: "/v1/auth/load_token",
    RELEVANT_CHUNKS: "/v1/relevant_chunks",
    UPDATE_VECTOR_DB: "/v1/update_chunks",
    PAST_SESSIONS: "/end_user/v1/history/sessions",
    PAST_CHATS: "/end_user/v1/history/chats",
    DELETE_SESSION: "/end_user/v1/history/delete-session",
    GENERATE_INLINE_EDIT: "/end_user/v2/code-gen/generate-inline-edit",
    GET_INLINE_EDIT_RESULT: "/end_user/v1/code-gen/get-job-status",
    DIFF_APPLIER : "/v1/diff-applicator/apply-unified-diff",
    BATCH_CHUNKS_SEARCH : "/v1/batch_chunks_search",
    RELEVANT_CHAT_HISTORY: "/end_user/v1/history/relevant-chat-history",
    INIT_BINARY: "/v1/init"
}