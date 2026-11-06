// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Avatar 跨端尺寸唯一表的接线契约(O81④ 第一例,2026-10-22 机主定档"取 web/RN 五档,小程序升一档")。
 *
 * 钉四组不变量,全都挡"不会让 typecheck 红"的失效:
 *  ① 数值表自证(AVATAR_PX / AVATAR_TEXT_PX / AVATAR_TAILWIND 同序同集,且类名换算等于 px);
 *  ② 各端留在自己文件里的类名表**换算回 px 后必须等于唯一表** —— 类名不能搬进 shared,
 *     因为 `apps/miniapp-taro/tailwind.config.ts` 的 content 只扫 `./src/**`,
 *     写进包里就进不了产物,头像会静默失去尺寸(所以只能这样对账,不能只 import);
 *  ③ 键集齐全:web 必须覆盖五档;小程序端若存在 Avatar 组件也必须覆盖五档,少一档 =
 *     该档调用点回退到 undefined 类名(小程序缺席时走 ②b 的具名豁免,不是静默跳过);
 *  ④ 变异自证:把在场端改回旧档(56)必须被本把尺子判红,否则锁是装饰。
 * 判据一律纯函数(readFileSync + 剥注释),两端组件不在本包被检程序里(§126 共享纯度)。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { AVATAR_PX, AVATAR_TEXT_PX, avatarSpecSelfCheck } from '../avatar-spec'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..', '..')

/** Tailwind 盒档 → 逻辑 px(spacing 步进 ×4)。 */
const STEP_PX: Record<string, number> = {
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '9': 36,
  '10': 40,
  '11': 44,
  '12': 48,
  '14': 56,
  '16': 64,
}
const TEXT_PX: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
}

/** 从源码里剥掉注释(块注释与行注释),避免把说明文字读成取用。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

/**
 * 取一张 `Record<...>` 常量表的条目 ⇒ { key: '类名串' }。
 * 只认形如 `xs: 'h-6 w-6 text-xs'` 的行,不猜别的写法。
 */
function classTable(src: string, varName: string): Record<string, string> {
  const body = new RegExp(`${varName}(?::[^=]*)?=\\s*\\{([\\s\\S]*?)\\n\\}`).exec(src)
  if (!body) throw new Error(`取不到表 ${varName}`)
  const out: Record<string, string> = {}
  for (const m of (body[1] ?? '').matchAll(/(\w+):\s*'([^']+)'/g))
    if (m[1] && m[2]) out[m[1]] = m[2]
  return out
}

/** 把一张类名表换算回 px;返回问题列表(空 = 与唯一表一致)。 */
function diffAgainstSpec(table: Record<string, string>, label: string): string[] {
  const bad: string[] = []
  for (const key of Object.keys(AVATAR_PX)) {
    const cls = table[key]
    if (!cls) {
      bad.push(`${label}.${key} 缺档`)
      continue
    }
    // 顺序无关:`h-8 w-8` 与 `w-8 h-8` 是同一档,只调顺序不该判红(判的是数值,不是字序)
    const h = /h-(\d+)/.exec(cls)?.[1]
    const w = /w-(\d+)/.exec(cls)?.[1]
    if (!h || !w) {
      bad.push(`${label}.${key} 读不出盒档:${cls}`)
      continue
    }
    const [hp, wp] = [STEP_PX[h], STEP_PX[w]]
    if (
      hp !== AVATAR_PX[key as keyof typeof AVATAR_PX] ||
      wp !== AVATAR_PX[key as keyof typeof AVATAR_PX]
    )
      bad.push(
        `${label}.${key} 盒 ${hp}/${wp} ≠ 唯一表 ${AVATAR_PX[key as keyof typeof AVATAR_PX]}`,
      )
    const font = /text-(xs|sm|base|lg|xl)/.exec(cls)
    if (!font) bad.push(`${label}.${key} 读不出一字号档:${cls}`)
    else if (TEXT_PX[`text-${font[1]}`] !== AVATAR_TEXT_PX[key as keyof typeof AVATAR_TEXT_PX])
      bad.push(
        `${label}.${key} 字号 ${TEXT_PX[`text-${font[1]}`]} ≠ 唯一表 ${AVATAR_TEXT_PX[key as keyof typeof AVATAR_TEXT_PX]}`,
      )
  }
  for (const key of Object.keys(table))
    if (!(key in AVATAR_PX)) bad.push(`${label} 多出未知档位 ${key}`)
  return bad
}

const WEB = 'apps/web/src/components/data/Avatar.tsx'
const TARO = 'apps/miniapp-taro/src/components/Avatar.tsx'

/**
 * 小程序端缺席豁免(BUG-0038):锁的目标文件已不存在，且 mini src 全量扫描没有任何
 * `@ihui/shared/ui/avatar-spec` 取用 ⇒ 该端确实没有可锁的 Avatar 组件。
 * 这不是 skip:②b 会同时断言「文件不存在 + 全 src 无 spec 取用」；任一条件失效，
 * ②b 立刻红，强制把该端接回锁，而不是让 readFileSync 抛 ENOENT。
 */
const TARO_ABSENT = !existsSync(resolve(REPO, TARO))
const TARO_ABSENCE_REASON =
  'apps/miniapp-taro/src/components/Avatar.tsx 不存在,且 mini src 全量扫描无 @ihui/shared/ui/avatar-spec 取用 ⇒ 该端没有可锁的 Avatar 组件,尺寸锁不适用。'

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p))
    else if (/\.(?:ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

/** 具名豁免:返回 false 时表示 Taro 端确实没有该组件,调用方不得再读 TARO。 */
function taroLockApplicable(): boolean {
  if (!TARO_ABSENT) return true
  expect(TARO_ABSENCE_REASON).toContain('不存在')
  expect(TARO_ABSENCE_REASON).toContain('@ihui/shared/ui/avatar-spec')
  return false
}

describe('Avatar 跨端唯一表接线', () => {
  it('① 数值表自证:三张表同序同集且类名换算等于 px', () => {
    expect(avatarSpecSelfCheck()).toEqual({ ok: true })
  })

  it('② web 与小程序各自留在可扫描文件里的类名表,换算回 px 等于唯一表', () => {
    const web = classTable(stripComments(readFileSync(resolve(REPO, WEB), 'utf8')), 'sizeMap')
    expect(diffAgainstSpec(web, 'web')).toEqual([])
    if (!taroLockApplicable()) return
    const taro = classTable(stripComments(readFileSync(resolve(REPO, TARO), 'utf8')), 'SIZES')
    expect(diffAgainstSpec(taro, 'taro')).toEqual([])
  })

  it('②b 小程序缺席豁免具名生效:文件不存在 + 全 src 无 spec 取用;任一失效即红', () => {
    if (!TARO_ABSENT) throw new Error(`Taro Avatar 已出现:${TARO};必须接回锁,不能继续用缺席豁免`)
    expect(TARO_ABSENCE_REASON).toContain('不存在')
    const offenders = sourceFiles(resolve(REPO, 'apps/miniapp-taro/src')).filter((p) =>
      readFileSync(p, 'utf8').includes('@ihui/shared/ui/avatar-spec'),
    )
    expect(offenders, 'Taro 端已出现 avatar-spec 消费点,缺席豁免失效').toEqual([])
  })

  it('③ 键集五档齐全(少一档会让该档调用点拿到 undefined 类名)', () => {
    const web = classTable(stripComments(readFileSync(resolve(REPO, WEB), 'utf8')), 'sizeMap')
    expect(Object.keys(web).sort()).toEqual(['lg', 'md', 'sm', 'xl', 'xs'])
    if (!taroLockApplicable()) return
    const taro = classTable(stripComments(readFileSync(resolve(REPO, TARO), 'utf8')), 'SIZES')
    expect(Object.keys(taro).sort()).toEqual(['lg', 'md', 'sm', 'xl', 'xs'])
  })

  it('③b 档位名取自共享类型,两端不再各写一份 union', () => {
    const check = (f: string) => {
      const src = stripComments(readFileSync(resolve(REPO, f), 'utf8'))
      expect(src).toMatch(/@ihui\/shared\/ui\/avatar-spec/)
      expect(src).not.toMatch(/^type AvatarSize =/m)
    }
    check(WEB)
    if (taroLockApplicable()) check(TARO)
  })

  it('④ 变异自证:把 xl 改回旧档 56 必须被同一把尺子判红', () => {
    // 小程序组件存在时测小程序;缺席豁免生效时改测仍在场的 web,避免这条变成空跑。
    const target = taroLockApplicable()
      ? { label: 'taro', file: TARO, table: 'SIZES' }
      : { label: 'web', file: WEB, table: 'sizeMap' }
    const src = stripComments(readFileSync(resolve(REPO, target.file), 'utf8'))
    const brokenSrc = src.replace(/xl: 'h-16 w-16 text-xl'/, "xl: 'w-14 h-14 text-lg'")
    expect(brokenSrc, `变异未命中 ${target.label} 的 xl 档`).not.toBe(src)
    const broken = classTable(brokenSrc, target.table)
    expect(diffAgainstSpec(broken, target.label).length).toBeGreaterThan(0)
    // 正向对照:原样必须零问题(否则上一条 ② 的红与这条不是同一件事)
    expect(diffAgainstSpec(classTable(src, target.table), target.label)).toEqual([])
  })

  it('⑤ 共享规格保持平台纯净(不得 import RN/Taro,§126)', () => {
    const spec = stripComments(readFileSync(resolve(HERE, '..', 'avatar-spec.ts'), 'utf8'))
    for (const banned of ['react-native', '@tarojs', 'node:']) expect(spec).not.toMatch(banned)
  })

  /**
   * 形状档(门 128 的 RD 维就比这个集合):两端都必须同时携带 circle/square 两档的字面类名,
   * 且档位名与 AVATAR_SHAPE_STEP 逐字对应。此前 web **收了 shape prop 却从不使用**,
   * 演示页的 `<Avatar shape="square">` 渲染成圆形 ⇒ 档集合少一档,报出来是"仅小程序档 8"。
   */
  it('⑥ 两端都携带两档形状类名,且与 AVATAR_SHAPE_STEP 逐字对应', async () => {
    const { AVATAR_SHAPE_STEP } = await import('../avatar-spec')
    expect(AVATAR_SHAPE_STEP).toEqual({ circle: 'md', square: 'lg' })
    const check = (f: string) => {
      const src = stripComments(readFileSync(resolve(REPO, f), 'utf8'))
      const steps = new Set([...src.matchAll(/rounded-(xs|sm|md|lg|xl|2xl)/g)].map((m) => m[1]))
      expect([...steps].sort()).toEqual(['lg', 'md'])
      for (const s of Object.values(AVATAR_SHAPE_STEP)) expect(steps.has(s)).toBe(true)
    }
    check(WEB)
    if (taroLockApplicable()) check(TARO)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
