export async function getOSName() {
  const osName = (await import('os-name')).default;
  return osName();
}
