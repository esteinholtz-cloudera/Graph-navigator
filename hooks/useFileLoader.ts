import { useState, useCallback } from 'react';

export interface FileLoadState {
  isLoading: boolean;
  error: string | null;
}

export const useFileLoader = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFromServer = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      const fileName = path.split('/').pop() || 'file';
      const extension = fileName.split('.').pop()?.toLowerCase();
      
      const format = (extension === 'json' || extension === 'jsonld') ? 'json' : 'rdf';
      
      setError(null);
      return { content, fileName, format: format as 'rdf' | 'json' };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error loading file';
      setError(errorMsg);
      console.error('Error loading file from URL:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFromFile = useCallback((file: File): Promise<{ content: string; fileName: string; format: 'rdf' | 'json' }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          const format = (extension === 'json' || extension === 'jsonld') ? 'json' : 'rdf';
          resolve({ content, fileName: file.name, format: format as 'rdf' | 'json' });
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsText(file);
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    loadFromServer,
    loadFromFile,
    clearError
  };
};
