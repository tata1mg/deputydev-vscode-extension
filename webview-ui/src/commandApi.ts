import { UsageTrackingRequest } from "./types";
import { callCommand } from "./vscode";

// export function webviewReady() {
//   return callCommand('webview-ready', null);
// }

// export function searchFile(query: string, limit: number = 20) {
//   return callCommand('search-file', { query, limit }) as Promise<
//     ChatReferenceFileItem[]
//   >;
// }

export function writeFile(params: {
  filePath: string;
  raw_diff: string;
  is_inline?: boolean;
  write_mode?: boolean;
}) {
  return callCommand("write-file", params);
}

export function checkDiffApplicable(params: {
  filePath: string;
  raw_diff: string;
}) {
  return callCommand("check-diff-applicable", params);
}

// chat api calls

export function apiChat(payload: unknown) {
  return callCommand<{ name: string; data: unknown }>("api-chat", payload, {
    stream: true,
  });
}

export function apiClearChat() {
  return callCommand("api-clear-chat", null);
}

export function apiSaveSession(payload: unknown) {
  return callCommand("api-save-session", payload);
}

export function apiChatSetting(payload: unknown) {
  return callCommand("api-chat-setting", payload);
}

export function apiStopChat() {
  return callCommand("api-stop-chat", null);
}

export function keywordSearch(payload: unknown) {
  return callCommand("keyword-search", payload);
}

export function usageTracking(payload: UsageTrackingRequest) {
  return callCommand("usage-tracking", payload);
}

export function keywordTypeSearch(payload: unknown) {
  return callCommand("keyword-type-search", payload);
}

// accept/reject file

/**
 * @param path: fs path
 */
export function acceptFile(path: string) {
  return callCommand("accept-file", { path });
}

/**
 * @param path: fs path
 */
export function rejectFile(path: string) {
  return callCommand("reject-file", { path });
}

export function openFile(path: string) {
  return callCommand("open-file", { path });
}

// generate code
export function cancelGenerateCode() {
  return callCommand("cancel-generate-code", null);
}

export function acceptGenerateCode() {
  return callCommand("accept-generate-code", null);
}

export function rejectGenerateCode() {
  return callCommand("reject-generate-code", null);
}

export function logToOutput(type: "info" | "warn" | "error", message: string) {
  return callCommand("log-to-output", { type, message });
}

export function showErrorMessage(message: string) {
  return callCommand("show-error-message", { message });
}

export function showInfoMessage(message: string) {
  return callCommand("show-info-message", { message });
}

// export function getOpenedFiles() {
//   return callCommand('get-opened-files', null) as Promise<
//     Omit<ChatReferenceFileItem, 'type'>[]
//   >;
// }

export function setGlobalState(data: { key: string; value: unknown }) {
  return callCommand("set-global-state", data);
}

export function getGlobalState(data: { key: string }) {
  return callCommand("get-global-state", data);
}

export function deleteGlobalState(data: { key: string }) {
  return callCommand("delete-global-state", data);
}

export function setWorkspaceState(data: { key: string; value: unknown }) {
  return callCommand("set-workspace-state", data);
}

export function getWorkspaceState(data: { key: string }) {
  return callCommand("get-workspace-state", data);
}

export function deleteWorkspaceState(data: { key: string }) {
  return callCommand("delete-workspace-state", data);
}

export function setSecretState(data: { key: string; value: unknown }) {
  return callCommand("set-secret-state", data);
}

export function getSecretState(data: { key: string }) {
  return callCommand("get-secret-state", data);
}

export function deleteSecretState(data: { key: string }) {
  return callCommand("delete-secret-state", data);
}

export function initiateLogin() {
  return callCommand("initiate-login", {});
}

export function fetchClientVersion() {
  return callCommand("get-client-version", {});
}

export function sendWebviewFocusState(isFocused: boolean) {
  return callCommand("webview-focus-state", { focused: isFocused });
}

export function getSessions(limit: number, offset: number) {
  return callCommand("get-sessions", { limit, offset });
}
export function getPinnedSessions() {
  return callCommand("get-pinned-sessions", { limit: 5, offset: 0 });
}
export function reorderPinnedSessions(data: Record<number, number>) {
  return callCommand("reorder-pinned-sessions", data);
}
export function getSessionChats(sessionId: number) {
  return callCommand("get-session-chats", { sessionId });
}

export function deleteSession(sessionId: number) {
  return callCommand("delete-session", { sessionId });
}

export function pinUnpinSession(
  sessionId: number,
  pin_or_unpin: string,
  rank?: number,
) {
  return callCommand("pin-unpin-session", { sessionId, pin_or_unpin, rank });
}

export function sendWorkspaceRepoChange(data: { repoPath: string }) {
  return callCommand("workspace-repo-change", data);
}

export function openBrowserPage(url: string) {
  return callCommand("open-requested-browser-page", { url });
}

export function signOut() {
  return callCommand("sign-out", {});
}

export function getProfileUiData() {
  return callCommand("fetch-profile-ui-data", {});
}

export function showUserLogs() {
  return callCommand("show-logs", {});
}

export function sendRetryEmbedding() {
  return callCommand("hit-retry-embedding", {});
}



// terminal
export function acceptTerminalCommand(tool_use_id: string , command: string) {
  return callCommand("accept-terminal-command", {tool_use_id, command});
}
export function rejectTerminalCommand() {
  return callCommand("reject-terminal-command", {});
}
 export function createNewWorkspace(tool_use_id: string) {
  console.log("createNewWorkspace sent from ui", tool_use_id);
  return callCommand("create-new-workspace", {tool_use_id});
}
export function editTerminalCommand(data: {user_query: string, old_command: string}) {
  return callCommand("edit-terminal-command", data);
}
