import type { Node } from 'unist';
import { visit } from 'unist-util-visit';
/**
 * Custom remark plugin that prevents filenames with extensions from being parsed as bold text
 * For example: __init__.py should not be rendered as bold "init" followed by ".py"
 */
export const remarkPreventBoldFilenames = () => {
  return (tree: Node) => {
    visit(tree, 'strong', (node: any, index: number | undefined, parent: any) => {
      // Only process if there's a next node (potential file extension)
      if (!parent || typeof index === 'undefined' || index === parent.children.length - 1) return;

      const nextNode = parent.children[index + 1];

      // Check if next node is text and starts with . followed by extension
      if (nextNode.type !== 'text' || !nextNode.value.match(/^\.[a-zA-Z0-9]+/)) return;

      // If the strong node has multiple children, something weird is happening
      if (node.children?.length !== 1) return;

      // Get the text content from inside the strong node
      const strongContent = node.children?.[0]?.value;
      if (!strongContent || typeof strongContent !== 'string') return;

      // Validate that the strong content is a valid filename
      if (!strongContent.match(/^[a-zA-Z0-9_-]+$/)) return;

      // Combine into a single text node
      const newNode = {
        type: 'text',
        value: `__${strongContent}__${nextNode.value}`,
      };

      // Replace both nodes with the combined text node
      parent.children.splice(index, 2, newNode);
    });
  };
};

/**
 * Custom remark plugin that converts plain URLs in text into clickable links
 */
export const remarkUrlToLink = () => {
  return (tree: Node) => {
    // Visit all "text" nodes in the markdown AST (Abstract Syntax Tree)
    visit(tree, 'text', (node: any, index, parent) => {
      const urlRegex = /https?:\/\/[^\s<>)"]+/g;
      const matches = node.value.match(urlRegex);
      if (!matches) return;

      const parts = node.value.split(urlRegex);
      const children: any[] = [];

      parts.forEach((part: string, i: number) => {
        if (part) children.push({ type: 'text', value: part });
        if (matches[i]) {
          children.push({
            type: 'link',
            url: matches[i],
            children: [{ type: 'text', value: matches[i] }],
          });
        }
      });

      if (parent) {
        parent.children.splice(index, 1, ...children);
      }
    });
  };
};
