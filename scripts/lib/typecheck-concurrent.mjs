// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 并发执行各 workspace 包的 typecheck(2026-11-07 立,T1 提速)。
 *
 * 为什么可以并发:各包 tsconfig 里**没有任何 project references**(`references` 全空),
 * 包间只通过 node_modules 里已构建的 `dist` 交换类型 —— typecheck 阶段彼此无依赖边。
 * 因此 `pnpm -r run typecheck` 的串行只是执行方式,不是判据要求。
 *
 * 判据强度零变化:
 *   - 每个包仍是**原脚本原样**(`pnpm --filter <name> run typecheck`),不绕过任何检查;
 *   - 每包 stdout/stderr **逐字节保留**,完成即输出(不攒到最后,也不截断);
 *   - 任包 rc!=0 ⇒ 整体非零退出;不因并发而提前终止其它包(否则错误会被吃掉)。
 *
 * 并发上限由机器决定,不写死:逻辑核数与可用内存各算一个上限取小。
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { cpus, totalmem } from 'node:os'

/** 单任务按 2GB 估算(tsc 大包 RSS 实测 1~3GB),另给系统留 4GB。 */
export const PER_TASK_MEM_BYTES = 2 * 1024 ** 3
export const RESERVED_MEM_BYTES = 4 * 1024 ** 3
/** 留一个核给调度/IO,避免 20 核机器上 20 个 tsc 互相抢。 */
export const RESERVED_CPUS = 1

/**
 * 算并发上限。env `IHUI_TYPECHECK_CONCURRENCY` 可显式覆盖(仅供夹具/排障;
 * 生产默认值必须由机器面推导,不写死)。
 * @returns {{limit:number, basis:string}}
 */
export function resolveConcurrency({
  cpuCount = cpus().length,
  totalMemBytes = totalmem(),
  perTaskMemBytes = PER_TASK_MEM_BYTES,
  reservedMemBytes = RESERVED_MEM_BYTES,
  reservedCpus = RESERVED_CPUS,
  env = process.env,
} = {}) {
  const override = env.IHUI_TYPECHECK_CONCURRENCY
  if (override !== undefined && override !== '') {
    const n = Number(override)
    if (Number.isInteger(n) && n > 0) {
      return { limit: n, basis: `env IHUI_TYPECHECK_CONCURRENCY=${n}` }
    }
  }
  const byCpu = Math.max(1, cpuCount - reservedCpus)
  const byMem = Math.max(1, Math.floor((totalMemBytes - reservedMemBytes) / perTaskMemBytes))
  const limit = Math.max(1, Math.min(byCpu, byMem))
  return {
    limit,
    basis: `逻辑核 ${cpuCount} → 上限 ${byCpu};内存 ${(totalMemBytes / 1024 ** 3).toFixed(1)}GB(每任务 ${(perTaskMemBytes / 1024 ** 3).toFixed(1)}GB、预留 ${(reservedMemBytes / 1024 ** 3).toFixed(1)}GB)→ 上限 ${byMem};取小 = ${limit}`,
  }
}

/**
 * 固定并发上限的池化调度(纯调度,不做 IO)。
 * worker 必须自己吞掉异常或返回结果;这里对抛错兜底成 `{error}`,不中断其它任务。
 */
export async function poolMap(items, limit, worker) {
  const results = new Array(items.length)
  const width = Math.max(1, Math.min(limit, items.length))
  let next = 0
  let active = 0
  return new Promise((resolve) => {
    const pump = () => {
      while (active < width && next < items.length) {
        const i = next++
        active++
        Promise.resolve()
          .then(() => worker(items[i], i))
          .then(
            (r) => {
              results[i] = r
              active--
              pump()
            },
            (error) => {
              results[i] = { ok: false, error }
              active--
              pump()
            },
          )
      }
      if (active === 0 && next >= items.length) resolve(results)
    }
    pump()
  })
}

/** 递归扫 apps/ 与 packages/ 下带非空 typecheck 脚本的 workspace 包(pnpm -r 的射程,不含根包)。 */
export function discoverTypecheckProjects(root) {
  const out = []
  for (const base of ['apps', 'packages']) {
    const dir = join(root, base)
    if (!existsSync(dir)) continue
    for (const name of readdirSafe(dir)) {
      const pkgDir = join(dir, name)
      const manifestPath = join(pkgDir, 'package.json')
      if (!existsSync(manifestPath)) continue
      let manifest
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      } catch {
        continue
      }
      const script = String(manifest?.scripts?.typecheck ?? '').trim()
      if (!script) continue
      out.push({
        name: manifest.name || `${base}/${name}`,
        dir: pkgDir,
        script,
        // shell 模式下列 + args 混传会触发 DEP0190(参数未转义);整条命令一起传,语义等价。
        command: `pnpm --filter ${manifest.name || `${base}/${name}`} run typecheck`,
        args: [],
      })
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function readdirSafe(dir) {
  try {
    // 只取目录名,避免把 README 之类当成包
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }
}

/**
 * workspace 包依赖图(name → 只保留 workspace 内依赖)。
 * 用于 build 前置的拓扑分层:被依赖包的 dist 必须先就位,typecheck 才读得到正确类型。
 */
export function workspaceDependencyGraph(root) {
  const graph = new Map()
  const pkgDirs = []
  for (const base of ['apps', 'packages']) {
    const dir = join(root, base)
    if (!existsSync(dir)) continue
    for (const name of readdirSafe(dir)) {
      const manifestPath = join(dir, name, 'package.json')
      if (existsSync(manifestPath)) pkgDirs.push(join(dir, name, 'package.json'))
    }
  }
  const names = new Set()
  for (const p of pkgDirs) {
    try {
      const m = JSON.parse(readFileSync(p, 'utf8'))
      if (m.name) names.add(m.name)
    } catch {
      /* 坏包清单:skip,别让前置整体炸掉 */
    }
  }
  for (const p of pkgDirs) {
    try {
      const m = JSON.parse(readFileSync(p, 'utf8'))
      if (!m.name) continue
      const deps = new Set(
        Object.keys({ ...m.dependencies, ...m.devDependencies, ...m.peerDependencies }).filter((d) =>
          names.has(d),
        ),
      )
      graph.set(m.name, deps)
    } catch {
      /* 同上 */
    }
  }
  return graph
}

/**
 * Kahn 拓扑分层:第 0 层无 workspace 依赖,后续层只依赖更前层。
 * 环(理论上不该有)兜底:把剩余节点整体并入下一层并在 basis 里说明,不让前置死循环。
 * @returns {{layers:string[][], cycle:string[]}}
 */
export function topoLayers(names, graph) {
  const layers = []
  const remaining = new Set(names)
  while (remaining.size > 0) {
    const layer = [...remaining]
      .filter((n) => [...(graph.get(n) || [])].every((d) => !remaining.has(d)))
      .sort()
    if (layer.length === 0) {
      const cycle = [...remaining].sort()
      layers.push(cycle)
      return { layers, cycle }
    }
    for (const n of layer) remaining.delete(n)
    layers.push(layer)
  }
  return { layers, cycle: [] }
}

/** 正在跑的子进程集合(信号清场用)。 */
const activeChildren = new Set()

/** 终止某棵子进程树(win32 taskkill /T /F;其余 SIGKILL),与 check-typecheck 同语义。 */
export function killChildTree(child) {
  if (!child || !child.pid) return
  try {
    if (process.platform === 'win32') {
      // 必须在 exit/SIGINT 回调里也能跑完:异步 spawn 在 exit 事件中不保证执行,
      // 会留下一串吃 CPU 的 tsc/pnpm(应与 check-typecheck 的组杀同效)。
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } else {
      child.kill('SIGKILL')
    }
  } catch {
    try {
      child.kill('SIGKILL')
    } catch {
      /* 忽略 */
    }
  }
}

/** 清场所有在飞包(信号/超时路径调用)。 */
export function killActiveChildren() {
  for (const c of activeChildren) killChildTree(c)
  activeChildren.clear()
}

/**
 * 跑一个包,收集**完整**输出。
 * @returns {Promise<{name, rc, signal, ms, stdout, stderr, errorTS, timedOut}>}
 */
export function runOneProject(project, { spawnImpl = spawn, root } = {}) {
  const startedAt = Date.now()
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let child
    try {
      child = spawnImpl(project.command, project.args, {
        cwd: project.dir || root,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        windowsHide: true,
        env: { ...process.env, IHUI_TYPECHECK_FULL_CHILD: '1' },
      })
    } catch (e) {
      resolve({
        name: project.name,
        rc: null,
        signal: null,
        ms: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}spawn 失败: ${e?.message ?? e}\n`,
        errorTS: 0,
        timedOut: false,
      })
      return
    }
    activeChildren.add(child)
    child.stdout?.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', (e) => {
      stderr += `spawn 失败: ${e?.message ?? e}\n`
    })
    child.on('close', (rc, signal) => {
      activeChildren.delete(child)
      resolve({
        name: project.name,
        rc: typeof rc === 'number' ? rc : null,
        signal: signal ?? null,
        ms: Date.now() - startedAt,
        stdout,
        stderr,
        errorTS: countErrorTS(`${stdout}\n${stderr}`),
        timedOut: false,
      })
    })
  })
}

export function countErrorTS(text) {
  return (text.match(/error TS\d+/g) || []).length
}

/**
 * 并发跑全部包,完成即输出(错误文本原样),最后给逐包 rc 汇总。
 * @returns {Promise<{results, ok, exitCode}>}
 */
export async function runTypecheckProjects({
  projects,
  concurrency,
  root,
  spawnImpl = spawn,
  out = (...a) => process.stdout.write(a.join(' ') + '\n'),
  err = (...a) => process.stderr.write(a.join(' ') + '\n'),
  writeStdout = (s) => process.stdout.write(s),
  writeStderr = (s) => process.stderr.write(s),
} = {}) {
  const startedAt = Date.now()
  const poolStarted = Date.now()
  const results = await poolMap(projects, concurrency, async (p) => {
    const r = await runOneProject(p, { spawnImpl, root })
    out(
      `\n──── [typecheck:full] ${p.name} 完成 rc=${r.rc ?? '?'}${r.signal ? ` signal=${r.signal}` : ''} ${r.ms}ms ────`,
    )
    // 关键:pnpm -r 会给每行加 `<包目录>: ` 前缀,check-typecheck 的报错路径解析器
    // (以及既有降级判据)都按这个形状认路径。并发版如果丢掉前缀,`src/x.ts(1,1)` 会被
    // 当成仓根相对路径 → 降级判据错位。这里逐行补回,前缀之后原文一字不改。
    const relDir = relative(root, p.dir).replace(/\\/g, '/')
    const withPrefix = (text) =>
      text
        .split('\n')
        .map((line) => (line.length > 0 ? `${relDir}: ${line}` : line))
        .join('\n')
    if (r.stdout) writeStdout(withPrefix(r.stdout.endsWith('\n') ? r.stdout : `${r.stdout}\n`))
    if (r.stderr) writeStderr(withPrefix(r.stderr.endsWith('\n') ? r.stderr : `${r.stderr}\n`))
    return r
  })
  const elapsedMs = Date.now() - poolStarted
  const failed = results.filter((r) => r.rc !== 0)
  out(
    `[typecheck:full] 并发 typecheck 结束:${projects.length - failed.length}/${projects.length} 包 rc=0,` +
      `${failed.length} 包失败,墙钟 ${elapsedMs}ms(本次总 ${Date.now() - startedAt}ms)`,
  )
  for (const r of results) {
    out(`  - ${r.name}: rc=${r.rc ?? '?'} ${r.ms}ms${r.errorTS ? ` error TS=${r.errorTS}` : ''}`)
  }
  if (failed.length > 0) {
    err(`[typecheck:full] ❌ 以下包未通过:${failed.map((r) => `${r.name}(rc=${r.rc ?? '?'})`).join(', ')}`)
  }
  return { results, ok: failed.length === 0, exitCode: failed.length ? failed[0].rc ?? 1 : 0 }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
