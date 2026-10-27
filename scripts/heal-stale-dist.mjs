#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出结论与点名 */
/**
 * heal-stale-dist.mjs —— workspace 包 `dist` 落后于源码时的**自动重建腿**(2026-10-27 立)。
 *
 * 为什么这一格非补不可(现读两条):
 *   ① 消费方拿样式常量走的是 dist,不是 src —— 实测 `@ihui/shared` 的 dist 落后 HEAD 源码 21 项,
 *      内容正是 carousel 点位尺寸、loader 色相步进这类**样式常量**(`CAROUSEL_DOT_ACTIVE_WIDTH_PX`
 *      / `COLORFUL_LOADER_HUE_STEP` …)。web 改一笔,只要 dist 没人重建,RN/小程序那侧读到的还是旧值,
 *      而**没有任何门会红**(守门 101/103 的 D 维把"清单未把声明入口指到 dist"的包放成只报数)。
 *   ② 全仓没有一条腿跑 `pnpm --filter <pkg> build`:dev 启动器只管 web 的 .next 缓存,
 *      守门只喊"修复:pnpm …",修复动作一直靠人想起来敲(AGENTS §0.9「造好没装车 = 没有」的反面:
 *      喊了没人修 = 也没装)。
 *
 * 判据零复算(§0.6):落后与否、修复命令,一律取守门 `check-stale-dist.mjs --json` 自己的结论。
 * 本器**不重算** D 维(src 抽声明 → 聚合 → 与 dist 差集)—— 复制那份组装必然与门漂移,
 * 漂移的产物是"器物说没落后、门说落后"的假自愈。
 *
 * 安全边界:
 *   · 只跑门自己给出的 build 命令(不拼没见过的命令;命令串里出现 shell 结构一律拒);
 *   · 一轮最多 MAX_BUILDS_PER_ROUND 个包(异常放大 = 判据或环境出问题了,不自动背书);
 *   · 每个 build 有硬超时;构建产物 dist 是 gitignored 的机器态,**不写仓、不落 HEAD、不推**;
 *   · 复量:重建后**再跑一次门**,该包仍在落后清单里 ⇒ 记 `still-behind` 并点名(不谎报 healed);
 *   · 取不到门的结论 ⇒ 未判定(§0.3),不记绿也不冒红。
 *
 * 用法:
 *   node scripts/heal-stale-dist.mjs                 # 预演:列出要重建哪些包与各自命令
 *   node scripts/heal-stale-dist.mjs --apply         # 真跑:逐个 build + 复量
 *   node scripts/heal-stale-dist.mjs --json          # 机读结论(守护轮读)
 *   node scripts/heal-stale-dist.mjs --self-test     # 纯函数自检(内存夹具,不跑 build)
 * 退出码:0 = 无需重建 / 已全部消账;3 = 有包重建后仍落后(拒落式出声);2 = 未判定。
 * 判机器状态 ⇒ 不进提交链(§12e);调度器 = git-guardian 巡检轮 healStaleDistLeg。
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { planPackageManagerSpawn } from './lib/npm-execpath.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_REL = 'scripts/check-stale-dist.mjs'
/** 一轮最多重建几个包:超过就说明判据或环境出了问题,不当"批量重修"的授权 */
export const MAX_BUILDS_PER_ROUND = 6
const BUILD_TIMEOUT_MS = Number(process.env.IHUI_DIST_BUILD_TIMEOUT_MS || 20 * 60 * 1000)

/**
 * 把一条 build 命令落成"可 spawn 三件套"。执行器身份不自造(§0.6):
 * Windows 上 pnpm 是 `.cmd` shim,而新版 Node 对 `execFileSync('pnpm.cmd', …)` 直接抛
 * **EINVAL**(2026-10-27 实测,不是 ENOENT 也不是构建失败 ⇒ 上一版这条腿一条都没跑起来);
 * 全仓唯一判定在 `scripts/lib/npm-execpath.mjs` —— 按 `npm_execpath` 决定直载 JS 入口(不开 shell)
 * 还是回落 PATH 解析(开 shell)。回落档经 cmd.exe,所以包名字符集先挡在判据外(见下)。
 */
export function pnpmSpawnPlan(pkg, script, envExecpath = process.env.npm_execpath) {
  const plan = planPackageManagerSpawn(envExecpath)
  return { cmd: plan.cmd, args: [...plan.prefix, '--filter', pkg, script], shell: plan.shell }
}

/** 允许进 shell 的 token 字符集:不含空格与任何 shell 元字符 */
const SAFE_TOKEN = '[A-Za-z0-9@._/-]+'

function sh(cmd, args, cwd = ROOT, timeout = BUILD_TIMEOUT_MS, shell = false) {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      shell,
      timeout,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, stdout: String(stdout ?? '') }
  } catch (e) {
    return {
      ok: false,
      stdout: String(e?.stdout ?? ''),
      why: String(e?.stderr ?? e?.stdout ?? e?.message ?? e).slice(0, 240),
    }
  }
}

/**
 * 从守门的机读档里取"要重建谁、用哪条命令"。取不到档 ⇒ null(交上层落未判定)。
 *
 * 只吃 `reds`(档a:该包清单确有声明入口走 dist ⇒ dist 旧了消费方真读到旧值),**不吃 `onlyReported`**
 * (档b)。这是 2026-10-27 实测定的,不是保守起见:
 *   · `@ihui/shared` 判"落后 21 项",`pnpm --filter @ihui/shared build` 跑成功(exit 0)后门**仍报 21 项**;
 *   · 查该包 `package.json`:全部 `exports` 子路径都指 `./src/*.ts` ⇒ dist 根本没有声明入口,
 *     这 21 项是"src 里有而 dist 不产"的形态差(门自己也因此把它归入"只报数")。
 * 把档b 接来自流的后果是:守护轮每 30 分钟白建一次一个**建不完**的包(分钟级 CPU、无效果),
 * 而真正要盯的档a 反而被淹在噪声里。要人工看档b 时用 `--include-reported` 显式点名。
 */
export function targetsFromVerdicts(parsed, { includeReported = false } = {}) {
  const v = parsed?.verdicts
  if (!v || !Array.isArray(v.reds) || !Array.isArray(v.onlyReported)) return null
  const rows = includeReported
    ? [...(v.reds || []), ...(v.onlyReported || []), ...(v.stockOnly || [])]
    : [...(v.reds || [])]
  const out = new Map()
  for (const row of rows) {
    const fix = String(row?.fix || '').trim()
    if (!row?.pkg || !fix) continue
    // build 命令必须是 `pnpm --filter <pkg> build` 这一条干净形态;有 shell 结构就不跑。
    // 包名用字符集而不是 \S:回落档经 cmd.exe,`x && del …` 不得成为可执行的 fix 命令。
    if (!new RegExp(`^pnpm\\s+--filter\\s+${SAFE_TOKEN}\\s+build$`).test(fix)) continue
    const filterName = fix.split(/\s+/)[2]
    if (!out.has(row.pkg)) out.set(row.pkg, { fix, filterName })
  }
  return [...out.entries()].map(([pkg, t]) => ({ pkg, fix: t.fix, filterName: t.filterName }))
}

/** 跑一次守门并解析它的机读档(--json 行以 '{' 起头,人类输出照旧)。 */
export function readVerdicts(deps = {}) {
  const run = deps.run || sh
  const r = run(process.execPath, [join(ROOT, GATE_REL), '--json'], ROOT, 15 * 60 * 1000)
  const line = String(r.stdout || '')
    .split('\n')
    .find((l) => l.trim().startsWith('{'))
  if (!line)
    return { ok: false, why: `守门机读档取不到${r.why ? `:${String(r.why).slice(0, 140)}` : ''}` }
  try {
    return { ok: true, json: JSON.parse(line) }
  } catch (e) {
    return { ok: false, why: `守门机读档不是合法 JSON:${String(e?.message ?? e).slice(0, 100)}` }
  }
}

/**
 * 一轮闭环。deps 全可注入 ⇒ 镜像测试不跑真 build(真 build 要几分钟且会改机器态)。
 * 返回 { state, targets, healed, still, refused, why }
 *   clean = 没有落后包;built = 全部消账;partial = 有包重建后仍落后;refused = 命令不合形态;
 *   undetermined = 门的结论取不到。
 */
export function healStaleDist(opts = {}) {
  const {
    apply = false,
    run = sh,
    read = readVerdicts,
    logger = () => {},
    includeReported = false,
  } = opts
  const first = read({ run })
  if (!first.ok)
    return {
      state: 'undetermined',
      targets: [],
      healed: [],
      still: [],
      refused: [],
      why: first.why,
    }
  const targets = targetsFromVerdicts(first.json, { includeReported })
  if (targets === null)
    return {
      state: 'undetermined',
      targets: [],
      healed: [],
      still: [],
      refused: [],
      why: '守门机读档形状不对(缺 reds/onlyReported)',
    }
  if (targets.length === 0)
    return { state: 'clean', targets: [], healed: [], still: [], refused: [], why: '' }
  if (targets.length > MAX_BUILDS_PER_ROUND)
    return {
      state: 'refused',
      targets,
      healed: [],
      still: [],
      refused: targets.map((t) => t.pkg),
      why: `一轮要重建 ${targets.length} 个包 > 上限 ${MAX_BUILDS_PER_ROUND} ⇒ 异常量级,不自动背书`,
    }
  const batch = targets.slice(0, MAX_BUILDS_PER_ROUND)
  if (!apply)
    return {
      state: 'pending',
      targets: batch,
      healed: [],
      still: [],
      refused: [],
      why: '预演(未加 --apply,不跑 build)',
    }

  const ran = []
  for (const t of batch) {
    // 形如 `pnpm --filter <pkg> build` 共 4 段;逐段取出后交执行器判据决定怎么 spawn(§12g 显式 stdio)
    const sp = pnpmSpawnPlan(t.filterName, 'build')
    const r = run(sp.cmd, sp.args, ROOT, BUILD_TIMEOUT_MS, sp.shell)
    logger(`  ${r.ok ? '✓' : '✗'} ${t.pkg} ⇒ ${t.fix}${r.ok ? '' : ` —— ${r.why}`}`)
    ran.push({ ...t, ok: r.ok, why: r.why ?? '' })
  }
  const after = read({ run })
  if (!after.ok)
    return {
      state: 'undetermined',
      targets: batch,
      healed: [],
      still: [],
      refused: [],
      why: `重建后复量取不到结论:${after.why}`,
    }
  const left = new Set(
    (targetsFromVerdicts(after.json, { includeReported }) || []).map((t) => t.pkg),
  )
  const healed = ran.filter((r) => r.ok && !left.has(r.pkg)).map((r) => r.pkg)
  const still = ran
    .filter((r) => !healed.includes(r.pkg))
    .map((r) => `${r.pkg}${r.why ? `(${r.why.slice(0, 80)})` : ''}`)
  return {
    state: still.length > 0 ? 'partial' : 'built',
    targets: batch,
    healed,
    still,
    refused: [],
    why: still.length ? `${still.length} 个包重建后仍落后 ⇒ 交人看(不谎报消账)` : '',
  }
}

function selfTest() {
  const cases = []
  const P = (name, pass, got = '') =>
    cases.push({ name, pass: !!pass, got: String(got).slice(0, 140) })
  // 夹具给的是 read() 的返回契约 {ok, json}(与生产 readVerdicts 同形);
  // json 里再套一层 verdicts,与守门 --json 的实际输出同形 —— 少套一层就等于测另一条判据。
  const fake = (verdicts) => ({ reds: [], onlyReported: [], stockOnly: [], ...verdicts })
  const rd = (verdicts) => ({ ok: true, json: { verdicts: fake(verdicts) } })
  // 纯判据用例取 json 那一层(把信封喂给判据 = 断言"没解开的信封"而不是断言判据)
  const tv = (verdicts, o) => targetsFromVerdicts(rd(verdicts).json, o)
  // 档a(清单真有声明入口走 dist)= reds ⇒ 才是该自动动手的对象
  const okShape = {
    reds: [{ pkg: '@ihui/shared', fix: 'pnpm --filter @ihui/shared build', total: 21 }],
  }
  // 档b(exports 全指 src,dist 无人读)⇒ 默认不动手;实测 build 跑成功后门仍报同一批,建不完
  const reportedShape = {
    onlyReported: [{ pkg: '@ihui/shared', fix: 'pnpm --filter @ihui/shared build', total: 21 }],
  }
  P(
    'S1 门给的 build 命令被采纳(判据不自造)',
    JSON.stringify(tv(okShape)) ===
      '[{"pkg":"@ihui/shared","fix":"pnpm --filter @ihui/shared build","filterName":"@ihui/shared"}]',
    JSON.stringify(tv(okShape)),
  )
  P('S2 形状不符 ⇒ null(交上层落未判定,不猜)', tv({ reds: null, onlyReported: null }) === null, '')
  P(
    'S3 命令串带 shell 结构 ⇒ 丢腿(不替它拼)',
    tv({ reds: [{ pkg: 'x', fix: 'pnpm --filter x build && rm -rf dist' }] }).length === 0,
    '',
  )
  // S3b 元字符藏在包名位置:回落档经 cmd.exe,这一型必须同样丢腿而不是"照跑"
  P(
    'S3b 包名位含 shell 元字符 ⇒ 丢腿',
    tv({ reds: [{ pkg: 'x', fix: 'pnpm --filter x&&calc build' }] }).length === 0 &&
      tv({ reds: [{ pkg: 'y', fix: 'pnpm --filter "y;del" build' }] }).length === 0,
    JSON.stringify(tv({ reds: [{ pkg: 'x', fix: 'pnpm --filter x&&calc build' }] })),
  )
  // S13 档b(只报数)默认不动手 —— 实测 @ihui/shared build 跑成功后门仍报同一批(dist 无声明入口,
  // 建不完);若纳入自动档,守护轮就变成每 30 分钟白建一次的空转。显式点名才纳入。
  P(
    'S13 档b 默认不重建;--include-reported 才纳入',
    tv(reportedShape).length === 0 && tv(reportedShape, { includeReported: true }).length === 1,
    `${JSON.stringify(tv(reportedShape))}/${JSON.stringify(tv(reportedShape, { includeReported: true }))}`,
  )
  P(
    'S4 无落后 ⇒ clean 且一次 build 都不跑',
    (() => {
      let runs = 0
      const r = healStaleDist({
        apply: true,
        read: () => rd({}),
        run: () => {
          runs++
          return { ok: true, stdout: '' }
        },
      })
      return r.state === 'clean' && runs === 0
    })(),
    '',
  )
  P(
    'S5 预演(无 --apply)绝不跑 build',
    (() => {
      let runs = 0
      const r = healStaleDist({
        read: () => rd(okShape),
        run: () => {
          runs++
          return { ok: true, stdout: '' }
        },
      })
      return r.state === 'pending' && runs === 0 && r.targets.length === 1
    })(),
    '',
  )
  P(
    'S6 重建后仍落后 ⇒ partial 点名,不谎报 healed',
    (() => {
      const r = healStaleDist({
        apply: true,
        read: () => rd(okShape),
        run: () => ({ ok: true, stdout: '' }),
      })
      return (
        r.state === 'partial' && r.healed.length === 0 && String(r.still).includes('@ihui/shared')
      )
    })(),
    '',
  )
  P(
    'S7 消账 ⇒ built 且 healed 命中',
    (() => {
      let n = 0
      const r = healStaleDist({
        apply: true,
        read: () => (n++ === 0 ? rd(okShape) : rd({})),
        run: () => ({ ok: true, stdout: '' }),
      })
      return r.state === 'built' && r.healed[0] === '@ihui/shared'
    })(),
    '',
  )
  P(
    'S8 门的结论取不到 ⇒ 未判定(不记绿也不冒红)',
    healStaleDist({ read: () => ({ ok: false, why: 'x' }) }).state === 'undetermined',
    '',
  )
  P(
    'S9 超量 ⇒ 整轮拒跑(不当批量重修的授权)',
    healStaleDist({
      apply: true,
      read: () =>
        rd({
          reds: Array.from({ length: 9 }, (_u, i) => ({
            pkg: `p${i}`,
            fix: `pnpm --filter p${i} build`,
          })),
        }),
      run: () => ({ ok: true, stdout: '' }),
    }).state === 'refused',
    '',
  )
  // S10:真跑时递给 pnpm 的 argv 必须是 ['--filter',<pkg>,'build']。
  // 上一版这里解构多跳一段 ⇒ script 取到 undefined,build 一条都跑不起来而状态照样"built"。
  const argvs = []
  const shells = []
  const r10 = healStaleDist({
    apply: true,
    read: () => (argvs.length === 0 ? rd(okShape) : rd({})),
    run: (cmd, args, _cwd, _t, shell) => {
      argvs.push([cmd, ...args])
      shells.push(shell)
      return { ok: true, stdout: '' }
    },
  })
  P(
    'S10 递给 pnpm 的 argv 三段齐(--filter/包名/脚本名,不含 undefined)',
    argvs.length === 1 &&
      String(argvs[0][1]) === '--filter' &&
      argvs[0][2] === '@ihui/shared' &&
      argvs[0][3] === 'build' &&
      !argvs[0].some((a) => a === undefined) &&
      r10.state === 'built',
    JSON.stringify(argvs),
  )
  // S12:执行器身份复用全仓唯一判据 npm-execpath,而不是本器自造常量 ——
  // 直接 spawn 'pnpm.cmd' 在 Windows 被 Node 判 EINVAL(本轮实测:整条腿一条 build 都没跑起来)。
  const pJS = pnpmSpawnPlan('@ihui/shared', 'build', 'D:/x/node_modules/pnpm/bin/pnpm.cjs')
  const pShim = pnpmSpawnPlan('@ihui/shared', 'build', undefined)
  P(
    'S12 执行器计划取自 npm-execpath 单源(JS 入口直载不开 shell;无 execpath 回落 PATH 才开 shell)',
    pJS.cmd === process.execPath &&
      JSON.stringify(pJS.args) ===
        '["D:/x/node_modules/pnpm/bin/pnpm.cjs","--filter","@ihui/shared","build"]' &&
      pJS.shell === false &&
      pShim.shell === true &&
      !String(pShim.cmd).endsWith('.cmd') &&
      argvs.length === 1 &&
      shells[0] === pShim.shell,
    `${JSON.stringify(pShim)}/${JSON.stringify(argvs)}/${JSON.stringify(shells)}`,
  )
  // S11:build 自己失败 ⇒ 该包进 still(不能因为"复量时门恰好不判它"就记成消账)
  const r11 = healStaleDist({
    apply: true,
    read: () => rd(okShape),
    run: () => ({ ok: false, stdout: '', why: 'exit 1' }),
  })
  P(
    'S11 build 失败 ⇒ partial 且点名',
    r11.state === 'partial' && String(r11.still).includes('exit 1'),
    `${r11.state}/${String(r11.still)}`,
  )
  return cases
}

function main(argv) {
  if (argv.includes('--self-test')) {
    const cases = selfTest()
    for (const c of cases)
      console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.pass ? '' : ` —— 实测:${c.got}`}`)
    const bad = cases.filter((c) => !c.pass).length
    console.log(
      bad === 0
        ? `自检 ${cases.length}/${cases.length} 通过`
        : `自检 ${cases.length - bad}/${cases.length} 通过`,
    )
    return bad === 0 ? 0 : 1
  }
  const r = healStaleDist({
    apply: argv.includes('--apply'),
    includeReported: argv.includes('--include-reported'),
    logger: (m) => process.stdout.write(`${m}\n`),
  })
  if (argv.includes('--json')) console.log(JSON.stringify(r))
  else {
    console.log(
      `[heal-stale-dist] state=${r.state} 待重建=${r.targets.length} 已消账=${r.healed.length} 仍落后=${r.still.length}${r.why ? ` —— ${r.why}` : ''}`,
    )
    for (const t of r.targets) console.log(`   · ${t.pkg} ⇒ ${t.fix}`)
    for (const s of r.still) console.log(`   ✗ 仍落后:${s}`)
  }
  if (r.state === 'undetermined') return 2
  if (r.state === 'partial' || r.state === 'refused') return 3
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ 未判定(异常):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  targetsFromVerdicts,
  readVerdicts,
  healStaleDist,
  pnpmSpawnPlan,
  selfTest,
  MAX_BUILDS_PER_ROUND,
  GATE_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
