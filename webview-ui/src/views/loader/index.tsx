import { useState, useEffect } from 'react';
import { useLoaderViewStore } from '@/stores/useLoaderViewStore';

export default function Loader() {
    const { loaderViewState } = useLoaderViewStore();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 100000);
        return () => clearTimeout(timer);
    }, []);

    return loading ? (
        <div className="min-h-screen flex flex-col justify-center items-center">
            <div className="flex justify-center">
                <div
                    className="animate-spin inline-block w-16 h-16 border-4 border-current border-t-transparent rounded-full"
                    role="status"
                    aria-label="loading"
                >
                    <span className="sr-only">Loading...</span>
                </div>
            </div>
            {/* <div className="mt-4 text-lg font-medium">Loading...</div> */}
            <div className="mt-4  font-medium text-base ">{loaderViewState}</div>
        </div>
    ) : (
        <div>Something went wrong. Please try restart VS code</div>
    );
}
