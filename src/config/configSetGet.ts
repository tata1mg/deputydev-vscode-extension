let MainConfig: Record<string, unknown> = {};
let EssentialConfig: Record<string, unknown> = {};

export function setMainConfig(config: any) {
  MainConfig = config;
}

export function setEssentialConfig(config: any) {
  EssentialConfig = config;
}

export function getMainConfig(): any {
  return MainConfig;
}

export function getEssentialConfig(): any {
  return EssentialConfig;
}
