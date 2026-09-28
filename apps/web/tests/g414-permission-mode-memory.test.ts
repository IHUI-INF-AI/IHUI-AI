// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-414 ② 第二格 —— "偏好档位只写不读"的读侧行为。
//
// 阳性判据:写进去的值必须真能被读回来并影响一个可观察决定(循环起点);
// 回归判据:当场生效的档位永远优先于记忆(否则界面显示与后端授权分叉)。
import { beforeEach, describe, expect, it } from 'vitest'
import {
  PREFERRED_MODE_MEMORY_KEY,
  WIRED_PREFERRED_MODE_READ_USES,
  readPreferredPermissionMode,
  rememberPreferredPermissionMode,
  resolveCycleStartMode,
} from '@/lib/permission-mode-memory'

beforeEach(() => {
  window.localStorage.clear()
})

describe('写侧与读侧闭环(修前:全仓零 getItem)', () => {
  it('记住非默认档 ⇒ 能原样读回', () => {
    rememberPreferredPermissionMode('accept-edits')
    expect(readPreferredPermissionMode()).toBe('accept-edits')
    expect(window.localStorage.getItem(PREFERRED_MODE_MEMORY_KEY)).toBe('accept-edits')
  })

  it('camelCase 拼写归一后再落盘(存储里不留第二套拼写)', () => {
    rememberPreferredPermissionMode('acceptEdits')
    expect(readPreferredPermissionMode()).toBe('accept-edits')
  })

  it('default 不落盘:兑现注释里那句"仅记忆非默认模式"', () => {
    rememberPreferredPermissionMode('accept-edits')
    rememberPreferredPermissionMode('default')
    expect(window.localStorage.getItem(PREFERRED_MODE_MEMORY_KEY)).toBeNull()
    expect(readPreferredPermissionMode()).toBeNull()
  })

  it('解除绑定(null/undefined)清掉记忆,而不是留着过时档位', () => {
    rememberPreferredPermissionMode('bypass-permissions')
    rememberPreferredPermissionMode(null)
    expect(readPreferredPermissionMode()).toBeNull()
  })

  it('存储里躺着垃圾值 ⇒ 读回 null(不猜档、不兜成某个具体档)', () => {
    window.localStorage.setItem(PREFERRED_MODE_MEMORY_KEY, 'yolo-all-the-way')
    expect(readPreferredPermissionMode()).toBeNull()
    window.localStorage.setItem(PREFERRED_MODE_MEMORY_KEY, 'bypassPermissions') // 另一种合法拼写
    expect(readPreferredPermissionMode()).toBe('bypass-permissions')
  })

  it('待拍板那一格仍未接线(翻它的人必须同时改这里,而不是悄悄改行为)', () => {
    expect(WIRED_PREFERRED_MODE_READ_USES).toEqual(['cycle-start'])
  })
})

describe('resolveCycleStartMode:唯一被接线的读侧', () => {
  it('当场有生效档位 ⇒ 记忆不得覆盖它', () => {
    expect(resolveCycleStartMode('plan', 'bypass-permissions')).toBe('plan')
  })

  it('当场没有档位(未绑定工作区)⇒ 以记忆为循环起点', () => {
    expect(resolveCycleStartMode(undefined, 'accept-edits')).toBe('accept-edits')
    expect(resolveCycleStartMode(null, 'accept-edits')).toBe('accept-edits')
  })

  it('两者都没有 ⇒ 落 default', () => {
    expect(resolveCycleStartMode(undefined, null)).toBe('default')
  })

  it('记忆来自存储时同样走这一条(端到端:remember → 循环起点)', () => {
    rememberPreferredPermissionMode('plan')
    expect(resolveCycleStartMode(undefined)).toBe('plan')
    expect(resolveCycleStartMode('default')).toBe('default')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
