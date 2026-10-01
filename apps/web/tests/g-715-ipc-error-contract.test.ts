// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-715 桌面 IPC 错误身份契约(2026-09-30 立)。
 *
 * 钉四件事,每条都有正反成对(只留正向的那把尺子,判据可以整族空转而账面全绿):
 *
 * 1. **码真的到端**:宿主回 `{ code:'permission', message:'…' }` ⇒ 走真实的 `writeTextFile`
 *    出口,抛出来的错误 `code === 'permission'` 且 `codeSource === 'wire'`。
 *    (只测归一纯函数证不了"命令出口接了这层",所以这一条打的是 bridge 的公开函数。)
 * 2. **不得由文案定档**:纯字符串 `'permission denied: …'` ⇒ `code === 'internal'` +
 *    `codeSource === 'fallback'`。这是本票要消灭的形态的反向锁 —— 若有人把归一改成
 *    "按 message 正则猜档",这一条当场翻红。
 * 3. **按码分派是真分派**:`startResize` 只在 `permission`(宿主对窗口状态的有意拒绝)
 *    这一档静默,其余档必须喊出来。旧写法是"整块吞掉",故障与合理拒绝同形。
 * 4. **两侧同一份档名表**:TS 的 `IPC_ERROR_CODES` 与 Rust `IpcErrorCode` 的枚举变体、
 *    `as_str()` 字面量三者同形(serde 的 snake_case 规则在测试里显式实现一份)。
 *    任一处漂了,渲染层读到的就是一份永远匹配不上的码。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 工厂里只**引用** invokeMock(不在工厂执行时解引用),而 invoke 的真正调用发生在测试体之后,
// 所以顶层 const 就够 —— 与 apps/web/tests/desktop-prefs-bridge.test.ts 同一套形状。
const invokeMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'main' }),
}))

// bridge 顶部会引 plugin-dialog;本用例不碰对话框,挂个空壳免得在 happy-dom 里真去拿 IPC 通道。
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
  message: vi.fn(),
  ask: vi.fn(),
}))

import {
  DesktopIpcError,
  IPC_ERROR_CODES,
  dispatchByIpcCode,
  isIpcErrorCode,
  startResize,
  toDesktopIpcError,
  writeTextFile,
} from '@/lib/tauri-bridge'

// tests → web → apps → 仓根,三层(少写一层会 resolve 到 apps/apps ⇒ 采集期 ENOENT,整个套件 0 用例)
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const RUST_LIB = join(REPO_ROOT, 'apps', 'desktop', 'src-tauri', 'src', 'lib.rs')

/** 与 serde `rename_all = "snake_case"` 同规则的显式实现(只覆盖 UpperCamel 这一族)。 */
function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

/** 从 Rust 源里取 `IpcErrorCode` 的枚举变体名。取不到 ⇒ 由"空集不得读成通过"那条用例判失败。 */
function rustEnumVariants(src: string): string[] {
  const block = src.match(/pub enum IpcErrorCode\b[\s\S]*?\{([\s\S]*?)\n\}/)
  if (!block) return []
  return [...block[1].matchAll(/^\s{4}([A-Z][A-Za-z0-9]*),/gm)].map((m) => m[1])
}

/** 从 Rust 源里取 `as_str()` 的 `Self::X => "x"` 字面量映射。 */
function rustAsStrMap(src: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of src.matchAll(/Self::([A-Z][A-Za-z0-9]*)\s*=>\s*"([a-z0-9_]+)"/g)) {
    out.set(m[1], m[2])
  }
  return out
}

describe('G-715 桌面 IPC 错误契约', () => {
  /** console.warn 的落点(不用 spy.mock.calls 取值:类型绕,且拼平后更好比对档名)。 */
  let warned: string[]

  beforeEach(() => {
    invokeMock.mockReset()
    warned = []
    // isTauri() 读的是 window 上的注入标记;不设就全部走"非桌面端"分支,测不到分派。
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warned.push(args.map((a) => String(a)).join(' '))
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  })

  // ── 1. 归一:只看 code 字段 ──

  describe('toDesktopIpcError', () => {
    it('宿主给 permission 档 ⇒ code=permission / codeSource=wire', () => {
      const err = toDesktopIpcError({
        code: 'permission',
        message: '路径不在应用数据目录内(拒绝): C:/Windows/x',
      })
      expect(err).toBeInstanceOf(DesktopIpcError)
      expect(err.code).toBe('permission')
      expect(err.codeSource).toBe('wire')
      expect(err.message).toContain('拒绝')
    })

    it('四档逐个都能被认出(不是只认立项那一条)', () => {
      for (const code of IPC_ERROR_CODES) {
        const err = toDesktopIpcError({ code, message: `m-${code}` })
        expect(err.code).toBe(code)
        expect(err.codeSource).toBe('wire')
      }
    })

    it('反向锁:纯字符串里写着 permission denied 也不得判成 permission 档', () => {
      // 这一条是本票的立论:文案正则分派就是要被消灭的形态。
      const err = toDesktopIpcError('permission denied: access is refused')
      expect(err.code).toBe('internal')
      expect(err.codeSource).toBe('fallback')
      expect(err.message).toBe('permission denied: access is refused')
    })

    it('闭集外的档名(哪怕很像)⇒ fallback internal,不猜', () => {
      for (const bogus of ['Permission', 'PERMISSION', 'notfound', 'no_such_code', '']) {
        const err = toDesktopIpcError({ code: bogus, message: 'boom' })
        expect(err.code).toBe('internal')
        expect(err.codeSource).toBe('fallback')
      }
    })

    it('数组 / null / undefined / Error 实例都不炸,且一律 fallback', () => {
      const cases: unknown[] = [['a'], null, undefined, new Error('原始失败')]
      for (const raw of cases) {
        const err = toDesktopIpcError(raw)
        expect(err.code).toBe('internal')
        expect(err.codeSource).toBe('fallback')
      }
    })

    it('给了档却没给文案 ⇒ 不编造业务文案,回落到可诊断的占位', () => {
      const err = toDesktopIpcError({ code: 'network' })
      expect(err.code).toBe('network')
      expect(err.codeSource).toBe('wire')
      expect(err.message).toContain('network')
    })

    it('raw 保留原始 rejection 供排查,而 message 不是 [object Object]', () => {
      const payload = { code: 'not_found', message: '未找到 Google Chrome' }
      const err = toDesktopIpcError(payload)
      expect(err.raw).toBe(payload)
      expect(err.message).toBe('未找到 Google Chrome')
      expect(String(err)).not.toContain('[object Object]')
    })
  })

  describe('isIpcErrorCode', () => {
    it('闭集内为真、集外为假(大小写敏感,不做前缀放宽)', () => {
      expect(isIpcErrorCode('not_found')).toBe(true)
      expect(isIpcErrorCode('NOT_FOUND')).toBe(false)
      expect(isIpcErrorCode(42)).toBe(false)
    })
  })

  // ── 2. 按码分派 ──

  describe('dispatchByIpcCode', () => {
    it('permission 走 permission handler;文案像 permission 的 fallback 不得走进去', () => {
      const handlers = { permission: () => 'refused' }
      const wireErr = toDesktopIpcError({ code: 'permission', message: 'window is maximized' })
      expect(dispatchByIpcCode(wireErr, handlers)).toBe('refused')
      // 反向对照:同一段文案以纯字符串进来 ⇒ 没有档 ⇒ 不进 handler
      const legacy = toDesktopIpcError('permission refused because of x')
      expect(dispatchByIpcCode(legacy, handlers)).toBeUndefined()
    })

    it('没有对应 handler ⇒ undefined,不猜默认行为', () => {
      const err = toDesktopIpcError({ code: 'network', message: '端口没抢到' })
      expect(dispatchByIpcCode(err, { permission: () => 'p' })).toBeUndefined()
    })
  })

  // ── 3. 真实出口:命令失败 ⇒ 渲染层拿到的是码 ──

  describe('writeTextFile(真实 bridge 出口)', () => {
    it('宿主以 IpcError 拒绝 ⇒ 抛出 DesktopIpcError 且 code 来自 wire', async () => {
      invokeMock.mockRejectedValue({
        code: 'permission',
        message: 'write C:/Users/x/app_data/a.json: 拒绝访问。',
      })
      const caught = await writeTextFile('C:/x/a.json', 'hi').catch((e: unknown) => e)
      expect(caught).toBeInstanceOf(DesktopIpcError)
      const err = caught as DesktopIpcError
      expect(err.code).toBe('permission')
      expect(err.codeSource).toBe('wire')
    })

    it('尚未接入 IpcError 的命令回裸字符串 ⇒ internal + fallback(而不是按文案猜)', async () => {
      invokeMock.mockRejectedValue('some legacy failure mentioning permission denied')
      const caught = await writeTextFile('C:/x/a.json', 'hi').catch((e: unknown) => e)
      const err = caught as DesktopIpcError
      expect(err.code).toBe('internal')
      expect(err.codeSource).toBe('fallback')
      expect(err.message).toContain('permission denied')
    })
  })

  describe('startResize(按码分派的处置)', () => {
    it('permission(窗口最大化/全屏的宿主拒绝)⇒ 静默,这是文档化的行为', async () => {
      invokeMock.mockRejectedValue({ code: 'permission', message: 'window is maximized' })
      await startResize('e')
      expect(warned).toEqual([])
    })

    it('非 permission 档 ⇒ 必须喊出来,不得再整块吞掉', async () => {
      invokeMock.mockRejectedValue({ code: 'not_found', message: 'window main not found' })
      await startResize('e')
      expect(warned.length).toBeGreaterThan(0)
      expect(warned.join(' | ')).toContain('not_found')
    })
  })

  // ── 4. 两侧档名表同形(跨语言契约)──

  describe('Rust ↔ TS 档名对账', () => {
    const src = readFileSync(RUST_LIB, 'utf8')
    const variants = rustEnumVariants(src)
    const asStr = rustAsStrMap(src)
    const tsCodes: readonly string[] = IPC_ERROR_CODES

    it('Rust 侧确实解析出了枚举变体(空集不得被读成"通过")', () => {
      expect(variants.length).toBeGreaterThanOrEqual(4)
      expect(asStr.size).toBeGreaterThanOrEqual(4)
    })

    it('Rust 的 as_str 字面量集合 === TS 的 IPC_ERROR_CODES(双向,不多不少)', () => {
      expect([...asStr.values()].sort()).toEqual([...tsCodes].sort())
    })

    it('每个变体都有 as_str 分支(双向一一对应,缺一条多一条都算漂)', () => {
      expect([...asStr.keys()].sort()).toEqual([...variants].sort())
    })

    it('每个字面量 = snake_case(变体名) = TS 档位', () => {
      for (const [variant, wire] of asStr) {
        expect(wire).toBe(toSnakeCase(variant))
        expect(tsCodes).toContain(wire)
      }
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
