export const API_ENDPOINTS = {
    GETSESSION: "/end_user/v1/get-session",
    VERIFYAUTHTOKEN: "/end_user/v1/verify-auth-token",
    QUERYSOLVER: "/end_user/query_solver/v1/solve-user-query",
    
    //ws endpoints
    UPDATEVECTORDB: "/v1/update_vector_store",
    RELEVANTCHUNKS: "/v1/relevant_chunks",
} as const;