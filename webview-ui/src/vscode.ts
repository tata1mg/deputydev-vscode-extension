/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
import useExtensionStore, { ViewType } from './stores/useExtensionStore';
import { Session, sessionChats, useChatStore } from './stores/chatStore';
import { useWorkspaceStore } from './stores/workspaceStore';
import { useRepoSelectorStore } from './stores/repoSelectorStore';
import { ChatReferenceFileItem } from './stores/chatStore';
import { SearchResponseItem } from './types';

type Resolver = {
  resolve: (data: unknown) => void;
  reject: (error: unknown) => void;
  chunk?: (data: unknown) => void;
};

interface WorkspaceRepo {
  repoPath: string;
  repoName: string;
}

interface SetWorkspaceReposData {
  repos: WorkspaceRepo[];
  activeRepo: string | null;
}

type EventListener = (data: {
  id: string;
  command: string;
  data: unknown;
}) => void;

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
    console.log('chunk', data);
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
  options: { stream: false },
): Promise<any>;

export function callCommand<T = any>(
  command: string,
  data: unknown,
  options: { stream: true },
): AsyncIterableIterator<T>;

export function callCommand(
  command: string,
  data: unknown,
  options?: { stream: boolean },
): Promise<any> | AsyncIterableIterator<any> {
  const id = uuidv4();
  vscode.postMessage({
    id,
    command,
    data,
  });

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

export function addCommandEventListener(
  command: string,
  listener: EventListener,
) {
  if (!events[command]) {
    events[command] = [];
  }
  events[command].push(listener);
}

export function removeCommandEventListener(
  command: string,
  listener: EventListener,
) {
  if (events[command]) {
    events[command] = events[command].filter((l) => l !== listener);
  }
}

addCommandEventListener('new-chat', async () => {

  const currentViewType = useExtensionStore.getState().viewType;
  if (currentViewType !== 'chat') {
    useExtensionStore.setState({ viewType: 'chat' });
  } else {
    // clear chat history
    useChatStore.getState().clearChat();
  }
});

addCommandEventListener('set-view-type', ({ data }) => {
  useExtensionStore.setState({ viewType: data as ViewType });
});


addCommandEventListener('repo-selector-state', ({ data }) => {
  useRepoSelectorStore.getState().setRepoSelectorDisabled(data as boolean);
});



addCommandEventListener('set-workspace-repos', ({ data }) => {
  const { repos, activeRepo } = data as SetWorkspaceReposData;

  // Log entire repos array
  console.log('Received Repositories:', repos);

  // Log each repo individually for better readability
  repos.forEach((repo, index) => {
    console.log(`Repo ${index + 1}:`, repo);
  });

  // Log activeRepo
  console.log('Active Repo:', activeRepo);

  useWorkspaceStore.getState().setWorkspaceRepos(repos, activeRepo);
});






addCommandEventListener('repo-selector-state', ({ data }) => {
  useRepoSelectorStore.getState().setRepoSelectorDisabled(data as boolean);
});



addCommandEventListener('set-workspace-repos', ({ data }) => {
  const { repos, activeRepo } = data as SetWorkspaceReposData;

  // Log entire repos array
  console.log('Received Repositories:', repos);

  // Log each repo individually for better readability
  repos.forEach((repo, index) => {
    console.log(`Repo ${index + 1}:`, repo);
  });

  // Log activeRepo
  console.log('Active Repo:', activeRepo);

  useWorkspaceStore.getState().setWorkspaceRepos(repos, activeRepo);
});





addCommandEventListener('sessions-history', ({ data }) => {
  useChatStore.setState({ sessions: data as Session[] });
});

addCommandEventListener('keyword-search-response', ({ data }) => {
  if (!Array.isArray(data)) {
    console.error("Invalid data format for 'keyword-search-response'", data);
    return;
  }

  const editorReference: ChatReferenceFileItem[] = (data as SearchResponseItem[]).map((item) => ({
    id: item.value,
    type: 'file',
    name: item.path.split('/').pop() || item.path,
    fsPath: item.path,
  }));

  useChatStore.setState({ currentEditorReference: editorReference });
});


addCommandEventListener('session-chats-history', ({ data }) => {
  useChatStore.setState({ sessionChats: data as sessionChats[] });
});
// addCommandEventListener('current-editor-changed', ({ data }) => {
//   const item = data as ChatReferenceFileItem;
//   useChatStore.setState({ currentEditorReference: item });
// });

// addCommandEventListener('server-started', async ({ data }) => {
//   console.debug('server-started', data);
//   useExtensionStore.setState({
//     isStarted: true,
//     serverUrl: data as string,
//   });
// });

// addCommandEventListener('generate-code', ({ data }) => {
//   console.debug('generate-code', data);
//   useChatStore.setState({
//     generateCodeSnippet: data as ChatReferenceSnippetItem,
//   });
// });

// addCommandEventListener('insert-into-chat', ({ data }) => {
//   console.debug('insert-into-chat', data);
//   if (data) {
//     useChatStore.setState((state) => ({
//       ...state,
//       chatReferenceList: [
//         ...state.chatReferenceList,
//         data as ChatReferenceSnippetItem,
//       ],
//     }));
//   }
//   useExtensionStore.setState({ viewType: 'chat' });
// });

// addCommandEventListener('diff-view-change', (params) => {
//   const data = params.data as DiffViewChange;
//   console.debug('diff-view-change', data);
//   useChatStore.setState((state) => {
//     const isExist = state.currentEditFiles.some(
//       (file) => file.path === data.path,
//     );
//     if (isExist) {
//       return {
//         ...state,
//         currentEditFiles: state.currentEditFiles.map((item) =>
//           item.path === data.path ? data : item,
//         ),
//       };
//     }
//     return {
//       ...state,
//       currentEditFiles: [...state.currentEditFiles, data],
//     };
//   });
// });
