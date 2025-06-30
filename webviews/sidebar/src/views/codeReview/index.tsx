import { useThemeStore } from "@/stores/useThemeStore";
import { ChevronUp, ChevronDown, ArrowRight, GitBranch, Check } from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';

type FileStatus = 'A' | 'D' | 'M' | 'R' | 'C' | 'U';

interface FileChange {
  id: string;
  name: string;
  path: string;
  status: FileStatus;
  changes: string;
  comments: number;
}

export default function CodeReview() {
  const { themeKind } = useThemeStore();
  const [showFilesToReview, setShowFilesToReview] = useState(true);

  const sourceBranch = 'feature/new-feature';
  const targetBranch = 'main';

  const files: FileChange[] = [
    { id: '1', name: 'auth.service.ts', path: 'src/services/auth.service.ts', status: 'M', changes: '+124 -45', comments: 3 },
    { id: '2', name: 'user.controller.ts', path: 'src/controllers/user.controller.ts', status: 'M', changes: '+32 -12', comments: 2 },
    { id: '3', name: 'auth.middleware.ts', path: 'src/middleware/auth.middleware.ts', status: 'A', changes: '+89 -0', comments: 0 },
    { id: '4', name: 'types.ts', path: 'src/types/auth.types.ts', status: 'A', changes: '+45 -0', comments: 1 },
  ];

  const getStatusColor = (status: FileStatus) => {
    switch (status) {
      case 'A': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'D': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'M': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'R': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const deputyDevLogo =
    themeKind === 'light' || themeKind === 'high-contrast-light'
      ? 'https://onemg.gumlet.io/dd_logo_dark_name_14_04.png'
      : 'https://onemg.gumlet.io/dd_logo_with_name_10_04.png';

  return (
    <PageTransition direction="right">
      <div className="relative flex h-full flex-col dark:bg-gray-900">
        {/* Header */}
        <div className="flex-grow">
          <div className="mt-10">
            <img
              src={deputyDevLogo}
              alt="DeputyDev Logo"
              className="h-10 w-auto px-4 opacity-90"
            />
          </div>
          <div className="px-4 fade-in mt-2">
            <div className="flex items-center gap-2">
              <p className="mb-2 text-lg text-gray-400">You are ready to review your code.</p>
              <Check className="mb-1 animate-pulse text-sm text-green-500" />
            </div>
          </div>
        </div>
        <div className="p-2">
          {/* Branch Info */}
          <div className="mt-2 flex items-center justify-center">
            <div
              className="flex items-center p-2 rounded-md border border-[var(--vscode-editorWidget-border)]"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
              }}
            >
              <GitBranch className="h-3.5 w-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
              <span className="font-mono text-sm">{sourceBranch}</span>
            </div>
            <ArrowRight className="h-4 w-4 mx-2 text-gray-400" />
            <div
              className="flex items-center p-2 rounded-md border border-[var(--vscode-editorWidget-border)]"
              style={{
                backgroundColor: 'var(--vscode-editor-background)',
              }}
            >
              <GitBranch className="h-3.5 w-3.5 mr-1.5 text-purple-600 dark:text-purple-400" />
              <span className="font-mono text-sm">{targetBranch}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col px-4 py-2 gap-2">
          {/* Files Section */}
          <div
            className="rounded-lg shadow-sm border border-[var(--vscode-editorWidget-border)] overflow-hidden"
            style={{
              backgroundColor: 'var(--vscode-editor-background)',
            }}
          >
            <motion.div
              className="flex items-center justify-between p-3 border-b border-[var(--vscode-editorWidget-border)] cursor-pointer"
              onClick={() => setShowFilesToReview(!showFilesToReview)}
              whileHover={{ backgroundColor: 'var(--vscode-list-hoverBackground)' }}
              initial={false}
            >
              <div className="flex items-center gap-2">
                <motion.span
                  transition={{ duration: 0.2 }}
                >
                  {showFilesToReview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </motion.span>
                <h2 className="font-medium">Files changed ({files.length})</h2>
              </div>
            </motion.div>

            <AnimatePresence>
              {showFilesToReview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{
                    opacity: 1,
                    height: 'auto',
                    transition: {
                      opacity: { duration: 0.2 },
                      height: { duration: 0.3, ease: 'easeInOut' }
                    }
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    transition: {
                      opacity: { duration: 0.15 },
                      height: { duration: 0.25, ease: 'easeInOut' }
                    }
                  }}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-[var(--vscode-editorWidget-border)]">
                    {files.map((file) => (
                      <motion.div
                        key={file.id}
                        className="p-3 cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{
                          opacity: 1,
                          x: 0,
                          transition: {
                            duration: 0.2,
                            ease: 'easeOut'
                          }
                        }}
                        exit={{
                          opacity: 0,
                          x: -10,
                          transition: {
                            duration: 0.15,
                            ease: 'easeIn'
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center min-w-0">
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded mr-2 ${getStatusColor(file.status)}`}>
                              {file.status}
                            </span>
                            <div className="truncate">
                              <div className="font-medium truncate">{file.name}</div>
                              <div className="text-xs truncate text-[var(--vscode-descriptionForeground)]">
                                {file.path}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-xs font-mono text-[var(--vscode-descriptionForeground)]">
                              {file.changes}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Review Button */}
          <div className="flex justify-center">
            <button
              className="px-4 py-2 font-mono text-sm border border-[var(--vscode-editorWidget-border)] text-center rounded-md cursor-pointer bg-[var(--vscode-editor-background)] hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
            >
              Review All Changes
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
