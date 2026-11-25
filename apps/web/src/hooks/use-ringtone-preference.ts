// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { setSoundNotificationEnabled } from '@ihui/shared/notifications/notification-store'
import {
  previewRingtone,
  readStoredRingtoneId,
  resolveRingtoneId,
  writeStoredRingtoneId,
  type RingtoneId,
} from '@ihui/shared/notifications/ringtone'

/** 后端偏好键:与 soundEnabled 同落 user_preferences(group=notifications),值为铃声 id 字符串 */
export const RINGTONE_PREF_KEY = 'ringtone'

/**
 * 从服务端拉取铃声偏好。服务端无值 / 接口失败返回 null(调用方保留本地缓存)。
 * 服务端值经 resolveRingtoneId 收敛:未知 / 非法 id 回落默认铃声,绝不留下"选了播不出"的状态。
 */
export async function loadRingtoneFromServer(): Promise<RingtoneId | null> {
  const res = await fetchApi<{ settings: Record<string, string> }>('/settings/notifications')
  if (!res.success || !res.data) return null
  const raw = res.data.settings?.[RINGTONE_PREF_KEY]
  return resolveRingtoneId(raw)
}

/** 把铃声 id 写回服务端;成功 true,失败 false(调用方回滚本地)。 */
export async function saveRingtoneToServer(id: RingtoneId): Promise<boolean> {
  const res = await fetchApi('/settings/notifications', {
    method: 'PUT',
    body: JSON.stringify({ [RINGTONE_PREF_KEY]: id }),
  })
  return res.success
}

/**
 * 登录后从服务端一次性校正本地偏好(声音开关 + 铃声)。
 *
 * 成功:以服务端为准写本地;失败:不覆盖本地已有值,返回 false。
 * - soundEnabled:`'0'` / `'false'` → 关闭;其余(`'1'` / `'true'` / 无该键)→ 开启。
 * - ringtone:`resolveRingtoneId` 收敛后写本地,未知 id 回落默认铃声。
 */
export async function syncPreferencesFromServer(): Promise<boolean> {
  const res = await fetchApi<{ settings: Record<string, string> }>('/settings/notifications')
  if (!res.success || !res.data) return false
  const settings = res.data.settings ?? {}
  const soundOn = settings.soundEnabled !== '0' && settings.soundEnabled !== 'false'
  setSoundNotificationEnabled(soundOn)
  writeStoredRingtoneId(resolveRingtoneId(settings[RINGTONE_PREF_KEY]))
  return true
}

/**
 * 登录态切为已登录后单次拉取服务端偏好校正本地;不轮询、不随每条通知请求。
 * 与设置页 `useRingtonePreference.refreshFromServer` 幂等:两边都以服务端为准写本地。
 * 挂在全局 Provider,保证没进过设置页的换设备用户也能跟随后端声音/铃声选择。
 */
export function usePreferenceSyncOnLogin(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const syncedRef = React.useRef(false)

  React.useEffect(() => {
    if (!isAuthenticated) return
    if (syncedRef.current) return
    syncedRef.current = true
    void syncPreferencesFromServer()
  }, [isAuthenticated])
}

export interface UseRingtonePreferenceReturn {
  ringtoneId: RingtoneId
  /** 选中并试听;本地乐观更新,PUT 失败回滚。返回是否保存成功。 */
  selectRingtone: (id: RingtoneId) => Promise<boolean>
  /** 仅试听(绕过去抖),不改选中项。 */
  preview: (id: RingtoneId) => void
  /** 登录后用服务端值校正本地缓存;失败保留本地。 */
  refreshFromServer: () => Promise<void>
}

/**
 * 铃声偏好读写 hook。本地缓存是即时落点,服务端是跨端同步真相源。
 * 挂载初值读本地;refreshFromServer 登录后以服务端为准回写本地。
 */
export function useRingtonePreference(): UseRingtonePreferenceReturn {
  const [ringtoneId, setRingtoneId] = React.useState<RingtoneId>(() => readStoredRingtoneId())

  const refreshFromServer = React.useCallback(async () => {
    const serverId = await loadRingtoneFromServer()
    if (serverId) {
      writeStoredRingtoneId(serverId)
      setRingtoneId(serverId)
    }
  }, [])

  const selectRingtone = React.useCallback(async (id: RingtoneId): Promise<boolean> => {
    const resolved = resolveRingtoneId(id)
    const previous = readStoredRingtoneId()
    // 乐观更新:本地先落、试听立即响;PUT 失败再回滚到旧值。
    writeStoredRingtoneId(resolved)
    setRingtoneId(resolved)
    previewRingtone(resolved)
    const ok = await saveRingtoneToServer(resolved)
    if (!ok) {
      writeStoredRingtoneId(previous)
      setRingtoneId(previous)
    }
    return ok
  }, [])

  const preview = React.useCallback((id: RingtoneId) => {
    previewRingtone(id)
  }, [])

  return { ringtoneId, selectRingtone, preview, refreshFromServer }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
