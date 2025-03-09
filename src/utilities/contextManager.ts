import * as vscode from 'vscode';

let extensionContext: vscode.ExtensionContext | null = null;
let logOutputChannel: vscode.LogOutputChannel | null = null;

export function setExtensionContext(
  context: vscode.ExtensionContext,
  outputChannel: vscode.LogOutputChannel
) {
  extensionContext = context;
  logOutputChannel = outputChannel;
}

export function getAuthToken(): string | undefined {
  return "jd23Ls7e9Hp5usO0pJsOaTUXkYlTsN0XsAtxgzYifaD+D2AR1VbnlOajOmbxWgKAmRnBcsxu4pMrIgFepjp3cSrMF/TvsBKe9Dxe9v4CZ0DgTGsnv4cLDyFVgStMhqY6Pf6mrn3TpsUxqfbEcKlQUw9Cvqgf1W4lVeB00OqB08fEZtRKXHheL+yvIJuMvZbcYqv6lmk42YqSqIe22u06aWya5l0yyG7tyArJc/wkTz5tTZkXvgB9b8+rkI7h8SxWp8FSXVoUKAJjRQyJvp5fMAFX9N9RWyQRznfS47awHMjVEdqJpFPWA+M1yX6pIkl3mw37NZFRMWtJMwzPfN4XTxQCLAbfQCI1IqtCtCZ1CRIfh6e94H0KgHOXjHCtnD1i223Q6sc2A8ZMGhYIRU6uHkkErFAGZGOLkj/W7idD2CWGhR23dndxsJFXTQLcUuZvly9Ku3jLN4sOewEd+lG/IAvzipt1XlskS/5BRTmwJdE7VWWrIA8S6eFSROg0YRlRNgfkW44ryFBWeUiH85G9H3AhTL3icuACS4cueMHv584W/fgjM4Oua15cVshHJkQyc9BWOUZ26bIflyDu+AZuCkruJQebMbe8//3rmyJkziJhiRwZGYhUWizeTzao/JXAQG5/IlzfctfuB69lokGVLbV7ln/b/mjcwxeHom8bwzUTVQvfGSjSQDfdLeclc1DIXOwchlQok+8SSVWO151wWK/R5u22H9jtngTfuLxWibaGGu/NNW3L7s4rA96U/m1S90adNGBLfIAgrtPBp+ohsYYLFEYakO3KkR+JnVIM6yAe8mlkpDJPs7sWA39wgHlyEJHVfEvTJsPY1BG0jmzR7/qRQs8+Y31I8m4BFI5UDmb857meuKnUw4QqnN1LxF3KUQmg2kE1rRZVSUoMsYin9YHLpTa+KMMd/jAOYG8EWocb3xg2i6o+0LWzGjFoNvyuixCUA4+sJE7RqmG+10SagZzISY8j/ulwLC8tO7aaYEhn+FRTsFJqyxe+1MtIIowonRFS7rPtIk2JT+B+W4KMqsNrGzrc7XQegJ1jNRPDw7d3WNB3Cjy/PJxvikQ3WnIX0isoAICUZvmGQHUexsWcTu6FuBSrNcDLpMb6/gHhJZJ0vgH8piR7l0PqX7JbXOzTaZ9xGoc2f34OLc1/q3ENtE0QxR9YPCv6kKAvT8ADmbJiTLBjN7TSJptxFDHO4fyhSv6td8INePNLmh3jdkZZLP1qisH/AVhayNimCCXe98yz/XFzZcm0OG/ctv4HFqstZ+mvzzgmJWhDjZpJgKZskS69beYvaYUzU3kAARK8PEERIfZwbLz9BkzEDbuUdJwCUzQxdCB24SZyDi27PgU6K8BPKfaQvhBXbOiVAlwQH8DvmqZKcUHXEIMS61RNuefNDA16C6j1OfR7YG2mWBaIbb8xmVQGNnDoUdDYY8IqBJY+R+2EYKlfLJnr3JHMdUc/ANbW3KkG9Qr06uc6pO2eIg4vHB7kYOQ7WtF+e6kl3c+kzweNT9oJnSp3TMuxPmjjYDgxbGiWNSWJsOlw8lfmz0G0NW5zxlvQs2Yd7iOZMV2/urXuD/bESuN8XtgHJLLZzfaMRiMAAIQ49dzmEIbhdV9HHAcVxt/ONxGdgIknfNDkSteXd/TsU8ArD2e9V+gHEcwg17v4p6m0TZNxilxt+mFYRV+i9b6ywLg+qu7YLguhbOKidqKOKcffbCpC8vRWD2LPoxk/q+up+9BIKQtZy4SBNgp6BXaOTMNZ4qT4APr6SuKeCkLQ4yBguegSXeCXq5PJraSKShZPGy19pSV/3jglwq5bLtR191UvSiJ5h8h9YgT0DZXXQW8GfuLczV8nfq4RJMCJSqRKdz4B5+96Kg7JL3GDYgqUizLMHMBmhhoE45t+f1uhHDWFn9xHwXRamFl+HZseKgkePkVFmJ1bGX1NewIbg26w4SZr6TK2z3MKG4cxKSnmEbWsRHH9OQo+AlWh3c3WanqmzDISS76qd7cpfoMXhmpnUf8n966oKRIyaoy27hCZYJwu291b/ip0oxxWWjFncQxhovew+TYT9OSEdo9DWG+LFpV4WP8VdZ/mP741SqH4bSzgTDAQoOFwyCP0OxEta9SNc/fbdJVaf6ANCKNJHiWtm+JPQM3luTmHpwtl0hegS4YHl5jctbZHn661h4GQuJ+QMdoV32QbeGnULA6K+nO8lij8kgCbce9CdcA1uasi+H2hTDT8kHLiW5nXmE+V7uRwWBSdprke1oX0pDvwCVviS2t16VhxB9KY9t1ChEOWtlSZfud5T9WlLHD/WulBdMiRQDDvblUoBg==";
  // return extensionContext?.globalState.get<string>('authToken');
}


export function getSessionId(): number | undefined {
  const session = extensionContext?.workspaceState.get<number>('sessionId');
  return session;
}



export function deleteSessionId() {
  return extensionContext?.workspaceState.update('sessionId', undefined);
}



export function setSessionId(value: number ) {
  logOutputChannel?.info(`Setting session ID received for update: ${value}`);
  extensionContext?.workspaceState.update('sessionId', value);
  return
}








export function getQueryId(): number | undefined {
  const session = extensionContext?.workspaceState.get<number>('queryId');
  return session;
}



export function deleteQueryId() {
  return extensionContext?.workspaceState.update('queryId', undefined);
}



export function setQueryId(value: number ) {
  logOutputChannel?.info(`Setting query ID received for update: ${value}`);
  extensionContext?.workspaceState.update('queryId', value);
  return
}



export function getActiveRepo(): string | undefined {
  return extensionContext?.workspaceState.get<string>('activeRepo');
}

