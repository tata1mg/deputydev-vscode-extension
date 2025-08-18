import { useThemeStore } from '@/stores/useThemeStore';
import { parse, Allow } from 'partial-json';
import Markdown from 'react-markdown';
import { AskUserInputProps } from '@/types';
import '../../../../styles/markdown-body.css';

const AskUserInput: React.FC<AskUserInputProps> = ({ input }) => {
  let promptText = input;
  const { themeKind } = useThemeStore();

  try {
    const parsed = parse(input, Allow.STR | Allow.OBJ);
    if (parsed && typeof parsed === 'object' && parsed.prompt) {
      promptText = parsed.prompt;
    }
  } catch {
    // If parsing fails, just show raw input as-it-is
  }

  return (
    <div
      className={`markdown-body text-base ${['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''}`}
    >
      {promptText !== null && promptText !== '' && <Markdown>{promptText}</Markdown>}
    </div>
  );
};

export default AskUserInput;
