import { cancelReview, startCodeReviewPostProcess } from '@/commandApi';
import { useCodeReviewStore } from '@/stores/codeReviewStore';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export const FailedAgentsDialog = () => {
  const { failedAgents } = useCodeReviewStore();

  const handleReviewCancel = () => {
    console.log('Review cancelled');
    useCodeReviewStore.getState().setShowFailedAgentsDialog(false);
    cancelReview();
  };

  const handleReviewProceed = () => {
    console.log('Review proceeded');
    startCodeReviewPostProcess({ review_id: useCodeReviewStore.getState().activeReviewId });
    useCodeReviewStore.getState().setShowFailedAgentsDialog(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--vscode-editorWidget-border)] p-4">
          <h3 className="font-medium">Review Status</h3>
        </div>

        <div className="p-4">
          <p className="mb-4 text-[var(--vscode-foreground)]">
            {failedAgents.length === 1
              ? '1 agent has failed:'
              : `${failedAgents.length} agents have failed:`}
          </p>

          <ul className="mb-6 space-y-2">
            {failedAgents.map((agent) => (
              <li
                key={agent.id}
                className="flex items-center text-sm text-[var(--vscode-foreground)]"
              >
                <span className="mr-2 h-2 w-2 rounded-full bg-red-500"></span>
                {agent.name}
              </li>
            ))}
          </ul>

          <div className="flex justify-end space-x-2">
            <button
              onClick={() => {
                handleReviewCancel();
              }}
              className="rounded border border-[var(--vscode-button-secondaryBackground)] px-4 py-2 text-sm text-[var(--vscode-button-secondaryForeground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handleReviewProceed();
              }}
              className="rounded bg-[var(--vscode-button-background)] px-4 py-2 text-sm text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
            >
              Proceed Anyway
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
