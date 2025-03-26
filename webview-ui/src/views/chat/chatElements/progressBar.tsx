import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ProgressBarData } from '@/types';
import React from 'react';

interface ProgressBarProps {
    progressBars: ProgressBarData[];
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progressBars }) => {
    const { activeRepo } = useWorkspaceStore();
    const repoName = activeRepo?.split('/').pop();

    return (
        <div className="w-full flex items-center mb-2">
            {progressBars
                .filter(bar => bar.repo === activeRepo)
                .map(bar => (
                    <div key={bar.repo} className="bg-gray-200 rounded h-7 flex-grow relative">
                        {bar.status === "Completed" ? (
                            <div className="bg-gray-200 rounded h-7 p-1 w-full flex justify-center">
                                <span className='text-green-600'>Indexing Completed</span>
                            </div>
                        ) : (
                            <>
                                {bar.status === "Failed" ? (
                                    <div className="bg-gray-200 rounded h-7 p-1 w-full flex justify-center">
                                        <span className='text-red-600'>Indexing Failed...</span>
                                    </div>
                                ) : (
                                    <div className="bg-gray-200 rounded h-7 flex-grow relative">
                                        <div
                                            className="h-7 rounded absolute"
                                            style={{
                                                width: bar.status === "In Progress" ? `${bar.progress}%` : '100%',
                                                background: bar.status === "In Progress" ? 'linear-gradient(to right, #4F46E5, #3B82F6)' : 'green',
                                            }}
                                        />
                                        <span className={`text-xs ${bar.status === "In Progress" ? 'text-black' : 'text-white'} absolute left-2 top-1`}>
                                            {`Indexing for ${repoName}`}
                                        </span>
                                        {bar.status === "In Progress" &&
                                            <span className="text-xs text-black absolute right-2 top-1">
                                                <span>{Math.floor(bar.progress)}%</span>
                                            </span>
                                        }
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}
        </div>
    );
};

export default ProgressBar;