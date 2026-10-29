#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端 SaaS 模式打包入口(2026-09-02 立)。
 *
 * 背景:本地三端联调桌面包(tauri build 的 beforeBuildCommand → build:static)不注入任何
 * env,Tauri 分支回退直连 http://127.0.0.1:8802。SaaS 化需要把线上后端地址烘焙进静态产物:
 *   - NEXT_PUBLIC_API_BASE_URL       → https://aizhs.top(登录/数据/刷新全走 /api/*)
 *   - NEXT_PUBLIC_STREAM_API_BASE_URL → 同线上(SSE 流式直连)
 *   - NEXT_PUBLIC_AI_SERVICE_URL      → 同线上(直连 8803 型功能经 nginx 代理)
 * 三个键烘焙后,apps/web/src/lib/api.ts / sso-desktop-bridge.ts / playground-api.ts 等
 * Tauri 分支的 env 优先逻辑全部落到线上地址;本地 dev(不注入)行为不变。
 *
 * 用法:
 *   pnpm build:desktop:saas                     # 默认 https://aizhs.top
 *   NEXT_PUBLIC_API_BASE_URL=https://<其他> pnpm build:desktop:saas   # 覆盖(测试环境)
 *   DESKTOP_ALLOW_UNSIGNED=1 pnpm build:desktop:saas   # 本地无 minisign 私钥时的显式豁免
 *
 * 未签名本地打包(2026-09-24 立):tauri.conf.json 钉着 createUpdaterArtifacts=true +
 * updater pubkey,而签名私钥 ~/.tauri/ihui-updater.key 只在发版机/CI 上。本机没有私钥时
 * makensis 其实**已经产出** setup.exe,只是随后的签名步报
 * `A public key has been found, but no private key.` → 整条命令 exit 1,本地连自测包都拿不到。
 * 设 `DESKTOP_ALLOW_UNSIGNED=1` 走显式豁免:向 tauri 传 `--config <绝对路径>`(临时 config 只关
 * `bundle.createUpdaterArtifacts`,写在仓库内 .ihui-agent/tmp/ 下、用完即删),并把同一个 env
 * 透传给尾部收敛脚本 scripts/desktop-artifact-single.mjs(它默认无条件要求 .sig)。
 * **未设该 env 时命令行与本文件行为逐字不变** —— 发版/CI 仍走签名链路。
 * 产物未签名 ⇒ 不得进更新源、不得发版、不得上传任何下载/更新 CDN。
 *
 * 产物:apps/desktop/src-tauri/target/release/bundle/(NSIS/msi 等),同目录 target 内。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 包管理器执行器判据单源(与 desktop-dev-saas.mjs 共用,不得各抄一份)
import { planPackageManagerSpawn } from './lib/npm-execpath.mjs'
// MSVC 工具链注入判据单源(立因/三态见该文件头注);vcvars 的生产实现同样复用
// desktop-build.mjs 已有的具名导出,不另写第二种形态
import { planBuildEnv, needsMsvcInjection } from './lib/msvc-env.mjs'
import { applyRustupPinToEnv } from './lib/rustup-env.mjs'
import { __test__ as desktopBuildInternals } from './desktop-build.mjs'
// 未签名豁免判据单源(§0.6:开关名/临时 config 形态/落点三件事全仓只许一份;
// scripts/desktop-artifact-single.mjs 与 scripts/desktop-build.mjs 读同一份)
import {
  ALLOW_UNSIGNED_ENV,
  UNSIGNED_CONFIG_CONTENT,
  allowUnsignedFrom,
  ensureUnsignedConfig,
  removeUnsignedConfig,
  unsignedConfigPath,
} from './lib/desktop-unsigned-config.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 本入口独占的那一格临时 config 目录(§15:路径由脚本自身位置推导,不写死盘符)。 */
const UNSIGNED_SLOT = 'desktop-build-saas'

/**
 * 组装本次要执行的命令行(纯函数,不派生进程 ⇒ 测试可直接断言 argv)。
 *
 * 默认分支与改版前**逐字一致**:`pnpm --filter @ihui/desktop build`
 * (= `tauri build && node ../../scripts/desktop-artifact-single.mjs`)。
 * 豁免分支改成两步 `exec tauri build --config <绝对路径>` + 显式跑尾部脚本,原因是:
 * 往 `pnpm run build` 追加参数会被拼到**整条脚本末尾**
 * (`tauri build && node …/desktop-artifact-single.mjs --config …`),--config 根本落不到 tauri 上。
 *
 * @param {{npmExecpath?: string, execPath: string, root: string, allowUnsigned: boolean}} p
 * @returns {{cmd: string, args: string[], shell: boolean, configPath: string|null, tail: {cmd: string, args: string[]}|null}}
 */
function buildPlan({ npmExecpath, execPath, root, allowUnsigned }) {
  // 判据单源在 scripts/lib/npm-execpath.mjs(与 desktop-dev-saas.mjs 共用同一份,
  // 不在此抄第二份 —— AGENTS.md §0.6;该判定曾各自独立抄在两处并同时打断两条入口)。
  const { cmd, prefix, shell } = planPackageManagerSpawn(npmExecpath, execPath)
  if (!allowUnsigned) {
    return { cmd, args: [...prefix, '--filter', '@ihui/desktop', 'build'], shell, configPath: null, tail: null }
  }
  const configPath = unsignedConfigPath(root, UNSIGNED_SLOT)
  return {
    cmd,
    args: [...prefix, '--filter', '@ihui/desktop', 'exec', 'tauri', 'build', '--config', configPath],
    shell,
    configPath,
    tail: { cmd: execPath, args: [path.join(root, 'scripts', 'desktop-artifact-single.mjs')] },
  }
}

async function main() {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://aizhs.top').replace(/\/+$/, '')

  process.env.NEXT_PUBLIC_API_BASE_URL = apiBase
  process.env.NEXT_PUBLIC_STREAM_API_BASE_URL = process.env.NEXT_PUBLIC_STREAM_API_BASE_URL || apiBase
  // WS 默认走 api 子域:主域 aizhs.top 对 /cozeZhsApi/*、/v1/ai/capabilities/* 的 WebSocket
  // 升级失败(000),api.aizhs.top 全路径 101(见 apps/web/src/lib/ws-url.ts 注释)。
  process.env.NEXT_PUBLIC_WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || 'https://api.aizhs.top'
  process.env.NEXT_PUBLIC_AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || apiBase

  console.log('[desktop-build-saas] 烘焙线上后端地址:')
  console.log(`  NEXT_PUBLIC_API_BASE_URL       = ${process.env.NEXT_PUBLIC_API_BASE_URL}`)
  console.log(`  NEXT_PUBLIC_STREAM_API_BASE_URL = ${process.env.NEXT_PUBLIC_STREAM_API_BASE_URL}`)
  console.log(`  NEXT_PUBLIC_WS_BASE_URL         = ${process.env.NEXT_PUBLIC_WS_BASE_URL}`)
  console.log(`  NEXT_PUBLIC_AI_SERVICE_URL      = ${process.env.NEXT_PUBLIC_AI_SERVICE_URL}`)

  // 执行器选择见 buildPlan:pnpm 的 npm_execpath 是 **exe 本体**而非 JS 入口,
  // 不能无条件交给 node 直载;只有 .c?js 入口才走直载,否则回落 shell 解析裸 `pnpm`。
  const allowUnsigned = allowUnsignedFrom(process.env)
  const plan = buildPlan({
    npmExecpath: process.env.npm_execpath,
    execPath: process.execPath,
    root: repoRoot,
    allowUnsigned,
  })

  // 派生用的 env。默认分支**逐字保持** process.env 不变;只有豁免分支(裸 `tauri build`)才注入
  // MSVC 工具链 —— 默认分支那条命令已改走 scripts/desktop-build.mjs,由它自己注入并对未判定
  // exit 2,这里再注一次就是同一次构建里跑两遍 vcvars(不只是慢,还会让"注入了几次"再也读不出来)。
  let buildEnv = process.env
  // 平台闸(判据单源:scripts/lib/msvc-env.mjs 的 needsMsvcInjection)。非 Windows 上 MSVC 根本不适用
  // (macOS/Linux 用 clang/cc),此时**既不注入也不判未判定** —— 但豁免分支仍要照常跑完(它与工具链无关)。
  if (allowUnsigned && needsMsvcInjection()) {
    const toolchain = planBuildEnv({ env: process.env, existsSync, runCapture: desktopBuildInternals.captureVsEnv })
    if (!toolchain.ok) {
      console.error(`[desktop-build-saas] ❌ 未判定:MSVC 工具链注入失败(reason=${toolchain.reason})—— 不记绿,也不记失败`)
      console.error(`  已试候选 ${toolchain.tried.length} 条,其中确实存在的 ${toolchain.candidates.length} 条:`)
      for (const c of toolchain.tried) console.error(`    ${toolchain.candidates.includes(c) ? '[存在]' : '[不存在]'} ${c}`)
      for (const d of toolchain.details) console.error(`    [失败] ${d.vcvars} -> ${d.error}`)
      console.error('  出路:装 VS 2022 Build Tools(含 MSVC v143 + Windows SDK),或设 VSINSTALLDIR 指向现有安装。')
      console.error('        本仓不靠"让 cargo 自己撞"来替代判定 —— 那只会把"没装工具链"换成更难认的一型。')
      return 2
    }
    console.log(`[desktop-build-saas] MSVC 工具链已注入:${toolchain.linkFrom}`)
    if (toolchain.removedDirs.length > 0) {
      console.log(`[desktop-build-saas] 已从 PATH 剔除遮蔽目录:${toolchain.removedDirs.join(' ; ')}`)
    }
    // ⚠ 顺序:策略 env 必须在注入**之后**落。planBuildEnv 的成功档是 `{...调用方env, ...vcvars的set块}`,
    // 注入结果**整块盖在**调用方 env 上 —— 写在注入之前的键,取值由那次 `set` 说了算。
    // DESKTOP_ALLOW_UNSIGNED 是"本脚本判出来要不要放行未签名"的结果,不是从 `set` 里读出来的,
    // 落在注入之后,才是"注入不会改写本脚本的策略"。
    // (实测:本文件只**读**它而不设它,读到的值来自父进程、会原样出现在 `set` 输出里 ⇒ 今天两种
    //  顺序同值;这一行仍保留,因为判据不能建立在"上游恰好把值带下来了"这个事实上。)
    buildEnv = { ...toolchain.env, [ALLOW_UNSIGNED_ENV]: '1' }
  } else if (allowUnsigned) {
    // 策略 env 与工具链无关,非 Windows 上照样要落到 child(否则尾部收敛钩子不认豁免)
    buildEnv = { ...process.env, [ALLOW_UNSIGNED_ENV]: '1' }
    console.log(`[desktop-build-saas] ⓘ 跳过 MSVC 注入:NOT_WINDOWS(platform=${process.platform}) —— 本平台不适用,按现 env 直跑`)
  }

  // rustup 家钉正(判据与三态日志单源 lib/rustup-env.mjs):豁免分支由本脚本亲自 spawn
  // tauri/cargo,agent 会话把 HOME 顶成沙箱根时,MSVC 注入成功照样死在 "no default toolchain"
  // 且报错长得像"没装 Rust"。必须排在 planBuildEnv **之后** —— 本判据从 PATH 反推 cargo 档案位,
  // 而 PATH 正是上一步刚重写过的那一份。
  buildEnv = applyRustupPinToEnv({
    env: buildEnv,
    platform: process.platform,
    existsSync,
    tag: 'desktop-build-saas',
    log: (m) => console.log(m),
  })

  if (allowUnsigned) {
    console.log(`[desktop-build-saas] !! ${ALLOW_UNSIGNED_ENV}=1 —— 本地未签名打包(显式豁免):`)
    console.log(`  !! 向 tauri 传 --config(绝对路径)关掉 bundle.createUpdaterArtifacts: ${plan.configPath}`)
    console.log(`  !! 尾部脚本 desktop-artifact-single.mjs 同受该 env 放行"缺 .sig"一项判据`)
    console.log('  !! 产物未签名:不得进更新源、不得发版、不得上传任何下载/更新 CDN')
    ensureUnsignedConfig(repoRoot, UNSIGNED_SLOT)
  }

  try {
    const r = spawnSync(plan.cmd, plan.args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: buildEnv,
      shell: plan.shell,
      windowsHide: true,
    })
    let code = r.status ?? 1
    // 豁免分支绕过了端内 build 脚本的 `&&` 尾部,这里显式补跑同一条收敛钩子(env 已透传)
    if (code === 0 && plan.tail) {
      const t = spawnSync(plan.tail.cmd, plan.tail.args, {
        cwd: repoRoot,
        stdio: 'inherit',
        env: buildEnv,
        windowsHide: true,
      })
      code = t.status ?? 1
    }
    return code
  } finally {
    if (plan.configPath) {
      const r = removeUnsignedConfig(repoRoot, UNSIGNED_SLOT)
      if (!r.removed) console.error(`[desktop-build-saas] 临时 config 未收掉(${r.configPath}):${r.reason}`)
    }
  }
}

const isDirectRun = !!process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isDirectRun) {
  // 不 catch:main() 自身抛错走 Node 默认"未处理拒绝"→ 打印堆栈 + exit 1(与改版前一致)
  main().then((code) => {
    process.exit(code)
  })
}

export const __test__ = {
  buildPlan,
  unsignedConfigPath,
  allowUnsignedFrom,
  ALLOW_UNSIGNED_ENV,
  UNSIGNED_SLOT,
  UNSIGNED_CONFIG_CONTENT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
