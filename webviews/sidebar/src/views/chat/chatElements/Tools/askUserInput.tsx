import { useThemeStore } from '@/stores/useThemeStore';
import { parse, Allow } from 'partial-json';
import Markdown from 'react-markdown';
import '../../../../styles/markdown-body.css';

interface AskUserInputProps {
  input: string;
}

export function AskUserInput({ input }: AskUserInputProps) {
  let promptText = input;
  const { themeKind } = useThemeStore();

  try {
    const parsed = parse(input, Allow.STR | Allow.OBJ);
    if (parsed && typeof parsed === 'object' && parsed.prompt) {
      promptText = parsed.prompt;
    }
  } catch {
    // If parsing fails, just show raw input as-is
  }

  return (
    <div
      className={`markdown-body text-base ${['high-contrast', 'high-contrast-light'].includes(themeKind) ? themeKind : ''}`}
    >
      <Markdown>{promptText}</Markdown>
    </div>
  );
}
