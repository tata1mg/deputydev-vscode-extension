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

    useEffect(() => {
        // Function to update the random phrase
        const updatePhrase = () => {
            const selectedPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            setRandomPhrase(selectedPhrase);
        };

        // Set the initial phrase
        updatePhrase();

        // Change the phrase every 2 seconds
        const intervalId = setInterval(updatePhrase, 3000);

        // Clear the interval on component unmount
        return () => clearInterval(intervalId);
    }, []); // Empty dependency array ensures this runs only once

    return (
        <div role="status" className="flex items-center space-x-2 mb-[10px] mt-[5px]">
            <span className="animate-pulse text-gray-500 text-sm">{randomPhrase}</span>
            <div className="flex space-x-1">
                <div className="animate-pulse bg-gray-500 rounded-full h-1 w-1"></div>
                <div className="animate-pulse bg-gray-500 rounded-full h-1 w-1 delay-200"></div>
                <div className="animate-pulse bg-gray-500 rounded-full h-1 w-1 delay-400"></div>
            </div>
        </div>
    );
}