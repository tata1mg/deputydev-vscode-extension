import * as vscode from 'vscode';
import { SidebarProvider } from '../panels/SidebarProvider';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './Logger';

export class ThemeManager {
  private sideBarProvider: SidebarProvider;
  private logger: Logger;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(sideBarProvider: SidebarProvider, logger: Logger) {
    this.sideBarProvider = sideBarProvider;
    this.logger = logger;

    // Send initial theme
    this.sendThemeKind(vscode.window.activeColorTheme.kind);

    // Listen for theme changes
    const themeChangeListener = vscode.window.onDidChangeActiveColorTheme((theme) => {
      this.logger.info(`[ThemeManager] Theme changed: ${this.getThemeKindName(theme.kind)}`);
      this.sendThemeKind(theme.kind);
    });

    this.disposables.push(themeChangeListener);
  }

  private sendThemeKind(kind: vscode.ColorThemeKind) {
    this.sideBarProvider.sendMessageToSidebar({
      id: uuidv4(),
      command: 'theme-change',
      data: this.getThemeKindName(kind),
    });
  }

  private getThemeKindName(kind: vscode.ColorThemeKind): string {
    switch (kind) {
      case vscode.ColorThemeKind.Dark:
        return 'dark';
      case vscode.ColorThemeKind.Light:
        return 'light';
      case vscode.ColorThemeKind.HighContrast:
        return 'high-contrast';
      case vscode.ColorThemeKind.HighContrastLight:
        return 'high-contrast-light';
      default:
        return 'unknown';
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
