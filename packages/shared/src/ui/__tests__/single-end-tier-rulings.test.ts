// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 单侧档裁定账的机读锁(O02 票④ 第 ④ 格,2026-10-28 b24-o02 席)。
 *
 * 背景:门 128(`scripts/check-cross-end-ui-parity.mjs`)的 SL 维只说得出一件事 ——
 * "这张具名档只被一条腿引用"。它**说不出**那一端是"另一端根本没有这个元素/这个形态",
 * 还是"两端本该同值却各写一份"。前者是平台结构差异(登记即可),后者是本票要拆的债(必须收敛)。
 * 这层判词此前只活在各 spec 的头注散文里,机器读不到 ⇒ 下一个人只能重新读一遍 1400 行注释。
 *
 * 本文件消费的是台账里那一份**机读裁定** `waivers.<族>.singleEndTiers`(每项
 * {tier, side, kind, element, reason, until}),四件事都钉死:
 *  ① **形状**:side / kind 取自封闭集,reason 必须够长可复核,until 是 ISO 日期且不得晚于族级豁免
 *     —— 裁定与它所属的那条豁免同生共死,不会各自漂。
 *  ② **档名仍在**:每一枚裁定的档必须仍从该族 spec 导出(档被删/改名 ⇒ 红,防止清单腐烂成散文)。
 *  ③ **两端真单侧**:owner 腿必须真引用该档,另一条腿必须**不**引用 ——
 *     谁为了把 diffCount 调小而给另一端补一条引用(凑平),或把 owner 端的取数点删了(元素被吞),
 *     这里就红。判据是源码级 readFileSync + 剥注释,与各 *-wiring 测试同口径,不复制门 128 的算法。
 *  ④ **覆盖面对着 spec 导出面现算**:某族 spec 里"恰好只有一条腿引用"的导出档集合,
 *     必须与登记集合**逐枚相等** —— 新出现一枚未登记的单侧导出档时红(要么收敛、要么登记裁定),
 *     登记了却已不再单侧时也红(清单腐烂)。这条把"漏登记"变成红灯,而不是靠人记得同步。
 *
 * 为什么**不**在这里跑门 128:门是判据本体(单一真相源),测试再跑一遍它等于两把尺子;
 * 而且门对 4000+ 文件跑一遍是分钟级。本文件只回答"这份裁定账本身有没有烂"。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const LEDGER_REL = 'scripts/cross-end-ui-parity-baseline.json'

/** 仓库根按 `pnpm-workspace.yaml` 往上找(定长相对层数一旦搬家就静默指向别处)。 */
function repoRoot(): string {
  let dir = fileURLToPath(new URL('.', import.meta.url))
  for (let up = 0; up < 12; up += 1) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')
      return dir
    } catch {
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  }
  throw new Error('找不到仓库根(pnpm-workspace.yaml)⇒ 单侧档裁定账无从取材')
}

const ROOT = repoRoot()

/** 逐族:台账键 / spec 文件 / 两端配对腿(与门 128 在册配对的两条腿同一批文件)。 */
const FAMILIES = [
  {
    name: 'SectionHeader',
    spec: 'packages/shared/src/ui/section-header-spec.ts',
    legs: {
      miniapp: 'apps/miniapp-taro/src/components/adapters/SectionHeader.taro.tsx',
      rn: 'packages/app/src/components/SectionHeader.tsx',
    },
  },
  {
    name: 'NavBar',
    spec: 'packages/shared/src/ui/navbar-spec.ts',
    legs: {
      miniapp: 'apps/miniapp-taro/src/components/NavBar.tsx',
      rn: 'apps/mobile-rn/src/components/NavBar.tsx',
    },
  },
  {
    name: 'ModelConfigDialog',
    spec: 'packages/shared/src/ui/model-config-dialog-spec.ts',
    legs: {
      miniapp: 'apps/miniapp-taro/src/components/ModelConfigDialog.tsx',
      rn: 'apps/mobile-rn/src/components/ModelConfigDialog.tsx',
    },
  },
  {
    name: 'VideoPlayer',
    spec: 'packages/shared/src/ui/video-player-spec.ts',
    legs: {
      miniapp: 'apps/miniapp-taro/src/components/VideoPlayer.tsx',
      rn: 'apps/mobile-rn/src/components/VideoPlayer.tsx',
    },
  },
  {
    name: 'IntelligentAssistant',
    spec: 'packages/shared/src/ui/intelligent-assistant-spec.ts',
    legs: {
      miniapp: 'apps/miniapp-taro/src/components/IntelligentAssistant.tsx',
      rn: 'apps/mobile-rn/src/components/IntelligentAssistant.tsx',
    },
  },
  {
    name: 'LoginPopUp',
    spec: 'packages/shared/src/ui/login-popup-spec.ts',
    legs: {
      miniapp: 'apps/miniapp-taro/src/components/LoginPopUp.tsx',
      rn: 'apps/mobile-rn/src/components/LoginPopUp.tsx',
    },
  },
  {
    name: 'InputArea',
    spec: 'packages/shared/src/ui/input-area-spec.ts',
    legs: {
      miniapp: 'apps/miniapp-taro/src/components/InputArea.tsx',
      rn: 'apps/mobile-rn/src/components/InputArea.tsx',
    },
  },
] as const

type Side = 'miniapp' | 'rn'

/** 封闭集:每一种都指向一种**不同的处置动作**,所以不允许自造 kind。 */
const KINDS = [
  'element-absent',
  'mechanism-variant',
  'cross-file-consumption',
  'undecided-fork',
] as const

const SIDES: readonly Side[] = ['miniapp', 'rn']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface Ruling {
  tier: string
  side: Side
  kind: string
  element: string
  reason: string
  until: string
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

/** 剥注释(保留字符串)—— 与门 128 同方向:判"这一端有没有引用"只能看代码,不能把注释里的档名当取数点。 */
function stripComments(src: string): string {
  let out = ''
  let mode: 'code' | 'line' | 'block' | 'str' = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i]
    const n = src[i + 1]
    if (mode === 'code') {
      if (c === '/' && n === '/') {
        mode = 'line'
        i += 1
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        i += 1
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        mode = 'str'
        quote = c
      }
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      }
      continue
    }
    if (mode === 'block') {
      if (c === '*' && n === '/') {
        mode = 'code'
        i += 1
      }
      continue
    }
    out += c
    if (c === quote) {
      mode = 'code'
      quote = ''
    }
  }
  return out
}

/** spec 导出面的档名(与"档"无关的导出如函数不在此列;`_WEIGHT` 这类常量会被一并取出,由覆盖对账自然归位)。 */
function exportedTiers(specSrc: string): string[] {
  return [...specSrc.matchAll(/^export const ([A-Z][A-Z0-9_]*)\b/gm)].map((m) => m[1] ?? '')
}

/** 只由一条腿引用的导出档 → 该腿;两条腿都引用或都不引用 ⇒ 不是单侧档(返回 null)。 */
function singleOwnerOf(tier: string, srcs: Record<Side, string>): Side | null {
  const inMiniapp = srcs.miniapp.includes(tier)
  const inRn = srcs.rn.includes(tier)
  if (inMiniapp === inRn) return null
  return inMiniapp ? 'miniapp' : 'rn'
}

/**
 * 裁定账的逐条判据(空数组 = 每枚都成立)。抽成纯函数是为了"本锁有牙"那一组能回喂改坏的素材。
 */
export function rulingProblems(
  family: string,
  rulings: Ruling[],
  srcs: Record<Side, string>,
  exported: string[],
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const r of rulings) {
    const at = `${family}.${r.tier || '(无名档)'}`
    if (!r.tier || typeof r.tier !== 'string') out.push(`${at} 缺档名`)
    else {
      if (seen.has(r.tier)) out.push(`${at} 重复登记(同一张档只能有一条裁定)`)
      seen.add(r.tier)
    }
    if (!SIDES.includes(r.side)) out.push(`${at} side=${String(r.side)} 不在 ${SIDES.join('/')} 里`)
    if (!(KINDS as readonly string[]).includes(r.kind))
      out.push(`${at} kind=${String(r.kind)} 不在 ${KINDS.join('/')} 里`)
    if (typeof r.element !== 'string' || r.element.trim().length < 4)
      out.push(`${at} 没写明它管辖的元素/槽位 —— 裁定无从复核`)
    if (typeof r.reason !== 'string' || r.reason.trim().length < 24)
      out.push(`${at} 的理由不足以回答"为什么是平台结构差异而不是待收敛的债"`)
    if (typeof r.until !== 'string' || !ISO_DATE.test(r.until))
      out.push(`${at} until 不是 ISO 日期(裁定必须会到期)`)
    if (r.tier && !exported.includes(r.tier))
      out.push(`${at} 已不在 spec 导出面 ⇒ 裁定清单过期,请同步`)
    if (r.tier) {
      const owner = singleOwnerOf(r.tier, srcs)
      if (owner === null)
        out.push(`${at} 两端都引用或都不引用 ⇒ 它已不是单侧档,裁定该撤下(或两端确实收敛了)`)
      else if (owner !== r.side)
        out.push(`${at} 登记的 owner=${r.side},实测该档取数点在 ${owner} 腿 ⇒ 归属漂了`)
    }
  }
  return out
}

/** 覆盖面对账:spec 导出面的单侧档集合必须与登记集合逐枚相等(两个方向都要报)。 */
export function coverageProblems(
  family: string,
  rulings: Ruling[],
  srcs: Record<Side, string>,
  exported: string[],
): string[] {
  const registered = new Set(rulings.map((r) => r.tier))
  const derived = new Set(exported.filter((t) => singleOwnerOf(t, srcs) !== null))
  const missing = [...derived].filter((t) => !registered.has(t))
  const extra = [...registered].filter((t) => !derived.has(t))
  return [
    ...missing.map(
      (t) =>
        `${family}.${t} 是 spec 导出面现算出的单侧档,却没有裁定登记 —— 要么把另一端接上(真收敛),要么登记它为什么是结构差异`,
    ),
    ...extra.map(
      (t) => `${family}.${t} 挂在裁定账上,但现读已不是单侧档(两端都引用/都不引用)⇒ 清单腐烂,请撤下`,
    ),
  ]
}

function loadFamilies() {
  const ledger = JSON.parse(read(LEDGER_REL)) as {
    counts?: Record<string, number>
    waivers?: Record<string, { reason?: string; until?: string; singleEndTiers?: Ruling[] }>
  }
  return FAMILIES.map((f) => {
    const srcs = {
      miniapp: stripComments(read(f.legs.miniapp)),
      rn: stripComments(read(f.legs.rn)),
    } as Record<Side, string>
    const exported = exportedTiers(read(f.spec))
    const waiver = ledger.waivers?.[f.name]
    const rulings = waiver?.singleEndTiers ?? []
    return { family: f.name, srcs, exported, waiver, rulings, counts: ledger.counts?.[f.name] }
  })
}

const LOADED = loadFamilies()

describe('waivers.<族>.singleEndTiers —— 单侧档裁定账的机读锁', () => {
  it('① 每一族都真的有裁定账,且条数大于零(空表不许冒充"本族无单侧档")', () => {
    for (const f of LOADED)
      expect(
        f.rulings.length,
        `${f.family} 没有 singleEndTiers ⇒ 裁定仍只活在散文里`,
      ).toBeGreaterThan(0)
  })

  it('② 形状 + 档名仍在 + 两端真单侧(逐族逐条)', () => {
    for (const f of LOADED)
      expect(
        rulingProblems(f.family, f.rulings, f.srcs, f.exported),
        `${f.family} 的裁定账有洞(见上)`,
      ).toEqual([])
  })

  it('③ 覆盖面对账:spec 导出面现算的单侧档集合 ≡ 登记集合(双向)', () => {
    for (const f of LOADED)
      expect(
        coverageProblems(f.family, f.rulings, f.srcs, f.exported),
        `${f.family} 的裁定账与 spec 导出面不一致(见上)`,
      ).toEqual([])
  })

  it('④ 裁定不会活得比它所属的族级豁免更久,也不会替族级豁免兜底', () => {
    for (const f of LOADED) {
      expect(typeof f.waiver?.reason, `${f.family} 缺族级豁免理由`).toBe('string')
      expect((f.waiver?.reason ?? '').trim().length).toBeGreaterThanOrEqual(6)
      expect(ISO_DATE.test(String(f.waiver?.until)), `${f.family} 族级豁免没有到期日`).toBe(true)
      // 裁定账只投影裁定,不是豁免通道:族的差异计数必须仍在台账上(否则裁定挂在"永远不可能被问责的免费额度"上)
      expect(Number(f.counts ?? 0), `${f.family} 的 counts 不在台账里或为 0`).toBeGreaterThan(0)
      for (const r of f.rulings) {
        expect(ISO_DATE.test(r.until), `${f.family}.${r.tier} 的 until 坏`).toBe(true)
        // undecided-fork 允许更早到期(逼裁决),其余必须与族级豁免同日
        if (r.kind === 'undecided-fork') expect(r.until <= String(f.waiver?.until)).toBe(true)
        else expect(r.until, `${f.family}.${r.tier} 与族级豁免的到期日不一致`).toBe(f.waiver?.until)
      }
    }
  })

  it('⑤ 本锁有牙:凑平/吞掉取数点/清单腐烂三种改坏都能被同一把尺子量到', () => {
    const f = LOADED.find((x) => x.family === 'LoginPopUp')
    if (!f) throw new Error('找不到 LoginPopUp 的裁定账(本用例的前提没了)')
    const owned = f.rulings.find((r) => r.side === 'miniapp')
    if (!owned) throw new Error('LoginPopUp 没有小程序侧裁定(本用例的前提没了)')

    // 甲:往另一端补一条引用(典型动机 = 让 diffCount 变小)⇒ 归属/单侧性必须红
    const padded = { ...f.srcs, rn: `${f.srcs.rn}\nconst __padded = ${owned.tier}\n` }
    expect(
      rulingProblems(f.family, f.rulings, padded, f.exported).some((p) => p.includes(owned.tier)),
      '另一端补引用没被拦 ⇒ 尺子没牙(凑平可过关)',
    ).toBe(true)

    // 乙:把 owner 端的取数点删掉(元素被吞/接线脱了)⇒ 同样必须红
    const stripped = {
      ...f.srcs,
      miniapp: f.srcs.miniapp.split(owned.tier).join('__gone__'),
    }
    expect(
      rulingProblems(f.family, f.rulings, stripped, f.exported).some((p) => p.includes(owned.tier)),
      'owner 端取数点被删没被拦 ⇒ 尺子只测"有没有登记",不测"还在不在用"',
    ).toBe(true)

    // 丙:覆盖对账对"spec 里现算是单侧、账上却没登记"必须红(拿掉一枚已登记档即等价于漏登记)
    const without = f.rulings.filter((r) => r.tier !== owned.tier)
    expect(
      coverageProblems(f.family, without, f.srcs, f.exported).some((p) => p.includes(owned.tier)),
      '漏登记没被覆盖对账量到 ⇒ 清单可以静默少一枚',
    ).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
