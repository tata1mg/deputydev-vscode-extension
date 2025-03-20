// Progress.tsx
import React from 'react';

interface ProgressProps {
    progress: number; // Expecting a number between 0 and 100
}

const ProgressBar: React.FC<ProgressProps> = ({ progress }) => {
    return (
        <div className="w-full flex items-center mb-2">
            <div className="bg-gray-200 rounded h-6 flex-grow relative">
                <div
                    className="h-6 rounded absolute"
                    style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(to right, #4F46E5, #3B82F6)', // Example gradient colors
                    }}
                />
                <span className="text-xs text-black absolute left-2 top-1">Indexing codebase...</span>
                <span className="text-xs text-black absolute right-2 top-1">{Math.floor(progress)}%</span>
            </div>
        </div>
    );
};

export default ProgressBar;