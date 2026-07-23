import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ihui-model-id'

/** 读取 localStorage 中的模型 id,无则返回 fallback。 */
export function readPersistedModel(fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved && saved.trim() ? saved : fallback
}

/** 写入模型 id 到 localStorage。 */
export function persistModel(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, id)
}

/**
 * 模型选择 + localStorage 持久化 hook。
 * 初始化时读 localStorage,变化时写回。
 */
export function useModelPersist(initial: string) {
  const [model, setModelState] = useState<string>(() => readPersistedModel(initial))

  useEffect(() => {
    persistModel(model)
  }, [model])

  return [model, setModelState] as const
}
