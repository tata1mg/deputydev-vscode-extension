import { useState, useEffect } from 'react';

export default function Loader() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 10000);
        return () => clearTimeout(timer);
    }, []);

    return loading ? (
        <div className="min-h-screen flex flex-col justify-center items-center">
            <div className="flex justify-center">
                <div className="animate-spin inline-block w-16 h-16 border-4 border-current border-t-transparent text-white rounded-full dark:text-white" role="status" aria-label="loading">
                    <span className="sr-only">Loading...</span>
                </div>
            </div>
            <div className="mt-4 text-lg text-white dark:text-white">Loading...</div>
        </div>
    ) : (
        <div>Something went wrong. Please try again later</div>
    );
}