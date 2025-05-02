/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
// import { useChatStore } from './stores/chatStore';

type Resolver = {
  resolve: (data: unknown) => void;
  reject: (error: unknown) => void;
  chunk?: (data: unknown) => void;
};

interface InlineChatReferenceData {
  keyword: string;
  path: string;
  chunk: {
    start_line: number;
    end_line: number;
    chunk_hash: string;
    file_hash: string;
    file_path: string;
    meta_info?: any;
  };
  value: string;
}

interface WorkspaceRepo {
  repoPath: string;
  repoName: string;
}

interface SetWorkspaceReposData {
  repos: WorkspaceRepo[];
  activeRepo: string | null;
}

type EventListener = (data: { id: string; command: string; data: unknown }) => void;

const vscode = acquireVsCodeApi();

const resolvers: Record<string, Resolver> = {};

const events: Record<string, EventListener[]> = {};

window.addEventListener('message', (event) => {
  const { id, command, data } = event.data;
  if (command === 'result') {
    const resolver = resolvers[id];
    resolver.resolve(data);
    delete resolvers[id];
    return;
  }

  if (command === 'chunk') {
    const resolver = resolvers[id];
    resolver.chunk?.(data);
    return;
  }

  const listeners = events[command];
  if (listeners) {
    listeners.forEach((listener) => listener({ id, command, data }));
  }
});

export function callCommand(command: string, data: unknown): Promise<any>;

export function callCommand(
  command: string,
  data: unknown,
  options: { stream: false }
): Promise<any>;

export function callCommand<T = any>(
  command: string,
  data: unknown,
  options: { stream: true }
): AsyncIterableIterator<T>;

export function callCommand(
  command: string,
  data: unknown,
  options?: { stream: boolean }
): Promise<any> | AsyncIterableIterator<any> {
  const id = uuidv4();

  if (command === 'get-workspace-state' || command === 'get-global-state') {
    // console.log("callCommand: waiting 0.5 seconds before sending workspace state request...");

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // console.log("callCommand: 0.5 seconds elapsed, now sending workspace state request...");

        // Create the resolver only when we actually send the request
        resolvers[id] = { resolve, reject };

        vscode.postMessage({ id, command, data });
      }, 500); // 5-second delay
    });
  } else {
    vscode.postMessage({ id, command, data });

    if (!options?.stream) {
      return new Promise((resolve, reject) => {
        resolvers[id] = { resolve, reject };
      });
    }
  }

  if (!options?.stream) {
    return new Promise((resolve, reject) => {
      resolvers[id] = { resolve, reject };
    });
  }

  // notice handler
  let chunkResolve: undefined | (() => void);
  // use array to void data loss
  const chunkData: any[] = [];

  let stop = false;
  const gen = (async function* () {
    while (true) {
      // wait for chunk
      await new Promise<void>((resolve) => {
        chunkResolve = resolve;
      });
      while (chunkData.length > 0) {
        yield chunkData.shift();
      }
      if (stop) {
        return;
      }
    }
  })();

  const chunk = (data: any) => {
    chunkData.push(data);
    if (chunkResolve) {
      chunkResolve();
      chunkResolve = undefined;
    }
  };

  const resolve = (data: any) => {
    chunkResolve?.();
    stop = true;
    gen.return(data);
  };

  // this cannot be catch by try catch in the outer for await loop.
  const reject = (error: any) => {
    gen.throw(error);
  };

  resolvers[id] = { resolve, reject, chunk };

  return gen;
}


// addCommandEventListener('terminal-output-to-chat', ({ data }) => {
//   const terminalOutput = data as { terminalOutput: string };
//   const currentUserInput = useChatStore.getState().userInput;
//   useChatStore.setState({
//     userInput: currentUserInput + terminalOutput.terminalOutput,
//   });
// });
