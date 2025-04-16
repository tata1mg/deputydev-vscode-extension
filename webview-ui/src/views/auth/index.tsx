import { initiateLogin } from "@/commandApi";
import { LogIn } from 'lucide-react';

export default function Auth() {
    const handleLogin = () => {
        initiateLogin();
    }

    return (
        <div className="flex h-screen flex-col">
            <div className="flex-1 flex items-center justify-center">
                <div className="max-w-[300px] w-full text-center px-6">
                    <img
                        src="https://onemg.gumlet.io/dd_logo_with_name_10_04.png"
                        alt="DeputyDev Logo"
                        className="h-10 w-auto mb-[25px] mx-auto"
                    />
                    <span className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 animate-gradient mb-[40px] block">
                        Your AI sidekick that amplifies your impact—turning coding hours into minutes
                    </span>
                    <button
                        onClick={handleLogin}
                        className="border border-b border-black rounded-lg text-xl text-center max-w-[130px] w-full mx-auto transition-transform transform hover:scale-105 p-2 shadow-xl hover:shadow-xxl active:scale-95 bg-[var(--vscode-list-inactiveSelectionBackground)]"
                    >
                        <div className="text-md flex items-center justify-center space-x-4">
                            <LogIn />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-500 animate-gradient">Sign in</span>
                        </div>
                    </button>
                </div>
            </div>
            <div className="fixed bottom-0 left-0 right-0 p-4">
                <p className="text-xs text-gray-500 text-center">DeputyDev is powered by AI. It can make mistakes. Please double check all output.</p>
            </div>
        </div>
    );
}