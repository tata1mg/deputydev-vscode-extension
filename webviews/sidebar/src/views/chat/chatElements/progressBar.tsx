import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ProgressBarData } from '@/types';
import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { sendRetryEmbedding } from '@/commandApi';

interface ProgressBarProps {
  progressBars: ProgressBarData[];
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progressBars }) => {
  const { activeRepo } = useWorkspaceStore();
  const repoName = activeRepo?.split('/').pop();

  const [shouldShowCompleted, setShouldShowCompleted] = useState(false);
  const prevStatusRef = useRef<string | null>(null);
  const prevRepoRef = useRef<string | null>(null);

  useEffect(() => {
    const currentBar = progressBars.find((bar) => bar.repo === activeRepo);
    const prevRepo = prevRepoRef.current;
    const prevStatus = prevStatusRef.current;

    if (!currentBar) return;

    const isSameRepo = activeRepo === prevRepo;

    // Show completed only if status changed from "In Progress"
    if (currentBar.status === 'Completed' && isSameRepo && prevStatus === 'In Progress') {
      // only show for one seconds
      setShouldShowCompleted(true);
      setTimeout(() => {
        setShouldShowCompleted(false);
      }, 1000);
    } else if (currentBar.status !== 'Completed') {
      setShouldShowCompleted(false);
    }

    prevStatusRef.current = currentBar.status;
    prevRepoRef.current = activeRepo;
  }, [progressBars, activeRepo]);

  const renderProgressContent = (bar: ProgressBarData) => {
    switch (bar.status) {
      case 'Completed':
        if (!shouldShowCompleted) return null;
        return (
          <div className="flex h-7 w-full justify-center rounded bg-green-600 p-1">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap">
              Indexing completed for {repoName}
            </div>
          </div>
        );
      case 'Failed':
        return (
          <div className="flex h-7 w-full items-center justify-between rounded bg-gray-200 p-1">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-red-600">
              Indexing failed for {repoName}
            </div>
            <RotateCcw className="cursor-pointer p-1 text-red-600" onClick={sendRetryEmbedding} />
          </div>
        );
      case 'In Progress':
        return (
          <div className="relative h-7 flex-grow rounded bg-gray-200">
            <div
              className="absolute h-7 rounded"
              style={{
                width: `${bar.progress}%`,
                background: 'linear-gradient(to right, #4F46E5, #3B82F6)',
              }}
            />
            <div className="absolute left-2 top-1 w-5/6 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-black">
              {`Indexing ${repoName}`}
            </div>
            <div className="absolute bottom-1 right-2 top-1 text-xs text-black">
              {`${Math.floor(bar.progress)}%`}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mb-2 flex w-full items-center">
      {progressBars
        .filter((bar) => bar.repo === activeRepo)
        .map((bar) => {
          // Skip rendering if Completed and we shouldn’t show it
          if (bar.status === 'Completed' && !shouldShowCompleted) return null;

          return (
            <div key={bar.repo} className="relative h-7 flex-grow rounded bg-gray-200">
              {renderProgressContent(bar)}
            </div>
          );
        })}
    </div>
  );
};

export default ProgressBar;
