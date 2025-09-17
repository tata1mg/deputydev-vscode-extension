import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Tooltip } from 'react-tooltip';
import { resetReview } from '@/commandApi';
import { on } from 'events';

interface ResetReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ResetReviewModal: React.FC<ResetReviewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const handleConfirm = () => {
    onClose();
    onConfirm();
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.15 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.1 },
    },
  };

  const modalVariants: Variants = {
    hidden: {
      opacity: 0,
      y: -10,
      scale: 0.98,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        damping: 30,
        stiffness: 600,
      },
    },
    exit: {
      opacity: 0,
      y: 10,
      scale: 0.98,
      transition: {
        duration: 0.1,
      },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 backdrop-blur-sm"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={backdropVariants}
        >
          <motion.div
            className="flex w-full max-w-xs flex-col rounded-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            variants={modalVariants}
          >
            <div className="flex flex-col gap-3">
              <h2 className="text-center text-sm font-medium text-[var(--vscode-foreground)]">
                Are you sure you want to reset the reviews?
              </h2>
              <div className="flex justify-center gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 rounded px-3 py-1.5 text-xs font-medium text-[var(--vscode-foreground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 rounded bg-[var(--vscode-button-background)] px-3 py-1.5 text-xs font-medium text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
                >
                  Reset
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      <Tooltip id="code-review-tooltips" />
    </AnimatePresence>
  );
};
