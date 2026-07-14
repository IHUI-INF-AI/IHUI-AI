import { createJSONStorage, type PersistStorage } from 'zustand/middleware'

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const ssrStorage = createJSONStorage(() =>
  typeof window !== 'undefined' ? window.localStorage : noopStorage,
)

export function createPersistConfig<T>(name: string, partialize?: (state: T) => Partial<T>) {
  return {
    name,
    storage: ssrStorage as PersistStorage<Partial<T>>,
    ...(partialize ? { partialize } : {}),
  }
}
