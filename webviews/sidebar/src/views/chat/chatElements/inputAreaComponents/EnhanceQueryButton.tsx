import { Sparkles, Loader2 } from 'lucide-react';
import { enhanceUserQuery } from '@/commandApi';
import { useChatStore } from '@/stores/chatStore';

interface EnhanceQueryButtonProps {
  userInput: string;
  enhancingUserQuery: boolean;
}

export const EnhanceQueryButton: React.FC<EnhanceQueryButtonProps> = ({
  userInput,
  enhancingUserQuery,
}) => {
  const { updateCurrentChat } = useChatStore();
  const currentChat = useChatStore((s) => s.getCurrentChat());
  const sessionId = currentChat.sessionId;

  async function awaitEnhanceUserQuery(userInput: string) {
    if (!userInput) return;

    updateCurrentChat({ enhancingUserQuery: true });

    try {
      const data = await enhanceUserQuery(userInput, sessionId);
      updateCurrentChat({
        userInput: data.enhanced_query,
      });
      if (data.session_id) {
        updateCurrentChat({ sessionId: data.session_id });
      }
    } catch (error) {
      console.error('Error enhancing user query:', error);
    } finally {
      updateCurrentChat({ enhancingUserQuery: false });
    }
  }

  return enhancingUserQuery ? (
    <div className="flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  ) : (
    <button
      className="flex items-center justify-center p-1 hover:rounded hover:bg-slate-400 hover:bg-opacity-10 disabled:cursor-not-allowed"
      onClick={() => awaitEnhanceUserQuery(userInput)}
      data-tooltip-id="sparkles-tooltip"
      data-tooltip-content={userInput ? 'Enhance your prompt' : 'Please write your prompt first.'}
      data-tooltip-place="top-start"
      disabled={!userInput}
    >
      <Sparkles className="h-4 w-4" />
    </button>
  );
};
