import React from 'react';
import { CodeActionPanel } from '../../codeActionPanel';

/**
 * Rehype React components mapping to render code blocks
 * as <CodeActionPanel /> instead of <pre><code>
 */
export const rehypeCodeActionPanelComponents = {
  pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => {
    const child = Array.isArray(children) ? children[0] : children;

    if (React.isValidElement(child) && child.type === 'code') {
      const codeEl = child as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;

      const className = codeEl.props.className || '';
      const language = className.replace('language-', '') || 'plaintext';
      const code = String(codeEl.props.children || '').trim();
      return (
        <div className="markdown-body">
          <CodeActionPanel
            language={language}
            content={code}
            is_diff={language === 'diff'}
            inline={false}
            isStreaming={true}
          />
        </div>
      );
    }

    // fallback for non-code <pre> blocks
    return <pre>{children}</pre>;
  },
};
