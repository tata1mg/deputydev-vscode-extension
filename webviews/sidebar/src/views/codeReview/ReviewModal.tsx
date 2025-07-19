import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useCodeReviewSettingStore, useCodeReviewStore } from '@/stores/codeReviewStore';
import { TriangleAlert } from 'lucide-react';
import { codeReviewPreProcess } from '@/commandApi';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartReview: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onStartReview }) => {
  const { userAgents } = useCodeReviewStore();
  const { enabledAgents } = useCodeReviewSettingStore();

  const handleCodeReview = () => {
    codeReviewPreProcess({ diff_s3_url: '', source_branch: '', target_branch: '' });
    onStartReview();
  };

  const toggleAgent = (agentId: number, agentName: string) => {
    useCodeReviewSettingStore.setState((state) => {
      const isEnabled = state.enabledAgents.some((a) => a.id === agentId);
      const updatedAgents = isEnabled
        ? state.enabledAgents.filter((a) => a.id !== agentId)
        : [...state.enabledAgents, { id: agentId, displayName: agentName }];

      return { enabledAgents: updatedAgents };
    });
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.2 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.15 },
    },
  };

  const modalVariants: Variants = {
    hidden: {
      opacity: 0,
      y: -20,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        damping: 25,
        stiffness: 500,
      },
    },
    exit: {
      opacity: 0,
      y: 20,
      scale: 0.95,
      transition: {
        duration: 0.15,
      },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm"
          onClick={onClose}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={backdropVariants}
        >
          <motion.div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            variants={modalVariants}
          >
            <div className="mb-6 flex flex-col gap-2">
              <div className="mb-4 flex flex-col space-y-2">
                <h2 className="text-center text-xl font-semibold">Confirm Code Review Agents</h2>
                {/* <p className="text-lg font-semibold">
                    {activeReviewOption?.value === 'ALL' && 'Reviewing all changes'}
                    {activeReviewOption?.value === 'UNCOMMITTED_ONLY' && 'Reviewing all uncommitted changes'}
                    {activeReviewOption?.value === 'COMMITTED_ONLY' && 'Reviewing all committed changes'}
                </p> */}
              </div>

              <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-md border border-[var(--vscode-editorWidget-border)] p-2">
                <span className="mb-2 pl-1 text-lg font-semibold text-[var(--vscode-foreground)]">
                  Active Review Agents
                </span>

                <hr className="border-[var(--vscode-editorWidget-border)]" />

                {userAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between rounded p-2 hover:bg-[var(--vscode-list-hoverBackground)]"
                  >
                    <span className="text-sm">{agent.display_name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAgent(agent.id, agent.display_name);
                      }}
                      className={`relative h-5 w-10 rounded-full transition-colors duration-300 ${
                        enabledAgents.some((enabledAgent) => enabledAgent.id === agent.id)
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300 ${
                          enabledAgents.some((enabledAgent) => enabledAgent.id === agent.id)
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2">
              {enabledAgents.length === 0 ? (
                <div className="mb-3 flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs italic text-yellow-600">
                    Please enable at least one agent to proceed.
                  </span>
                </div>
              ) : (
                <p className="mb-3 text-center text-sm italic text-green-600">
                  You are ready to review your code.
                </p>
              )}
              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="rounded px-4 py-2 text-sm hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={enabledAgents.length > 0 ? { scale: 1.02 } : {}}
                  whileTap={enabledAgents.length > 0 ? { scale: 0.98 } : {}}
                  onClick={() => {
                    handleCodeReview();
                  }}
                  className={`rounded px-4 py-2 text-sm ${
                    enabledAgents.length > 0
                      ? 'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]'
                      : 'cursor-not-allowed bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] opacity-70'
                  }`}
                  disabled={enabledAgents.length === 0}
                >
                  Start Review
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
