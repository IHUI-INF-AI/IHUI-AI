// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出包链「派生进程不得弹窗」回归锁(2026-11-03)。
 *
 * 立因:`scripts/mobile-release-gate.mjs` 在 Windows 上派生 4 道子门,任一处漏 `windowsHide`
 * 都可能弹控制台窗口并把门挂住。形态锁 = **逐调用点**量,不按文件数:
 * ① 每个 `spawnSync/execFileSync` 实参里必须直接带 `windowsHide: true`,或最后一个实参是
 *    在同文件里定义的 `const opts = {…}` 且该对象里有它(共享 opts 是允许的,但要逐个调用点接上);
 * ② 文件里出现调用而扫描器一个都没解析到 ⇒ 判未判定(空扫不等于干净)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

/** 出包门直接派生的链条(与 mobile-release-gate.mjs 的 GATES 一一对应)。 */
const CHAIN = [
  'scripts/mobile-release-gate.mjs',
  'scripts/mobile-release-artifact-check.mjs',
  'scripts/release-mobile-rn.mjs',
]

/** 从开括号位置取到配平的整段实参文本(引号内的括号不参与配平)。 */
function callArgsAt(src, openParen) {
  let depth = 0
  let quote = null
  for (let i = openParen; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return src.slice(openParen + 1, i)
    }
  }
  return null
}

/** 同文件里 `const <name> = {…}` 的对象字面量文本;找不到返回 null。 */
function constObjectText(src, name) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\{`)
  const m = re.exec(src)
  if (!m) return null
  const open = src.indexOf('{', m.index)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  return null
}

test('出包链每个 spawn/execFile 调用点都带 windowsHide(含共享 opts 的逐个接线)', () => {
  for (const rel of CHAIN) {
    const src = readFileSync(join(ROOT, rel), 'utf8')
    const sites = [...src.matchAll(/\b(?:spawnSync|execFileSync)\s*\(/g)]
    assert.ok(sites.length > 0, `${rel}: 一个派生调用都没解析到 ⇒ 扫描器失效,不记绿`)
    for (const m of sites) {
      const args = callArgsAt(src, m.index + m[0].length - 1)
      assert.ok(args !== null, `${rel}: 调用括号不配平,无法验证 windowsHide`)
      if (/windowsHide\s*:\s*true/.test(args)) continue
      // 对象展形态:`{ ...opts, shell: true }` —— 问 opts 自己的字面量。
      const spread = /\.\.\.\s*([A-Za-z_$][\w$]*)/.exec(args)
      if (spread) {
        const spreadObj = constObjectText(src, spread[1])
        assert.ok(
          spreadObj && /windowsHide\s*:\s*true/.test(spreadObj),
          `${rel}: ${src.slice(m.index, m.index + 40)} 展开的 ${spread[1]} 里没有 windowsHide`,
        )
        continue
      }
      // 共享 opts 形态:最后一个实参是标识符,且该标识符的对象字面量里有 windowsHide。
      const tail = args.trim().replace(/,\s*$/, '')
      const lastArg = (tail.match(/,([^,]+)$/) ?? [])[1]?.trim() ?? tail
      const obj = /^[A-Za-z_$][\w$]*$/.test(lastArg) ? constObjectText(src, lastArg) : null
      assert.ok(
        obj && /windowsHide\s*:\s*true/.test(obj),
        `${rel}: 调用点 ${src.slice(m.index, m.index + 40)} 未接 windowsHide(直接实参里没有,${lastArg} 的对象里也没有)`,
      )
    }
  }
})

test('出包门自身:两个 spawnSync 都吃同一个带 windowsHide 的 opts(形态锁,防"只补一处")', () => {
  const src = readFileSync(join(ROOT, 'scripts/mobile-release-gate.mjs'), 'utf8')
  const opts = constObjectText(src, 'opts')
  assert.ok(opts, 'mobile-release-gate.mjs 找不到 const opts = {…}')
  assert.match(opts, /windowsHide\s*:\s*true/, '共享 opts 里没有 windowsHide: true')
  const calls = [...src.matchAll(/\bspawnSync\s*\(/g)].map((m) =>
    callArgsAt(src, m.index + m[0].length - 1),
  )
  assert.equal(calls.length, 2, `spawnSync 调用点应恰为 2 处,实得 ${calls.length}`)
  for (const args of calls)
    assert.match(String(args), /\bopts\b/, '调用点未接共享 opts(逐点省略即弹窗风险)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
