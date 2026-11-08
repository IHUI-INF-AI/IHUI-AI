// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * gate-worker.mjs — 门结果缓存的后台预跑 CLI(2026-11-07 立,feat/gate-cache-1107)。
 *
 * 用法:
 *   node scripts/gate-worker.mjs <commit|tree sha> [...]
 *   node scripts/gate-worker.mjs --tree <tree sha> [--tree <sha> ...]
 *         [--gates 193,47p | --gate 193 --gate 47p] [--all]
 *         [--concurrency N] [--repo <path>] [--cache-dir <path>]
 *         [--timeout-ms N] [--keep] [--json] [--list-gates]
 *
 * 行为:
 *   1) 每个输入先归一成 **tree sha**(commit 走 `^{tree}`;tree 原样);
 *   2) 每个树用 `git archive` 解到临时目录 —— **不用 `git worktree`**,不污染共享 `.git`,
 *      也绝不读开发工作区;
 *   3) 解出来的树就地 `git init` 成一个隔离仓:HEAD = 这个 tree,索引 = 这个 tree;
 *      对象只从共享 `.git/objects` **只读**挂 alternates,新对象写进临时仓。
 *      这样需要 git 的门看到的是"这个树",不是开发者的 HEAD/索引;
 *   4) 每门独立临时目录 + 独立 TMPDIR(TEMP/TMP 同),互不共享工作目录;有界并发;
 *   5) 每门跑完写缓存;命中打印 `CACHE_HIT key=<key> ...` 并直接复用。
 *
 * 退出码:0 = 全部门 rc=0;1 = 有门 rc≠0;2 = 有「未判定」(取树失败/锁等待超时等)。
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { cpus } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  cacheDirFor,
  computeCacheKey,
  computeConfigHash,
  lookup,
  withGateCache,
} from './lib/gate-cache.mjs'
import { resolveGitdir, resolveGitBin } from './lib/gitdir.mjs'
import { assertMaterializedGateBody } from './lib/gate-body-provenance.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import {
  listTreeEntries,
  materializeTree,
  matchesSpecSet,
  otherLiveLease,
  pathSetKey,
  sweepUntracked,
} from './lib/tree-materialize.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPO = resolve(HERE, '..')
const REGISTRY_REL = join('scripts', 'data', 'gate-cache-registry.json')
const DEFAULT_TIMEOUT_MS = 300_000

/** 派生 git 一律显式接管 stdio(gate 193 的判据面);失败不抛,折成 rc。 */
function git(repo, args, { env, allowFail = false } = {}) {
  const res = spawnSync(resolveGitBin(), ['-C', repo, ...args], {
    env: env ?? process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  const out = { rc: res.status ?? (res.error ? 127 : 1), stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
  if (out.rc !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} 失败(rc=${out.rc}): ${out.stderr.split('\n')[0] || res.error?.message || ''}`)
  }
  return out
}

function usage() {
  return [
    '用法: node scripts/gate-worker.mjs <sha...> [选项]',
    '  --tree <sha>           指定 tree sha(可重复;与位置参数等价)',
    '  --gates a,b            只跑指定门 id(逗号分隔)',
    '  --gate <id>            只跑指定门(可重复)',
    '  --all                  跑注册表全部门(默认)',
    '  --concurrency N        并发上限(默认 min(4, CPU-1))',
    '  --repo <path>          仓库路径(默认本脚本所在仓)',
    '  --cache-dir <path>     缓存落点覆盖(默认 <真实 gitdir>/ihui-gate-cache/v1)',
    '  --timeout-ms N         单门超时(默认 300000)',
    '  --keep                 保留临时树(排查用)',
    '  --json                 输出机器可读汇总',
    '  --list-gates           只列注册表里的门',
  ].join('\n')
}

function parseArgs(argv) {
  const opts = {
    trees: [],
    gates: [],
    all: false,
    concurrency: null,
    repo: DEFAULT_REPO,
    cacheDir: null,
    timeoutMs: null,
    keep: false,
    json: false,
    listGates: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      const v = argv[i + 1]
      if (v === undefined) throw new Error(`${arg} 缺少参数`)
      i += 1
      return v
    }
    if (arg === '--tree') opts.trees.push(next())
    else if (arg === '--gates') opts.gates.push(...next().split(',').map((s) => s.trim()).filter(Boolean))
    else if (arg === '--gate') opts.gates.push(next())
    else if (arg === '--all') opts.all = true
    else if (arg === '--concurrency') opts.concurrency = Number(next())
    else if (arg === '--repo') opts.repo = resolve(next())
    else if (arg === '--cache-dir') opts.cacheDir = resolve(next())
    else if (arg === '--timeout-ms') opts.timeoutMs = Number(next())
    else if (arg === '--keep') opts.keep = true
    else if (arg === '--json') opts.json = true
    else if (arg === '--list-gates') opts.listGates = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg.startsWith('-')) throw new Error(`未知参数: ${arg}`)
    else opts.trees.push(arg)
  }
  return opts
}

function loadRegistry(repo) {
  const path = join(repo, REGISTRY_REL)
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.gates)) {
    throw new Error(`注册表格式不符(schemaVersion 须为 1): ${path}`)
  }
  const seen = new Set()
  for (const gate of parsed.gates) {
    if (!gate || typeof gate.id !== 'string' || gate.id === '') throw new Error('注册表条目缺 id')
    if (seen.has(gate.id)) throw new Error(`注册表 id 重复: ${gate.id}`)
    seen.add(gate.id)
    if (typeof gate.script !== 'string' || gate.script === '') throw new Error(`门 ${gate.id} 缺 script`)
    if (gate.args !== undefined && !Array.isArray(gate.args)) throw new Error(`门 ${gate.id} 的 args 必须是数组`)
    if (gate.inputs !== undefined && !Array.isArray(gate.inputs)) throw new Error(`门 ${gate.id} 的 inputs 必须是数组`)
  }
  return parsed
}

function resolveTree(repo, spec) {
  const out = git(repo, ['rev-parse', '--verify', `${spec}^{tree}`])
  const treeSha = out.stdout.trim()
  if (!/^[0-9a-f]{40,64}$/.test(treeSha)) throw new Error(`无法把 ${spec} 归一成 tree sha`)
  const type = git(repo, ['cat-file', '-t', treeSha]).stdout.trim()
  if (type !== 'tree') throw new Error(`${spec} 归一结果不是 tree(${type})`)
  return treeSha
}

/** 被测树里的 blob sha;取不到给 null(参与 configHash,不冒充"没变")。 */
function blobShaInTree(repo, treeSha, relPath) {
  const res = git(repo, ['rev-parse', '--verify', `${treeSha}:${relPath}`], { allowFail: true })
  const sha = res.stdout.trim()
  return res.rc === 0 && /^[0-9a-f]{40,64}$/.test(sha) ? sha : null
}

function toolVersionFor(repo, treeSha, gate) {
  if (typeof gate.toolVersion === 'string' && gate.toolVersion !== '') return gate.toolVersion
  const scriptSha = blobShaInTree(repo, treeSha, gate.script)
  const nodeMajor = process.versions.node.split('.')[0]
  return `node${nodeMajor}+${scriptSha ? scriptSha.slice(0, 16) : 'missing'}`
}

function configHashFor(repo, treeSha, gate) {
  const inputs = [...new Set(gate.inputs ?? [])]
  const blobShas = {}
  for (const relPath of inputs) blobShas[relPath] = blobShaInTree(repo, treeSha, relPath)
  return computeConfigHash({ inputs, blobShas, extra: gate.config ?? null })
}

/**
 * 子集物化的读取面验收:探针记录到的路径必须全部落在**该门自己声明的** path spec 内。
 * 盘上可能同时物化了别的门的路径(并集共享一份),所以判据用门自己的 spec,
 * 而不是物化用的并集 —— 多给了文件不等于允许读。
 *  · 门自己生成的文件(不在 tree 清单里)不算越界 —— 它们不是"树的物化面";
 *  · 目录枚举同样验:枚举到的目录必须已被完整物化(spec 命中 `<dir>/`),
 *    否则「少文件」会改变门的结论,一律判越界;
 *  · 没有探针输出 / 输出损坏 ⇒ 按越界处理(fail-closed,改走全树)。
 * 返回 { ok, reason, extraFiles, extraDirs, extraFileCount, extraDirCount }。
 */
function probeCoverage({ probeBase, material, manifest, specs }) {
  const dir = dirname(probeBase)
  const base = basename(probeBase)
  let names = []
  try {
    names = readdirSync(dir).filter((f) => f.startsWith(`${base}.`) && f.endsWith('.json'))
  } catch {
    names = []
  }
  if (names.length === 0) return { ok: false, reason: 'probe-missing', extraFileCount: 0, extraDirCount: 0, extraFiles: [], extraDirs: [] }
  const extraFiles = new Set()
  const extraDirs = new Set()
  for (const name of names) {
    let data
    try {
      data = JSON.parse(readFileSync(join(dir, name), 'utf8'))
    } catch {
      return { ok: false, reason: 'probe-corrupt', extraFileCount: 0, extraDirCount: 0, extraFiles: [], extraDirs: [] }
    }
    for (const p of [...(data.reads ?? []), ...(data.stats ?? [])]) {
      const rel = relative(material.dir, p).replace(/\\/g, '/')
      if (!rel || rel.startsWith('..')) continue
      if (!manifest.has(rel)) continue
      if (!matchesSpecSet(rel, specs)) extraFiles.add(rel)
    }
    for (const d of data.dirs ?? []) {
      const rel = relative(material.dir, d).replace(/\\/g, '/')
      if (!rel || rel.startsWith('..')) continue
      if (rel === '') extraDirs.add('.')
      else if (!matchesSpecSet(`${rel}/`, specs)) extraDirs.add(`${rel}/`)
    }
  }
  const ok = extraFiles.size === 0 && extraDirs.size === 0
  return {
    ok,
    reason: ok ? 'covered' : 'undeclared-read',
    extraFiles: [...extraFiles].slice(0, 12),
    extraDirs: [...extraDirs].slice(0, 12),
    extraFileCount: extraFiles.size,
    extraDirCount: extraDirs.size,
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    for (;;) {
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

async function main(argv) {
  let opts
  try {
    opts = parseArgs(argv)
  } catch (error) {
    console.error(`参数错误: ${error.message}\n${usage()}`)
    return 2
  }
  if (opts.help) {
    console.log(usage())
    return 0
  }

  const repo = opts.repo
  const registry = loadRegistry(repo)
  if (opts.listGates) {
    for (const gate of registry.gates) console.log(`${gate.id}\t${gate.script}\t${(gate.args ?? []).join(' ')}`)
    return 0
  }

  const selected = opts.gates.length > 0 ? registry.gates.filter((g) => opts.gates.includes(g.id)) : registry.gates
  if (selected.length === 0) {
    console.error(`没有任何门被选中(注册表 ${registry.gates.length} 条,请求: ${opts.gates.join(',') || '全部'})`)
    return 2
  }
  const unknown = opts.gates.filter((id) => !registry.gates.some((g) => g.id === id))
  if (unknown.length > 0) {
    console.error(`注册表里没有这些门: ${unknown.join(',')}`)
    return 2
  }

  if (opts.trees.length === 0) {
    console.error(`缺少被测树。\n${usage()}`)
    return 2
  }

  const cpusCount = cpus()?.length ?? 1
  const concurrency = Number.isInteger(opts.concurrency) && opts.concurrency > 0
    ? opts.concurrency
    : Math.max(1, Math.min(4, cpusCount - 1))

  const gitDir = resolveGitdir(repo)
  const cache = cacheDirFor({ gitDir, cacheDir: opts.cacheDir ?? undefined })

  const trees = []
  for (const spec of opts.trees) {
    try {
      trees.push({ spec, treeSha: resolveTree(repo, spec) })
    } catch (error) {
      console.error(`TREE_ERROR spec=${spec}: ${error.message}`)
      return 2
    }
  }

  const startedAll = Date.now()
  const materials = []
  const results = []
  const pending = []
  let undetermined = 0
  let jobs = 0

  // 先只算键、查缓存:全命中的树**根本不解包**(960MB 级的 tree 不该为了一次命中搬两遍)。
  for (const tree of trees) {
    for (const gate of selected) {
      jobs += 1
      const toolVersion = toolVersionFor(repo, tree.treeSha, gate)
      const configHash = configHashFor(repo, tree.treeSha, gate)
      const key = computeCacheKey({ treeSha: tree.treeSha, gateId: gate.id, toolVersion, configHash })
      const identity = {
        key,
        treeSha: tree.treeSha,
        gateId: gate.id,
        toolVersion,
        ...(opts.cacheDir ? { cacheDir: cache } : { gitDir }),
      }
      const hit = lookup(identity)
      if (hit.status === 'hit') {
        console.log(
          `CACHE_HIT key=${key} gate=${gate.id} tree=${tree.treeSha} rc=${hit.rc} green=${hit.green} source=direct`,
        )
        results.push({ gateId: gate.id, treeSha: tree.treeSha, key, ...hit, source: 'direct', durationMs: 0 })
      } else {
        pending.push({ tree, gate, identity, key, specs: gate.paths ?? 'full' })
      }
    }
  }

  /**
   * 清掉门落在物化树里的未跟踪残留(`.ihui-agent/state/*`、`.tsbuildinfo` 等)。
   * 缓存条目跨轮复用,不清就会与「整树全新解包」的旧行为分叉(实测 T1 输出会摆动);
   * 别人正占着同一份树时一律不动(避免删掉并发进程正在读的状态)。
   */
  const sweepMaterial = (material) => {
    if (otherLiveLease(material.dir)) return
    const { removedFiles, removedDirs } = sweepUntracked({
      repo,
      treeSha: material.treeSha,
      dir: material.dir,
    })
    if (removedFiles || removedDirs) {
      console.log(
        `TREE_SWEEP tree=${material.treeSha} set=${material.key} files=${removedFiles} dirs=${removedDirs}`,
      )
    }
  }

  /**
   * 每棵树只物化**一份**,由该树待跑的门决定它是什么:
   *   · 有全树门(T1 typecheck)在场 ⇒ 直接全树。全树是任何子集的超集,再解一份子集
   *     纯属重复落盘;实测让两者并行只会互相踩盘(945MB 那次从 50s 级退到 90s 级),
   *     所以这里**串行**、且只解这一份。
   *   · 没有全树门 ⇒ 解**所有子集门的并集**(实测 5,832 文件 / 119.75MB = 12.7% 字节)。
   *
   * 多门共享同一份(绝不各解一份);每门仍用**自己声明的 paths** 校验读取面 ——
   * 并集只是"盘上多了些门没声明的文件",门真去读一个字节就会被探针抓住并回落全树,
   * 判据强度与全量解包一致。
   */
  const materialPromises = new Map()
  const plannedSpecs = (tree) => {
    const items = pending.filter((p) => p.tree === tree)
    if (items.some((p) => p.specs === 'full')) return 'full'
    const union = items.flatMap((p) => (Array.isArray(p.specs) ? p.specs : []))
    return union.length > 0 ? [...new Set(union)] : 'full'
  }
  const materialFor = (tree, specs) => {
    const key = `${tree.treeSha}\0${pathSetKey(specs)}`
    if (!materialPromises.has(key)) {
      materialPromises.set(
        key,
        materializeTree({ repo, gitDir, treeSha: tree.treeSha, paths: specs, onProgress: (line) => console.log(line) }).then(
          (material) => {
            materials.push(material)
            // 命中即复用上一轮的目录:先清掉上一轮门留下的未跟踪残留,保证与"全新解包"同形。
            if (material.cacheHit) sweepMaterial(material)
            return material
          },
          (error) => {
            materialPromises.delete(key)
            throw error
          },
        ),
      )
    }
    return materialPromises.get(key)
  }
  const ensureFull = (tree) => materialFor(tree, 'full')

  // 先把每棵树的物化建起来(单次 archive,串行;失败的树整树门标 undetermined)。
  const runnable = []
  for (const tree of trees) {
    const items = pending.filter((p) => p.tree === tree)
    if (items.length === 0) continue
    try {
      await materialFor(tree, plannedSpecs(tree))
      runnable.push(...items)
    } catch (error) {
      console.error(`TREE_MATERIALIZE_ERROR tree=${tree.treeSha}: ${error.message}`)
      for (const item of items) {
        undetermined += 1
        results.push({
          gateId: item.gate.id,
          treeSha: item.tree.treeSha,
          key: item.key,
          status: 'undetermined',
          reason: 'materialize-failed',
          green: false,
          durationMs: 0,
        })
      }
    }
  }

  const runResults = await runPool(runnable, concurrency, async ({ tree, gate, identity, key, specs }) => {
    const material = await materialFor(tree, plannedSpecs(tree))
    const gateScratch = mkScratch(`gate-worker-${gate.id.replace(/[^A-Za-z0-9_.-]/g, '_')}-`)
    const gateTmp = join(gateScratch, 'tmp')
    mkdirSync(gateTmp, { recursive: true })
    const probeBase = join(gateScratch, 'read-probe')
    // 树已被全树物化(有全树门在场)⇒ 这棵树上的每个门都拿到完整读取面,不必探针也不必回落。
    const fullTree = material.specs === 'full'
    const manifest = fullTree ? null : listTreeEntries(repo, tree.treeSha)
    const execute = (mat, { probe }) => {
      // 2026-11-08:物化树没有 .git(cwd 在 scratch 外),不能装 gate-body preflight;
      // 这里用 repo 侧的同一把尺子预校验:「物化出来的门体 == 被判树里那一份」。
      // 不一致 ⇒ 该门未判定(rc=2 + 自称未判定),绝不拿错代门体作答 0/1。
      try {
        assertMaterializedGateBody({ repo, treeSha: tree.treeSha, script: gate.script })
      } catch (e) {
        if (e?.exitCode === 2) {
          return { rc: 2, stdout: '', stderr: `${e.message}\n` }
        }
        throw e
      }
      const env = { ...mat.isoEnv, TMPDIR: gateTmp, TMP: gateTmp, TEMP: gateTmp }
      if (probe) {
        env.NODE_OPTIONS = `${env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ` : ''}--import ${pathToFileURL(join(HERE, 'lib', 'gate-read-probe.mjs')).href}`
        env.IHUI_READ_PROBE_BASE = probeBase
        env.IHUI_READ_PROBE_ROOT = mat.dir
      }
      const res = spawnSync(process.execPath, [join(mat.dir, gate.script), ...(gate.args ?? [])], {
        cwd: gateScratch,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: opts.timeoutMs ?? gate.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
      })
      const timedOut = res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGTERM'
      return {
        rc: timedOut ? 124 : (res.status ?? 1),
        stdout: res.stdout ?? '',
        stderr: `${res.stderr ?? ''}${timedOut ? '\n[gate-worker] timeout' : ''}`,
      }
    }
    try {
      const outcome = await withGateCache({
        ...identity,
        run: async () => {
          if (fullTree) return execute(material, { probe: false })
          // 子集:门照常跑,探针只记录读取面;判据仍是门自己的 rc/输出。
          // 一旦触到自己的声明集之外的树路径(含目录枚举),立刻换全树重跑 ——
          // 绝不拿"少文件"或"多给了别的门的文件"当结论。
          const res = execute(material, { probe: true })
          const coverage = probeCoverage({ probeBase, material, manifest, specs })
          if (coverage.ok) return res
          console.log(
            `SUBSET_FALLBACK gate=${gate.id} tree=${tree.treeSha} reason=${coverage.reason} extraFiles=${coverage.extraFileCount} extraDirs=${coverage.extraDirCount} samples=${JSON.stringify([...coverage.extraFiles, ...coverage.extraDirs].slice(0, 6))}`,
          )
          const full = await ensureFull(tree)
          return execute(full, { probe: false })
        },
      })

      if (outcome.status === 'hit') {
        console.log(
          `CACHE_HIT key=${key} gate=${gate.id} tree=${tree.treeSha} rc=${outcome.rc} green=${outcome.green} source=${outcome.source}`,
        )
      } else if (outcome.status === 'run') {
        console.log(
          `GATE_RUN  key=${key} gate=${gate.id} tree=${tree.treeSha} rc=${outcome.rc} durationMs=${outcome.durationMs}`,
        )
      } else {
        console.log(`UNDETERMINED key=${key} gate=${gate.id} tree=${tree.treeSha} reason=${outcome.reason}`)
      }
      return { gateId: gate.id, treeSha: tree.treeSha, key, ...outcome }
    } finally {
      rmScratch(gateScratch)
    }
  })
  results.push(...runResults)

  const wallMs = Date.now() - startedAll
  const hits = results.filter((r) => r.status === 'hit')
  const runs = results.filter((r) => r.status === 'run')
  const undecided = results.filter((r) => r.status === 'undetermined')
  undetermined = undecided.length
  const failed = results.filter((r) => r.status !== 'hit' && r.status !== 'run')
  const reds = results.filter((r) => (r.status === 'run' || r.status === 'hit') && r.rc !== 0)
  const coldMs = runs.reduce((sum, r) => sum + (r.durationMs ?? 0), 0)
  const savedMs = hits.reduce((sum, r) => sum + (r.record?.durationMs ?? 0), 0)

  if (!opts.keep) {
    // 跑完把门留下的未跟踪残留清干净:缓存条目要留给下一轮,必须是"刚解包"的样子。
    for (const material of materials) sweepMaterial(material)
    for (const material of materials) material.release()
  } else {
    for (const material of materials) console.log(`KEEP tree=${material.dir}`)
  }

  const summary = {
    trees: trees.length,
    gates: selected.length,
    jobs,
    hits: hits.length,
    runs: runs.length,
    undetermined: undetermined + failed.length,
    reds: reds.length,
    coldMs,
    savedMs,
    wallMs,
    cacheDir: cache,
    results: results.map((r) => ({
      gateId: r.gateId,
      treeSha: r.treeSha,
      key: r.key,
      status: r.status,
      rc: r.rc ?? null,
      green: r.green ?? false,
      reason: r.reason ?? null,
      durationMs: r.durationMs ?? r.record?.durationMs ?? 0,
      source: r.source ?? null,
    })),
  }
  console.log(`SUMMARY ${JSON.stringify(summary)}`)
  if (opts.json) console.log(JSON.stringify(summary))

  if (undetermined + failed.length > 0) return 2
  return reds.length > 0 ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`gate-worker 崩溃: ${error?.stack ?? error}`)
      process.exit(2)
    })
}

export { main, loadRegistry, resolveTree, materializeTree }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
