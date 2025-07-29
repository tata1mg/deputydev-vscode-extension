import {
  openCommentInFile,
  openFile,
  sendCommentStatusUpdate,
  submitCommentFeedback,
} from '@/commandApi';
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
  const [showCommentFeedbackForm, setShowCommentFeedbackForm] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [currentFeedbackType, setCurrentFeedbackType] = useState<'like' | 'dislike' | null>(null);

  const handleCommentLikeOrDislike = (commentId: number, isLike: boolean) => {
    console.log('Like or dislike on this comment: ', commentId, isLike);
    const pastReviews = useCodeReviewStore.getState().pastReviews;
    const comment = pastReviews
      .flatMap((review) => Object.values(review.comments).flat())
      .find((comment) => comment.id === commentId);

    console.log('Like or dislike on this comment: ', comment);

    if (comment && comment.feedback && comment.feedback.like === isLike) {
      return;
    }

    // Update the feedback in the store immediately
    useCodeReviewStore.setState((state) => ({
      pastReviews: state.pastReviews.map((review) => ({
        ...review,
        comments: Object.fromEntries(
          Object.entries(review.comments).map(([filePath, comments]) => [
            filePath,
            comments.map((comment) =>
              comment.id === commentId
                ? {
                    ...comment,
                    feedback: {
                      like: isLike,
                      feedback_comment: '',
                    },
                  }
                : comment
            ),
          ])
        ),
      })),
    }));

    submitCommentFeedback({ commentId: commentId, isLike: isLike });

    setCurrentFeedbackType(isLike ? 'like' : 'dislike');
    setShowCommentFeedbackForm(commentId);
    setFeedbackText('');
  };

  const handleCommentFeedback = (commentId: number, isLike: boolean) => {
    if (!currentFeedbackType) return;

    // Update the feedback in the store
    useCodeReviewStore.setState((state) => ({
      pastReviews: state.pastReviews.map((review) => ({
        ...review,
        comments: Object.fromEntries(
          Object.entries(review.comments).map(([filePath, comments]) => [
            filePath,
            comments.map((comment) =>
              comment.id === commentId
                ? {
                    ...comment,
                    feedback: {
                      like: isLike,
                      feedback_comment: feedbackText,
                    },
                  }
                : comment
            ),
          ])
        ),
      })),
    }));

    submitCommentFeedback({ commentId: commentId, isLike: isLike, feedbackComment: feedbackText });

    // Reset form state
    setShowCommentFeedbackForm(null);
    setFeedbackText('');
    setCurrentFeedbackType(null);
  };

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
    rationale: string,
    agentId?: number | null
  ): string => {
    let userAgent = null;
    if (agentId) {
      userAgent = userAgents.find((ua) => ua.id === agentId);
    }
    const agentName = userAgent ? userAgent.display_name : null;

    let formattedComment = '';

    if (agentName) {
      formattedComment += `**${agentName}**: `;
    }

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
          className="h-auto flex-1 overflow-y-auto rounded-b-lg border border-t-0 border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)]"
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
                                      ? 'border-[2px] border-green-500 bg-gray-800 text-white opacity-50'
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
                                  className={`relative flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${tagColors(tag)} ${isSelected ? 'border-[2px] border-green-500 opacity-50' : 'hover:opacity-80'}`}
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
                          const hasActiveFilters = selectedAgents.size > 0 || selectedTags.size > 0;
                          // Skip files with no comments when filters are active
                          if (hasActiveFilters && !hasComments) {
                            return null;
                          }

                          return (
                            <div key={filePath} className="pl-4">
                              <div
                                className="flex cursor-pointer items-center justify-between p-1.5 hover:bg-[var(--vscode-list-hoverBackground)]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasComments) {
                                    toggleFile(filePath);
                                  }
                                  if (!hasComments) {
                                    openFile(filePath);
                                  }
                                }}
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <motion.div
                                    animate={{
                                      rotate: expandedFile === filePath && hasComments ? 90 : 0,
                                    }}
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
                                    {hasComments &&
                                      filteredComments.map((comment: CodeReviewComment) => {
                                        const isResolved = comment.comment_status === 'RESOLVED';
                                        const isIgnored = comment.comment_status === 'REJECTED';
                                        return (
                                          <div
                                            key={comment.id}
                                            className={`border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] py-1.5 pl-6 pr-2 text-xs ${!isResolved && !isIgnored && !showCommentFeedbackForm ? 'cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]' : ''} `}
                                            onClick={
                                              !isResolved && !isIgnored && !showCommentFeedbackForm
                                                ? () => {
                                                    openCommentInFile({
                                                      filePath: comment.file_path,
                                                      lineNumber: comment.line_number - 1,
                                                      commentText: getFormattedComment(
                                                        comment.comment,
                                                        comment.corrective_code,
                                                        comment.rationale,
                                                        comment.agent_ids.length === 1
                                                          ? comment.agent_ids[0]
                                                          : null
                                                      ),
                                                      promptText: `${comment.tag.toUpperCase()} : ${comment.title}`,
                                                      commentId: comment.id,
                                                    });
                                                  }
                                                : undefined
                                            }
                                          >
                                            <div className="flex w-full flex-col gap-1">
                                              <div
                                                className={`relative flex w-full items-start justify-between ${isResolved ? 'line-through opacity-70' : ''} ${isIgnored ? 'line-through decoration-red-600 opacity-70' : ''}`}
                                              >
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
                                                    className={`flex w-fit items-center gap-1 rounded-md border border-[var(--vscode-editorWidget-border)] bg-gray-800 px-1 py-0.5 text-[10px] text-white ${isResolved ? 'line-through opacity-70' : ''} ${isIgnored ? 'line-through decoration-red-600 opacity-70' : ''} `}
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
                                                  className={`w-fit rounded-md border px-1 py-0.5 text-[10px] text-white ${tagColors(comment.tag)} flex items-center gap-1 ${isResolved ? 'line-through opacity-70' : ''} ${isIgnored ? 'line-through decoration-red-600 opacity-70' : ''} `}
                                                >
                                                  {comment.tag.toLowerCase() === 'bug' ? (
                                                    <Bug size={10} />
                                                  ) : (
                                                    <TriangleAlert size={10} />
                                                  )}
                                                  {comment.tag.toUpperCase()}
                                                </div>

                                                {/* FEEDBACK */}
                                                <div className="mt-1 flex w-full flex-col">
                                                  <div className="flex items-center gap-2">
                                                    <motion.button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (
                                                          !comment.feedback ||
                                                          comment.feedback.like !== true
                                                        ) {
                                                          handleCommentLikeOrDislike(
                                                            comment.id,
                                                            true
                                                          );
                                                        }
                                                      }}
                                                      whileHover={{ scale: 1.1 }}
                                                      whileTap={{ scale: 0.95 }}
                                                      className={`rounded p-1 hover:bg-green-900/30 ${
                                                        comment.feedback &&
                                                        comment.feedback.like === true
                                                          ? 'bg-green-900/50'
                                                          : ''
                                                      }`}
                                                    >
                                                      <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                      >
                                                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                                                      </svg>
                                                    </motion.button>
                                                    <motion.button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (
                                                          !comment.feedback ||
                                                          comment.feedback.like === true
                                                        ) {
                                                          handleCommentLikeOrDislike(
                                                            comment.id,
                                                            false
                                                          );
                                                        }
                                                      }}
                                                      whileHover={{ scale: 1.1 }}
                                                      whileTap={{ scale: 0.95 }}
                                                      className={`rounded p-1 hover:bg-red-900/30 ${
                                                        comment.feedback &&
                                                        comment.feedback.like === false
                                                          ? 'bg-red-900/50'
                                                          : ''
                                                      }`}
                                                    >
                                                      <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                      >
                                                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                                                      </svg>
                                                    </motion.button>
                                                  </div>

                                                  <AnimatePresence>
                                                    {showCommentFeedbackForm === comment.id && (
                                                      <motion.div
                                                        initial={{
                                                          opacity: 0,
                                                          height: 0,
                                                          marginTop: 0,
                                                        }}
                                                        animate={{
                                                          opacity: 1,
                                                          height: 'auto',
                                                          marginTop: 8,
                                                          transition: {
                                                            opacity: { duration: 0.2 },
                                                            height: { duration: 0.3 },
                                                            marginTop: { duration: 0.2 },
                                                          },
                                                        }}
                                                        exit={{
                                                          opacity: 0,
                                                          height: 0,
                                                          marginTop: 0,
                                                          transition: {
                                                            opacity: { duration: 0.15 },
                                                            height: { duration: 0.25 },
                                                            marginTop: { duration: 0.2 },
                                                          },
                                                        }}
                                                        className="overflow-hidden"
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        <div className="rounded border border-[var(--vscode-editorWidget-border)] p-2">
                                                          <textarea
                                                            value={feedbackText}
                                                            onChange={(e) =>
                                                              setFeedbackText(e.target.value)
                                                            }
                                                            placeholder="Please provide your feedback (Optional)"
                                                            className="mb-2 w-full rounded border border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            rows={3}
                                                          />
                                                          <div className="flex justify-end gap-2">
                                                            <motion.button
                                                              whileHover={{ scale: 1.03 }}
                                                              whileTap={{ scale: 0.98 }}
                                                              onClick={() => {
                                                                setShowCommentFeedbackForm(null);
                                                                setFeedbackText('');
                                                                setCurrentFeedbackType(null);
                                                              }}
                                                              className="rounded border border-[var(--vscode-editorWidget-border)] px-2 py-1 text-xs hover:bg-[var(--vscode-list-hoverBackground)]"
                                                            >
                                                              Cancel
                                                            </motion.button>
                                                            <motion.button
                                                              whileHover={{ scale: 1.03 }}
                                                              whileTap={{ scale: 0.98 }}
                                                              onClick={() =>
                                                                handleCommentFeedback(
                                                                  comment.id,
                                                                  comment.feedback.like
                                                                )
                                                              }
                                                              disabled={feedbackText === ''}
                                                              className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-50"
                                                            >
                                                              Submit
                                                            </motion.button>
                                                          </div>
                                                        </div>
                                                      </motion.div>
                                                    )}
                                                  </AnimatePresence>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
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
        <div className="flex min-h-[300px] items-center justify-center rounded-b-lg border border-t-0 border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] italic">
          {useCodeReviewStore.getState().isFetchingPastReviews && (
            <div className="flex flex-col items-center justify-center space-y-2">
              <LoaderCircle className="h-10 w-10 animate-spin" />
              <span className="text-md font-mono">Fetching Reviews...</span>
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
