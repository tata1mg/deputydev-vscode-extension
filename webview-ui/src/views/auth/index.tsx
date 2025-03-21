import { initiateLogin } from "@/commandApi";
import { BotMessageSquare, LogIn } from 'lucide-react';

export default function Auth() {

    const handleLogin = () => {
        initiateLogin()
    }

    return (
        <div className="mx-auto flex max-w-[300px] w-full flex-col justify-between items-center p-6 mt-[210px]">
            <BotMessageSquare className="w-20 h-20 mb-[20px] animate-bounce" />
            <span className="text-3xl mb-[25px] text-center">Develop with DeputyDev</span>
            <span className="text-lg text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 animate-gradient mb-[40px]">
                Your AI sidekick that amplifies your impact—turning coding hours into minutes
            </span>
            <button
                onClick={handleLogin}
                className="border border-b border-black rounded-lg text-xl text-center max-w-[130px] w-full transition-transform transform hover:scale-105 p-2 shadow-xl hover:shadow-xxl active:scale-95 bg-[var(--vscode-list-inactiveSelectionBackground)]"
            >
                <div className="text-md flex items-center justify-center space-x-4">
                    <LogIn />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 animate-gradient">Sign in</span>
                </div>
            </button>
        </div>
    );
}