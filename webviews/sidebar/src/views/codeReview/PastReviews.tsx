import { openCommentInFile } from '@/commandApi';
import { useCodeReviewStore } from '@/stores/codeReviewStore';
import { AgentSummary, CodeReviewComment, Review } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, User, Bug, TriangleAlert, FileWarning, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';

export const PastReviews = () => {
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<Set<number>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const { pastReviews, userAgents } = useCodeReviewStore();

  const tagColors = (tag: string) => {
    const lowerTag = tag.toLowerCase();
    if (lowerTag === 'bug') return 'bg-red-700';
    if (lowerTag === 'suggestion') return 'bg-yellow-600';
    return 'bg-blue-600';
  };

  const toggleReview = (reviewId: string) => {
    setExpandedReview(expandedReview === reviewId ? null : reviewId);
    setExpandedFile(null);
  };

  const toggleFile = (filePath: string) => {
    setExpandedFile(expandedFile === filePath ? null : filePath);
  };

  const toggleAgent = (agentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAgents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const toggleTag = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const getFilteredComments = (comments: CodeReviewComment[]) => {
    return comments.filter((comment) => {
      const tagMatch = selectedTags.size === 0 || selectedTags.has(comment.tag);
      const agentMatch =
        selectedAgents.size === 0 || comment.agent_ids.some((id) => selectedAgents.has(id));
      return tagMatch && agentMatch;
    });
  };

  const getAllTags = (review: Review) => {
    const tags = new Set<string>();
    Object.values(review.comments).forEach((comments) => {
      comments.forEach((comment) => {
        tags.add(comment.tag);
      });
    });
    return Array.from(tags);
  };

  const hasVisibleComments = (review: Review) => {
    if (selectedAgents.size === 0 && selectedTags.size === 0) {
      return true;
    }

    return Object.values(review.comments).some((comments) => {
      return getFilteredComments(comments).length > 0;
    });
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
        </div>
      </div>

      <div
        className="flex-1 overflow-auto rounded-b-lg border border-t-0 border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
        style={{
          boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
        }}
      >
        {pastReviews.map((review: Review) => {
          if (!hasVisibleComments(review)) return null;

          const fileCount = review.meta.file_count;
          const commentCount = review.meta.comment_count;
          const reviewDate = review.review_datetime
            ? new Date(review.review_datetime).toLocaleDateString()
            : 'No date';
          const allTags = getAllTags(review);

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
                    <span className="text-sm font-medium">{review.title}</span>
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
                    {/* Agent Filter */}
                    <div className="my-3 flex flex-col gap-2 pl-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Agents</span>
                        {selectedAgents.size > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAgents(new Set());
                            }}
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                          >
                            <X size={12} /> Clear
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {review.agent_summary.map((agent: AgentSummary) => {
                          const isSelected = selectedAgents.has(agent.id);
                          return (
                            <div
                              key={agent.id}
                              onClick={(e) => toggleAgent(agent.id, e)}
                              className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white opacity-50 hover:opacity-75'}`}
                            >
                              <User className="h-3 w-3" />
                              <span className="text-xs">{agent.display_name}</span>
                              <span className="ml-1 rounded-full bg-blue-500 px-1.5 text-[10px] font-bold">
                                {agent.count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Tag Filter */}
                    <div className="mb-3 flex flex-col gap-2 pl-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Tags</span>
                        {selectedTags.size > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTags(new Set());
                            }}
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                          >
                            <X size={12} /> Clear
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {allTags.map((tag: string) => {
                          const isSelected = selectedTags.has(tag);
                          const Icon = tag.toLowerCase() === 'bug' ? Bug : TriangleAlert;
                          return (
                            <div
                              key={tag}
                              onClick={(e) => toggleTag(tag, e)}
                              className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] transition-colors ${tagColors(tag)} ${isSelected ? 'opacity-100' : 'opacity-50 hover:opacity-75'}`}
                            >
                              <Icon size={12} />
                              {tag.toUpperCase()}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Files and Comments */}
                    {Object.entries(review.comments).map(
                      ([filePath, comments]: [string, CodeReviewComment[]]) => {
                        const filteredComments = getFilteredComments(comments);
                        if (filteredComments.length === 0) return null;

                        return (
                          <div key={filePath} className="pl-4">
                            <div
                              className="flex cursor-pointer items-center justify-between p-1.5 hover:bg-[var(--vscode-list-hoverBackground)]"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFile(filePath);
                              }}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <motion.div
                                  animate={{ rotate: expandedFile === filePath ? 90 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronRight size={12} className="flex-shrink-0" />
                                </motion.div>
                                <div className="flex min-w-0 flex-1 items-center">
                                  <div
                                    data-tooltip-id="code-review-tooltips"
                                    data-tooltip-content={filePath}
                                    data-tooltip-place="top-start"
                                    data-tooltip-class-name="max-w-[80%] break-words whitespace-normal"
                                    style={{
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      direction: 'rtl',
                                      textAlign: 'left',
                                      flex: 1,
                                    }}
                                  >
                                    {filePath}
                                  </div>
                                </div>
                                <div className="ml-2 flex items-center gap-1 whitespace-nowrap text-xs text-[var(--vscode-descriptionForeground)]">
                                  {filteredComments.length}
                                  <FileWarning className="h-4 w-4 flex-shrink-0 text-red-600" />
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
                                  {filteredComments.map((comment: CodeReviewComment) => (
                                    <div
                                      key={comment.id}
                                      className="cursor-pointer border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] py-1.5 pl-6 pr-2 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                                      onClick={() => {
                                        openCommentInFile({
                                          filePath: comment.file_path || 'utils/actions.ts',
                                          lineNumber: comment.line_number - 1,
                                          commentText: comment.comment,
                                        });
                                      }}
                                    >
                                      <div className="flex w-full flex-col gap-1">
                                        <div className="flex w-full items-center justify-between">
                                          <div className="truncate font-semibold">
                                            {comment.title}
                                          </div>
                                          <span className="whitespace-nowrap text-xs text-[var(--vscode-descriptionForeground)]">
                                            Line {comment.line_number}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1">
                                          {comment.agent_ids.map((agentId: number) => (
                                            <div
                                              key={agentId}
                                              className="flex w-fit items-center gap-1 rounded-md border border-[var(--vscode-editorWidget-border)] bg-gray-800 px-1 py-0.5 text-[10px] text-white"
                                            >
                                              <User className="h-3 w-3" />
                                              <span>
                                                {
                                                  userAgents.find((ua) => ua.id === agentId)
                                                    ?.display_name
                                                }
                                              </span>
                                            </div>
                                          ))}
                                          <div
                                            className={`w-fit rounded-md border px-1 py-0.5 text-[10px] text-white ${tagColors(comment.tag)} flex items-center gap-1`}
                                          >
                                            {comment.tag.toLowerCase() === 'bug' ? (
                                              <Bug size={10} />
                                            ) : (
                                              <TriangleAlert size={10} />
                                            )}
                                            {comment.tag.toUpperCase()}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      }
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
      <Tooltip id="code-review-tooltips" />
    </div>
  );
};

export default PastReviews;
