// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PermissionShortcutsModal(? 唤起的权限模式专属帮助)静态断言
 *
 * 为什么用静态源码断言而不是渲染:
 * - 该组件外壳是 @ihui/ui-react 的 Radix Dialog(portal + 焦点管理),jsdom/happy-dom 下
 *   需要 mock Dialog 全家桶才能渲染,一旦渲染失败测试就与"权限族是否被误删"无关地变红;
 * - 本文件要守的是"内容边界"(不再重复全局面板的对话模式切换 / 不再硬编码中文 / 交叉指引到位),
 *   这类判据对源码字符串最敏感、对运行时 DOM 最不敏感,静态断言更稳也更快。
 * - 所有"应当没有"的断言都配了正向对照(positive control):同一判据先在测试内构造的
 *   哨兵字符串上断言"必须命中",防止因正则失配 / 文件读空导致的假绿。
 *
 * 覆盖:
 * 1. MODE_SWITCH_ROWS / ModeSwitchRow 与仅其使用的 lucide 图标已删除
 * 2. 硬编码中文界面文案('切换到…')不再出现在组件里
 * 3. 底部交叉指引行存在(shortcutsSeeAllKbd + <kbd>Ctrl+/</kbd> + data-testid)
 * 4. 权限族键位与分组(shortcutsSectionSwitch / shortcutsItemShiftTabKbd / SquareSlash)未被误删
 * 5. 五份 web 语言包 chat.permission.shortcutsSeeAllKbd 对称存在、译文纯度正确、
 *    键位不写进译文(避免 5 语言键位漂移)
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
type Locale = (typeof LOCALES)[number]

/**
 * 仓库根定位:向上走找 language pack 目录。
 * 不用 import.meta.url —— web 包 vitest 默认 environment 是 happy-dom,
 * 该环境下 Vite 会把 import.meta.url 改写成非 file: 形式,fileURLToPath 直接抛错。
 */
function findRepoRoot(): string {
  let dir = process.cwd()
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(dir, 'packages/i18n/messages/web/zh-CN.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return process.cwd()
}

const REPO_ROOT = findRepoRoot()
const COMPONENT = join(REPO_ROOT, 'apps/web/src/components/ai/permission-shortcuts-modal.tsx')

/** CJK 汉字区段(ko 译文必须纯 Hangul、zh-TW 必须繁体) */
const HAN = /[一-鿿]/

function readLocale(locale: Locale): string {
  return readFileSync(join(REPO_ROOT, `packages/i18n/messages/web/${locale}.json`), 'utf8')
}

/** 取 chat.permission.shortcutsSeeAllKbd 的值(缺失/非字符串 → 空串,由断言判失败) */
function seeAllValue(locale: Locale): string {
  const parsed = JSON.parse(readLocale(locale)) as {
    chat?: { permission?: Record<string, unknown> }
  }
  const value = parsed.chat?.permission?.shortcutsSeeAllKbd
  return typeof value === 'string' ? value : ''
}

describe('PermissionShortcutsModal — 收敛为权限模式专属帮助', () => {
  const source = readFileSync(COMPONENT, 'utf8')

  it('源码确实被读到(非空且含组件签名)', () => {
    expect(source.length).toBeGreaterThan(3000)
    expect(source).toContain('export function PermissionShortcutsModal')
  })

  it('① 不再重复全局面板的对话模式切换行', () => {
    // 正向对照:先证明这些判据本身能命中(否则下面的 not.* 是假绿)
    for (const chord of ['1', '2', '3', '4']) {
      expect(new RegExp(`Ctrl\\+${chord}`).test(`Ctrl+${chord}`)).toBe(true)
    }
    expect(/MODE_SWITCH_ROWS/.test('const MODE_SWITCH_ROWS: ModeSwitchRow[] = []')).toBe(true)
    expect(/\bLayers\b/.test("import { Layers } from 'lucide-react'")).toBe(true)

    for (const chord of ['Ctrl+1', 'Ctrl+2', 'Ctrl+3', 'Ctrl+4']) {
      expect(source).not.toContain(chord)
    }
    expect(source).not.toMatch(/MODE_SWITCH_ROWS/)
    expect(source).not.toMatch(/ModeSwitchRow/)
    // 仅被该分组使用的 lucide 图标一并清理(Keyboard / SquareSlash 等保留,见 ④)
    for (const icon of ['Hammer', 'BookOpen', 'Search', 'FileText', 'Layers']) {
      expect(source).not.toContain(icon)
    }
  })

  it('② 不再有硬编码中文界面文案', () => {
    expect(/desc:\s*'切换到/.test("{ key: 'Ctrl+1', desc: '切换到构建模式' }")).toBe(true)
    expect(source).not.toMatch(/desc:\s*'切换到/)
    expect(source).not.toContain('切换到构建模式')
    expect(source).not.toContain('<span>对话模式切换</span>')
    // 行表的"键位标签"位同样不得写中文(曾是 key: '查看历史',en/ja/ko 下直接漏中文)。
    // 先证明这条正则会命中哨兵,再断言源码里没有 —— 防"正则失配型假绿"。
    const CJK_KEY_ROW = /key:\s*'[^']*[\u4e00-\u9fff]/
    expect(CJK_KEY_ROW.test("{ key: '查看历史', descKey: 'x' }")).toBe(true)
    expect(source).not.toMatch(CJK_KEY_ROW)
    expect(source).toContain("labelKey: 'historyOpenExternal'")
  })

  it('③ 底部交叉指引行存在且走 i18n', () => {
    expect(source).toContain("t('shortcutsSeeAllKbd')")
    expect(source).toContain('data-testid="permission-shortcuts-see-all"')
    expect(source).toContain('Ctrl+/')
    // 交叉指引必须排在分组渲染之后、关闭按钮之前
    expect(source.indexOf('permission-shortcuts-see-all')).toBeGreaterThan(
      source.indexOf('SHORTCUT_GROUPS.map'),
    )
    expect(source.indexOf('permission-shortcuts-see-all')).toBeLessThan(
      source.indexOf('data-testid="permission-shortcuts-close"'),
    )
    // 约束边界:无原生提示、无胶囊圆角
    expect(source).not.toMatch(/\btitle=/)
    expect(source).not.toContain('rounded-full')
  })

  it('④ 权限族分组与键位未被误删(反向哨兵)', () => {
    expect(source).toContain('SHORTCUT_GROUPS')
    expect(source).toContain('shortcutsSectionSwitch')
    expect(source).toContain('shortcutsSectionGuard')
    expect(source).toContain('shortcutsSectionAudit')
    expect(source).toContain('shortcutsItemShiftTabKbd')
    expect(source).toContain('shortcutsItemNumberKbd')
    expect(source).toContain('shortcutsItemSlashAskKbd')
    expect(source).toContain('shortcutsItemQuestionMarkKbd')
    expect(source).toContain('shortcutsItemUndoKbd')
    expect(source).toContain('shortcutsItemHistoryKbd')
    // /permission 行仍在用 SquareSlash,不得随 MODE_SWITCH_ROWS 一起删
    expect(source).toContain('SquareSlash')
    for (const kept of ['Keyboard', 'ShieldAlert', 'ShieldCheck', 'History', 'Hand', 'Undo2']) {
      expect(source).toContain(kept)
    }
  })

  it('⑤ 五份 web 语言包对称且键位不入译文', () => {
    for (const locale of LOCALES) {
      expect(readLocale(locale)).toContain('"shortcutsSeeAllKbd":')
      const value = seeAllValue(locale)
      expect(value.length).toBeGreaterThan(0)
      // 键位由组件里的 <kbd> 呈现,译文不得内嵌 Ctrl(否则 5 语言键位漂移)
      expect(value).not.toMatch(/Ctrl/i)
    }
    expect(seeAllValue('zh-CN')).toBe('查看全部快捷键')
    expect(seeAllValue('zh-TW')).toBe('檢視所有快速鍵')
    expect(seeAllValue('en')).toBe('View all keyboard shortcuts')
    expect(seeAllValue('ja')).toContain('ショートカット')
    expect(seeAllValue('ko')).toBe('모든 키보드 단축보기')
    // ko 纯 Hangul(不含汉字)/ zh-TW 繁体字形(不得回退简体"快捷键")
    expect(HAN.test('모드 전환')).toBe(false)
    expect(HAN.test('模式切換')).toBe(true)
    expect(seeAllValue('ko')).not.toMatch(HAN)
    expect(seeAllValue('zh-TW')).not.toContain('快捷键')
    expect(seeAllValue('zh-TW')).toContain('檢視')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
