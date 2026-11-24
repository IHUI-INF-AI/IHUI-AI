// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时锁:小程序 store 持久化装配点的读写通道必须取自**端工厂单点**
 * `createTaroStorageTransport()`(守门 121 C7 那枚工厂的接线腿)。
 *
 * 为什么需要这把锁(2026-11-01):端内曾在装配点就地重抄一份
 * `createSyncTransport({ getItem: getStorageSync…, … })`,于是端工厂带着绿灯测试却零生产调用方
 * ——"造好没装车"。接线之后如果没有行为锁,谁把内联形态加回来都不会红。
 *
 * 判据形态(只观察,不复制守门判据,§22c):
 * 1. 两处装配点(invite / vip)模块加载时都向端工厂取 transport;
 * 2. 取工厂发生在第一次盘写**之前**(证"读写真走工厂",不是另造一条通道);
 * 3. 旧 key 的值经工厂落到新 key,且旧 key 被清(migrateLegacyStorageKey 的真实落盘效果)。
 *
 * 存储层是替身:Map 模拟 Taro.storage(含"key 不存在返回空串"的真实语义),不连任何真机/服务。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
// 静态 import 只为**预热模块图**(2026-11-03 flake 定位):`@ihui/shared` 桶文件的首次
// transform+加载实测 3.1s(本机单跑),它原本落在 M1 的用例窗口里 —— 动态 import 触发
// 的按需 transform 全记在 testTimeout 内,全量并行(worker 争 CPU)时逼近/越过 15s。
// 静态 import 在**文件收集期**完成同一段冷启动(不受 testTimeout 约束),用例内首次
// import 只剩 35ms;判据(取工厂先于盘写、旧 key 迁到新 key 并被清、变异对照无工厂调用)
// 一字未动,只是把冷启动移出被计时的窗口。M3 直接用它跑迁移,不再二次动态 import。
import { migrateLegacyStorageKey } from '@ihui/shared'
import type * as TaroStorageAdapter from '../src/stores/storage-adapter'

const { taroStorage, callLog } = vi.hoisted(() => ({
  /** 替身盘:旧 key 预置值 ⇒ 模块加载即触发一次真实迁移 */
  taroStorage: {
    ihui_invite_code: '{"code":"INV-legacy"}',
    ihui_vip_info: '{"level":3}',
  } as Record<string, string>,
  /** 装配点取工厂 / 盘写 的先后次序(按发生顺序追记) */
  callLog: [] as string[],
}))

vi.mock('@tarojs/taro', () => {
  const get = (key: string) => (key in taroStorage ? taroStorage[key] : '')
  const set = (key: string, value: string) => {
    callLog.push(`write:${key}`)
    taroStorage[key] = value
  }
  const remove = (key: string) => {
    delete taroStorage[key]
  }
  const taro = {
    getStorageSync: get,
    setStorageSync: set,
    removeStorageSync: remove,
    showToast: () => {},
    getEnv: () => 'weapp',
    ENV_TYPE: { WEAPP: 'weapp', WEB: 'web', ALIPAY: 'alipay' },
    request: () => ({ abort: () => {} }),
    navigateTo: () => Promise.resolve(),
    switchTab: () => Promise.resolve(),
    reLaunch: () => Promise.resolve(),
  }
  return { ...taro, default: taro }
})

// 端工厂包一层计数,不改其实现:判据要的是"装配点确实向它取通道",不是工厂自身行为
// (工厂行为由 src/stores/tests/storage-adapter.test.ts 钉)
vi.mock('../src/stores/storage-adapter', async (importOriginal) => {
  const mod = await importOriginal<typeof TaroStorageAdapter>()
  return {
    ...mod,
    createTaroStorageTransport: () => {
      callLog.push('factory')
      return mod.createTaroStorageTransport()
    },
  }
})

describe('小程序 store 持久化装配点 ⇒ 端工厂单点', () => {
  beforeEach(() => {
    callLog.length = 0
  })

  it('M1 invite 模块加载:先取端工厂,再落盘,旧 key 迁到新 key 并被清', async () => {
    await import('../src/stores/invite')

    expect(callLog[0]).toBe('factory')
    expect(taroStorage['ihui-invite-code']).toBe('{"code":"INV-legacy"}')
    expect('ihui_invite_code' in taroStorage).toBe(false)
  })

  it('M2 vip 模块加载:同一端工厂,不另造同步包装', async () => {
    await import('../src/stores/vip')

    expect(callLog[0]).toBe('factory')
    expect(taroStorage['ihui-vip-info']).toBe('{"level":3}')
    expect('ihui_vip_info' in taroStorage).toBe(false)
  })

  it('M3 变异对照(夹具，不碰生产面):端内重抄形态迁移照样成功 ⇒ 承重的是"取工厂"那条断言', async () => {
    const { createSyncTransport } = await import('@ihui/shared/stores')
    taroStorage['probe_legacy'] = '{"p":1}'
    const before = callLog.length

    // 这正是接线前的失效形态:装配点就地重抄一份 Taro 同步包装,绕开端工厂
    migrateLegacyStorageKey(
      createSyncTransport({
        getItem: (key) => (key in taroStorage ? (taroStorage[key] ?? null) : null),
        setItem: (key, value) => {
          taroStorage[key] = value
        },
        removeItem: (key) => {
          delete taroStorage[key]
        },
      }),
      'probe_legacy',
      'probe_new',
    )

    expect(taroStorage['probe_new']).toBe('{"p":1}') // 迁移成功了……
    expect(callLog.slice(before).includes('factory')).toBe(false) // ……但工厂一次都没被取用
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
