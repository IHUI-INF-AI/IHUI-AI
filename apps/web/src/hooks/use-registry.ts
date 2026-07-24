'use client'

import { useState, useEffect, useCallback } from 'react'
import { registryApi } from '@/lib/api-registry'
import type {
  RegistryItem,
  RegistrySortKey,
  RegistrySourceType,
  RegistrySyncLog,
  RegistrySyncResponse,
  InstallRegistryItemResponse,
  UpgradeAllResponse,
  ConfigDriftDetectResponse,
  RegistryWorkerStats,
} from '@ihui/types'

export function useRegistryItems(sort: RegistrySortKey, sourceType?: RegistrySourceType) {
  const [items, setItems] = useState<RegistryItem[]>([])
  const [installedIds, setInstalledIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await registryApi.listItems({ sort, sourceType, page, pageSize: 24 })
      setItems(res.items)
      setInstalledIds(res.installedIds)
      setTotal(res.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [sort, sourceType, page])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { items, installedIds, loading, error, total, page, setPage, refresh }
}

export function useRegistrySyncLogs() {
  const [logs, setLogs] = useState<RegistrySyncLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await registryApi.listSyncLogs({ page: 1, pageSize: 20 })
      setLogs(res.logs)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  return { logs, loading, error, refresh }
}

export function useRegistrySync() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<RegistrySyncResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trigger = useCallback(
    async (body: { sourceType?: RegistrySourceType; source?: string; force?: boolean }) => {
      setSyncing(true)
      setError(null)
      try {
        const res = await registryApi.triggerSync(body)
        setResult(res)
        return res
      } catch (e) {
        setError(e instanceof Error ? e.message : '同步失败')
        return null
      } finally {
        setSyncing(false)
      }
    },
    [],
  )

  return { syncing, result, error, trigger }
}

export function useRegistryInstall() {
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const install = useCallback(
    async (body: {
      sourceType: RegistrySourceType
      sourceId: string
      version?: string
    }): Promise<InstallRegistryItemResponse | null> => {
      setInstalling(true)
      setError(null)
      try {
        return await registryApi.install(body)
      } catch (e) {
        setError(e instanceof Error ? e.message : '安装失败')
        return null
      } finally {
        setInstalling(false)
      }
    },
    [],
  )

  return { installing, error, install }
}

export function useRegistryUpgradeAll() {
  const [upgrading, setUpgrading] = useState(false)
  const [result, setResult] = useState<UpgradeAllResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const upgradeAll = useCallback(async (body: { sourceType?: RegistrySourceType }) => {
    setUpgrading(true)
    setError(null)
    try {
      const res = await registryApi.upgradeAll(body)
      setResult(res)
      return res
    } catch (e) {
      setError(e instanceof Error ? e.message : '升级失败')
      return null
    } finally {
      setUpgrading(false)
    }
  }, [])

  return { upgrading, result, error, upgradeAll }
}

export function useRegistryConfigDrift() {
  const [report, setReport] = useState<ConfigDriftDetectResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await registryApi.detectConfigDrift()
      setReport(res)
      return res
    } catch (e) {
      setError(e instanceof Error ? e.message : '检测失败')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { report, loading, error, detect }
}

export function useRegistryWorkerStats() {
  const [stats, setStats] = useState<RegistryWorkerStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await registryApi.getWorkerStats()
      setStats(res)
      return res
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { stats, loading, error, refresh }
}
