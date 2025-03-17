import { initiateLogin } from "@/commandApi";
import { BotMessageSquare } from 'lucide-react';

export default function Auth() {

    const handleLogin = () => {
        initiateLogin()
    }

    return (
        <div className="mt-36 px-4">
            <div className="mx-auto flex w-full flex-col justify-between p-2 border rounded-xl bg-white">
                <BotMessageSquare className="text-black w-20 h-20" />
                <h1 className="text-2xl font-bold text-black ml-2">Welcome to DeputyDev</h1>
                <span className="text-lg text-gray-400 ml-2">AI Powered Assistant</span>
                <p className="text-sm text-gray-500 ml-2">
                    Please login first...
                </p>
                <hr className="border-black mt-2 mb-2" />
                <button
                    onClick={handleLogin}
                    className="text-lg text-center bg-black border rounded-xl p-2 text-white w-full transition-transform transform hover:scale-105 hover:bg-neutral-600"
                >
                    LOGIN USING BROWSER
                </button>
            </div>
        </div>
    );
}