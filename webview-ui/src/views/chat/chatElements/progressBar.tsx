import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ProgressBarData } from '@/types';
import React, { useEffect, useRef, useState } from 'react';

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
        const currentBar = progressBars.find(bar => bar.repo === activeRepo);
        const prevRepo = prevRepoRef.current;
        const prevStatus = prevStatusRef.current;

        if (!currentBar) return;

        const isSameRepo = activeRepo === prevRepo;

        // Show completed only if status changed from "In Progress"
        if (
            currentBar.status === 'Completed' &&
            isSameRepo &&
            prevStatus === 'In Progress'
        ) {
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
            case "Completed":
                if (!shouldShowCompleted) return null;
                return (
                    <div className="bg-green-600 rounded h-7 p-1 w-full flex justify-center">
                        <div className='overflow-hidden text-ellipsis whitespace-nowrap'>Indexing completed for {repoName}</div>
                    </div>
                );
            case "Failed":
                return (
                    <div className="bg-gray-200 rounded h-7 p-1 w-full flex justify-center">
                        <div className="text-red-600 overflow-hidden text-ellipsis whitespace-nowrap">Indexing failed for {repoName}</div>
                    </div>
                );
            case "In Progress":
                return (
                    <div className="bg-gray-200 rounded h-7 flex-grow relative">
                        <div
                            className="h-7 rounded absolute"
                            style={{
                                width: `${bar.progress}%`,
                                background: 'linear-gradient(to right, #4F46E5, #3B82F6)',
                            }}
                        />
                        <div className="w-5/6 text-xs text-black absolute left-2 top-1 overflow-hidden text-ellipsis whitespace-nowrap">
                            {`Indexing for ${repoName}`}
                        </div>
                        <div className="text-xs text-black absolute right-2 top-1 bottom-1">
                            {`${Math.floor(bar.progress)}%`}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="w-full flex items-center mb-2">
            {progressBars
                .filter(bar => bar.repo === activeRepo)
                .map(bar => {
                    // Skip rendering if Completed and we shouldn’t show it
                    if (bar.status === 'Completed' && !shouldShowCompleted) return null;

                    return (
                        <div key={bar.repo} className="bg-gray-200 rounded h-7 flex-grow relative">
                            {renderProgressContent(bar)}
                        </div>
                    );
                })}
        </div>
    );
};

export default ProgressBar;