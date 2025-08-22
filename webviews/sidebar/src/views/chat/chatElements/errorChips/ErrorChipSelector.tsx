import { InputTokenLimitErrorData, LLMThrottlingException } from '@/types';
import { ThrottledChatMessage } from './ThrottledPanel';
import { TokenLimitExceededPanel } from './TokenLimitExceededPanel';
import React from 'react';
import { RetryChip } from './RetryChip';

// Type guard functions for error data
const isInputTokenLimitErrorData = (errorData: any): errorData is InputTokenLimitErrorData => {
  return (
    errorData &&
    (errorData.type === 'STREAM_ERROR' || errorData.type === 'TOKEN_LIMIT_ERROR') &&
    typeof errorData.current_tokens === 'number' &&
    typeof errorData.max_tokens === 'number'
  );
};

const isLLMThrottlingException = (errorData: any): errorData is LLMThrottlingException => {
  return errorData && errorData.type === 'THROTTLING_ERROR';
};

const ErrorChipSelector: React.FC<{ msg: any }> = ({ msg }) => {
  if (isLLMThrottlingException(msg.errorData)) {
    return (
      <ThrottledChatMessage
        retryAfterSeconds={msg.errorData.retry_after}
        currentModel={msg.errorData.model_name}
        errorMessage={msg.error_msg}
        retry={msg.retry}
        payloadToRetry={msg.payload_to_retry}
      />
    );
  } else if (isInputTokenLimitErrorData(msg.errorData)) {
    return (
      <TokenLimitExceededPanel
        currentModel={msg.errorData.model || 'Unknown'}
        query={msg.errorData.query || ''}
        errorMessage={msg.error_msg}
        retry={msg.retry}
        payloadToRetry={msg.payload_to_retry}
        betterModels={msg.errorData.better_models}
      />
    );
  } else {
    // Otherwise, show the old error UI
    return (
      <div>
        <RetryChip
          error_msg={msg.error_msg}
          retry={msg.retry}
          payload_to_retry={msg.payload_to_retry}
        />
      </div>
    );
  }
};

export default ErrorChipSelector;
