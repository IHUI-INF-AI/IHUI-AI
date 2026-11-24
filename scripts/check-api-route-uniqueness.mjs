#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-api-route-uniqueness.mjs —— Fastify **同一 `(method, path)` 被注册两次**的提交门(门 269)
 *
 * ## 立因
 * 同一 `(method,path)` 注册两次时 Fastify 只在**装配期**抛 `Method 'GET' already declared`,
 * 提交链零判据 ⇒ 单元测试各装各的插件、门 8 只判「前端调用有没有后端在册」,两型都看不见。
 * 实发:`/api/coupons/available` 被两枚提交各注册一次(枚 `36f6c451f8` / `4c51d614ee`),
 * IHUI-API-BLUE 19:08/19:53 两轮各等满 120s 未就绪(修复枚 `399dc2969c`)。
 *
 * ## 判据
 * 判据层 = `scripts/lib/api-route-uniqueness.mjs`(纯函数,零 IO);取材**不另造挂载图**,
 * 直接吃守门 8 的唯一实现 `route-registration-extract.mjs::extractApiRegistrations`。
 * 本脚本只做**取材 + 排版 + 出口码**,一行判据都不重写(§22c / §0.6)。
 *
 * ## 面(§0.4 同面同轮)
 *  - 默认(全量):判 **HEAD blob**,棘轮基线 = `HEAD^`;
 *  - `--staged`:判**索引 blob**,棘轮基线 = `HEAD`;
 *  - `--worktree`:仅人工/夹具逃生舱(判磁盘),基线 = `HEAD`。
 * 两面旗同给 ⇒ 用法错 exit 2。面取不到 ⇒ **exit 2 显式未判定**,绝不回落另一个面。
 *
 * ## 出口码
 *  - `0` 判过(存量重复只报数,不判红 —— 棘轮锚点 = 基线面自身重复数);
 *  - `1` 判出**本次新增**重复(逐条点名 method + path + 两处注册位置);
 *  - `2` 未判定(取材面空转 / 基线不可得却已有重复 / 旗标不认识 / 面取不到)。
 *
 * 用法:`node scripts/check-api-route-uniqueness.mjs [--staged|--worktree] [--self-test] [--json]`
 * 跳过:`HUSKY_SKIP_API_ROUTE_UNIQUENESS=1`(应急,须带 `HUSKY_SKIP_REASON`)
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DEFAULT_ENTRY_TS,
  __test__ as routeExtractTest,
} from './lib/route-registration-extract.mjs'
import {
  EXCLUDE_LABEL,
  EXCLUDE_REASON,
  __test__ as uniqTest,
  analyzeRouteUniqueness,
  decideExitCode,
} from './lib/api-route-uniqueness.mjs'
import {
  catBatch,
  describeProbe,
  gitRaw,
  listFaceFiles,
  probeFaceSpec,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 取材射程:Fastify 组合根与业务路由都在这里(`stagedTriggers: apps/api/`)。 */
const SCOPE_DIR = 'apps/api/src'
const BATCH_TIMEOUT = 180_000

const USAGE =
  '用法: node scripts/check-api-route-uniqueness.mjs [--staged|--worktree] [--self-test] [--json]'
const KNOWN_FLAGS = new Set(['--staged', '--worktree', '--self-test', '--json'])

/** 输出:纯文本、无 emoji(§「不加 emoji」),结论行首带状态词便于 grep。 */
const log = (s = '') => console.log(s)

/** 枚举某一 rev 下的取材射程路径(空数组由调用方判「枚举到 0」)。 */
function listAtRev(rev) {
  const out = gitRaw(['ls-tree', '-r', '--name-only', '-z', rev, '--', SCOPE_DIR], ROOT, {
    timeout: BATCH_TIMEOUT,
  })
  return String(out)
    .split('\u0000')
    .map((p) => p.replaceAll('\\', '/'))
    .filter((p) => p.length > 0)
}

/**
 * 读一面。`head` 档的 `rev` 决定读哪一枚提交(HEAD / HEAD^);`staged` 档读索引 blob;
 * `worktree` 档读磁盘(tracked 集合,人工逃生舱)。
 * @param {'head'|'staged'|'worktree'} face
 * @param {string} rev 仅 `head` 档生效
 * @returns {{ok:true, files:Map<string,string>, listed:number, unreadable:string[]}|{ok:false, error:string}}
 */
function readFace(face, rev) {
  const ref = rev || 'HEAD'
  try {
    const listed =
      face === 'worktree'
        ? listFaceFiles(ROOT, 'worktree', { paths: [SCOPE_DIR], timeout: BATCH_TIMEOUT })
        : face === 'staged'
          ? listFaceFiles(ROOT, 'staged', { paths: [SCOPE_DIR], timeout: BATCH_TIMEOUT })
          : listAtRev(ref)
    const paths = [...new Set(listed.map((p) => p.replaceAll('\\', '/')))]
      .filter((p) => p.endsWith('.ts') && !p.endsWith('.d.ts'))
      .sort()
    if (paths.length === 0)
      return {
        ok: false,
        error: `${face}${face === 'head' ? `@${ref}` : ''} 面 ${SCOPE_DIR} 下一个 .ts 都没有`,
      }
    const files = new Map()
    const unreadable = []
    if (face === 'worktree') {
      for (const p of paths) {
        const text = readWorktreeFile(ROOT, p)
        if (typeof text !== 'string') unreadable.push(p)
        else files.set(p, text)
      }
    } else {
      const specs = paths.map((p) => (face === 'staged' ? `:${p}` : `${ref}:${p}`))
      const got = catBatch(ROOT, specs, { timeout: BATCH_TIMEOUT, maxBuffer: 1 << 29 })
      paths.forEach((p, i) => {
        const text = got.get(specs[i])
        if (typeof text !== 'string') unreadable.push(p)
        else files.set(p, text)
      })
    }
    if (files.size === 0)
      return { ok: false, error: `${face} 面 ${paths.length} 个文件一个都读不到` }
    return { ok: true, files, listed: paths.length, unreadable }
  } catch (e) {
    const spec = `${ref}:${DEFAULT_ENTRY_TS}`
    return {
      ok: false,
      error: `${face}${face === 'head' ? `@${ref}` : ''} 面取不到:${String(e?.message ?? e).split('\n')[0]}(${describeProbe(
        probeFaceSpec(ROOT, spec),
      )})`,
    }
  }
}

/** 可见性:把不可判定档位排成一行(0 条也打,免得「没看见」被读成「没有」)。 */
function exclusionLine(excludeByReason) {
  return Object.values(EXCLUDE_REASON)
    .map((r) => `${r} ${excludeByReason[r] ?? 0}`)
    .join(' · ')
}

/** 逐条点名:重复键 + 每个注册站点。 */
function printDuplicates(title, list) {
  log(`${title} ${list.length} 条重复路由:`)
  for (const d of list) {
    log(`  ${d.key} —— ${d.sites.length} 处注册${d.baseCount ? `(基线 ${d.baseCount} 处)` : ''}`)
    for (const s of d.sites) log(`    - ${s.file}:${s.line} (via=${s.via || 'graph'})`)
  }
}

function renderText(result, { face, baseRef, exitCode }) {
  log(`[API 路由唯一性] 面: ${face} · 棘轮基线: ${baseRef || '不可得'}`)
  if (result.baseline === null)
    log(`[API 路由唯一性] 基线不可得( ${baseRef || '-'} 取不到)⇒ 只能判绝对重复,新增/存量分不清`)
  log(
    `取材面: 文件 ${result.files} · 挂载图条目 ${result.entries} · 可判定 ${result.determinable} · ` +
      `不可判定 ${result.excluded.length}(${exclusionLine(result.excludeByReason)})`,
  )
  log(
    `图侧报数(不是结论): 未判定 ${result.graph.undetermined} · 不透明前缀 ${result.graph.opaque} · ` +
      `图走不到的函数 ${result.graph.unreached}`,
  )
  for (const c of result.collisions)
    for (const g of c.groups)
      log(
        `不可判定(内联别名塌陷): ${c.file} ${g.fn}(${g.param}) × ${g.blocks.length} 块 ` +
          `[${g.blocks.map((b) => `${b.prefix || '(无前缀)'}@${b.startLine}-${b.endLine}`).join(', ')}]`,
      )
  log(
    `重复: 本次 ${result.duplicates.length} 键 / ${result.ratchet ? result.ratchet.currentCount : result.duplicates.reduce((a, d) => a + d.sites.length, 0)} 站点` +
      (result.ratchet ? ` · 基线 ${result.ratchet.baseCount} 站点` : ''),
  )
  if (result.ratchet && result.ratchet.fixed.length > 0)
    log(`比基线减少(只报数): ${result.ratchet.fixed.join(', ')}`)
  if (result.paramAdvisories.length > 0) {
    log(
      `参数名差异(旁路报数,不判红;方法+路径形状相同而参数名不同): ${result.paramAdvisories.length} 组`,
    )
    for (const p of result.paramAdvisories)
      log(`  ${p.key} ← ${p.variants.map((v) => v.path).join(' / ')}`)
  }
  if (result.ratchet && result.ratchet.regressed.length > 0)
    printDuplicates('新增(本次比基线多):', result.ratchet.regressed)
  else if (result.duplicates.length > 0) printDuplicates('存量(不判红,只报数):', result.duplicates)
  if (result.ratchet && result.ratchet.regressed.length > 0) {
    log(
      `[FAIL] 本次新增 ${result.ratchet.regressed.length} 条重复路由 —— 同一 (method,path) 注册两次会在装配期抛 Method already declared`,
    )
    log(`[FAIL] 存量 ${result.ratchet.baseCount} 站点(基线面)不受本门判红;修法见各条站点位置`)
  } else if (exitCode === 2) {
    log('[UNDETERMINED] 未判定:见上方原因(取材面空转 / 基线不可得却已有重复);不记绿也不判红')
  } else {
    log(`[OK] 判过:本次没有新增重复路由(可判定站点 ${result.determinable} 个)`)
  }
}

/**
 * 自检:`--self-test` 的口径。判据全在 lib,**这里只造输入、断言输出方向**
 * (含「摘掉即翻红」的成对夹具:同前缀两处 → 红;分前缀 → 绿)。
 */
function runSelfTest() {
  const cases = []
  const ok = (name, fn) => {
    try {
      fn()
      cases.push({ name, pass: true })
    } catch (e) {
      cases.push({ name, pass: false, error: String(e?.message ?? e) })
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }

  const plugin = (name) => `
import type { FastifyPluginAsync } from 'fastify'
export const ${name}: FastifyPluginAsync = async (server) => {
  server.get('/x', async () => 'ok')
}
`
  const mkFiles = (serverBody) => {
    const files = new Map()
    files.set(
      DEFAULT_ENTRY_TS,
      `import { aRoutes } from './routes/a.js'\nimport { bRoutes } from './routes/b.js'\nexport async function buildServer(server) {\n${serverBody}\n}\n`,
    )
    files.set('apps/api/src/routes/a.ts', plugin('aRoutes'))
    files.set('apps/api/src/routes/b.ts', plugin('bRoutes'))
    return files
  }

  ok('同前缀两处同名注册 ⇒ 1 条重复,两处位置都点名', () => {
    const files = mkFiles(
      `  server.register(aRoutes, { prefix: '/api/a' })\n  server.register(bRoutes, { prefix: '/api/a' })`,
    )
    const r = analyzeRouteUniqueness(files, { baseFiles: new Map() })
    assert(r.duplicates.length === 1, `期望 1 条重复,实得 ${r.duplicates.length}`)
    assert(r.duplicates[0].key === 'GET /api/a/x', `键不对:${r.duplicates[0].key}`)
    assert(r.duplicates[0].sites.length === 2, '站点数应为 2')
    assert(
      r.duplicates[0].sites
        .map((s) => s.file)
        .sort()
        .join(',') === 'apps/api/src/routes/a.ts,apps/api/src/routes/b.ts',
      '两处注册文件应逐条点名',
    )
  })

  ok('不同前缀 ⇒ 0 条重复(反向对照:不是恒红)', () => {
    const files = mkFiles(
      `  server.register(aRoutes, { prefix: '/api/a' })\n  server.register(bRoutes, { prefix: '/api/b' })`,
    )
    const r = analyzeRouteUniqueness(files, { baseFiles: new Map() })
    assert(r.duplicates.length === 0, `期望 0 条,实得 ${r.duplicates.length}`)
  })

  ok('内联块形参同名塌陷 ⇒ 判为不可判定而不是假阳性', () => {
    const files = new Map()
    files.set(
      DEFAULT_ENTRY_TS,
      `import { aliasRoutes } from './routes/alias.js'\nexport async function buildServer(server) {\n  server.register(aliasRoutes, { prefix: '/api/admin' })\n}\n`,
    )
    files.set(
      'apps/api/src/routes/alias.ts',
      `
import type { FastifyPluginAsync } from 'fastify'
export const aliasRoutes: FastifyPluginAsync = async (server) => {
  server.register(async (s) => {
    s.get('/list', async () => 'a')
  }, { prefix: '/login-logs' })
  server.register(async (s) => {
    s.get('/list', async () => 'b')
  }, { prefix: '/posts' })
}
`,
    )
    const r = analyzeRouteUniqueness(files, { baseFiles: new Map() })
    assert(
      r.duplicates.length === 0,
      `期望 0 条(塌陷块须剔除),实得 ${r.duplicates.map((d) => d.key)}`,
    )
    assert(
      r.excludeByReason[EXCLUDE_REASON.INLINE_ALIAS_COLLISION] === 2,
      '塌陷块内 2 条应记不可判定',
    )
    assert(r.collisions.length === 1, '应报出 1 个塌陷文件')
  })

  ok('兜底前缀(via=fallback)不进判红面', () => {
    const files = new Map()
    files.set(
      DEFAULT_ENTRY_TS,
      `export async function buildServer(server) {\n  server.get('/', async () => 'ok')\n}\n`,
    )
    // 未被 server.ts 注册的插件函数 ⇒ 挂载图走不到 ⇒ 该文件的注册落 via='fallback',
    // 前缀是按「本文件自身声明」猜的,不能拿来判重复(HEAD 面 agent-runs 三处 POST / 同型)。
    files.set(
      'apps/api/src/routes/orphan.ts',
      `
import type { FastifyPluginAsync } from 'fastify'
export const orphanRoutes: FastifyPluginAsync = async (server) => {
  server.get('/', async () => 'a')
}
`,
    )
    const r = analyzeRouteUniqueness(files, { baseFiles: new Map() })
    assert(
      r.excludeByReason[EXCLUDE_REASON.FALLBACK_PREFIX] >= 1,
      `兜底条目应被剔除,实得 ${JSON.stringify(r.excludeByReason)}`,
    )
    assert(r.duplicates.length === 0, `兜底条目不得判重复,实得 ${r.duplicates.map((d) => d.key)}`)
  })

  ok('站点归一:同一声明展开两次只算一处', () => {
    const one = { method: 'GET', path: '/a', file: 'f.ts', line: 3, via: 'graph' }
    const r = uniqTest.findDuplicateRoutes([one, { ...one }, { ...one, line: 9 }])
    assert(r.length === 1, '两条不同声明应判重')
    assert(r[0].sites.length === 2, `同一声明应折成 1 处,实得 ${r[0].sites.length}`)
  })

  ok('通配方法 ANY 与具体方法同路径相撞', () => {
    const r = uniqTest.findDuplicateRoutes([
      { method: 'GET', path: '/a', file: 'f.ts', line: 3, via: 'graph' },
      { method: 'ANY', path: '/a', file: 'g.ts', line: 5, via: 'graph' },
    ])
    assert(r.length === 1, `期望 1 条,实得 ${r.length}`)
    assert(
      uniqTest.methodsOverlap('GET', 'ANY') && !uniqTest.methodsOverlap('GET', 'POST'),
      '方法覆盖判据反了',
    )
  })

  ok('棘轮:基线 1 站点 → 本次 2 站点 = 回归;基线 2 → 本次 1 = 不回归', () => {
    const base = [{ method: 'GET', path: '/a', key: 'GET /a', sites: [{ file: 'f.ts', line: 1 }] }]
    const up = uniqTest.ratchetDuplicates(base, [
      {
        method: 'GET',
        path: '/a',
        key: 'GET /a',
        sites: [
          { file: 'f.ts', line: 1 },
          { file: 'g.ts', line: 2 },
        ],
      },
    ])
    assert(up.regressed.length === 1 && up.regressed[0].baseCount === 1, '回归维判错')
    const down = uniqTest.ratchetDuplicates(
      [
        {
          method: 'GET',
          path: '/a',
          key: 'GET /a',
          sites: [
            { file: 'f.ts', line: 1 },
            { file: 'g.ts', line: 2 },
          ],
        },
      ],
      base,
    )
    assert(down.regressed.length === 0, '存量下降不得判红')
  })

  ok('出口码三态:空转 2 / 新增 1 / 基线不可得且已有重复 2 / 其余 0', () => {
    assert(decideExitCode({ determinableCount: 0 }) === 2, '取材面空转应 exit 2')
    assert(decideExitCode({ determinableCount: 5, regressedCount: 1 }) === 1, '新增应 exit 1')
    assert(
      decideExitCode({ determinableCount: 5, duplicateCount: 1, baselineKnown: false }) === 2,
      '基线不可得却已有重复应 exit 2(不猜)',
    )
    assert(
      decideExitCode({ determinableCount: 5, duplicateCount: 1, baselineKnown: true }) === 0,
      '存量重复应 exit 0(只报数)',
    )
  })

  ok('判据单源:本门只经 lib 入口,不自己抽路径', () => {
    assert(typeof routeExtractTest.walkFastifyGraph === 'function', '取材侧 __test__ 出口应可用')
    assert(typeof uniqTest.detectInlineAliasCollisions === 'function', '本层 __test__ 出口应可用')
  })

  const failed = cases.filter((c) => !c.pass)
  for (const c of cases)
    log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.name}${c.pass ? '' : ` —— ${c.error}`}`)
  log(`自检 ${cases.length - failed.length}/${cases.length}`)
  return failed.length === 0 ? 0 : 1
}

async function main() {
  const argv = process.argv.slice(2)
  const unknown = argv.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.has(a))
  if (unknown.length > 0) {
    log(`[UNDETERMINED] 用法错:未认识的旗标 ${unknown.join(' ')}`)
    log(USAGE)
    return 2
  }
  const faceSel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
  })
  if (faceSel.error) {
    log(`[UNDETERMINED] 用法错:${faceSel.error}`)
    log(USAGE)
    return 2
  }
  if (argv.includes('--self-test')) return runSelfTest()
  const asJson = argv.includes('--json')
  const face = faceSel.face
  const baseRef = face === 'head' ? 'HEAD^' : 'HEAD'

  const cur = readFace(face, 'HEAD')
  if (!cur.ok) {
    log(`[UNDETERMINED] ${cur.error}`)
    if (asJson) log(JSON.stringify({ face, error: cur.error }, null, 2))
    return 2
  }
  const base = readFace('head', baseRef)
  if (cur.unreadable.length > 0)
    log(`[WARN] ${cur.unreadable.length} 个文件读不到(未进面,首:${cur.unreadable[0]})`)

  const result = analyzeRouteUniqueness(cur.files, {
    entryTs: DEFAULT_ENTRY_TS,
    baseFiles: base.ok ? base.files : null,
    baselineKnown: base.ok,
  })
  const exitCode = decideExitCode({
    determinableCount: result.determinable,
    duplicateCount: result.duplicates.length,
    regressedCount: result.ratchet ? result.ratchet.regressed.length : 0,
    baselineKnown: result.baselineKnown,
  })
  if (asJson) {
    log(
      JSON.stringify(
        { face, baseRef: base.ok ? baseRef : null, exitCode, ...result, baseline: result.baseline },
        (k, v) => (k === 'files' && v instanceof Map ? v.size : v),
        2,
      ),
    )
    return exitCode
  }
  renderText(result, { face, baseRef: base.ok ? baseRef : null, exitCode })
  if (!base.ok) log(`[WARN] 基线面取不到:${base.error}`)
  return exitCode
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (e) => {
      console.error(`[UNDETERMINED] 脚本自身异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    },
  )
}

export const __test__ = { readFace, renderText, runSelfTest, EXCLUDE_LABEL, uniqTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
