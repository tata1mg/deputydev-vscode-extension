/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from "uuid";
import { useExtensionStore } from "./stores/useExtensionStore";
import { useChatSettingStore, useChatStore } from "./stores/chatStore";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { useRepoSelectorStore } from "./stores/repoSelectorStore";
import {
  ChatMessage,
  Session,
  ViewType,
  ChatReferenceItem,
  ProfileUiDiv,
  ProgressBarData,
} from "@/types";
import { logToOutput, getSessions } from "./commandApi";
import { useSessionsStore } from "./stores/sessionsStore";
import { useLoaderViewStore } from "./stores/useLoaderViewStore";
import { useUserProfileStore } from "./stores/useUserProfileStore";

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

type EventListener = (data: {
  id: string;
  command: string;
  data: unknown;
}) => void;

const vscode = acquireVsCodeApi();

const resolvers: Record<string, Resolver> = {};

const events: Record<string, EventListener[]> = {};

window.addEventListener("message", (event) => {
  const { id, command, data } = event.data;
  if (command === "result") {
    const resolver = resolvers[id];
    resolver.resolve(data);
    delete resolvers[id];
    return;
  }

  if (command === "chunk") {
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

  if (command === "get-workspace-state") {
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

addCommandEventListener("new-chat", async () => {
  useChatSettingStore.setState({
    chatSource: "new-chat",
  });

  const currentViewType = useExtensionStore.getState().viewType;

  if (currentViewType !== "chat") {
    useExtensionStore.setState({ viewType: "chat" });
  } else {
    useChatStore.getState().clearChat();
    callCommand("delete-session-id", null);
  }
});

addCommandEventListener("set-view-type", ({ data }) => {
  const currentViewType = useExtensionStore.getState().viewType;

  if (data === "history" && currentViewType !== "history") {
    useSessionsStore.getState().clearCurrentSessionsPage();
    useSessionsStore.getState().clearSessions();
  }
  useExtensionStore.setState({ viewType: data as ViewType });
});

addCommandEventListener("repo-selector-state", ({ data }) => {
  useRepoSelectorStore.getState().setRepoSelectorDisabled(data as boolean);
});

addCommandEventListener("repo-selector-state", ({ data }) => {
  useRepoSelectorStore.getState().setRepoSelectorDisabled(data as boolean);
});

addCommandEventListener("set-workspace-repos", ({ data }) => {
  logToOutput(
    "info",
    `set-workspace-repos :: ${JSON.stringify(data)}`,
  );
  const { repos, activeRepo } = data as SetWorkspaceReposData;

  logToOutput(
    "info",
    `set-workspace-repos :: ${JSON.stringify(repos)}`,
  );
  logToOutput(
    "info",
    `set-workspace-repos :: ${JSON.stringify(activeRepo)}`,
  );
  useWorkspaceStore.getState().setWorkspaceRepos(repos, activeRepo);
});

addCommandEventListener("sessions-history", ({ data }: any) => {
  useSessionsStore.setState({ noUnpinnedSessions: data.unpinnedSessions.length === 0 });
  // Check if data is not empty before setting it
  useSessionsStore.getState().setHasMore(data.hasMore);
  if (data.unpinnedSessions && Array.isArray(data.unpinnedSessions) && data.unpinnedSessions.length > 0) {
    // Append new sessions to the existing ones
    useSessionsStore
      .getState()
      .setSessions((prevSessions) => [...prevSessions, ...(data.unpinnedSessions as Session[])]);
  }
});

addCommandEventListener("pinned-sessions", ({ data }: any) => {
  useSessionsStore.setState({ noPinnedSessions: data.lenght === 0});
  // Check if data is not empty before setting it
  if (data && Array.isArray(data) && data.length > 0) {
    // Append new sessions to the existing ones
    useSessionsStore.setState({
      pinnedSessions: data as Session[],
    });
  }
});

addCommandEventListener("keyword-search-response", ({ data }) => {
  const AutoSearchResponse = (data as any[]).map((item) => {
    return {
      icon: item.type,
      label: item.value,
      value: item.value,
      description: item.path,
      chunks: item.chunks ? item.chunks : null,
    };
  });
  logToOutput(
    "info",
    `AutoSearchResponse :: ${JSON.stringify(AutoSearchResponse)}`,
  );
  useChatStore.setState({ ChatAutocompleteOptions: AutoSearchResponse });
  if (!Array.isArray(data)) {
    // console.error("Invalid data format for 'keyword-search-response'", data);
    return;
  }

  // const editorReference: ChatReferenceFileItem[] = (
  //   data as SearchResponseItem[]
  // ).map((item) => ({
  //   id: item.value,
  //   type: "file",
  //   name: item.path.split("/").pop() || item.path,
  //   fsPath: item.path,
  // }));

  // useChatStore.setState({ currentEditorReference: editorReference });
});

addCommandEventListener("keyword-type-search-response", ({ data }) => {
  const AutoSearchResponse = (data as any[]).map((item) => {
    return {
      icon: item.type,
      label: item.value,
      value: item.value,
      description: item.path,
      chunks: item.chunks ? item.chunks : null,
    };
  });
  logToOutput(
    "info",
    `AutoSearchResponse :: ${JSON.stringify(AutoSearchResponse)}`,
  );
  useChatStore.setState({ ChatAutocompleteOptions: AutoSearchResponse });
  if (!Array.isArray(data)) {
    // console.error(
    //   "Invalid data format for 'keyword-type-search-response'",
    //   data
    // );
    return;
  }
});

addCommandEventListener("session-chats-history", ({ data }) => {
  useExtensionStore.setState({ viewType: "chat" });
  useChatStore.setState({ history: data as ChatMessage[] });
});

addCommandEventListener("inline-chat-data", ({ data }) => {
  const response = data as InlineChatReferenceData;
  const currentEditorReference = useChatStore.getState().currentEditorReference;
  const lengthOfCurrentEditorReference = currentEditorReference.length;
  const chatReferenceItem: ChatReferenceItem = {
    index: lengthOfCurrentEditorReference,
    type: "code_snippet",
    keyword: response.keyword,
    path: response.path,
    chunks: [response.chunk],
    noEdit: true,
  };
  useChatStore.setState({
    currentEditorReference: [...currentEditorReference, chatReferenceItem],
  });
  useChatSettingStore.setState({ chatSource: "inline-chat" });
  // console.dir(useChatStore.getState().currentEditorReference, { depth: null });
});

addCommandEventListener("progress-bar", ({ data }) => {
  const progressBarData = data as ProgressBarData;
  const incomingProgressBarRepo = progressBarData.repo;
  const currentProgressBars = useChatStore.getState().progressBars;
  // Check if the repo is present in the currentProgressBars array
  const isRepoPresent = currentProgressBars.some(
    (bar) => bar.repo === incomingProgressBarRepo,
  );
  if (!isRepoPresent) {
    // If the repo is not present, add it to the array
    useChatStore.setState({
      progressBars: [...currentProgressBars, progressBarData],
    });
  } else {
    // If the repo is present, update the progress
    useChatStore.setState({
      progressBars: currentProgressBars.map((bar) =>
        bar.repo === incomingProgressBarRepo
          ? { ...progressBarData } // Replace the existing bar with progressBarData
          : bar,
      ),
    });
  }
});

addCommandEventListener("profile-ui-data", ({ data }) => {
  useUserProfileStore.setState({ profileUiData: data as ProfileUiDiv[] });
});

addCommandEventListener("force-upgrade-data", ({ data }) => {
  useChatStore.setState({
    forceUpgradeData: data as { url: string; upgradeVersion: string },
  });
  useExtensionStore.setState({ viewType: "force-upgrade" });
});

addCommandEventListener("loader-message", ({ data }) => {
  const loaderMessage = data as boolean;
  useLoaderViewStore.setState({ loaderViewState: loaderMessage });
});

addCommandEventListener("send-client-version", ({ data }) => {
  useExtensionStore.setState({ clientVersion: data as string });
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
