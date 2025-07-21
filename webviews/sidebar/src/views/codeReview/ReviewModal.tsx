import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useCodeReviewSettingStore, useCodeReviewStore } from '@/stores/codeReviewStore';
import { TriangleAlert } from 'lucide-react';
import { codeReviewPreProcess } from '@/commandApi';
import { Info } from 'lucide-react';
import { Tooltip } from 'react-tooltip';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartReview: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, onStartReview }) => {
  const { userAgents } = useCodeReviewStore();
  const { enabledAgents } = useCodeReviewSettingStore();

  const handleCodeReview = () => {
    codeReviewPreProcess(useCodeReviewStore.getState().new_review);
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

              <div className="space-y-2 rounded-md border border-[var(--vscode-editorWidget-border)] p-2">
                <div className="sticky top-0 z-10 border-b border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2 text-sm font-semibold text-[var(--vscode-foreground)]">
                  Predefined Agents
                </div>
                <div className="max-h-[90px] overflow-y-auto">
                  {userAgents.filter((agent) => !agent.is_custom_agent).length === 0 && (
                    <div className="p-2 text-xs text-[var(--vscode-descriptionForeground)]">
                      No predefined agents available.
                    </div>
                  )}
                  {userAgents
                    .filter((agent) => !agent.is_custom_agent)
                    .map((agent) => (
                      <div key={agent.id} className="w-full">
                        <div className="flex w-full cursor-pointer items-center justify-between p-2 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)]">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex-1 truncate">{agent.display_name}</span>
                            <Info
                              className="mr-2 h-4 w-4 flex-shrink-0 opacity-30 hover:opacity-60"
                              data-tooltip-id="code-review-tooltips"
                              data-tooltip-content={agent.objective}
                              data-tooltip-place="top-start"
                              data-tooltip-class-name="z-50 max-w-[80%]"
                              data-tooltip-effect="solid"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAgent(agent.id, agent.display_name);
                                }}
                                className={`relative h-4 w-8 rounded-full transition-colors duration-300 ${
                                  enabledAgents.some((enabledAgent) => enabledAgent.id === agent.id)
                                    ? 'bg-green-500'
                                    : 'bg-gray-300'
                                }`}
                              >
                                <div
                                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-md transition-transform duration-300 ${
                                    enabledAgents.some(
                                      (enabledAgent) => enabledAgent.id === agent.id
                                    )
                                      ? 'translate-x-4'
                                      : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="sticky top-0 z-10 border-b border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2 text-sm font-semibold text-[var(--vscode-foreground)]">
                  Custom Agents
                </div>
                <div className="max-h-[90px] overflow-y-auto">
                  {userAgents.filter((agent) => agent.is_custom_agent).length === 0 && (
                    <div className="p-2 text-xs text-[var(--vscode-descriptionForeground)]">
                      No custom agents available.
                    </div>
                  )}
                  {userAgents
                    .filter((agent) => agent.is_custom_agent)
                    .map((agent) => (
                      <div key={agent.id} className="w-full">
                        <div className="flex w-full cursor-pointer items-center justify-between p-2 text-left text-xs hover:bg-[var(--vscode-list-hoverBackground)]">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex-1 truncate">{agent.display_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAgent(agent.id, agent.display_name);
                                }}
                                className={`relative h-4 w-8 rounded-full transition-colors duration-300 ${
                                  enabledAgents.some((enabledAgent) => enabledAgent.id === agent.id)
                                    ? 'bg-green-500'
                                    : 'bg-gray-300'
                                }`}
                              >
                                <div
                                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-md transition-transform duration-300 ${
                                    enabledAgents.some(
                                      (enabledAgent) => enabledAgent.id === agent.id
                                    )
                                      ? 'translate-x-4'
                                      : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
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
      <Tooltip id="code-review-tooltips" />
    </AnimatePresence>
  );
};
