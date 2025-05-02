import { callCommand } from './vscode';


export function checkDiffApplicable(params: { filePath: string; raw_diff: string }) {
  return callCommand('check-diff-applicable', params);
}

// chat api calls

export function apiChat(payload: unknown) {
  return callCommand<{ name: string; data: unknown }>('api-chat', payload, {
    stream: true,
  });
}
