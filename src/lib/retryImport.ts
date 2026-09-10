export async function retryImport<T>(load: () => Promise<T>, key: string): Promise<T> {
  const marker = `dz-import-retry:${key}`;
  try {
    const module = await load();
    sessionStorage.removeItem(marker);
    return module;
  } catch (error) {
    if (!sessionStorage.getItem(marker)) {
      sessionStorage.setItem(marker, '1');
      window.location.reload();
      return new Promise<T>(() => undefined);
    }
    sessionStorage.removeItem(marker);
    throw error;
  }
}
