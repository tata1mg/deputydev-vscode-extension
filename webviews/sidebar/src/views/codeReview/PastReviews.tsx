import { openCommentInFile } from '@/commandApi';
import { useCodeReviewStore } from '@/stores/codeReviewStore';
import { CodeReviewComment } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Funnel } from 'lucide-react';
import { useState } from 'react';

const markdownComment = `
            This is a heading
            This is **bold** and *italic* text.

            // This is a code block
            function example() {
                return "Hello, world!";
            }
            `;

export const PastReviews = () => {
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const { pastReviews } = useCodeReviewStore();

  const toggleReview = (reviewId: string) => {
    setExpandedReview(expandedReview === reviewId ? null : reviewId);
    setExpandedFile(null);
  };

  const toggleFile = (filePath: string) => {
    setExpandedFile(expandedFile === filePath ? null : filePath);
  };
  return (
    <div className="mt-2 flex h-full flex-col px-4">
      <div
        className="flex w-full rounded-t-lg border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
        style={{
          boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex w-full items-center justify-between px-4 py-2">
          <div className="relative flex-1 text-sm font-medium">Past Reviews</div>
          <Funnel className="h-4 w-4" />
        </div>
      </div>

      <div
        className="flex-1 overflow-auto rounded-b-lg border border-t-0 border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
        style={{
          boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
        }}
      >
        {pastReviews.map((review) => {
          // Group comments by file path
          const filesWithComments = review.comments.reduce<Record<string, CodeReviewComment[]>>(
            (acc, comment) => {
              if (!acc[comment.file_path]) {
                acc[comment.file_path] = [];
              }
              acc[comment.file_path].push(comment);
              return acc;
            },
            {}
          );

          const fileCount = Object.keys(filesWithComments).length;
          const commentCount = review.comments.length;
          const reviewDate = new Date(review.created_at).toLocaleDateString();

          return (
            <div key={review.id} className="m-1 text-sm">
              <div
                className="flex cursor-pointer items-center justify-between rounded px-2 py-0.5 hover:bg-[var(--vscode-list-hoverBackground)]"
                onClick={() => toggleReview(review.id.toString())}
              >
                <div className="flex items-center">
                  <motion.div
                    animate={{ rotate: expandedReview === review.id.toString() ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </motion.div>
                  <div className="flex flex-col px-2">
                    <span className="text-sm font-medium">Review #{review.id}</span>
                    <span className="text-[8px] text-[var(--vscode-descriptionForeground)]">
                      {reviewDate}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                  {fileCount} files • {commentCount} comments
                </div>
              </div>

              <AnimatePresence>
                {expandedReview === review.id.toString() && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{
                      opacity: 1,
                      height: 'auto',
                      transition: {
                        opacity: { duration: 0.2 },
                        height: { duration: 0.3, ease: 'easeInOut' },
                      },
                    }}
                    exit={{
                      opacity: 0,
                      height: 0,
                      transition: {
                        opacity: { duration: 0.15 },
                        height: { duration: 0.25, ease: 'easeInOut' },
                      },
                    }}
                    className="overflow-hidden border-t border-[var(--vscode-editorWidget-border)] text-xs"
                  >
                    {Object.entries(filesWithComments).map(([filePath, comments]) => (
                      <div key={filePath} className="pl-4">
                        <div
                          className="flex cursor-pointer items-center justify-between p-1.5 hover:bg-[var(--vscode-list-hoverBackground)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFile(filePath);
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <motion.div
                              animate={{ rotate: expandedFile === filePath ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight size={12} className="flex-shrink-0" />
                            </motion.div>
                            <span className="min-w-0 flex-1 truncate">{filePath}</span>
                            <div className="flex flex-shrink-0 items-center gap-1 text-xs text-[var(--vscode-descriptionForeground)]">
                              {comments.length}
                              <span className="text-red-600">!</span>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedFile === filePath && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{
                                opacity: 1,
                                height: 'auto',
                                transition: {
                                  opacity: { duration: 0.2 },
                                  height: { duration: 0.3, ease: 'easeInOut' },
                                },
                              }}
                              exit={{
                                opacity: 0,
                                height: 0,
                                transition: {
                                  opacity: { duration: 0.15 },
                                  height: { duration: 0.25, ease: 'easeInOut' },
                                },
                              }}
                              className="overflow-hidden"
                            >
                              {comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="cursor-pointer border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] py-1.5 pl-6 pr-2 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                                  onClick={() => {
                                    openCommentInFile({
                                      filePath: 'utils/actions.ts',
                                      lineNumber: 2,
                                      commentText: markdownComment,
                                    });
                                  }}
                                >
                                  <div className="text-[11px] text-[var(--vscode-descriptionForeground)]">
                                    Line {comment.line_number} • {comment.tag}
                                  </div>
                                  <div className="leading-tight">{comment.comment}</div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PastReviews;
