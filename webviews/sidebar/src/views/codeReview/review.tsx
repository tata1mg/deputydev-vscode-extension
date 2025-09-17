import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, X } from 'lucide-react';
import { useCodeReviewStore } from '@/stores/codeReviewStore';
import { FailedAgentsDialog } from '@/views/codeReview/FailedAgentsDialog';
import { StepStatus } from '@/types';
import { useEffect, useRef, useState } from 'react';

interface Agent {
  id: number;
  name: string;
  status: StepStatus;
}

const AnimatedCheck = () => (
  <motion.div
    initial={{ scale: 0, rotate: -180 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
  >
    <Check className="h-4 w-4 text-white" />
  </motion.div>
);

const LoadingSpinner = () => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
  >
    <Loader2 className="h-4 w-4 text-yellow-500" />
  </motion.div>
);

const AgentStatus = ({ agent, status }: { agent: Agent; status: StepStatus }) => {
  const isCompleted = status === 'COMPLETED';
  const isActive = status === 'IN_PROGRESS';
  const isFailed = status === 'FAILED';
  const isStopped = status === 'STOPPED';

  const statusText = isCompleted
    ? 'completed'
    : isActive
      ? 'in progress...'
      : isFailed
        ? 'failed'
        : isStopped
          ? 'stopped'
          : 'pending';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2"
    >
      {isCompleted ? (
        <AnimatedCheck />
      ) : isActive ? (
        <LoadingSpinner />
      ) : isFailed || isStopped ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-4 w-4 items-center justify-center"
        >
          <X className={`h-3 w-3 ${isFailed ? 'text-red-500' : 'text-gray-500'}`} />
        </motion.div>
      ) : null}
      <span
        className={`text-xs ${
          isCompleted
            ? 'text-green-500'
            : isActive
              ? 'text-yellow-500'
              : isFailed
                ? 'text-red-500'
                : 'text-gray-500'
        }`}
      >
        {agent.name} agent {statusText}
      </span>
    </motion.div>
  );
};

export const Review = () => {
  const { steps, failedAgents, showFailedAgentsDialog } = useCodeReviewStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

  // Auto-scroll logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const threshold = 50; // pixels from bottom to consider "at bottom"

      if (distanceFromBottom < threshold) {
        setIsAutoScrollEnabled(true);
      } else {
        setIsAutoScrollEnabled(false);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to bottom when steps change and auto-scroll is enabled
  useEffect(() => {
    if (isAutoScrollEnabled && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [steps, isAutoScrollEnabled]);

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'COMPLETED':
        return <AnimatedCheck />;
      case 'IN_PROGRESS':
        return <LoadingSpinner />;
      case 'FAILED':
        return <X className="h-3 w-3 text-red-500" />;
      case 'STOPPED':
        return <X className="h-3 w-3 text-gray-500" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-gray-400" />;
    }
  };

  const getStatusTextColor = (status: StepStatus) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 dark:text-green-400';
      case 'IN_PROGRESS':
        return 'text-yellow-500 dark:text-yellow-400';
      case 'FAILED':
        return 'text-red-500 dark:text-red-400';
      case 'STOPPED':
        return 'text-gray-500 dark:text-gray-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  if (steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-gray-500">No active review session</p>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 px-4 pb-2"
      >
        <div
          ref={containerRef}
          className="h-[260px] overflow-y-auto rounded-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] shadow-sm"
        >
          <motion.div className="flex flex-col p-4" layout>
            <motion.h2
              className="mb-4 text-lg font-medium"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Review Progress
            </motion.h2>

            <motion.div className="space-y-4" layout>
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  className="space-y-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-center gap-3">
                    <motion.div className="flex h-6 w-6 items-center justify-center" layout>
                      {getStatusIcon(step.status)}
                    </motion.div>
                    <motion.span
                      className={`text-sm font-medium ${getStatusTextColor(step.status)}`}
                      layout="position"
                    >
                      {step.label}
                    </motion.span>
                  </div>

                  <AnimatePresence>
                    {step.agents && step.agents.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-9 space-y-2 overflow-hidden border-l-2 border-gray-200 pl-4 dark:border-gray-700"
                      >
                        {step.agents.map((agent) => (
                          <AgentStatus
                            key={`${step.id}-${agent.id}`}
                            agent={agent}
                            status={agent.status}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Show Failed Agents Dialog if there are any failed agents */}
      {showFailedAgentsDialog && failedAgents.length > 0 && <FailedAgentsDialog />}
    </>
  );
};
