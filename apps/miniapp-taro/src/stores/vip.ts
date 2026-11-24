// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 修复说明(2026-07-26):Taro 4.2.0 Vite runner 会把 `import { create } from 'zustand'`
// 错误归并为 `taro.react_production_min.create`(React 上无此函数),运行时抛
// `TypeError: taro.react_production_min.create is not a function`。
// 改用 `zustand/vanilla` 的 `createStore` + createTaroZustandHook
// 绕过 Taro Vite 的归并逻辑,与 stores/invite.ts 的修复方案保持一致。
// 2026-07-28 P0-1: 复用 stores/helpers/create-taro-zustand-hook.ts,消除三处重复实现。
// 2026-07-28 P0-3: storage key 迁移 'ihui_vip_info'(下划线) → 'ihui-vip-info'(连字符),
//   与 @ihui/shared/constants VIP_STORAGE_KEY 对齐,保证切端状态一致。
// 2026-07-28 抽离:迁移逻辑改用 @ihui/shared migrateLegacyStorageKey 通用工具;
//   VIP 状态判断改用 @ihui/shared isVipActive + getVipStatusFromSnapshot,消除端内重复。
import { createStore } from 'zustand/vanilla'
import { getStorageSync, setStorageSync } from '@tarojs/taro'
import { getVipInfo } from '../api'
import { createTaroZustandHook } from './helpers/create-taro-zustand-hook'
import { VIP_STORAGE_KEY } from '@/constants/storage'
import { migrateLegacyStorageKey, isVipActive, getVipStatusFromSnapshot } from '@ihui/shared'
import { createTaroStorageTransport } from './storage-adapter'

// 历史遗留 key(下划线),仅用于一次性迁移到连字符 key
const LEGACY_VIP_STORAGE_KEY = 'ihui_vip_info'

// store 初始化前执行迁移(模块加载时一次性执行)
// transport 取端工厂单点(含"非 string 归一 null"契约),不在端内重抄一份 Taro 同步包装
migrateLegacyStorageKey(createTaroStorageTransport(), LEGACY_VIP_STORAGE_KEY, VIP_STORAGE_KEY)

interface VipState {
  isVip: boolean
  vipLevel: number
  vipExpireTime: string
  vipName: string
  privileges: string[]
  setVip: (info: Partial<VipState>) => void
  checkVipStatus: () => Promise<boolean>
  clearVip: () => void
}

function loadStoredVip(): Partial<VipState> {
  try {
    return getStorageSync(VIP_STORAGE_KEY) || {}
  } catch (e) {
    // 读失败降级默认值:读失败不等于盘上没有,但不阻断 store 初始化(对照 utils/auth.ts 读隔离范式)
    console.warn(
      `[vip] failed to read stored vip state; falling back to defaults: ${
        e instanceof Error ? e.message : 'unknown error'
      }`,
    )
    return {}
  }
}

/** 同步存储写入隔离:写失败仅告警、不抛出 ⇒ 绝不阻断内存状态落地 */
function persistVip(value: unknown): void {
  try {
    setStorageSync(VIP_STORAGE_KEY, value)
  } catch (e) {
    console.warn(
      `[vip] failed to persist vip state; in-memory state still applied: ${
        e instanceof Error ? e.message : 'unknown error'
      }`,
    )
  }
}

const vipStoreApi = createStore<VipState>((set) => ({
  isVip: false,
  vipLevel: 0,
  vipExpireTime: '',
  vipName: '',
  privileges: [],
  setVip: (info) => {
    const next = {
      isVip: info.isVip,
      vipLevel: info.vipLevel,
      vipExpireTime: info.vipExpireTime,
      vipName: info.vipName,
      privileges: info.privileges,
    }
    // 状态先落地:存储写满/抛异常也不该让会员态更新不了(persistVip 内部已隔离写失败)
    set(next)
    persistVip(next)
  },
  checkVipStatus: async () => {
    try {
      const info = await getVipInfo()
      if (!info) {
        // 无会员记录必须落空态,不能拿包络对象继续读字段。
        set({ isVip: false, vipLevel: 0, vipExpireTime: '', vipName: '', privileges: [] })
        persistVip(null)
        return false
      }
      const active = isVipActive(info.expireTime || '')
      const next = {
        isVip: active,
        vipLevel: info.level,
        vipExpireTime: info.expireTime || '',
        vipName: info.name,
        privileges: info.privileges || [],
      }
      set(next)
      persistVip(next)
      return active
    } catch {
      return false
    }
  },
  clearVip: () => {
    set({
      isVip: false,
      vipLevel: 0,
      vipExpireTime: '',
      vipName: '',
      privileges: [],
    })
    persistVip(null)
  },
}))

const useVipStore = createTaroZustandHook(vipStoreApi)

export { useVipStore }

export function getVipStatus(): { isVip: boolean; level: number; expireTime: string } {
  return getVipStatusFromSnapshot(loadStoredVip())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
