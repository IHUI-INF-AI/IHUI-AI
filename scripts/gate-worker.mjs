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
import { existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs'
import { cpus } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  cacheDirFor,
  computeCacheKey,
  computeConfigHash,
  lookup,
  withGateCache,
} from './lib/gate-cache.mjs'
import { resolveGitdir, resolveGitBin } from './lib/gitdir.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

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
 * 把 tree 解成"隔离可跑仓"。返回 { dir, isoEnv }。
 * 只读共享 .git/objects(alternates),所有新对象写进临时 .git —— 不产生任何共享写。
 */
function materializeTree({ repo, gitDir, treeSha, onProgress }) {
  const scratch = mkScratch('gate-worker-tree-')
  try {
    return materializeTreeIn({ scratch, repo, gitDir, treeSha, onProgress })
  } catch (error) {
    rmScratch(scratch)
    throw error
  }
}

function materializeTreeIn({ scratch, repo, gitDir, treeSha, onProgress }) {
  const extractDir = join(scratch, 'tree')
  mkdirSync(extractDir, { recursive: true })
  const tarPath = join(scratch, 'tree.tar')

  git(repo, ['archive', '--format=tar', `--output=${tarPath}`, treeSha])
  // cwd + 相对路径:Windows 的 tar 会把 `C:\...` 当成"远端主机 C",绝对路径同样会被转义坏。
  const tar = spawnSync('tar', ['-xf', 'tree.tar', '-C', 'tree'], {
    cwd: scratch,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  })
  if ((tar.status ?? 1) !== 0) {
    throw new Error(`解包失败(rc=${tar.status}): ${(tar.stderr ?? '').split('\n')[0]}`)
  }

  // 依赖目录不是"工作区源码":用 junction 只读复用,树里的源码全部来自 archive。
  const srcModules = join(repo, 'node_modules')
  const dstModules = join(extractDir, 'node_modules')
  if (existsSync(srcModules) && !existsSync(dstModules)) {
    try {
      symlinkSync(srcModules, dstModules, 'junction')
    } catch {
      onProgress?.(`WARN node_modules junction 建不起来:${dstModules}`)
    }
  }

  const isoGitDir = join(extractDir, '.git')
  const isoEnv = {
    ...process.env,
    GIT_DIR: isoGitDir,
    GIT_WORK_TREE: extractDir,
    GIT_INDEX_FILE: join(isoGitDir, 'index'),
    GIT_OBJECT_DIRECTORY: join(isoGitDir, 'objects'),
    GIT_ALTERNATE_OBJECT_DIRECTORIES: join(gitDir, 'objects'),
    GIT_AUTHOR_NAME: 'gate-cache',
    GIT_AUTHOR_EMAIL: 'gate-cache@localhost',
    GIT_COMMITTER_NAME: 'gate-cache',
    GIT_COMMITTER_EMAIL: 'gate-cache@localhost',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00 +0000',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00 +0000',
  }

  git(extractDir, ['init', '--quiet'])
  const commit = git(extractDir, ['commit-tree', treeSha, '-m', `gate-cache tree ${treeSha}`], { env: isoEnv })
    .stdout.trim()
  git(extractDir, ['update-ref', 'refs/heads/gate-cache', commit], { env: isoEnv })
  git(extractDir, ['symbolic-ref', 'HEAD', 'refs/heads/gate-cache'], { env: isoEnv })
  git(extractDir, ['read-tree', 'HEAD'], { env: isoEnv })

  return { scratch, dir: extractDir, isoEnv }
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
  const materialsByTree = new Map()
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
        pending.push({ tree, gate, identity, key })
      }
    }
  }

  if (pending.length > 0) {
    const pendingTrees = [...new Map(pending.map((p) => [p.tree.treeSha, p.tree])).values()]
    for (const tree of pendingTrees) {
      try {
        const material = materializeTree({ repo, gitDir, treeSha: tree.treeSha })
        materials.push(material)
        materialsByTree.set(tree.treeSha, material)
      } catch (error) {
        console.error(`TREE_MATERIALIZE_ERROR tree=${tree.treeSha}: ${error.message}`)
        for (const item of pending.filter((p) => p.tree.treeSha === tree.treeSha)) {
          undetermined += 1
          results.push({
            gateId: item.gate.id,
            treeSha: tree.treeSha,
            key: item.key,
            status: 'undetermined',
            reason: 'materialize-failed',
            green: false,
            durationMs: 0,
          })
        }
      }
    }
  }

  const runnable = pending.filter((p) => materialsByTree.has(p.tree.treeSha))
  const runResults = await runPool(runnable, concurrency, async ({ tree, gate, identity, key }) => {
    const material = materialsByTree.get(tree.treeSha)
    const gateScratch = mkScratch(`gate-worker-${gate.id.replace(/[^A-Za-z0-9_.-]/g, '_')}-`)
    const gateTmp = join(gateScratch, 'tmp')
    mkdirSync(gateTmp, { recursive: true })
    try {
      const outcome = await withGateCache({
        ...identity,
        run: () => {
          const res = spawnSync(process.execPath, [join(material.dir, gate.script), ...(gate.args ?? [])], {
            cwd: gateScratch,
            env: { ...material.isoEnv, TMPDIR: gateTmp, TMP: gateTmp, TEMP: gateTmp },
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
    for (const material of materials) rmScratch(material.scratch)
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
