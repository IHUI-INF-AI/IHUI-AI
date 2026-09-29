// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-414 ② 第二格 —— "偏好档位只写不读"的读侧行为。
//
// 阳性判据:写进去的值必须真能被读回来并影响一个可观察决定(循环起点);
// 回归判据:当场生效的档位永远优先于记忆(否则界面显示与后端授权分叉)。
// 票 G-937982 增补 —— localStorage 乐观首屏缓存纪律:信封化(savedAt)+ TTL 7d +
// 未来时间戳不采信 + 全字段校验失败回 null + default/解绑(环境态)不落盘。
import { beforeEach, describe, expect, it } from 'vitest'
import {
  PREFERRED_MODE_MEMORY_KEY,
  PREFERRED_MODE_MEMORY_TTL_MS,
  WIRED_PREFERRED_MODE_READ_USES,
  readPreferredPermissionMode,
  rememberPreferredPermissionMode,
  resolveCycleStartMode,
} from '@/lib/permission-mode-memory'

beforeEach(() => {
  window.localStorage.clear()
})

describe('写侧与读侧闭环(修前:全仓零 getItem)', () => {
  it('记住非默认档 ⇒ 能原样读回(落盘为 savedAt 信封)', () => {
    rememberPreferredPermissionMode('accept-edits')
    expect(readPreferredPermissionMode()).toBe('accept-edits')
    const raw = window.localStorage.getItem(PREFERRED_MODE_MEMORY_KEY)
    expect(raw).not.toBeNull()
    const envelope = JSON.parse(raw!) as { savedAt: number; mode: string }
    expect(envelope.mode).toBe('accept-edits')
    expect(typeof envelope.savedAt).toBe('number')
  })

  it('camelCase 拼写归一后再落盘(存储里不留第二套拼写)', () => {
    rememberPreferredPermissionMode('acceptEdits')
    expect(readPreferredPermissionMode()).toBe('accept-edits')
    const envelope = JSON.parse(
      window.localStorage.getItem(PREFERRED_MODE_MEMORY_KEY)!,
    ) as { mode: string }
    expect(envelope.mode).toBe('accept-edits')
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
  })

  it('信封化之前的旧格式(裸 wire 字符串)无时间戳 ⇒ 新鲜度不可判,按漂移回 null', () => {
    window.localStorage.setItem(PREFERRED_MODE_MEMORY_KEY, 'bypassPermissions')
    expect(readPreferredPermissionMode()).toBeNull()
  })

  it('待拍板那一格仍未接线(翻它的人必须同时改这里,而不是悄悄改行为)', () => {
    expect(WIRED_PREFERRED_MODE_READ_USES).toEqual(['cycle-start'])
  })
})

describe('localStorage 乐观首屏缓存边界(G-937982)', () => {
  it('缓存命中 ⇒ 首屏初值即记忆档(读回非 null)', () => {
    rememberPreferredPermissionMode('plan')
    expect(readPreferredPermissionMode()).toBe('plan')
  })

  it('超期(> TTL 7d)⇒ 回 null(宁可回 default 起点也不用过时档位)', () => {
    const now = Date.now()
    rememberPreferredPermissionMode('accept-edits', now - PREFERRED_MODE_MEMORY_TTL_MS - 1)
    expect(readPreferredPermissionMode(now)).toBeNull()
  })

  it('TTL 边界内(= TTL)⇒ 仍采信', () => {
    const now = Date.now()
    rememberPreferredPermissionMode('accept-edits', now - PREFERRED_MODE_MEMORY_TTL_MS)
    expect(readPreferredPermissionMode(now)).toBe('accept-edits')
  })

  it('savedAt 在未来(时钟回拨/被篡改)⇒ 不采信回 null', () => {
    const now = Date.now()
    rememberPreferredPermissionMode('accept-edits', now + 60_000)
    expect(readPreferredPermissionMode(now)).toBeNull()
  })

  it('信封字段漂移 ⇒ 全部回 null(不喂半成品给读侧)', () => {
    const drifts: unknown[] = [
      JSON.stringify({ mode: 'accept-edits' }), // 缺 savedAt
      JSON.stringify({ savedAt: Date.now() }), // 缺 mode
      JSON.stringify({ savedAt: 'not-a-number', mode: 'accept-edits' }), // savedAt 类型漂移
      JSON.stringify({ savedAt: Date.now(), mode: 42 }), // mode 类型漂移
      JSON.stringify(['accept-edits']), // 数组
      '42', // JSON 标量
    ]
    for (const drift of drifts) {
      window.localStorage.setItem(PREFERRED_MODE_MEMORY_KEY, drift as string)
      expect(readPreferredPermissionMode()).toBeNull()
    }
  })

  it('信封内档位拼写认不出 ⇒ 回 null(全字段校验含 wire 归一)', () => {
    window.localStorage.setItem(
      PREFERRED_MODE_MEMORY_KEY,
      JSON.stringify({ savedAt: Date.now(), mode: 'yolo-all-the-way' }),
    )
    expect(readPreferredPermissionMode()).toBeNull()
  })

  it('环境态不写入:已有有效记忆时 remember(default) 走 remove 而不是覆写 default', () => {
    rememberPreferredPermissionMode('accept-edits')
    rememberPreferredPermissionMode('default')
    expect(window.localStorage.getItem(PREFERRED_MODE_MEMORY_KEY)).toBeNull()
    expect(readPreferredPermissionMode()).toBeNull()
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
