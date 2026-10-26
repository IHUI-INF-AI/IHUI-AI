// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dialog 族「平台无关 spec 数据 + 两端薄壳」接线契约的测试(二期契约下沉,形状照 card-wiring)。
 *
 * dialog 是**部分下沉**样板:两端只有 max-width 是现值逐字相同的可下沉几何(均 `max-w-lg`=512px),
 * 其余几何(padding / 圆角 / 遮罩不透明度)按平台机制分叉,已在 dialog-spec 登记为允许不同形不下沉
 * (同 badge 部分下沉先例)。本测试只钉 max-width 这一档的"两端壳都接走且真消费",并守住平台专属机制不被误删。
 * 每条判据都是**源码级**(readFileSync + 剥注释),两端壳不在本包被检程序里。
 * 判据一律实现为纯函数(问题列表),变异自证才能把"改坏的源码"喂回同一把尺子。
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as dialogSpec from '../dialog-spec'

/**
 * 仓库根按 `pnpm-workspace.yaml` 往上找,不写死相对层数。找不到就抛:那是取材前提没了,不许退化成跳过。
 */
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

const SPEC_SRC = readFileSync(join(ROOT, 'packages/shared/src/ui/dialog-spec.ts'), 'utf8')
const WEB_SRC = readFileSync(join(ROOT, 'packages/ui-react/src/components/dialog.tsx'), 'utf8')
const RN_SRC = readFileSync(join(ROOT, 'packages/ui-native/src/dialog.tsx'), 'utf8')

/** 两端壳引入 spec 的子路径(禁挂根桶) */
const SPEC_SUBPATH = '@ihui/shared/ui/dialog-spec'

/**
 * spec 的真实导出常量清单:**现读模块**,不在判据里抄第二份名字。
 */
const SPEC_EXPORTS = Object.keys(dialogSpec)
  .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name))
  .sort()

/** 本票点名的常量槽位(spec 可以更多,这个不许少) */
const REQUIRED_EXPORTS = ['DIALOG_MAX_WIDTH_TIER']

/** 剥注释但**保留字符串内容** */
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

/** ① spec 平台纯度:零 import(纯数据) */
function specPurityProblems(src: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const sources = [...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '')
  for (const s of sources) out.push(`dialog-spec 出现 import ${s}(spec 必须是平台无关纯数据)`)
  const requires = [...code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? '')
  for (const s of requires) out.push(`dialog-spec 出现 require(${s})(spec 必须是平台无关纯数据)`)
  return out
}

/** ③ 壳接线:每个导出常量都要被 import,且在**剥掉 import 语句之后的正文中**被真实消费 */
function specWiringProblems(src: string, side: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  const importRe = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${SPEC_SUBPATH}['"]`)
  const hit = code.match(importRe)
  if (!hit) {
    out.push(`${side} 壳未从 ${SPEC_SUBPATH} 引入 spec`)
    return out
  }
  const imported = (hit[1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  for (const name of SPEC_EXPORTS) {
    if (!imported.includes(name)) out.push(`${side} 壳未引入 ${name}`)
  }
  for (const name of imported) {
    if (!SPEC_EXPORTS.includes(name)) out.push(`${side} 壳引入了 spec 里不存在的 ${name}`)
  }
  const body = code.replace(importRe, '')
  for (const name of imported) {
    if (!new RegExp(`\\b${name}\\b`).test(body)) {
      out.push(`${side} 壳 import 了 ${name} 但正文没有消费(造好没装车)`)
    }
  }
  return out
}

/** ④ 平台专属机制:允许不同形,但下沉时误删即越界 ⇒ 逐条钉在位。dialog 是部分下沉,平台机制差异更大。 */
function platformOnlyProblems(src: string, side: string): string[] {
  const code = stripComments(src)
  const out: string[] = []
  if (side === 'web') {
    // web 的 Esc 层栈 + close 按钮 token 是 web 承载机制,必须保留;且 RN 的 Modal 不应泄露进 web
    if (!/useEscStackId/.test(code)) out.push('web 壳丢了平台专属 useEscStackId(Esc 层栈)')
    if (!/CLOSE_BUTTON_BASE/.test(code))
      out.push('web 壳丢了平台专属 CLOSE_BUTTON_BASE(close 按钮 token)')
    // 用 `<Modal`(JSX 机制)而非裸 `Modal`:`Modal` 也会出现在 react-native 的 import 行,裸匹配会误判
    if (/<Modal/.test(code)) out.push('web 壳混入了 RN 专属 Modal(不该下沉却下沉了)')
  }
  if (side === 'RN') {
    // RN 的 Modal + 遮罩点击关闭是 RN 承载机制,必须保留;且 web 的 Esc 层栈不应泄露进 RN
    // 用 `<Modal`(JSX 机制)而非裸 `Modal`:同上,裸 `Modal` 会命中 react-native 的 import 行
    if (!/<Modal/.test(code)) out.push('RN 壳丢了平台专属 Modal(RN 弹窗机制)')
    if (/useEscStackId/.test(code)) out.push('RN 壳混入了 web 专属 useEscStackId(不该下沉却下沉了)')
  }
  return out
}

/** ⑤ 导出面不回退:web 关键件在位点;RN 的单组件 + 头部/标题/描述/底部在位点(结构不同)。 */
const WEB_PARTS = ['Dialog', 'DialogContent']
const RN_PARTS = ['Dialog', 'DialogHeader', 'DialogTitle', 'DialogDescription', 'DialogFooter']

function exportProblems(src: string, parts: string[]): string[] {
  const code = stripComments(src)
  const exportTexts = [
    ...code.matchAll(
      /export\s+(?:(?:async\s+)?(?:function|const|let|var|class|type|interface)\s+[A-Za-z_$][\w$]*|\{[^}]*\})/g,
    ),
  ].map((m) => m[0])
  const exportBlob = exportTexts.join(' ')
  const out: string[] = []
  for (const part of parts) {
    if (!new RegExp(`\\b${part}\\b`).test(exportBlob)) out.push(`壳缺 ${part}`)
  }
  return out
}

describe('① dialog-spec 的平台纯度', () => {
  it('现态:零 import,纯数据', () => {
    expect(specPurityProblems(SPEC_SRC)).toEqual([])
  })

  it('本锁有牙:spec 被污染进 react-native ⇒ 纯度判据必须红', () => {
    const dirty = `${SPEC_SRC}\nimport { View } from 'react-native'\n`
    expect(dirty).not.toBe(SPEC_SRC)
    expect(specPurityProblems(dirty).length).toBeGreaterThan(0)
  })
})

describe('② spec 导出面', () => {
  it('现态:本票点名的 DIALOG_MAX_WIDTH_TIER 在位', () => {
    expect(SPEC_EXPORTS.length).toBeGreaterThan(0)
    for (const name of REQUIRED_EXPORTS) expect(SPEC_EXPORTS).toContain(name)
  })

  it('裁定取值:DIALOG_MAX_WIDTH_TIER = lg(两端现值逐字相同 max-w-lg,收一处)', () => {
    expect(dialogSpec.DIALOG_MAX_WIDTH_TIER).toBe('lg')
  })

  it('本锁有牙:漏掉 DIALOG_MAX_WIDTH_TIER ⇒ 导出面判据必须红', () => {
    const missing = REQUIRED_EXPORTS.filter((n) => n !== 'DIALOG_MAX_WIDTH_TIER')
    expect(missing).not.toContain('DIALOG_MAX_WIDTH_TIER')
    expect(REQUIRED_EXPORTS.length).toBeGreaterThan(missing.length)
  })
})

describe('③ 两端壳接线(每个导出常量都要 import 且真消费)', () => {
  it('现态:web 壳接走 spec 全部常量', () => {
    expect(specWiringProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 壳接走 spec 全部常量', () => {
    expect(specWiringProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:web 壳把 max-width 档改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    // 须同时剥掉 `Record<typeof DIALOG_MAX_WIDTH_TIER, string>` 类型标注 —— 否则 `typeof` 引用仍让
    // "正文消费"判据误判通过(同 card-wiring 的 RADIUS_CLASS 齿同构)
    const dirty = WEB_SRC.replace('MAX_WIDTH_CLASS[DIALOG_MAX_WIDTH_TIER]', "'max-w-lg'").replace(
      'Record<typeof DIALOG_MAX_WIDTH_TIER, string>',
      'Record<string, string>',
    )
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳把 max-width 档改回字面量(import 还在,消费断开)⇒ 判据必须红', () => {
    const dirty = RN_SRC.replace('MAX_WIDTH_CLASS[DIALOG_MAX_WIDTH_TIER]', "'max-w-lg'").replace(
      'Record<typeof DIALOG_MAX_WIDTH_TIER, string>',
      'Record<string, string>',
    )
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })

  it('本锁有牙:web 壳整条 import 删掉(回到端内写死)⇒ 判据必须红', () => {
    const dirty = WEB_SRC.replace(
      new RegExp(`import\\s*\\{[^}]*\\}\\s*from\\s*['"]${SPEC_SUBPATH}['"]\\n`),
      '',
    )
    expect(dirty).not.toBe(WEB_SRC)
    expect(specWiringProblems(dirty, 'web').length).toBeGreaterThan(0)
  })

  it('本锁有牙:RN 壳漏引常量 ⇒ 判据必须红', () => {
    // 实际是单行 import(`import { DIALOG_MAX_WIDTH_TIER } from ...`),剥掉常量名即断接
    const dirty = RN_SRC.replace('import { DIALOG_MAX_WIDTH_TIER } from', 'import { } from')
    expect(dirty).not.toBe(RN_SRC)
    expect(specWiringProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })
})

describe('④ 平台专属项:允许不同形,但不许下沉时误删', () => {
  it('现态:web 保留 Esc 层栈与 close 按钮 token,且无 RN Modal', () => {
    expect(platformOnlyProblems(WEB_SRC, 'web')).toEqual([])
  })

  it('现态:RN 保留 Modal,且无 web Esc 层栈', () => {
    expect(platformOnlyProblems(RN_SRC, 'RN')).toEqual([])
  })

  it('本锁有牙:RN 壳删掉 Modal ⇒ 平台专属判据必须红', () => {
    // 实际 JSX 是 `<Modal visible={visible} transparent ...`(属性名 visible 非 modalVisible)
    const dirty = RN_SRC.replace('<Modal visible={visible} transparent', '<View visible={visible}')
    expect(dirty).not.toBe(RN_SRC)
    expect(platformOnlyProblems(dirty, 'RN').length).toBeGreaterThan(0)
  })
})

describe('⑤ 导出面不回退', () => {
  it('现态:web 关键件(Dialog/DialogContent)都在位', () => {
    expect(exportProblems(WEB_SRC, WEB_PARTS)).toEqual([])
  })

  it('现态:RN 单组件 + 头部/标题/描述/底部都在位', () => {
    expect(exportProblems(RN_SRC, RN_PARTS)).toEqual([])
  })

  it('本锁有牙:web 壳删掉 DialogContent 导出 ⇒ 导出面判据必须红', () => {
    const dirty = WEB_SRC.replace(/export\s*\{\s*[^}]*DialogContent[^}]*\}/, 'export { Dialog }')
    expect(dirty).not.toBe(WEB_SRC)
    expect(exportProblems(dirty, WEB_PARTS).length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
