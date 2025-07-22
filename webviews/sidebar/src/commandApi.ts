import {
  UsageTrackingRequestFromSidebar,
  SaveUrlRequest,
  Settings,
  AgentPayload,
  NewReview,
} from './types';
import { callCommand } from './vscode';

export function writeFile(params: {
  filePath: string;
  raw_diff: string;
  is_inline?: boolean;
  write_mode?: boolean;
}) {
  return callCommand('write-file', params);
}

export function checkDiffApplicable(params: { filePath: string; raw_diff: string }) {
  return callCommand('check-diff-applicable', params);
}
export function checkFileExists(filePath: string) {
  return callCommand('check-file-exists', { filePath });
}

// chat api calls

export function apiChat(payload: unknown) {
  return callCommand<{ name: string; data: unknown }>('api-chat', payload, {
    stream: true,
  });
}

export function apiClearChat() {
  return callCommand('api-clear-chat', null);
}

export function apiSaveSession(payload: unknown) {
  return callCommand('api-save-session', payload);
}

export function apiChatSetting(payload: unknown) {
  return callCommand('api-chat-setting', payload);
}

export function apiStopChat() {
  return callCommand('api-stop-chat', null);
}

export function keywordSearch(payload: unknown) {
  return callCommand('keyword-search', payload);
}

export function usageTracking(payload: UsageTrackingRequestFromSidebar) {
  return callCommand('usage-tracking', payload);
}

export function keywordTypeSearch(payload: unknown) {
  return callCommand('keyword-type-search', payload);
}

export function urlSearch(payload: { keyword: string; isSettings?: boolean }) {
  return callCommand('url-search', payload);
}

export function getSavedUrls(payload: { isSettings?: boolean } = {}) {
  return callCommand('get-saved-urls', payload);
}

export function saveUrl(payload: SaveUrlRequest) {
  return callCommand('save-url', payload);
}

export function deleteSavedUrl(id: string, isSettings?: boolean) {
  return callCommand('delete-saved-url', { id, isSettings });
}

export function updateSavedUrl(payload: { id: string; name: string; isSettings?: boolean }) {
  return callCommand('update-saved-url', payload);
}

// accept/reject file

export function acceptAllChangesInSession(sessionId: number) {
  return callCommand('accept-all-changes-in-session', { sessionId });
}

export function rejectAllChangesInSession(sessionId: number) {
  return callCommand('reject-all-changes-in-session', { sessionId });
}

export function acceptAllChangesInFile(filePath: string, repoPath: string, sessionId: number) {
  return callCommand('accept-all-changes-in-file', { filePath, repoPath, sessionId });
}

export function rejectAllChangesInFile(filePath: string, repoPath: string, sessionId: number) {
  return callCommand('reject-all-changes-in-file', { filePath, repoPath, sessionId });
}

export function openDiffViewer(filePath: string, repoPath: string) {
  return callCommand('open-diff-viewer-for-file', { filePath, repoPath });
}

/**
 * @param path: fs path
 */
export function acceptFile(path: string) {
  return callCommand('accept-file', { path });
}

/**
 * @param path: fs path
 */
export function rejectFile(path: string) {
  return callCommand('reject-file', { path });
}

export function openFile(path: string, startLine?: number, endLine?: number, isAbsolute?: boolean) {
  return callCommand('open-file', { path, startLine, endLine, isAbsolute });
}

export function revealFolderInExplorer(folderPath: string) {
  return callCommand('reveal-folder-in-explorer', { folderPath });
}

export function createOrOpenFile(path: string) {
  return callCommand('open-or-create-file', { path });
}

export function openMcpSettings() {
  return callCommand('open-mcp-settings', {});
}

// generate code
export function cancelGenerateCode() {
  return callCommand('cancel-generate-code', null);
}

export function acceptGenerateCode() {
  return callCommand('accept-generate-code', null);
}

export function rejectGenerateCode() {
  return callCommand('reject-generate-code', null);
}

export function logToOutput(type: 'info' | 'warn' | 'error', message: string) {
  return callCommand('log-to-output', { type, message });
}

export function logToLogFile(type: 'info' | 'warn' | 'error', message: string) {
  return callCommand('log-to-log-file', { type, message });
}

export function showErrorMessage(message: string) {
  return callCommand('show-error-message', { message });
}

export function showInfoMessage(message: string) {
  return callCommand('show-info-message', { message });
}

export function setGlobalState(data: { key: string; value: unknown }) {
  return callCommand('set-global-state', data);
}

export function getGlobalState(data: { key: string }) {
  return callCommand('get-global-state', data);
}

export function deleteGlobalState(data: { key: string }) {
  return callCommand('delete-global-state', data);
}

export function updateContextRepositories(data: { contextRepositories: unknown }) {
  return callCommand('update-context-repositories', data);
}

export function setWorkspaceState(data: { key: string; value: unknown }) {
  return callCommand('set-workspace-state', data);
}

export function getWorkspaceState(data: { key: string }) {
  return callCommand('get-workspace-state', data);
}

export function deleteWorkspaceState(data: { key: string }) {
  return callCommand('delete-workspace-state', data);
}

export function setSecretState(data: { key: string; value: unknown }) {
  return callCommand('set-secret-state', data);
}

export function getSecretState(data: { key: string }) {
  return callCommand('get-secret-state', data);
}

export function deleteSecretState(data: { key: string }) {
  return callCommand('delete-secret-state', data);
}

export function initiateLogin() {
  return callCommand('initiate-login', {});
}

export function fetchClientVersion() {
  return callCommand('get-client-version', {});
}

export function getSessions(limit: number, offset: number) {
  return callCommand('get-sessions', { limit, offset });
}
export function getPinnedSessions() {
  return callCommand('get-pinned-sessions', { limit: 5, offset: 0 });
}
export function reorderPinnedSessions(data: Record<number, number>) {
  return callCommand('reorder-pinned-sessions', data);
}
export function getSessionChats(sessionId: number) {
  return callCommand('get-session-chats', { sessionId });
}

export function deleteSession(sessionId: number) {
  return callCommand('delete-session', { sessionId });
}

export function pinUnpinSession(sessionId: number, pin_or_unpin: string, rank?: number) {
  return callCommand('pin-unpin-session', { sessionId, pin_or_unpin, rank });
}

export function sendWorkspaceRepoChange(data: { repoPath: string }) {
  return callCommand('workspace-repo-change', data);
}

export function openBrowserPage(url: string) {
  return callCommand('open-requested-browser-page', { url });
}

export function saveSettings(data: Settings) {
  return callCommand('save-settings', data);
}

export function signOut() {
  return callCommand('sign-out', {});
}

export function getProfileUiData() {
  return callCommand('fetch-profile-ui-data', {});
}

export function showUserLogs() {
  return callCommand('show-logs', {});
}

export function hitEmbedding(repoPath: string) {
  if (repoPath) {
    return callCommand('hit-embedding', { repoPath });
  }
}

// terminal
export function acceptTerminalCommand(tool_use_id: string, command: string) {
  return callCommand('accept-terminal-command', { tool_use_id, command });
}
export function rejectTerminalCommand() {
  return callCommand('reject-terminal-command', {});
}
export function createNewWorkspace(tool_use_id: string) {
  return callCommand('create-new-workspace', { tool_use_id });
}
export function editTerminalCommand(data: { user_query: string; old_command: string }) {
  return callCommand('edit-terminal-command', data);
}
export function killProcessById(tool_use_id: string) {
  return callCommand('kill-terminal-process', { tool_use_id });
}
export function killAllProcesses() {
  return callCommand('kill-all-terminal-processes', null);
}

export function setShellIntegrationTimeoutMessage(data: { key: string; value: unknown }) {
  return callCommand('set-shell-integration-timeout', data);
}

export function setDisableShellIntegrationMessage(data: { key: string; value: unknown }) {
  return callCommand('set-disable-shell-integration', data);
}

export function webviewInitialized() {
  return callCommand('webview-initialized', {});
}

export function submitFeedback(feedback: string, queryId: number) {
  return callCommand('submit-feedback', { feedback, queryId });
}

export function enhanceUserQuery(userQuery: string) {
  return callCommand('enhance-user-query', { userQuery });
}

// MCP Operations
export function syncServers() {
  return callCommand('sync-servers', {});
}

export function mcpServerEnableOrDisable(action: 'enable' | 'disable', serverName: string) {
  return callCommand('mcp-server-enable-or-disable', { action, serverName });
}

export function toolUseApprovalUpdate(
  toolUseId: string,
  autoAcceptNextTime: boolean,
  approved: boolean
) {
  return callCommand('tool-use-approval-update', { toolUseId, autoAcceptNextTime, approved });
}

export function uploadFileToS3(data: File) {
  const reader = new FileReader();

  reader.onload = () => {
    const arrayBuffer = reader.result as ArrayBuffer;
    const uint8Array = new Uint8Array(arrayBuffer);
    const fileData = {
      name: data.name,
      type: data.type,
      size: data.size,
      content: Array.from(uint8Array),
    };
    callCommand('upload-file-to-s3', fileData);
  };
  reader.readAsArrayBuffer(data);
}

export function showVsCodeMessageBox(type: 'info' | 'error' | 'warning', message: string) {
  return callCommand('show-vscode-message-box', { type, message });
}

export function deleteImage(key: string) {
  return callCommand('delete-image', { key });
}

export function downloadImageFile(key: string) {
  return callCommand('download-image-file', { key });
}

// Code Review

export function codeReviewPreProcess(data: NewReview) {
  return callCommand('code-review-pre-process', data);
}

export function startCodeReview(data: { review_id: number; agents: AgentPayload[] }) {
  return callCommand('start-code-review', data);
}

export function newReview(data: { targetBranch: string; reviewType: string }) {
  return callCommand('new-review', data);
}

export function hitSnapshot(reviewType: string) {
  if (reviewType !== 'COMMITTED_ONLY') {
    return callCommand('hit-snapshot', { reviewType });
  }
}

export function searchBranches(keyword: string) {
  return callCommand('search-branches', { keyword });
}

export function openFileDiff(data: { udiff: string; filePath: string; fileName: string }) {
  console.log('openFileDiff called with', data);
  return callCommand('open-file-diff', data);
}

export function fetchPastReviews(data: { sourceBranch: string; repoId: number }) {
  return callCommand('fetch-past-reviews', data);
}

export function openCommentInFile(data: {
  filePath: string;
  lineNumber: number;
  commentText: string;
  promptText: string;
  commentId: number;
}) {
  return callCommand('open-comment-in-file', data);
}

export function getUserAgents() {
  return callCommand('fetch-user-agents', {});
}

export function performCrudOnUserAgent(
  operation: 'CREATE' | 'UPDATE' | 'DELETE',
  agent_id?: number,
  agent_name?: string,
  custom_prompt?: string
) {
  return callCommand('user-agent-crud', { operation, agent_id, agent_name, custom_prompt });
}

export function startCodeReviewPostProcess(data: { review_id: number }) {
  return callCommand('code-review-post-process', data);
}

export function cancelReview() {
  return callCommand('cancel-review', {});
}
