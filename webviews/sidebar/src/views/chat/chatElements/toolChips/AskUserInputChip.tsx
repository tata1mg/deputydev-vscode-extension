import { useThemeStore } from '@/stores/useThemeStore';
import { parse, Allow } from 'partial-json';
import Markdown from 'react-markdown';
import { AskUserInputProps } from '@/types';
import '../../../../styles/markdown-body.css';

const AskUserInput: React.FC<AskUserInputProps> = ({ input }) => {
  const { themeKind } = useThemeStore();
  let promptText = '';

  if (typeof input === 'object') {
    promptText = input.prompt ?? JSON.stringify(input, null, 2);
  } else {
    try {
      const parsed = parse(input, Allow.STR);
      promptText = typeof parsed === 'object' ? parsed.prompt : '';
    } catch {
      // Ignoring
    }
  }

  return (
    <div
      className={`markdown-body text-base ${['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''}`}
    >
      {promptText !== undefined && promptText !== null && promptText !== '' && (
        <Markdown>{promptText}</Markdown>
      )}
    </div>
  );
};

export default AskUserInput;
