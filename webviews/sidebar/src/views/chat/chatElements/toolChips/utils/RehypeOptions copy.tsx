import React from 'react';
import { CodeActionPanel } from '../../codeActionPanel';

/**
 * Rehype React components mapping to render code blocks
 * as <CodeActionPanel /> instead of <pre><code>
 */
export const rehypeCodeActionPanelComponents = {
  pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => {
    if (
      Array.isArray(children) &&
      children.length === 1 &&
      React.isValidElement(children[0]) &&
      children[0].type === 'code'
    ) {
      const codeEl = children[0] as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;

      const className = codeEl.props.className || '';
      const language = className.replace('language-', '') || 'plaintext';
      const code = String(codeEl.props.children || '').trim();

      return (
        <CodeActionPanel
          language={language}
          content={code}
          is_diff={false}
          inline={false}
          isStreaming={true}
        />
      );
    }

    // fallback if it's a normal <pre>
    return <pre>{children}</pre>;
  },
};
