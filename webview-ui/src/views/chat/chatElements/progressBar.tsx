// Progress.tsx
import React from 'react';

interface ProgressProps {
    progress: number; // Expecting a number between 0 and 100
}

const ProgressBar: React.FC<ProgressProps> = ({ progress }) => {
    return (
        <div className="w-full bg-gray-200 rounded-full h-2">
            <div
                className="h-2 rounded-full animate-pulse"
                style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(to right, #4F46E5, #3B82F6)', // Example gradient colors
                }}
            />
        </div>
    );
};

export default ProgressBar;