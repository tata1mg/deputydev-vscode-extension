import { initiateLogin } from '@/commandApi';
import { LogIn } from 'lucide-react';

export default function Auth() {
  const handleLogin = () => {
    initiateLogin();
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[300px] px-6 text-center">
          <img
            src="https://onemg.gumlet.io/dd_logo_with_name_10_04.png"
            alt="DeputyDev Logo"
            className="mx-auto mb-[25px] h-10 w-auto"
          />
          <span className="animate-gradient mb-[40px] block bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-lg text-transparent">
            Your AI sidekick that amplifies your impact—turning coding hours into minutes
          </span>
          <button
            onClick={handleLogin}
            className="hover:shadow-xxl mx-auto w-full max-w-[130px] transform rounded-lg border border-b border-black bg-[var(--vscode-list-inactiveSelectionBackground)] p-2 text-center text-xl shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            <div className="text-md flex items-center justify-center space-x-4">
              <LogIn />
              <span className="animate-gradient bg-gradient-to-r from-blue-500 to-green-500 bg-clip-text text-transparent">
                Sign in
              </span>
            </div>
          </button>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4">
        <p className="text-center text-xs text-gray-500">
          DeputyDev is powered by AI. It can make mistakes. Please double check all output.
        </p>
      </div>
    </div>
  );
}
