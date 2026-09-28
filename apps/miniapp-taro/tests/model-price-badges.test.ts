// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 小程序端「模型价格徽章族」接线锁(纯函数判据 + 源码级对账)。
 *
 * 立票:用户 2026-09-27 批准「ModelList 徽章族铺到小程序」。本端此前把「免费」徽章**恒真**
 * 渲染(文件里那句"显示条件一字未动"写的就是事实),于是付费模型在小程序上也被说成"免费"
 * —— 那是假陈述,不是"少一个徽章";而 typecheck / 构建 / 守门 128 全都不会红(它判的是档值,
 * 不是分支条件)。本文件把这三格钉成判据:
 *  L1 判据只有一份(端内不得再出现 `input_price === 0` 这类裸判据 / 第二份自由网关正则)
 *  L2 徽章必须是**二分支**且由同一条件分派(免费与付费各在真/假两支)
 *  L3 徽章族圆角与 RN 同档(rnRadius.md),配色走 tokens 同源档、不得自拼十六进制
 * 每条断言都配一个**构造反例**证明它会红 —— 只有"当前绿"而没有"错了会红"的断言,
 * 与本仓记过多次的"判据失效的表现永远是安静"是同一种缺陷。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { modelIsFree } from '@ihui/shared/ui/model-badge-facts'

const COMPONENT = resolve(__dirname, '../src/components/ModelList.tsx')
const SRC_ROOT = resolve(__dirname, '../src')
const componentSrc = readFileSync(COMPONENT, 'utf8')

/**
 * 只认代码面:剥块注释与整行行注释。
 * 不剥的话,本文件与组件里"老写法长什么样"的说明文字会被判据当成违规命中(守门 70 / 131
 * 都记过同一型:门把自己解释自己的散文判成违规)。
 */
function codeFace(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

function walkTs(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walkTs(p))
    else if (/\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

/** L1:裸价格判据(input_price / output_price 直接和 0 比)。返回命中行。 */
function findBarePricePredicate(code: string): string[] {
  return code.split('\n').filter((line) => /(input|output)_price\s*[=!]==?\s*0\b/.test(line))
}

/** L1b:第二份自由网关正则(判据必须只在 packages/shared 那一份里)。 */
function findSecondGatewayRegex(code: string): string[] {
  return code
    .split('\n')
    .filter((line) => /@cf\\/i.test(line) && /\/[\\^]/i.test(line) && !/^\s*\*/.test(line))
}

/** L1c:唯一判据是否被真的 import 进来(子路径形态)。写成函数以便用构造反例证它会红。 */
function hasSoleGateImport(code: string): boolean {
  return code.includes("import { modelIsFree } from '@ihui/shared/ui/model-badge-facts'")
}

/**
 * L2:二分支分派判据 —— 必须存在
 *   modelIsFree({ ... inputPrice ... }) ? ( ... 'course.free' ... ) : ( ... 'course.paid' ... )
 * 即:同一条件分派、免费在真支、付费在假支。写成函数是为了能用构造反例喂它。
 */
function isTwoBranchDispatched(code: string): boolean {
  return /modelIsFree\(\s*\{[^}]*inputPrice[^}]*\}\s*\)\s*\?\s*\([\s\S]*?'course\.free'[\s\S]*?\)\s*:\s*\([\s\S]*?'course\.paid'/.test(
    code,
  )
}

/**
 * L3:逐个"徽章容器块"取它的圆角档。锚点用每块**首个**内衬声明(paddingLeft),
 * 不用裸 PAD 常量名 —— 后者会在同一块里命中 paddingRight/paddingTop,把它们配到
 * **下一块**的 borderRadius 上,产出看着对其实错位的条目。
 */
function badgeRadius(code: string): Array<{ pad: string; radius: string | undefined }> {
  const found: Array<{ pad: string; radius: string | undefined }> = []
  const re =
    /paddingLeft:\s*toUnit\(MODEL_LIST_(PRICE_)?BADGE_PADDING_X_PX\)[\s\S]{0,600}?borderRadius:\s*([^,\n]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    found.push({ pad: m[1] ? 'price' : 'rank', radius: m[2].trim() })
  }
  return found
}

describe('L1 判据只有一份(端内不再出现裸判据)', () => {
  it('真仓读数:apps/miniapp-taro/src 全面无 `input_price === 0` 类裸判据', () => {
    const hits: string[] = []
    for (const f of walkTs(SRC_ROOT)) {
      for (const line of findBarePricePredicate(codeFace(readFileSync(f, 'utf8'))))
        hits.push(`${f}: ${line.trim()}`)
    }
    expect(hits).toEqual([])
  })

  it('真仓读数:端内没有第二份自由网关正则', () => {
    const hits: string[] = []
    for (const f of walkTs(SRC_ROOT)) {
      for (const line of findSecondGatewayRegex(codeFace(readFileSync(f, 'utf8'))))
        hits.push(`${f}: ${line.trim()}`)
    }
    expect(hits).toEqual([])
  })

  it('有牙:同一 helper 喂构造的裸判据源码必须命中,喂"只写在注释里"的必须不命中', () => {
    const bad = 'const free = model.input_price === 0'
    const alsoBad = 'if (model.output_price !== 0) return'
    expect(findBarePricePredicate(bad)).toHaveLength(1)
    expect(findBarePricePredicate(alsoBad)).toHaveLength(1)
    // 反证:注释形态不得计入(否则门把说明文字判成违规,下一个人就只能删说明)
    expect(
      findBarePricePredicate(codeFace('// const free = model.input_price === 0')),
    ).toHaveLength(0)
    expect(findBarePricePredicate(codeFace('/* if (model.input_price === 0) */'))).toHaveLength(0)
    // 第二份正则的构造命中与反证
    expect(findSecondGatewayRegex(String.raw`const re = /^@cf\/|^llm7\//`)).toHaveLength(1)
    expect(findSecondGatewayRegex(codeFace(String.raw`/* const re = /^@cf\// */`))).toHaveLength(0)
  })

  it('接线在位:ModelList 从子路径 import 唯一判据,且没有挂进任何 barrel', () => {
    const face = codeFace(componentSrc)
    expect(hasSoleGateImport(face)).toBe(true)
    // 有牙:摘掉 import / 改挂 barrel 的两种构造源码都必须判 false
    expect(
      hasSoleGateImport(
        `import { View } from '@tarojs/components'\nexport default function X(){return null}`,
      ),
    ).toBe(false)
    expect(
      hasSoleGateImport(
        "import { modelIsFree } from '@ihui/shared/ui'\nconst free = modelIsFree(m)",
      ),
    ).toBe(false)
    const barrelUi = readFileSync(
      resolve(__dirname, '../../../packages/shared/src/ui/index.ts'),
      'utf8',
    )
    const barrelRoot = readFileSync(
      resolve(__dirname, '../../../packages/shared/src/index.ts'),
      'utf8',
    )
    expect(barrelUi).not.toContain('model-badge-facts')
    expect(barrelRoot).not.toContain('model-badge-facts')
  })
})

describe('L2 徽章是二分支(假陈述的根治)', () => {
  it('真仓读数:免费与付费由同一 modelIsFree 条件分派', () => {
    expect(isTwoBranchDispatched(codeFace(componentSrc))).toBe(true)
  })

  it('真仓读数:两处文案各出现一次且带 tt 回退档,且 course.paid 五语言包在位', () => {
    const face = codeFace(componentSrc)
    expect(face.match(/tt\('course\.free', '免费'\)/g)?.length).toBeGreaterThanOrEqual(1)
    expect(face).toContain("tt('course.paid', '付费')")
    // 反证:若有人改成不带回退的 t('course.paid'),键缺失时端上会回显裸键名
    expect(face).not.toMatch(/[^t]\('course\.paid'\)/)
    // 键本身必须在五语言包里 —— 代码用得到而包里没有,端上就是"永远走中文回退"的假国际化。
    // 同一条判据也跑 course.free(阳性对照:读法本身看得见的键必须是 true,否则 0 处也可能是尺子坏了)。
    for (const loc of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
      const pack = JSON.parse(
        readFileSync(
          resolve(__dirname, `../../../packages/i18n/messages/miniapp-taro/${loc}.json`),
          'utf8',
        ),
      ) as { course?: Record<string, string> }
      expect(typeof pack.course?.free, `${loc}: course.free`).toBe('string')
      expect(typeof pack.course?.paid, `${loc}: course.paid`).toBe('string')
    }
  })

  it('有牙:恒真单分支 / 两块并列无分派 两种构造源码都必须判 false', () => {
    const alwaysFree = `{<View>{tt('course.free', '免费')}</View>}`
    expect(isTwoBranchDispatched(alwaysFree)).toBe(false)
    const twoUnconditionalBlocks = `
      <View>{tt('course.free', '免费')}</View>
      <View>{tt('course.paid', '付费')}</View>
    `
    expect(isTwoBranchDispatched(twoUnconditionalBlocks)).toBe(false)
    const paidOnlyArm = `{cond ? (<View>x</View>) : (<View>{tt('course.paid', '付费')}</View>)}`
    expect(isTwoBranchDispatched(paidOnlyArm)).toBe(false)
    // 阳性对照:与本仓真写法同形的最小样本必须判 true(否则上面的 false 只是判据失灵)
    const okShape = `{modelIsFree({ id: m.id, inputPrice: m.input_price }) ? (
      <View>{tt('course.free', '免费')}</View>
    ) : (
      <View>{tt('course.paid', '付费')}</View>
    )}`
    expect(isTwoBranchDispatched(okShape)).toBe(true)
  })

  it('判据行为与端上装配一致:付费模型走假支、免费模型走真支', () => {
    expect(modelIsFree({ id: 'gpt-4o', inputPrice: 2.5 })).toBe(false)
    expect(modelIsFree({ id: 'deepseek-v3', inputPrice: 0 })).toBe(true)
    // LlmModel 契约只有 input_price(无 output_price)⇒ 只投这一档必须够用
    expect(modelIsFree({ id: '@cf/llama', inputPrice: undefined })).toBe(true)
  })
})

describe('L3 徽章族圆角与配色同档', () => {
  it('真仓读数:每个徽章容器都取 rnRadius.md(RN rankBadge / freeBadge / paidBadge 都是 md)', () => {
    const list = badgeRadius(codeFace(componentSrc))
    expect(list.length).toBeGreaterThanOrEqual(3)
    const off = list.filter((b) => b.radius !== 'rnRadius.md')
    expect(off).toEqual([])
    // 反向锁:说明圆角档差的那条旧注释不得留在文件里骗下一个人
    expect(componentSrc).not.toContain('圆角同取 rnRadius.xs(与 RN rankBadge 同档)')
  })

  it('有牙:同一 helper 喂 sm / xs 的构造块必须报出非 md', () => {
    const bad = `paddingLeft: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_X_PX), borderRadius: rnRadius.sm,`
    expect(badgeRadius(bad)).toEqual([{ pad: 'price', radius: 'rnRadius.sm' }])
    const ok = `paddingLeft: toUnit(MODEL_LIST_BADGE_PADDING_X_PX), borderRadius: rnRadius.md,`
    expect(badgeRadius(ok)).toEqual([{ pad: 'rank', radius: 'rnRadius.md' }])
  })

  it('付费支配色走 tokens 同源档,端内不自拼十六进制', () => {
    const face = codeFace(componentSrc)
    const paidIdx = face.indexOf("tt('course.paid'")
    expect(paidIdx).toBeGreaterThan(-1)
    const branchIdx = face.lastIndexOf(') : (', paidIdx)
    expect(branchIdx).toBeGreaterThan(-1) // 付费必须落在假支,不是随便一处文案
    const paidArm = face.slice(branchIdx, branchIdx + 900)
    expect(paidArm).toContain("background: 'var(--color-warning-amber-light)'")
    expect(paidArm).toContain("color: 'var(--color-warning-amber-text)'")
    // 反证:徽章族里出现裸十六进制即违反 AGENTS §4"跨端色值同源"(守门 93 问责面)
    expect(/MODEL_LIST_PRICE_BADGE[\s\S]{0,600}#[0-9a-fA-F]{3,8}/.test(face)).toBe(false)
    // 有牙:同一形状喂"自拼十六进制"的构造源码必须判 true(否则上面那条 false 是恒假断言)
    expect(
      /MODEL_LIST_PRICE_BADGE[\s\S]{0,600}#[0-9a-fA-F]{3,8}/.test(
        `paddingLeft: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_X_PX), background: '#fef3c7'`,
      ),
    ).toBe(true)
  })
})
