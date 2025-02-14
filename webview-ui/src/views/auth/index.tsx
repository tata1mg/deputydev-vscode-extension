import useExtensionStore from "@/stores/useExtensionStore";
import { initiateLogin } from "@/commandApi";
import { useEffect } from "react";

export default function Auth() {

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const response = event.data || {};
            console.log("message", response)

            if (response === "AUTHENTICATED") {
                nextPage()
            }
        }

        window.addEventListener('message', handleMessage); // Listen for messages
        return () => window.removeEventListener('message', handleMessage);
    }, [])

    const nextPage = () => {
        useExtensionStore.setState({ viewType: 'chat' });
    };

    const handleLogin = () => {
        initiateLogin()
    }

    return (
        <div className="container flex h-screen w-screen flex-col items-center justify-center bg-black p-8">
            <div className="mx-auto flex w-full flex-col justify-between border rounded-xl p-6 shadow-lg bg-white">
                <h1 className="text-3xl font-bold mb-6 text-black">Login to DeputyDev Extension</h1>
                <p className="text-lg text-black text-center">
                    Please login by clicking the button below.
                </p>
                <hr className="border-gray-300 mt-3" />
                <button
                    onClick={handleLogin}
                    className="px-4 py-2 bg-black text-white rounded hover:bg-gray-700 transition duration-200"
                >
                    OPEN BROWSER FOR AUTHENTICATION
                </button>
            </div>
        </div>
    );
}