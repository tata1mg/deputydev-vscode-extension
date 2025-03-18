import React, { useEffect, useState } from 'react';

export function Shimmer() {
    const phrases = [
        "DeputyDev doing something",
        "Something cool is happening",
        "Loading your request",
        "Hang tight, we're on it",
        "Just a moment, please",
    ];

    const [randomPhrase, setRandomPhrase] = useState("");
    const [activeDots, setActiveDots] = useState(0);

    useEffect(() => {
        const updateDots = () => {
            setActiveDots(prev => (prev + 1) % 4);
        };

        const intervalId = setInterval(updateDots, 1000);

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const updatePhrase = () => {
            const selectedPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            setRandomPhrase(selectedPhrase);
        };

        updatePhrase();

        const intervalId = setInterval(updatePhrase, 2000);

        return () => clearInterval(intervalId);
    }, []);

    return (
        <div role="status" className="flex items-center space-x-2 mb-[10px] mt-[5px]">
            <span className="animate-pulse text-gray-500 text-sm">{randomPhrase}</span>
            <div className="flex space-x-1">
                {Array.from({ length: 3 }, (_, index) => (
                    <div
                        key={index}
                        className={`animate-pulse bg-gray-500 rounded-full h-1 w-1 ${index < activeDots ? '' : 'opacity-0'}`}
                    ></div>
                ))}
            </div>
        </div>
    );
}