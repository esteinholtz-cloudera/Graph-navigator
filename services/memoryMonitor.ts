
export interface MemoryStatus {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  pressure: number; // 0 to 1
}

export const getMemoryStatus = (): MemoryStatus | null => {
  // performance.memory is a non-standard Chrome/Edge API but highly useful for dev tools/apps
  const mem = (performance as any).memory;
  if (!mem) return null;

  return {
    usedJSHeapSize: mem.usedJSHeapSize,
    totalJSHeapSize: mem.totalJSHeapSize,
    jsHeapSizeLimit: mem.jsHeapSizeLimit,
    pressure: mem.usedJSHeapSize / mem.jsHeapSizeLimit
  };
};

export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
