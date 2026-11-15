// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

import {
  REA_CAPABILITIES,
  REA_CATEGORIES,
  REA_SOURCES,
  type ReaCapability,
} from '../rea-capabilities'
import { validatePluginViewManifest } from '@/lib/plugin-view-runtime'

/**
 * REA 逆向能力目录数据契约锁 —— 2026-11-15。
 *
 * 目录是逆向复用的唯一展示面。每条 evidence 必须锚定 2026-11-15 用 REA
 * (js_app_map)对 app.asar 的现场取证(evidence_id + sha8 + 实测要点),
 * **不得**回退成先前会话摘要里的臆测函数名(如 `qoder_exec_tool_impl`,
 * 该名在实测取证里查不到)。三条判据,任一不过即红:
 *  ① 结构锁:id/枚举/成熟度/maturity 合法,evidence 六字段齐全。
 *  ② 溯源锁:每条 evidence 的 sha8 与 version 非空且非占位;非 rea 来源
 *     的 probe 必须是 evidence_id 形态(`ev_` 前缀)。
 *  ③ 视图锁:挂了 view 的条目必须能过 F 类 validatePluginViewManifest
 *     (单一真相源,不复刻第二份沙箱契约)。
 */

const isEvId = (s: string) => /^ev_[0-9a-f]{8,}/.test(s)

/** 在 base 下递归找文件名精确等于 name 的所有文件(深度受限,防大目录)。 */
function findByName(base: string, name: string, depth = 0): string[] {
  if (depth > 8) return []
  let out: string[] = []
  let entries: string[] = []
  try {
    entries = readdirSync(base)
  } catch {
    return []
  }
  for (const e of entries) {
    const p = join(base, e)
    let isDir = false
    try {
      isDir = statSync(p).isDirectory()
    } catch {
      continue
    }
    if (isDir) out = out.concat(findByName(p, name, depth + 1))
    else if (e === name) out.push(p)
  }
  return out
}

/**
 * 第三种证据形态(.archify 源码级取证)的强校验:
 * 不只看 file 是否带 .archify,而是**真读仓内该文件、重算 sha256、比对 sha8**。
 * 文件不存在 / sha8 对不上 ⇒ 臆造,判红。这是防止"编个 .archify 路径 + 编个哈希"
 * 蒙混过关的唯一硬保证 —— 与 ev_id / unpacked 两条形态同为实测锚点。
 *
 * file 形态不统一,故不硬套正则:直接扫 file 里的所有 `.ts`/`.json` 文件名叶段,
 * 逐个在仓内 .archify 下按名查找,任一叶段的真实 sha8 == 声明 sha8 即认。这样
 * 既能覆盖 `.archify/.../src__acl.ts`(全路径)也能覆盖
 * `G:\\Trae CN\\...\\app(_b_one-ckg.json 取证:...)`(括号内点名)两种写法。
 */
function isSourceForensics(c: ReaCapability['evidence']): boolean {
  // 定位仓内 .archify(从 cwd 向上最多 6 层)
  let repoRoot = process.cwd()
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(repoRoot, '.archify'))) break
    const parent = dirname(repoRoot)
    if (parent === repoRoot) break
    repoRoot = parent
  }
  const base = join(repoRoot, '.archify')
  if (!existsSync(base)) return false

  // 扫 file 里所有带扩展名的叶段作为候选取证产物名
  const leaves = c.file.split(/[\\/()\s,]+/).filter((seg) => /\.(ts|json)$/i.test(seg))
  if (leaves.length === 0) return false
  for (const leaf of leaves) {
    const hits = findByName(base, leaf)
    if (
      hits.some(
        (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 8) === c.sha8,
      )
    ) {
      return true
    }
  }
  return false
}

describe('REA 逆向能力目录 · 数据契约', () => {
  it('①至少收录一条能力,且每条六字段 evidence 齐全', () => {
    expect(REA_CAPABILITIES.length).toBeGreaterThan(0)
    for (const c of REA_CAPABILITIES) {
      expect(c.id, `id 缺失`).toMatch(/^[a-z0-9-]+$/)
      expect(c.name.length, `${c.id} 名字空`).toBeGreaterThan(0)
      expect(c.summary.length, `${c.id} 摘要空`).toBeGreaterThan(0)
      expect(c.target.length, `${c.id} 落位空`).toBeGreaterThan(0)
      // evidence 六字段
      expect(c.evidence.program, `${c.id} program`).toBeDefined()
      expect(c.evidence.probe.length, `${c.id} probe 空`).toBeGreaterThan(0)
      expect(c.evidence.file.length, `${c.id} file 空`).toBeGreaterThan(0)
      expect(c.evidence.version.length, `${c.id} version 空`).toBeGreaterThan(0)
      expect(c.evidence.sha8.length, `${c.id} sha8 空`).toBeGreaterThan(0)
      expect(c.evidence.measured.length, `${c.id} measured 空`).toBeGreaterThan(0)
    }
  })

  it('①枚举字段全部落在合法档内', () => {
    for (const c of REA_CAPABILITIES) {
      expect(REA_CATEGORIES).toContain(c.category)
      expect(REA_SOURCES).toContain(c.source)
      expect(['A', 'B', 'C']).toContain(c.maturity)
    }
  })

  it('②非 rea 来源的能力必须锚定真实证据(取证 id / unpacked / .archify 源码级取证)', () => {
    for (const c of REA_CAPABILITIES) {
      if (c.source === 'rea') continue
      // 真证据三种形态,任一即可:
      //  ① ev_<hex>   = REA(js_app_map)现场取证 id;
      //  ② unpacked   = app.asar.unpacked 里实测到的真实落盘文件/包(如 node-pty/keytar);
      //  ③ .archify   = 本仓 .archify/ 下 REA 对原生模块(dll/exe)或已还原源码的静态取证
      //                 产物(如 deepseek-sandbox-acl-src/*.ts、trae-native-runtime/*.json),
      //                 文件在仓内可回读、sha8 可校验 —— 与 ev_id 同为实测,非臆测。
      // 臆测函数名(如 *_impl)三种形态都不匹配 ⇒ 仍被拦。
      const isRealEvidence =
        isEvId(c.evidence.probe) ||
        /unpacked/i.test(c.evidence.probe) ||
        // ③ 第三种形态:.archify 源码级取证,真读仓内文件重算 sha256 比对 sha8
        isSourceForensics(c.evidence)
      expect(
        isRealEvidence,
        `${c.id}: 非 rea 来源的 evidence 应为 ev_ 取证 id / unpacked 实路径 / .archify 源码取证,实为 probe="${c.evidence.probe}" file="${c.evidence.file}"`,
      ).toBe(true)
      expect(c.evidence.file, `${c.id}: file 应指向 app.asar/unpacked/.archify 取证实路径`).toMatch(
        /\.(asar|unpacked)?$|\\resources\\app($|\()|unpacked|\.archify|\.[a-z]+\.json|\.[a-z_]+\.ts/i,
      )
      expect(c.evidence.sha8, `${c.id}: sha8 应为 8 位十六进制`).toMatch(/^[0-9a-f]{8}$/)
    }
  })

  it('②id 全局唯一', () => {
    const ids = REA_CAPABILITIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('③挂 view 的条目过 F 类 manifest 校验(单一真相源)', () => {
    const withView = REA_CAPABILITIES.filter(
      (c): c is ReaCapability & { view: NonNullable<ReaCapability['view']> } => !!c.view,
    )
    expect(withView.length).toBeGreaterThan(0)
    for (const c of withView) {
      const v = validatePluginViewManifest(c.view)
      expect(v.ok, `${c.id} view 未过校验: ${v.problems.join(';')}`).toBe(true)
    }
  })

  it('③四个源程序各至少有一条能力(逆向覆盖完整)', () => {
    for (const src of REA_SOURCES) {
      expect(
        REA_CAPABILITIES.some((c) => c.source === src),
        `源程序 ${src} 无任何能力收录`,
      ).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
