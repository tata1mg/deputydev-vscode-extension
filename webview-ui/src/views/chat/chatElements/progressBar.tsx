// Progress.tsx
import { useRepoSelectorStore } from '@/stores/repoSelectorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import React from 'react';

interface ProgressProps {
    progress: number; // Expecting a number between 0 and 100
}

const ProgressBar: React.FC<ProgressProps> = ({ progress }) => {
    const { activeRepo } = useWorkspaceStore();
    const repoName = activeRepo?.split('/').pop();
    const repoSelectorEmbedding = useRepoSelectorStore(
        (state) => state.repoSelectorDisabled,
      );
    return (
        <div className="w-full flex items-center mb-2">
            <div className="bg-gray-200 rounded h-6 flex-grow relative">
                <div
                    className="h-6 rounded absolute"
                    style={{
                        width: repoSelectorEmbedding ? `${progress}%` : '100%',
                        background: repoSelectorEmbedding ? 'linear-gradient(to right, #4F46E5, #3B82F6)' : 'green',
                    }}
                />
                <span className={`text-xs ${repoSelectorEmbedding ? 'text-black' : 'text-white'} absolute left-2 top-1`}>{repoSelectorEmbedding ? `Indexing ${repoName}` : "Completed"}</span>
                <span className="text-xs text-black absolute right-2 top-1">{repoSelectorEmbedding ? `${Math.floor(progress)}%` : ""}</span>
            </div>
        </div>
    );
};

export default ProgressBar;