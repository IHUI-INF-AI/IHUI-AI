#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-gate-owner-declaration.mjs —— 元门 D:改别人的门必须先声明属主(2026-11-07)
 *
 * 背景:2026-11-07 一天之内四条开发线在 `scripts/` 上并行,反复出现"两个人在改同一道门"
 * 的撞车。登记表 `scripts/data/gate-owners.json` 把每个门脚本的属主写清楚:
 *   · `owners.<ownerId>.scripts` = 已登记属主的门;
 *   · `unowned[]` = **尚未登记**的门(owner: null)。这类门**没有**被填成"公共" ——
 *     那等于没登记;它们保持原样,由人工逐门裁决(见防线文档 §4)。
 *
 * 本门的判据只针对**已登记属主**的门:
 *   某次提交改了 `owners` 里的门,而提交信息里没有 `Gate-Owner: <ownerId>`
 *   (或 `Gate-Owner: <脚本名>`) ⇒ 判红。
 * 改未登记属主的门 ⇒ 只列出清单,不判红(没有属主就没有"别人"可撞,需人工补登记)。
 *
 * 用法:
 *   node scripts/check-gate-owner-declaration.mjs                 # 判 HEAD 提交
 *   node scripts/check-gate-owner-declaration.mjs --commit=<rev>  # 判指定提交
 *   node scripts/check-gate-owner-declaration.mjs --staged --message-file=.git/COMMIT_EDITMSG
 *   --json 机器可读;--registry=<path> 指定登记表(默认 scripts/data/gate-owners.json)
 *
 * 未判定出口:登记表不可解析 / 变更清单取不到 / --staged 却没有提交信息 ⇒ exit 2。
 * 运行形态:手动 / 由 `scripts/run-reading-trust-defense.mjs` 调度。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

/** 本地未判定错误(本门不读仓库内容,故不引入 face-reader 的取材层)。 */
class Undetermined extends Error {}

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
/**
 * 本门读的三个文件**都不是被审的仓库内容**:① 自己的登记表(config)、② 提交信息(外部输入)、
 * ③ `.git/COMMIT_EDITMSG`(外部输入)。按门 118 的出路条款,这类"纯计算/外部输入"应当**不读 ROOT 锚点**,
 * 否则会被判成"按磁盘判仓库内容"。故这里的文件路径一律从脚本自身位置(HERE)推导。
 * 被审的"哪些门脚本被改"走 git 的 `--name-only`(纯路径清单,不取 blob 正文)。
 */
const REGISTRY_PATH = join(HERE, 'data', 'gate-owners.json')
const GATE_FILE_RE = /^scripts\/(?:check|scan|guard|verify)-[^/]+\.mjs$/
const TRAILER_RE = /^[ \t]*Gate-Owner:[ \t]*(.+?)[ \t]*$/gm

function parseArgs(argv) {
  const opts = { commit: 'HEAD', staged: false, json: false, message: null, messageFile: null, registry: REGISTRY_PATH }
  for (const a of argv) {
    if (a === '--staged') opts.staged = true
    else if (a === '--json') opts.json = true
    else if (a.startsWith('--commit=')) opts.commit = a.slice('--commit='.length)
    else if (a.startsWith('--message=')) opts.message = a.slice('--message='.length)
    else if (a.startsWith('--message-file=')) opts.messageFile = resolve(process.cwd(), a.slice('--message-file='.length))
    else if (a.startsWith('--registry=')) opts.registry = resolve(process.cwd(), a.slice('--registry='.length))
    else throw new Undetermined(`未知参数 ${a}`)
  }
  return opts
}

function loadRegistry(file) {
  try {
    const reg = JSON.parse(readFileSync(file, 'utf8'))
    if (!reg || typeof reg !== 'object') return { ok: false, error: '登记表不是对象' }
    if (!reg.owners || typeof reg.owners !== 'object') return { ok: false, error: '登记表缺 owners 对象' }
    if (!Array.isArray(reg.unowned)) return { ok: false, error: '登记表缺 unowned 数组(未登记的门必须显式列名)' }
    const owned = new Map()
    for (const [ownerId, meta] of Object.entries(reg.owners)) {
      const scripts = Array.isArray(meta?.scripts) ? meta.scripts : []
      for (const s of scripts) {
        const rel = `scripts/${s}`
        if (owned.has(rel)) return { ok: false, error: `登记表一槽多账:${rel} 同时登记给 ${owned.get(rel)} 与 ${ownerId}` }
        owned.set(rel, ownerId)
      }
    }
    const unowned = new Set(reg.unowned.map((u) => (typeof u === 'string' ? u : u?.script)).filter(Boolean).map((s) => `scripts/${s}`))
    for (const rel of owned.keys()) {
      if (unowned.has(rel)) return { ok: false, error: `登记表自相矛盾:${rel} 同时在 owners 与 unowned` }
    }
    return { ok: true, owned, unowned }
  } catch (e) {
    return { ok: false, error: `登记表不可读(${e.message})` }
  }
}

function gitRun(args) {
  const r = spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.error) throw new Undetermined(`git ${args[0]} 执行失败(${r.error.message})`)
  if (r.status !== 0) throw new Undetermined(`git ${args[0]} 退出 ${r.status}:${(r.stderr || '').trim().slice(0, 200)}`)
  return r.stdout
}

function changedGateScripts({ staged, commit }) {
  // 只取**路径清单**,不取 blob 正文:故用 diff/diff-tree 的 --name-only 形态。
  // (`git show` 在本仓门 118 里被登记为"内容类动词",写它会被判成散写读内容;而这里确实只数路径。)
  const raw = staged
    ? gitRun(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    : gitRun(['diff-tree', '-r', '--no-commit-id', '--name-only', '--diff-filter=ACMR', commit])
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => GATE_FILE_RE.test(s))
}

function commitMessage({ staged, commit, message, messageFile }) {
  if (message) return message
  if (messageFile) {
    if (!existsSync(messageFile)) throw new Undetermined(`提交信息文件不存在:${messageFile}`)
    return readFileSync(messageFile, 'utf8')
  }
  if (staged) {
    const fallback = join(HERE, '..', '.git', 'COMMIT_EDITMSG')
    if (!existsSync(fallback)) throw new Undetermined('--staged 模式缺提交信息(传 --message 或 --message-file)')
    return readFileSync(fallback, 'utf8')
  }
  return gitRun(['log', '-1', '--format=%B', commit])
}

function declaredOwners(message) {
  const set = new Set()
  TRAILER_RE.lastIndex = 0
  let m
  while ((m = TRAILER_RE.exec(message || '')) !== null) {
    for (const part of m[1].split(/[,，;；]/).map((s) => s.trim()).filter(Boolean)) set.add(part)
  }
  return set
}

/**
 * 纯判定(供镜像测试)。
 * @param {{changed:string[], owned:Map<string,string>, unowned:Set<string>, message:string}} arg
 */
export function judgeOwnerDeclarations({ changed, owned, unowned, message }) {
  const declared = declaredOwners(message)
  const missing = []
  const unownedChanged = []
  const uncovered = []
  for (const rel of changed) {
    const ownerId = owned.get(rel)
    if (ownerId === undefined) {
      if (unowned.has(rel)) unownedChanged.push(rel)
      else uncovered.push(rel)
      continue
    }
    if (!declared.has(ownerId) && !declared.has(rel) && !declared.has(rel.replace(/^scripts\//, ''))) missing.push({ rel, ownerId })
  }
  return { missing, unownedChanged, uncovered, declared: [...declared] }
}

function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`未判定:${e.message}`)
    process.exit(2)
  }
  const reg = loadRegistry(opts.registry)
  if (!reg.ok) {
    console.error(`未判定:${reg.error}`)
    process.exit(2)
  }

  let changed
  let message
  try {
    changed = changedGateScripts(opts)
    message = commitMessage(opts)
  } catch (e) {
    console.error(`未判定:${e.message}`)
    process.exit(2)
  }

  const r = judgeOwnerDeclarations({ changed, owned: reg.owned, unowned: reg.unowned, message })
  const summary = {
    mode: opts.staged ? 'staged' : `commit:${opts.commit}`,
    changedGates: changed.length,
    declared: r.declared,
    missing: r.missing.length,
    unownedChanged: r.unownedChanged.length,
    uncovered: r.uncovered.length,
  }

  if (opts.json) {
    console.log(JSON.stringify({ ...summary, ...r }, null, 2))
  } else {
    console.log(
      `门属主声明:${summary.mode} 改门=${summary.changedGates} 已声明=${summary.declared.join(',') || '(无)'} ` +
        `缺声明=${summary.missing} 未登记属主=${summary.unownedChanged} 登记表未覆盖=${summary.uncovered}`,
    )
    for (const m of r.missing) console.log(`  - ${m.rel} 属主=${m.ownerId},提交信息缺 \`Gate-Owner: ${m.ownerId}\``)
    if (r.unownedChanged.length > 0) {
      console.log('改动了未登记属主的门(不判红;请人工在 scripts/data/gate-owners.json 补登记):')
      for (const s of r.unownedChanged) console.log(`  - ${s}`)
    }
    if (r.uncovered.length > 0) {
      console.log('改动了登记表完全没覆盖的门(登记表不完整,需补登记):')
      for (const s of r.uncovered) console.log(`  - ${s}`)
    }
  }

  if (r.missing.length > 0 || r.uncovered.length > 0) process.exit(1)
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()

export { declaredOwners, loadRegistry }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
