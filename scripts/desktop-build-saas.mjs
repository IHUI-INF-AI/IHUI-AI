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
import { mkdirSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 与 scripts/desktop-artifact-single.mjs 共用同一个开关:一处开,签名步与 .sig 断言同时放行 */
const ALLOW_UNSIGNED_ENV = 'DESKTOP_ALLOW_UNSIGNED'
const allowUnsignedFrom = (env) => env?.[ALLOW_UNSIGNED_ENV] === '1'

/** 临时 config 只允许落在仓库内(§15 工作区卫生),路径由脚本自身位置推导,不写死盘符 */
const unsignedConfigPath = (root) => path.join(root, '.ihui-agent', 'tmp', 'desktop-build-saas', 'tauri.unsigned.json')
/** 唯一被覆盖的字段:关掉 updater 产物(签名),不动 pubkey/bundle 目标/版本号等任何发版形态 */
const UNSIGNED_CONFIG_CONTENT = `${JSON.stringify({ bundle: { createUpdaterArtifacts: false } }, null, 2)}\n`

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
  const cmd = npmExecpath ? execPath : 'pnpm'
  const prefix = npmExecpath ? [npmExecpath] : []
  const shell = !npmExecpath
  if (!allowUnsigned) {
    return { cmd, args: [...prefix, '--filter', '@ihui/desktop', 'build'], shell, configPath: null, tail: null }
  }
  const configPath = unsignedConfigPath(root)
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

  // 走与 pnpm 脚本相同的执行器:pnpm 运行时 npm_execpath 指向 pnpm 本体(node 直跑),
  // 避免 Windows 下对 pnpm.cmd 的 shell 解析依赖。
  const allowUnsigned = allowUnsignedFrom(process.env)
  const plan = buildPlan({
    npmExecpath: process.env.npm_execpath,
    execPath: process.execPath,
    root: repoRoot,
    allowUnsigned,
  })

  if (allowUnsigned) {
    console.log(`[desktop-build-saas] !! ${ALLOW_UNSIGNED_ENV}=1 —— 本地未签名打包(显式豁免):`)
    console.log(`  !! 向 tauri 传 --config(绝对路径)关掉 bundle.createUpdaterArtifacts: ${plan.configPath}`)
    console.log(`  !! 尾部脚本 desktop-artifact-single.mjs 同受该 env 放行"缺 .sig"一项判据`)
    console.log('  !! 产物未签名:不得进更新源、不得发版、不得上传任何下载/更新 CDN')
    mkdirSync(path.dirname(plan.configPath), { recursive: true })
    writeFileSync(plan.configPath, UNSIGNED_CONFIG_CONTENT)
  }

  try {
    const r = spawnSync(plan.cmd, plan.args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
      shell: plan.shell,
      windowsHide: true,
    })
    let code = r.status ?? 1
    // 豁免分支绕过了端内 build 脚本的 `&&` 尾部,这里显式补跑同一条收敛钩子(env 已透传)
    if (code === 0 && plan.tail) {
      const t = spawnSync(plan.tail.cmd, plan.tail.args, {
        cwd: repoRoot,
        stdio: 'inherit',
        env: process.env,
        windowsHide: true,
      })
      code = t.status ?? 1
    }
    return code
  } finally {
    if (plan.configPath) {
      rmSync(plan.configPath, { force: true })
      // 目录只在自己空的时候才收(rmdirSync 对非空目录抛 ENOTEMPTY),不得连带删掉别人的现场
      try {
        rmdirSync(path.dirname(plan.configPath))
      } catch {
        /* 目录非空(他人正在用)⇒ 保留,不算本脚本的残留 */
      }
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

export const __test__ = { buildPlan, unsignedConfigPath, UNSIGNED_CONFIG_CONTENT, allowUnsignedFrom, ALLOW_UNSIGNED_ENV }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
