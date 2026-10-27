// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SectionHeader「一份源 + 两端注入」接线契约(O92 重建件 / 门 128 换腿后残留的收口锁)。
 *
 * 这个文件钉四组不变量,各自挡一种**不会让 typecheck 红**的失效:
 *  ① 共享表的档位面 —— 标题/副标题/「更多」间距与「更多」字号逐枚在位,且「更多」箭头与
 *     标签同号这一条**写在表里**(而不是各端各记一句注释);
 *  ② 小程序适配层的取数 —— 五个档全部经 `toRpx(具名档)` 取,箭头 `size` 不得回退成裸 24rpx
 *     (那是同一枚 12px 档的第三份:web `h-3 w-3` / RN `ICON_SIZE` / 小程序 24rpx);
 *  ③ RN 唯一渲染腿的取数 —— 四档直接消费,sizes 1:1 不做换算,「更多」入口委托 MoreLink
 *     (箭头几何单源在委托件,腿里不另造第二份);
 *  ④ 委托件的取数 —— MoreLink 的 `ICON_SIZE` 必须由共享表的字号档派生,不得再写局部 12。
 * 每条判据都实现成**纯函数(问题列表)**,再用变异自证把"改坏的源码"喂回同一把尺子 ——
 * 否则"本锁有牙"只是一句口号。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  SECTION_HEADER_MORE_FONT_PX,
  SECTION_HEADER_MORE_MARGIN_LEFT_PX,
} from '../section-header-spec'

/** 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数(搬家/换解析根时定长路径会静默指歪)。 */
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
  throw new Error('找不到仓库根(pnpm-workspace.yaml)⇒ 跨端接线对账无从取材')
}

const ROOT = repoRoot()
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8')

/**
 * 剥注释但保留字符串内容:留注释会把说明性文字喂进判据(本文件的头注里逐字写着"裸 24rpx"),
 * 剥字符串会把 `name="chevron-right"` / `size={…}` 一起抹掉(判据失明)。
 * 与守门 128 的同名函数同一形状;本文件不引 scripts/(测试不依赖守门实现)。
 */
function stripComments(src: string): string {
  let out = ''
  let mode: 'code' | 'line' | 'block' = 'code'
  let quote = ''
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i)
    const n = src.charAt(i + 1)
    if (mode === 'code') {
      if (quote !== '') {
        out += c
        if (c === '\\') {
          out += n
          i += 1
        } else if (c === quote) {
          quote = ''
        }
        continue
      }
      if (c === '/' && n === '/') {
        mode = 'line'
        out += '  '
        i += 1
        continue
      }
      if (c === '/' && n === '*') {
        mode = 'block'
        out += '  '
        i += 1
        continue
      }
      if (c === "'" || c === '"' || c === '`') quote = c
      out += c
      continue
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code'
        out += c
      } else {
        out += ' '
      }
      continue
    }
    if (c === '*' && n === '/') {
      mode = 'code'
      out += '  '
      i += 1
      continue
    }
    out += c === '\n' ? c : ' '
  }
  return out
}

const SPEC_SRC = read('packages/shared/src/ui/section-header-spec.ts')
const MP_SRC = read('apps/miniapp-taro/src/components/adapters/SectionHeader.taro.tsx')
const RN_SRC = read('packages/app/src/components/SectionHeader.tsx')
const MORE_SRC = read('packages/app/src/components/MoreLink.tsx')

/** 表里必须存在的档(标题区几何 + 「更多」字号/间距),缺一枚 = 某端迟早各抄一份。 */
const REQUIRED_TIERS = [
  'SECTION_HEADER_TITLE_FONT_PX',
  'SECTION_HEADER_SUBTITLE_FONT_PX',
  'SECTION_HEADER_SUBTITLE_GAP_PX',
  'SECTION_HEADER_MORE_MARGIN_LEFT_PX',
  'SECTION_HEADER_ARROW_MARGIN_LEFT_PX',
  'SECTION_HEADER_MORE_FONT_PX',
]

function specProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  for (const name of REQUIRED_TIERS) {
    if (!new RegExp(`export const ${name}\\s*=\\s*\\d`).test(code))
      out.push(`共享表缺档 ${name}(端内会各自补一份数字)`)
  }
  // 箭头与标签同档这条**判决**必须写在表里:只写在端内注释里,下一个人看不到约束来源。
  if (!/箭头字形同档/.test(src)) out.push('共享表未写明「箭头字形与标签同档」(裁决出处丢了)')
  return out
}

function mpProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (!/from\s+['"]@ihui\/shared\/ui\/section-header-spec['"]/.test(code))
    out.push('小程序适配层未从 section-header-spec 取数(单一源断开)')
  for (const name of REQUIRED_TIERS) {
    if (!new RegExp(`\\b${name}\\b`).test(code)) out.push(`小程序适配层未消费 ${name}`)
  }
  if (!/size=\{SECTION_HEADER_MORE_FONT_PX \* TARO_RPX_PER_PX\}/.test(code))
    out.push('小程序适配层箭头 size 未由 SECTION_HEADER_MORE_FONT_PX 派生(或没按 rpx 倍率换算)')
  if (/size=\{toRpx\(/.test(code))
    out.push('小程序适配层箭头 size 传了 rpx 字符串(LineIcon 只在收数值时做 H5 换算)')
  if (/size=\{\s*\d+(?:\.\d+)?\s*\}/.test(code))
    out.push('小程序适配层出现裸 size={数字}(同一枚档的第三份回潮)')
  return out
}

function rnProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (!/from\s+['"]@ihui\/shared\/ui\/section-header-spec['"]/.test(code))
    out.push('RN 唯一渲染腿未从 section-header-spec 取数(单一源断开)')
  for (const name of [
    'SECTION_HEADER_TITLE_FONT_PX',
    'SECTION_HEADER_SUBTITLE_FONT_PX',
    'SECTION_HEADER_SUBTITLE_GAP_PX',
    'SECTION_HEADER_MORE_MARGIN_LEFT_PX',
  ]) {
    if (!new RegExp(`\\b${name}\\b`).test(code)) out.push(`RN 腿未消费 ${name}`)
  }
  if (!/<MoreLink[\s/>]/.test(code) || !/from\s+['"]\.\/MoreLink['"]/.test(code))
    out.push('RN 腿未把「更多」委托给 MoreLink(箭头几何会出现第二份)')
  // 腿里只许出现"档名字面量"(fontSize: X_PX),不许出现"数字字面量"。
  if (/(?:fontSize|marginLeft|marginTop|width|height)\s*:\s*\d+(?:\.\d+)?(?![\w.])/.test(code))
    out.push('RN 腿出现裸几何数字(端内既定档回潮)')
  return out
}

function moreLinkProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (!/SECTION_HEADER_MORE_FONT_PX as LABEL_FONT_SIZE/.test(code))
    out.push('MoreLink 未从 section-header-spec 取「更多」字号(别名 LABEL_FONT_SIZE)')
  if (!/SECTION_HEADER_ARROW_MARGIN_LEFT_PX as GAP/.test(code))
    out.push('MoreLink 未从 section-header-spec 取文字↔箭头间距(别名 GAP)')
  if (!/const ICON_SIZE = LABEL_FONT_SIZE\b/.test(code))
    out.push('MoreLink 的 ICON_SIZE 未由共享字号档派生(端内 12 回潮)')
  if (/const ICON_SIZE = \d/.test(code)) out.push('MoreLink 的 ICON_SIZE 写成了数字字面量')
  return out
}

describe('① 共享表:六档在位 + 箭头同档的裁决写在表里', () => {
  it('现态:无缺档、裁决语在同一条文档里', () => {
    expect(specProblems(SPEC_SRC)).toEqual([])
    expect(SECTION_HEADER_MORE_FONT_PX).toBe(12)
    expect(SECTION_HEADER_MORE_MARGIN_LEFT_PX).toBe(8)
  })

  it('本锁有牙:摘掉一枚档 ⇒ 判据必须红', () => {
    const dirty = SPEC_SRC.replace('export const SECTION_HEADER_ARROW_MARGIN_LEFT_PX = 2', '')
    expect(dirty).not.toBe(SPEC_SRC)
    expect(specProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('② 小程序适配层:全部档经具名档取,箭头不写裸 24rpx、也不传 rpx 字符串', () => {
  it('现态:五档消费 + 箭头 size 由字号档派生', () => {
    expect(mpProblems(MP_SRC)).toEqual([])
  })

  it('本锁有牙:箭头 size 回退成裸 24 ⇒ 判据必须红', () => {
    const dirty = MP_SRC.replace(
      'size={SECTION_HEADER_MORE_FONT_PX * TARO_RPX_PER_PX}',
      'size={24}',
    )
    expect(dirty).not.toBe(MP_SRC)
    expect(mpProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('③ RN 唯一渲染腿:四档直接消费 + 「更多」委托 MoreLink', () => {
  it('现态:取数面与委托都在位', () => {
    expect(rnProblems(RN_SRC)).toEqual([])
  })

  it('本锁有牙:标题字号改写成数字 ⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('fontSize: SECTION_HEADER_TITLE_FONT_PX', 'fontSize: 16')
    expect(dirty).not.toBe(RN_SRC)
    expect(rnProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('④ 委托件 MoreLink:ICON_SIZE 由共享字号档派生', () => {
  it('现态:两个别名都在位,ICON_SIZE 不再是局部常量', () => {
    expect(moreLinkProblems(MORE_SRC)).toEqual([])
  })

  it('本锁有牙:ICON_SIZE 写回 12 ⇒ 判据必须红', () => {
    const dirty = MORE_SRC.replace('const ICON_SIZE = LABEL_FONT_SIZE', 'const ICON_SIZE = 12')
    expect(dirty).not.toBe(MORE_SRC)
    expect(moreLinkProblems(dirty).length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
