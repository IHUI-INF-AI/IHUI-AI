// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序 HostToastLayer:共享 host-toast 通道 → Taro.showToast 的真实落地。
 * 断言 error 走端内既有错误样式(icon:'none'),success 走标准图标,卸载后不再消费。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const taro = vi.hoisted(() => ({ showToast: vi.fn() }))
vi.mock('@tarojs/taro', () => ({ default: taro }))

import { showHostToast, HOST_TOAST_DEFAULT_DURATION_MS } from '@ihui/shared/utils/host-toast'
import { maskComments } from '../../../../../scripts/lib/code-mask.mjs' // arch-exempt: 与 tests/api-no-double-unwrap.test.ts:19 同形 —— 反臂必须与被审面共用同一份遮罩实现(§22c)
import { bindHostToastToTaro, showMiniHostToast } from '../HostToastLayer'

describe('小程序 host toast 落地', () => {
  beforeEach(() => {
    taro.showToast.mockClear()
    vi.stubGlobal('__DEV__', true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('kind=error 走端内错误样式(icon:none)', () => {
    showMiniHostToast('操作失败', 'error', 1200)
    expect(taro.showToast).toHaveBeenCalledWith({
      title: '操作失败',
      icon: 'none',
      duration: 1200,
    })
  })

  it('kind=success 走标准成功 toast(时长取共享通道单源,不再自带 2000)', () => {
    showMiniHostToast('已保存', 'success')
    expect(taro.showToast).toHaveBeenCalledWith({
      title: '已保存',
      icon: 'success',
      duration: HOST_TOAST_DEFAULT_DURATION_MS,
    })
  })

  /**
   * 成对臂(2026-11-05 立):默认时长必须**只有一个出处**。
   * 正向 = 屏侧 showHostToast 未给时长时,端内渲染拿到的数 == 通道常量;
   * 反臂 = 端内两处文件(端口层 / 本层)一旦再各自写死数字时长即翻红 ——
   * 那正是本次并掉的三份(端口 1500 / 本层 2000 / RN FloatBox 3000)的回潮通道。
   */
  it('屏侧未给时长 → 端内渲染时长 == 共享单源(与 RN 同一条屏同一个数)', () => {
    const unsubscribe = bindHostToastToTaro()
    showHostToast('加载失败', { kind: 'error' })
    expect(taro.showToast).toHaveBeenCalledWith({
      title: '加载失败',
      icon: 'none',
      duration: HOST_TOAST_DEFAULT_DURATION_MS,
    })
    unsubscribe()
  })

  it('反臂:端内端口层/渲染层都不得自带数字默认时长(改成各写一份即翻红)', () => {
    for (const rel of ['../on-toast.ts', '../HostToastLayer.tsx']) {
      // 判面遮注释(§0.4 同口径):本文件头注里写着「原先自带 DEFAULT_DURATION = 2000」这类
      // 历史叙述,不遮就会被读成第二份默认值 ⇒ 假红。
      const src = maskComments(readFileSync(join(__dirname, rel), 'utf8'))
      const numericDefaults = [...src.matchAll(/DEFAULT_DURATION[A-Z_]*\s*=\s*\d+/g)].map((m) => m[0])
      expect(numericDefaults, `${rel} 又立了第二份时长默认值`).toEqual([])
      // 兜底只能落在共享常量上,不得是 `?? 数字` 形态
      expect(/\?\?\s*\d{3,}/.test(src), `${rel} 用数字兜底了时长`).toBe(false)
    }
  })

  it('显式 duration 原样透传,不被单源常量覆盖', () => {
    const unsubscribe = bindHostToastToTaro()
    showHostToast('这条 2500ms', { kind: 'info', duration: 2500 })
    expect(taro.showToast).toHaveBeenCalledWith({
      title: '这条 2500ms',
      icon: 'none',
      duration: 2500,
    })
    unsubscribe()
  })

  it('host-toast 事件写入 → Taro.showToast(不再静默丢弃)', () => {
    const unsubscribe = bindHostToastToTaro()
    showHostToast('网络异常', { kind: 'error', duration: 1600 })

    expect(taro.showToast).toHaveBeenCalledTimes(1)
    expect(taro.showToast).toHaveBeenCalledWith({
      title: '网络异常',
      icon: 'none',
      duration: 1600,
    })
    unsubscribe()
  })

  it('卸载后不再消费通道事件', () => {
    vi.stubGlobal('__DEV__', false)
    const unsubscribe = bindHostToastToTaro()
    unsubscribe()
    showHostToast('不应出现')
    expect(taro.showToast).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
