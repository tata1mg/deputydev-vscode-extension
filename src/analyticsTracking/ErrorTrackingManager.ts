import { CLIENT_VERSION } from '../config';
import { ErrorTrackingService } from '../services/errorTracking/ErrorTrackingService';
import { ErrorTrackingRequestForBackend, ToolRequest } from '../types';
import { getActiveRepo, getSessionId, getUserData } from '../utilities/contextManager';
import { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class ErrorTrackingManager {
  onStarted: () => void = () => {};
  onError: (error: Error) => void = () => {};
  private errorTrackingService = new ErrorTrackingService();

  async trackError(errorPayload: {
    errorType: string;
    errorSource: string;
    errorData: Record<string, any>;
    repoName?: string;
    sessionId?: number;
    timestamp?: string;
  }) {
    const userData = getUserData();
    const userEmail = userData?.email;
    const activeRepo = getActiveRepo();
    const sessionId = getSessionId();

    const errorAnalyticsPayload: ErrorTrackingRequestForBackend = {
      error_id: uuidv4(),
      error_type: errorPayload.errorType,
      error_source: errorPayload.errorSource,
      error_data: errorPayload.errorData,
      user_email: userEmail,
      repo_name: activeRepo,
      session_id: sessionId,
      client_version: CLIENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    await this.errorTrackingService.trackErrorEvent(errorAnalyticsPayload);
  }

  /**
   * Tracks an error that occurs during tool execution.
   * @param error The Error object caught during tool execution.
   * @param toolRequest The ToolRequest associated with this execution.
   */
  async trackToolExecutionError(error: unknown, toolRequest: ToolRequest) {
    // Always include these basics:
    const baseErrorData = {
      toolName: toolRequest.tool_name,
      toolUseId: toolRequest.tool_use_id,
      data:
        toolRequest.accumulatedContent.length > 500
          ? toolRequest.accumulatedContent.substring(0, 500) + '...'
          : toolRequest.accumulatedContent,
    };
    let errorData: Record<string, any> = {};

    // AxiosError case
    if (error instanceof AxiosError) {
      // Remove traceback field from responseData if exists and is an object
      let cleanedResponseData = error.response?.data;
      if (cleanedResponseData && typeof cleanedResponseData === 'object' && 'traceback' in cleanedResponseData) {
        const { traceback, ...rest } = cleanedResponseData;
        cleanedResponseData = rest;
      }

      errorData = {
        ...baseErrorData,
        errorName: error.name,
        errorCode: error.code,
        errorMessage: error.message,
        baseURL: error.config?.baseURL,
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        responseData: cleanedResponseData,
      };
    }
    // Standard JS Error case
    else if (error instanceof Error) {
      const err = error as any;
      errorData = {
        ...baseErrorData,
        errorName: error.name,
        errorCode: err.code,
        errorMessage: error.message,
        status: err.status,
        baseURL: err.config?.baseURL,
        url: err.config?.url,
        method: err.config?.method,
      };
    }
    // WebSocket or other unknown error shapes
    else if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, any>;
      errorData = {
        ...baseErrorData,
        errorName: err.name ?? 'UnknownError',
        errorMessage: err.message ?? 'An unknown error occurred during tool execution.',
        ...err, // spreads any other properties if present
      };
    }
    // Truly unknown error
    else {
      errorData = {
        ...baseErrorData,
        errorName: 'UnknownError',
        errorMessage: 'An unknown error occurred during tool execution.',
        errorValue: error,
      };
    }

    let errorSource = 'BINARY';
    if (toolRequest.tool_name === 'write_to_file' || toolRequest.tool_name === 'replace_in_file') {
      errorSource = 'EXTENSION';
    }
    await this.trackError({
      errorType: 'TOOL_EXECUTION_ERROR',
      errorSource: errorSource,
      errorData,
    });
  }

  /**
   * Tracks any general error (non-tool-specific).
   * @param error The caught error (unknown type).
   * @param errorType The type of error (e.g., 'API_ERROR', 'UI_ERROR').
   * @param errorSource The source of the error (e.g., 'EXTENSION', 'BINARY', 'BACKEND').
   * This method handles AxiosError, standard Error, and other object types.
   * It cleans up the error data to avoid sending sensitive information like tracebacks.
   */
  async trackGeneralError(
    error: unknown,
    errorType: string,
    errorSource: 'EXTENSION' | 'BINARY' | 'BACKEND',
    extraData?: Record<string, any>,
  ) {
    let errorData: Record<string, any> = {};

    if (error instanceof AxiosError) {
      // Remove traceback field from responseData if exists and is an object
      let cleanedResponseData = error.response?.data;
      if (cleanedResponseData && typeof cleanedResponseData === 'object' && 'traceback' in cleanedResponseData) {
        const { traceback, ...rest } = cleanedResponseData;
        cleanedResponseData = rest;
      }
      errorData = {
        errorName: error.name,
        errorCode: error.code,
        errorMessage: error.message,
        baseURL: error.config?.baseURL,
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        responseData: cleanedResponseData,
      };
    } else if (error instanceof Error) {
      console.log('Error tracking:', error);
      errorData = {
        errorName: error.name,
        errorMessage: error.message,
      };
    } else if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, any>;
      errorData = {
        errorName: err.name ?? 'UnknownError',
        errorMessage: err.message ?? 'An unknown error occurred during tool execution.',
        ...err, // spreads any other properties if present
      };
    } else {
      errorData = {
        errorName: 'UnknownError',
        errorMessage: 'An unknown error occurred during tool execution.',
        errorValue: error,
      };
    }
    errorData = { ...errorData, ...(extraData ?? {}) };

    await this.trackError({
      errorType: errorType,
      errorSource: errorSource,
      errorData,
    });
  }
}
