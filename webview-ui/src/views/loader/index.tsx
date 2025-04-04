import { useState, useEffect } from 'react';
import { useLoaderViewStore } from '@/stores/useLoaderViewStore';

const QUOTES = [
    "Code is poetry written for machines to execute",
    "Elegant code solves complex problems simply ",
    "Debug your thinking before debugging your code ",
    "Great software reflects its creators' craftsmanship",
    "Every line of code changes someone's life",
    "One commit at a time builds masterpieces",
    "Software engineers turn imagination into reality",
    "Clean code today saves headaches tomorrow",
    "Programming: where logic meets creativity",
    "Good developers code; great ones solve problems",
    "Code with purpose, deploy with confidence",
    "True innovation happens beyond comfort zones",
    "Quality code tells a story others understand",
    "The best algorithms feel inevitable, not complicated",
    "Software engineering is thinking made visible",
    "Refactor your mindset, elevate your code",
    "The hardest bugs teach the greatest lessons",
    "Great solutions emerge from understanding problems",
    "Legacy code is tomorrow's inheritance",
    "Every programmer was once a beginner",
];
export default function Loader() {
    const { loaderViewState } = useLoaderViewStore();
    const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
    const [animate, setAnimate] = useState(true);

    useEffect(() => {
        if (!loaderViewState) return;

        const interval = setInterval(() => {
            setAnimate(false); // trigger scale out
            setTimeout(() => {
                setCurrentQuoteIndex(prev => {
                    let next;
                    do {
                        next = Math.floor(Math.random() * QUOTES.length);
                    } while (next === prev);
                    return next;
                });
                setAnimate(true); // trigger scale in
            }, 300); // match with transition duration
        }, 3000);

        return () => clearInterval(interval);
    }, [loaderViewState]);

    return (
        <div className="min-h-screen flex flex-col justify-center items-center text-center px-4">
            <div className="flex justify-center mb-6">
                <div
                    className="animate-spin inline-block w-16 h-16 border-4 border-current border-t-transparent rounded-full"
                    role="status"
                    aria-label="loading"
                >
                    <span className="sr-only ">Loading...</span>
                </div>
            </div>

            {loaderViewState ? (
                <>
                    <div className="text-lg font-semibold mb-2 opacity-85">
                        Getting DeputyDev ready for you
                    </div>
                    <div className="text-sm text-gray-500 mb-8">
                        Please ensure you have a stable internet connection for the best experience.
                    </div>
                    <div
                        className={`italic text-base max-w-xl text-center min-h-[3.5rem] flex items-center justify-center transition-all duration-500 ${
                            animate ? 'opacity-50 scale-100' : 'opacity-0 scale-95'
                        }`}
                    >
                        "{QUOTES[currentQuoteIndex]}"
                    </div>
                </>
            ) : (
                <div className="text-lg font-medium">Loading...</div>
            )}
        </div>
    );
}