// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端构建入口(**薄壳**):先把 MSVC 工具链注进 env,再 spawn `pnpm tauri build`。
//
// 存在的理由见 scripts/lib/msvc-env.mjs 头注:本机 `C:\Program Files\Git\usr\bin` 在系统 PATH 里且
// 带 GNU coreutils 的 `link.exe`,未加载 MSVC 的 shell 里 cargo 链接阶段直接失败
// (`link: missing operand after '\377\376'`)。本文件是"调用点",判据全在 lib 里,自己一份都不抄。
//
// 用法:
//   node scripts/desktop-build.mjs [--debug | --dev] [--no-artifact-check] [-- <tauri 额外参数>...]
//   node scripts/desktop-build.mjs --help
//
// 三态(AGENTS §0.3):env 注入取不到 ⇒ 打印显式「未判定」并 exit 2,**不**静默回落成"裸 env 硬跑"。
// tauri / 收敛钩子的退出码原样透传,不改写。
//
// 为什么也有 `--dev`:`tauri dev` 同样要编要链(首次 cargo 编译/任何触发重链接的改动),
// 所以"只有 build 入口注入工具链"等于给 dev 留了一个没有出路的告警
// (scripts/start-dev.ps1 会就 link.exe 遮蔽发 Write-Warn,而它指向的出路必须真能跑 —— §0.8)。

import { spawn, execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { planBuildEnv } from './lib/msvc-env.mjs'
// 包管理器执行器判据单源(与 desktop-build-saas / desktop-dev-saas 共用,不得各抄一份)
import { planPackageManagerSpawn } from './lib/npm-execpath.mjs'
// 未签名豁免判据单源(§0.6)。为什么**本入口必须**认这个开关:desktop-artifact-single.mjs 早就有
// `DESKTOP_ALLOW_UNSIGNED=1` 放行"缺 .sig",但它挂在 tauri build **之后** —— tauri 先在签名步
// exit 1(本机无 minisign 私钥),收敛钩子根本跑不到,于是那条豁免写了却落不了地(2026-10-19 实测
// `DESKTOP_ALLOW_UNSIGNED=1 pnpm --filter @ihui/desktop build` 仍 exit 1)。§0.8:不得写跑不通的出路。
import {
  ALLOW_UNSIGNED_ENV,
  allowUnsignedFrom,
  ensureUnsignedConfig,
  removeUnsignedConfig,
} from './lib/desktop-unsigned-config.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DESKTOP = path.join(ROOT, 'apps', 'desktop')
const ARTIFACT_HOOK = path.join(ROOT, 'scripts', 'desktop-artifact-single.mjs')
/**
 * 收敛钩子要判的产物目录 —— **随档位走**,不写死 release。
 *
 * 为什么必须分档:钩子的默认 `--dir` 是 `target/release/bundle/nsis`。而 `--debug` 构建的包落在
 * `target/debug/bundle/nsis`。若让 debug 档去判 release 目录,得到的是**上一次 release 构建**的
 * 结论 —— 本次 debug 产物一个字节都没被看过,却照样打印"✅"(§0.9:判据必须在真跑它的那一刻才成立)。
 * 反过来更糟的一格:release 目录若恰好不满足不变量,debug 构建会被一段与自己无关的红拦下。
 * @param {boolean} debug
 * @returns {string}
 */
function artifactDirFor(debug) {
  return path.join(DESKTOP, 'src-tauri', 'target', debug ? 'debug' : 'release', 'bundle', 'nsis')
}
/** 本入口独占的那一格临时 config 目录(与 desktop-build-saas 各占一格,免得并发时互删)。 */
const UNSIGNED_SLOT = 'desktop-build'

const USAGE = `用法:node scripts/desktop-build.mjs [--debug | --dev] [--no-artifact-check] [-- <tauri 额外参数>...]

  --debug               tauri build --debug
  --dev                 tauri dev(开发态,同样注入工具链;不跑安装包收敛钩子)
  --no-artifact-check   跳过构建后的单一产物收敛钩子(desktop-artifact-single.mjs)
  -- <参数>...          原样透传给 tauri(例如 -- --config src-tauri/tauri.dev.json)
  --help                本帮助

环境:注入 MSVC 工具链(vcvars64.bat)后再 spawn;取不到工具链时打印「未判定」并 exit 2。`

/**
 * 跑一次 vcvars64.bat 并取回它注入后的环境块。
 *
 * 为什么是"切到 vcvars 所在目录 + 只写批处理文件名",而不是 `call "<完整路径> && set"`:
 * 本机实测(2026-10-19,四组对照)完整路径那一形态**静默不生效** —— Node 把带内嵌引号的参数交给
 * cmd.exe 时,cmd 解析出的 `call` 目标不是那个 .bat,`set` 照样打印**未加载工具链的**环境块
 * (`VCToolsInstallDir` 取不到、PATH 里没有 MSVC 段),退出码还是 0。
 * 于是判据侧表现为"解析成功但工具链没注入",构建侧表现为一个指向 link.exe 的费解报错。
 * 切 cwd 后 `call vcvars64.bat` 用的是 cmd 的"当前目录优先"查找,一个引号都不需要。
 * `/d` 关闭 AutoRun(§30:AutoRun 会往这台机的 cmd 会话里插东西)。
 *
 * @param {string} vcvars vcvars64.bat 的完整路径
 * @returns {string} `set` 输出原文
 */
function captureVsEnv(vcvars) {
  return execFileSync('cmd.exe', ['/d', '/s', '/c', 'call vcvars64.bat >nul 2>&1 && set'], {
    cwd: path.dirname(vcvars),
    encoding: 'utf8',
    windowsHide: true,
    // §12g:派生必须显式接管 stdio;这一档不吃 stdin、不靠 stdout 之外的任何东西拿结论
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 << 20,
  })
}

/**
 * 派生通道判据单源(§12g 样板):带 input 的调用必须给 stdin 留管道,否则写进去的内容被静默吃掉。
 * 本文件两处派生都没有 input,恒取第一支。
 *
 * @param {{ input?: unknown }} opts
 * @returns {['ignore' | 'pipe', 'pipe', 'pipe']}
 */
function stdioFor(opts) {
  return opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
}

/** 换行符会破坏任何一层参数解析,出现即拒(不是"原样透传")。 */
function hasLineBreak(arg) {
  return /[\r\n]/.test(arg)
}

/**
 * @param {string[]} argv
 * @returns {{ help: boolean, debug: boolean, dev: boolean, artifactCheck: boolean, passthrough: string[], unknown: string[] }}
 */
function parseArgv(argv) {
  const out = { help: false, debug: false, dev: false, artifactCheck: true, passthrough: [], unknown: [] }
  let inPassthrough = false
  for (const a of argv) {
    if (!inPassthrough && a === '--') {
      inPassthrough = true
      continue
    }
    if (inPassthrough) {
      out.passthrough.push(a)
      continue
    }
    if (a === '--debug') out.debug = true
    else if (a === '--dev') out.dev = true
    else if (a === '--no-artifact-check') out.artifactCheck = false
    else if (a === '--help' || a === '-h') out.help = true
    else out.unknown.push(a)
  }
  return out
}

/**
 * 派生一个子进程并等它结束;输出转发到本进程终端(管住长构建的管道缓冲)。
 *
 * 退出码语义:
 *   · 子进程自己退出 ⇒ **原样透传**(不取反、不改写、不"看起来像失败就归一成 1");
 *   · 被信号打死(code 为 null)⇒ 1(不是"通过",但也不是"没判";信号名随行打印);
 *   · spawn 本身失败(ENOENT 之类)⇒ 2,**未判定**:连构建都没启动,不能记绿。
 *
 * @param {{ cmd: string, args: string[], cwd: string, env: Record<string, string>, shell: boolean }} p
 * @returns {Promise<{ code: number, error: Error | null }>}
 */
function runChild(p) {
  const opts = {
    cwd: p.cwd,
    env: p.env,
    shell: p.shell,
    windowsHide: true,
    stdio: stdioFor({}),
  }
  return new Promise((resolve) => {
    const child = spawn(p.cmd, p.args, opts)
    child.stdout?.pipe(process.stdout, { end: false })
    child.stderr?.pipe(process.stderr, { end: false })
    child.on('error', (e) => resolve({ code: 2, error: e }))
    child.on('close', (code, signal) => {
      if (code !== null) return resolve({ code, error: null })
      console.error(`[desktop-build] 子进程被信号终止:${signal} —— 判定为失败(1)`)
      resolve({ code: 1, error: null })
    })
  })
}

/** 工具链取不到时的出口:显式「未判定」+ 机器可读 reason + 出路(AGENTS §0.3)。 */
function printUndecided(plan) {
  console.error(`[desktop-build] ❌ 未判定:MSVC 工具链注入失败(reason=${plan.reason})`)
  console.error(`  已试候选 ${plan.tried.length} 条,存在的 ${plan.candidates.length} 条:`)
  for (const c of plan.tried) console.error(`    ${plan.candidates.includes(c) ? '✔' : '✘'} ${c}`)
  for (const d of plan.details) console.error(`  ✘ ${d.vcvars} → ${d.error}`)
  console.error('  出路:装 VS 2022 Build Tools(含 MSVC v143 + Windows SDK),或设 VSINSTALLDIR 指向现有安装;')
  console.error('        本仓不改判据来迁就"没装工具链"——那样只会把报错换成更难认的一型。')
}

async function main(argv = process.argv.slice(2)) {
  const opts = parseArgv(argv)
  if (opts.help) {
    console.log(USAGE)
    return 0
  }
  if (opts.unknown.length > 0) {
    console.error(`[desktop-build] 未知参数:${opts.unknown.join(' ')}\n${USAGE}`)
    return 2
  }
  if (opts.debug && opts.dev) {
    // tauri dev 本就只有 debug 档,同时给两个等于有一条被静默忽略 —— 显式拒,不给"看起来生效了"
    console.error(`[desktop-build] --debug 与 --dev 互斥(tauri dev 只有 debug 档),请只给一个\n${USAGE}`)
    return 2
  }
  const bad = opts.passthrough.find((a) => hasLineBreak(a))
  if (bad) {
    console.error(`[desktop-build] 透传参数里带换行符,拒绝下发:${JSON.stringify(bad)}`)
    return 2
  }

  const plan = planBuildEnv({ env: process.env, existsSync, runCapture: captureVsEnv })
  if (!plan.ok) {
    printUndecided(plan)
    return 2
  }
  console.log(`[desktop-build] MSVC 工具链已注入:${plan.linkFrom}`)
  console.log(`[desktop-build] vcvars:${plan.vcvars}`)
  if (plan.removedDirs.length > 0) console.log(`[desktop-build] 已从 PATH 剔除遮蔽目录:${plan.removedDirs.join(' ; ')}`)

  // pnpm 在本机是 .cmd shim(实测 `where pnpm` 只有 pnpm.cmd / 无扩展名 shim),
  // `spawn('pnpm', …, { shell: false })` 直接 ENOENT(实测)⇒ 执行器选择复用 scripts/lib/npm-execpath.mjs
  // 这一份单源判据,而不是在本文件里重新决定"要不要开 shell"。
  const { cmd, prefix, shell } = planPackageManagerSpawn(process.env.npm_execpath, process.execPath)
  const sub = opts.dev ? 'dev' : 'build'

  // 未签名本地打包的**两段豁免**:给 tauri 一份只关 updater 产物的临时 config(否则它在签名步
  // exit 1),并让同一个 env 继续传给尾部收敛钩子(它要放行"缺 .sig"那一项)。
  // dev 档不产安装包 ⇒ 不需要(也不会)走到这里。
  const allowUnsigned = !opts.dev && allowUnsignedFrom(process.env)
  let unsignedConfig = null
  if (allowUnsigned) {
    unsignedConfig = ensureUnsignedConfig(ROOT, UNSIGNED_SLOT)
    console.log(`[desktop-build] !! ${ALLOW_UNSIGNED_ENV}=1 —— 本地未签名打包(显式豁免):`)
    console.log(`[desktop-build] !! 向 tauri 传 --config 关掉 bundle.createUpdaterArtifacts:${unsignedConfig}`)
    console.log(`[desktop-build] !! 产物未签名:不得进更新源、不得发版、不得上传任何下载/更新 CDN`)
  }

  const tauriArgs = [
    ...prefix,
    'tauri',
    sub,
    ...(opts.debug ? ['--debug'] : []),
    ...(unsignedConfig ? ['--config', unsignedConfig] : []),
    ...opts.passthrough,
  ]
  console.log(`[desktop-build] 执行:${cmd} ${tauriArgs.join(' ')}(cwd=${DESKTOP}${shell ? ',shell=true' : ''})`)

  try {
    const build = await runChild({ cmd, args: tauriArgs, cwd: DESKTOP, env: plan.env, shell })
    if (build.error) {
      console.error(`[desktop-build] ❌ 未判定:构建进程根本没启动(${build.error.code ?? build.error.message})—— 不记绿`)
      return 2
    }
    if (build.code !== 0) {
      console.error(
        `[desktop-build] ❌ tauri ${sub} 失败,退出码原样透传:${build.code}` +
          (build.code === 1 && !allowUnsigned
            ? `\n  查因顺序:① 无 updater 签名私钥 → 本机打包请显式设 ${ALLOW_UNSIGNED_ENV}=1(只产本地自测包,不得发布);② 工具链/链接问题 → 看上面注入行与 'where link'`
            : ''),
      )
      return build.code
    }

    if (opts.dev) {
      // dev 档不产安装包,收敛钩子对它没有判据面(目录里只有上次 build 留下的东西,跑它等于拿别的
      // 构建的产物冒充本次结论 —— §0.9 "判据必须在真跑它的那一刻才成立")。
      console.log('[desktop-build] ✅ tauri dev 已结束(开发态不产安装包,按设计跳过单一产物收敛钩子)')
      return 0
    }

    if (!opts.artifactCheck) {
      console.log('[desktop-build] 已按 --no-artifact-check 跳过单一产物收敛钩子')
      return 0
    }
    const tail = await runChild({
      cmd: process.execPath,
      args: [ARTIFACT_HOOK, '--dir', artifactDirFor(opts.debug)],
      cwd: DESKTOP,
      env: plan.env,
      shell: false,
    })
    if (tail.error) {
      console.error(`[desktop-build] ❌ 未判定:收敛钩子根本没启动(${tail.error.code ?? tail.error.message})—— 不记绿`)
      return 2
    }
    if (tail.code !== 0) {
      console.error(`[desktop-build] ❌ 单一产物收敛钩子失败,退出码原样透传:${tail.code}`)
      return tail.code
    }
    console.log('[desktop-build] ✅ 构建 + 单一产物收敛均通过')
    return 0
  } finally {
    if (unsignedConfig) {
      const r = removeUnsignedConfig(ROOT, UNSIGNED_SLOT)
      if (!r.removed) console.error(`[desktop-build] 临时 config 未收掉(${r.configPath}):${r.reason}`)
    }
  }
}

const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then(
    (code) => {
      process.exit(code)
    },
    (e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    },
  )
}

export const __test__ = { parseArgv, stdioFor, hasLineBreak, captureVsEnv, artifactDirFor, ARTIFACT_HOOK, DESKTOP }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
