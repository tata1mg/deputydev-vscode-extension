import { openCommentInFile, sendCommentStatusUpdate } from '@/commandApi';
import { useCodeReviewStore } from '@/stores/codeReviewStore';
import { AgentSummary, CodeReviewComment, Review } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Bug,
  TriangleAlert,
  FileWarning,
  X,
  LoaderCircle,
  Undo2,
  BotMessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { Tooltip } from 'react-tooltip';

export const PastReviews = () => {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<Set<number>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const { pastReviews, userAgents } = useCodeReviewStore();

  const markCommentUnresolved = (commentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    useCodeReviewStore.setState((state) => ({
      pastReviews: state.pastReviews.map((review) => ({
        ...review,
        comments: Object.fromEntries(
          Object.entries(review.comments).map(([filePath, comments]) => [
            filePath,
            comments.map((comment) =>
              comment.id === commentId ? { ...comment, comment_status: 'NOT_REVIEWED' } : comment
            ),
          ])
        ),
      })),
    }));
    sendCommentStatusUpdate(commentId, 'NOT_REVIEWED');
  };

  const formatCodeBlock = (code: string): string => {
    if (!code?.trim()) return '';

    // Replace escaped newlines with actual newlines and remove leading/trailing whitespace
    const cleanCode = code.replace(/\\n/g, '\n').replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');

    if (!cleanCode) return '';

    // If code is already wrapped in triple backticks, return as is
    const trimmedCode = cleanCode.trim();
    if (trimmedCode.startsWith('```') && trimmedCode.endsWith('```')) {
      return `\n${trimmedCode}\n`;
    }

    // Otherwise, wrap in triple backticks without language specification
    return `\n\`\`\`\n${trimmedCode}\n\`\`\`\n`;
  };

  const getFormattedComment = (
    comment: string,
    correctiveCode: string,
    rationale: string
  ): string => {
    let formattedComment = '';

    if (comment?.trim()) {
      formattedComment += `${comment.trim()}\n\n`;
    }

    if (rationale?.trim()) {
      formattedComment += `**Rationale**: ${rationale.trim()}\n\n`;
    }

    if (correctiveCode?.trim()) {
      formattedComment += `**Suggested Fix**:${formatCodeBlock(correctiveCode)}`;
    }

    formattedComment += '\n\n';

    return formattedComment.trim();
  };

  const tagColors = (tag: string) => {
    const lowerTag = tag.toLowerCase();
    if (lowerTag === 'bug') return 'bg-red-700';
    if (lowerTag === 'suggestion') return 'bg-yellow-600';
    return 'bg-blue-600';
  };

  const toggleReview = (reviewId: number) => {
    useCodeReviewStore.setState({
      expandedReview: useCodeReviewStore.getState().expandedReview === reviewId ? null : reviewId,
    });
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
      if (newSet.has(tag.toLowerCase())) {
        newSet.delete(tag.toLowerCase());
      } else {
        newSet.add(tag.toLowerCase());
      }
      return newSet;
    });
  };

  const getFilteredComments = (comments: CodeReviewComment[]) => {
    return comments.filter((comment) => {
      const tagMatch = selectedTags.size === 0 || selectedTags.has(comment.tag.toLowerCase());
      const agentMatch =
        selectedAgents.size === 0 || comment.agent_ids.some((id) => selectedAgents.has(id));
      return tagMatch && agentMatch;
    });
  };

  const getAllTags = (review: Review) => {
    const tagCounts = new Map<string, number>();
    Object.values(review.comments).forEach((comments) => {
      comments.forEach((comment) => {
        const normalizedTag = comment.tag.toLowerCase();
        tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries()).map(([tag, count]) => ({
      tag: tag.charAt(0).toUpperCase() + tag.slice(1),
      count,
    }));
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
          <div className="relative flex-1 text-sm font-medium">Reviews</div>
        </div>
      </div>

      {pastReviews && pastReviews.length > 0 ? (
        <div
          className="min-h-[260px] flex-1 overflow-auto rounded-b-lg border border-t-0 border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
          style={{
            boxShadow: '0 1px 1px rgba(0,0,0,0.05)',
          }}
        >
          {pastReviews.map((review: Review) => {
            const fileCount = review.meta.file_count;
            const commentCount = review.meta.comment_count;
            const reviewDate = review.review_datetime
              ? new Date(review.review_datetime).toLocaleDateString()
              : '';
            const allTags = getAllTags(review);

            return (
              <div key={review.id} className="m-1 text-sm">
                <div
                  className={`flex cursor-pointer items-center justify-between rounded-t px-2 py-1.5 hover:bg-[var(--vscode-list-hoverBackground)] ${useCodeReviewStore.getState().expandedReview === review.id ? 'border-l border-r border-t border-[var(--vscode-editorWidget-border)]' : 'rounded border border-[var(--vscode-editorWidget-border)]'}`}
                  onClick={() => toggleReview(review.id)}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <motion.div
                      animate={{
                        rotate: useCodeReviewStore.getState().expandedReview === review.id ? 90 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </motion.div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{review.title}</div>
                      <div className="flex items-center gap-2 text-[12px] text-[var(--vscode-descriptionForeground)]">
                        {reviewDate !== '' && (
                          <div className="flex items-center gap-2">
                            <span>{reviewDate}</span>
                            <span>•</span>
                          </div>
                        )}
                        <span>
                          {fileCount} {fileCount === 1 ? 'File' : 'Files'}
                        </span>
                        <span>•</span>
                        <span>
                          {commentCount} {commentCount === 1 ? 'Comment' : 'Comments'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {useCodeReviewStore.getState().expandedReview === review.id && (
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
                      className="overflow-hidden rounded-b border-b border-l border-r border-[var(--vscode-editorWidget-border)]"
                    >
                      {/* Agent Filter */}
                      {review.agent_summary.length !== 0 && (
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
                                  className={`relative flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
                                    isSelected
                                      ? 'border-[var(--vscode-editorWidget-border)] bg-gray-800 text-white opacity-50'
                                      : 'border-[var(--vscode-editorWidget-border)] bg-gray-800 text-white hover:opacity-80'
                                  }`}
                                >
                                  <BotMessageSquare className="h-3 w-3" />
                                  <span className="text-xs">{agent.display_name}</span>
                                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 font-bold leading-none">
                                    {agent.count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tag Filter */}
                      {allTags.length !== 0 && (
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
                            {allTags.map(({ tag, count }) => {
                              const isSelected = selectedTags.has(tag.toLowerCase());
                              const Icon = tag.toLowerCase() === 'bug' ? Bug : TriangleAlert;
                              return (
                                <div
                                  key={tag}
                                  onClick={(e) => toggleTag(tag, e)}
                                  className={`relative flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${tagColors(tag)} ${isSelected ? 'opacity-50' : 'hover:opacity-80'}`}
                                >
                                  <Icon size={12} />
                                  {tag.toUpperCase()}
                                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold leading-none">
                                    {count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Files and Comments */}
                      {Object.entries(review.comments).map(
                        ([filePath, comments]: [string, CodeReviewComment[]]) => {
                          const filteredComments = getFilteredComments(comments);
                          const hasComments = filteredComments.length > 0;

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
                                    {hasComments ? (
                                      <>
                                        {filteredComments.length}
                                        <FileWarning className="h-4 w-4 flex-shrink-0 text-red-600" />
                                      </>
                                    ) : (
                                      <span className="text-[var(--vscode-descriptionForeground)]">
                                        No comments
                                      </span>
                                    )}
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
                                    {hasComments ? (
                                      filteredComments.map((comment: CodeReviewComment) => {
                                        const isResolved = comment.comment_status === 'RESOLVED';
                                        const isIgnored = comment.comment_status === 'REJECTED';
                                        return (
                                          <div
                                            key={comment.id}
                                            className={`border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] py-1.5 pl-6 pr-2 text-xs ${
                                              isResolved
                                                ? 'line-through opacity-70'
                                                : 'cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]'
                                            } ${isIgnored ? 'line-through decoration-red-600 opacity-70' : ''}`}
                                            onClick={
                                              !isResolved
                                                ? () => {
                                                    openCommentInFile({
                                                      filePath: comment.file_path,
                                                      lineNumber: comment.line_number - 1,
                                                      commentText: getFormattedComment(
                                                        comment.comment,
                                                        comment.corrective_code,
                                                        comment.rationale
                                                      ),
                                                      promptText: `${comment.tag.toUpperCase()} : ${comment.title}`,
                                                      commentId: comment.id,
                                                    });
                                                  }
                                                : undefined
                                            }
                                          >
                                            <div className="flex w-full flex-col gap-1">
                                              <div className="relative flex w-full items-start justify-between">
                                                <span className="font-semibold">
                                                  {comment.title}
                                                </span>
                                                <div className="flex flex-col items-end">
                                                  <div className="flex h-5 items-center">
                                                    <span className="whitespace-nowrap text-xs text-[var(--vscode-descriptionForeground)]">
                                                      Line {comment.line_number}
                                                    </span>
                                                  </div>
                                                  {(comment.comment_status === 'RESOLVED' ||
                                                    comment.comment_status === 'REJECTED') && (
                                                    <div className="absolute right-0 top-6">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          markCommentUnresolved(comment.id, e);
                                                        }}
                                                        className="rounded border border-[var(--vscode-editorWidget-border)] p-1 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)]"
                                                        title="Mark as unresolved"
                                                      >
                                                        <Undo2 className="h-3 w-3" />
                                                      </button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex flex-wrap items-center gap-1">
                                                {comment.agent_ids.map((agentId: number) => (
                                                  <div
                                                    key={agentId}
                                                    className="flex w-fit items-center gap-1 rounded-md border border-[var(--vscode-editorWidget-border)] bg-gray-800 px-1 py-0.5 text-[10px] text-white"
                                                  >
                                                    <BotMessageSquare className="h-3 w-3" />
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
                                        );
                                      })
                                    ) : (
                                      <div className="py-2 pl-6 pr-2 text-xs text-[var(--vscode-descriptionForeground)]">
                                        No comments in this file.
                                      </div>
                                    )}
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
      ) : (
        <div className="flex min-h-[260px] items-center justify-center rounded-b-lg border border-t-0 border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] italic">
          {useCodeReviewStore.getState().isFetchingPastReviews && (
            <div className="flex flex-col items-center justify-center space-y-2">
              <LoaderCircle className="h-10 w-10 animate-spin" />
              <span className="text-md font-mono">Fetching Past Reviews Changes...</span>
            </div>
          )}
          {!useCodeReviewStore.getState().isFetchingPastReviews && (
            <span className="text-md font-mono">No Reviews Available.</span>
          )}
        </div>
      )}
      <Tooltip id="code-review-tooltips" />
    </div>
  );
};

export default PastReviews;
