import * as vscode from "vscode";

export async function updateTerminalSettings(context: vscode.ExtensionContext) {
  // Helper function to set default global state values
  const setDefaultGlobalStateValue = async (key: string, defaultValue: any) => {
    const value = context.globalState.get(key);
    if (value === undefined) {
      await context.globalState.update(key, defaultValue);
    }
  };

  // Set default values for terminal settings
  await setDefaultGlobalStateValue("terminal-output-limit", 500); // Limit excessive output
  await setDefaultGlobalStateValue("terminal-shell-limit", 5); // Restrict active shells
  await setDefaultGlobalStateValue("terminal-command-timeout", 40); // Prevent hanging commands
}
