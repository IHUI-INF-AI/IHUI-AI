// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 设备指纹采集器的采集形状回归。
 *
 * 这枚文件钉的不是"hash 长什么样"(摘要实现的真伪由 apps/api/tests/legacy-device-fingerprint.test.ts
 * 用生产实现证),而是**采集器到底喂了几个字段** —— v1 只喂 `platform`,于是全网 iOS 塌成同一个值,
 * 而该值是 user_devices 的唯一键、被支付/审计/异常检测当设备标识用。替身此前把 `source` 写死成 `{}`,
 * 所以这件事在端内测试面上根本不可见;本次把替身改成回显输入,才谈得上有证据。
 *
 * 五条断言各有分工:
 *  1. 交出的输入**多于一个字段**(platform 之外至少有 screen / language / timezone 之一)——
 *     反向对照:把采集器退回"只喂 platform"时这条必红。
 *  2. 在共享替身环境下**不抛**(Platform 没有 constants / Version 时仍要能出串)。
 *  3. 缺字段就**不填**该段,不得把 undefined 拼成字符串 —— 拼进去会让"取不到"与"取到 undefined"
 *     同形,而后者才是把设备画像写歪的那一种。
 *  4. iOS 拿到 `expo-device` 的 `modelId` ⇒ 机型进 `platform` 段(`ios-iPhone16,2-18.1`)——
 *     反向对照:iOS 那一支退回旧写法(不取机型、只出 `ios-<version>`)时这条必红。
 *  5. iOS 拿不到 `modelId`(模拟器 / 原生未就绪 / 空串)⇒ 退回今天的 `${Platform.OS}-${version}`,
 *     且不得出现 `ios-undefined-18.1` 那一形(它是第 3 条在 iOS 支上的具体化)。
 *
 * iOS 那一支在 jsdom 下没法靠真机驱动,靠的是**改共享替身的 `Platform`** + 替身自己的
 * `__setModelId`(与 setup.ts 取 `resetAsyncStorageMock` 同一口径:相对路径引到别名指向的同一模块实例)。
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Platform } from 'react-native'
import { mobileRnDeviceFingerprintCollector } from '../src/lib/device-fingerprint'
import { __setModelId } from './__mocks__/expo-device'

/** 共享替身的 Platform 只有 `OS:'web'`;iOS 支要的是可写的 OS 与 RN 真机同形的 Version(字符串)。 */
type MutablePlatform = { OS: string; Version?: string | number }
const platform = Platform as unknown as MutablePlatform

describe('mobileRnDeviceFingerprintCollector 采集形状', () => {
  it('除 platform 之外至少再交出一段(退化指纹的反命题)', async () => {
    const { source } = await mobileRnDeviceFingerprintCollector.get()
    const keys = Object.keys(source).filter((k) => source[k as keyof typeof source] !== undefined)
    expect(keys.length).toBeGreaterThan(1)
    expect(keys).toContain('platform')
    expect(keys).toContain('screen')
  })

  it('替身环境下不抛,且 platform 段拿不到机型时退回 Platform.OS', async () => {
    const { source } = await mobileRnDeviceFingerprintCollector.get()
    expect(typeof source.platform).toBe('string')
    expect(source.platform && source.platform.length > 0).toBe(true)
    // 共享替身的 Platform 只有 OS:'web',既没有 constants 也没有 Version ⇒ 不得出现 "undefined" 字样
    expect(source.platform).not.toContain('undefined')
  })

  it('取不到的段一律缺席,不得写成字符串 "undefined"', async () => {
    const { source } = await mobileRnDeviceFingerprintCollector.get()
    for (const [k, v] of Object.entries(source)) {
      expect(v, `字段 ${k} 不得是 undefined/空串`).not.toBeUndefined()
      if (typeof v === 'string') expect(v.trim().length, `字段 ${k} 不得为空串`).toBeGreaterThan(0)
    }
  })
})

describe('mobileRnDeviceFingerprintCollector iOS 机型段', () => {
  afterEach(() => {
    platform.OS = 'web'
    delete platform.Version
    __setModelId(null)
  })

  it('拿到 modelId ⇒ 机型进 platform 段(取厂商机型标识,不是用户可改的设备名)', async () => {
    platform.OS = 'ios'
    platform.Version = '18.1'
    __setModelId('iPhone16,2')
    const { source } = await mobileRnDeviceFingerprintCollector.get()
    expect(source.platform).toBe('ios-iPhone16,2-18.1')
  })

  it('拿不到 modelId ⇒ 退回 ios-<version>,不得出现 ios-undefined-<version>', async () => {
    platform.OS = 'ios'
    platform.Version = '18.1'
    __setModelId(null)
    const { source } = await mobileRnDeviceFingerprintCollector.get()
    expect(source.platform).toBe('ios-18.1')
    expect(source.platform).not.toContain('undefined')
    // 原生回了空串同样算"取不到"(它不是机型,拼进去就是一枚带空洞的指纹)
    __setModelId('   ')
    const blank = await mobileRnDeviceFingerprintCollector.get()
    expect(blank.source.platform).toBe('ios-18.1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
