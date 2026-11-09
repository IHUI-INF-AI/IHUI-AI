// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * XUI-046 接线锁(RN 直播推流结束)。
 * 旧实现:卸载/切后台不结束推流,服务端流一直挂着;观众数还用随机数臆造。
 * 本夹具钉三件事:AppState 订阅 + 卸载 teardown 会发 status:'inactive';源码不再有 Math.random。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(__dirname, '..', 'LiveHostScreen.tsx'), 'utf8')

/** 接线判据:正反两面对同一实现 */
export function detectLiveTeardown(src: string): string[] {
  const missing: string[] = []
  if (!src.includes("import { useCallback, useEffect, useMemo, useRef, useState } from 'react'")) {
    missing.push('useRef/useCallback imported')
  }
  if (!src.includes("import { AppState } from 'react-native'")) missing.push('AppState imported')
  if (!src.includes('const teardownLive = useCallback(')) missing.push('teardownLive')
  if (!src.includes("AppState.addEventListener('change'")) missing.push('AppState listener')
  if (!src.includes("updateSrsStream(current.id, { status: 'inactive' })")) {
    missing.push('teardown calls updateSrsStream inactive')
  }
  if (!src.includes('sub.remove()')) missing.push('listener removed on unmount')
  if (src.includes('Math.random()')) missing.push('fabricated viewer count')
  return missing
}

describe('XUI-046 直播结束/观众数', () => {
  it('正向:切后台与卸载都会结束推流,且不再用随机数造人数', () => {
    expect(detectLiveTeardown(SRC)).toEqual([])
  })

  it('反向对照:旧实现(无 AppState、有 Math.random)必须判红', () => {
    const oldImpl = `
import { useEffect, useMemo, useState } from 'react'
import { } from 'react-native'
setViewers((v) => v + Math.floor(Math.random() * 5))
setViewers(Math.floor(Math.random() * 20) + 5)
`
    expect(detectLiveTeardown(oldImpl)).toEqual([
      'useRef/useCallback imported',
      'AppState imported',
      'teardownLive',
      'AppState listener',
      'teardown calls updateSrsStream inactive',
      'listener removed on unmount',
      'fabricated viewer count',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
