#!/usr/bin/env node
/**
 * 桌面端 SaaS 联调模式(2026-09-02 立):dev 模式桌面端连接线上生产后端。
 *
 * 与 `build:desktop:saas`(打包时烘焙线上地址)互补 —— 本脚本用于**日常开发联调**,
 * 不需要走完整的 tauri build 打包流程(数分钟级),保留热重载能力。
 *
 * 背景与三个必踩的坑(2026-09-02 实测):
 *   1. 端口占用:tauri.conf.json 的 devUrl 固定 http://localhost:8801,若 8801 已被
 *      其他 next dev 占用,beforeDevCommand 启动的 dev server 会漂移到 8802 →
 *      窗口加载 devUrl 失败白屏。故本脚本先释放 8801 再自行拉起。
 *   2. exe 占用:cargo 链接阶段要删除 target/debug/ihui-desktop.exe,若上一个桌面端
 *      实例仍在运行 → `failed to remove file ... 拒绝访问 (os error 5)`。故先停旧实例。
 *   3. 会话生命周期:next dev 若由会话内的后台任务托管,会话结束即被杀 → 桌面端白屏。
 *      故以 detached 进程常驻启动,脱离父进程生命周期。
 *
 * 另:beforeDevCommand 被覆盖为空(`--config` 合并),避免 Tauri 二次拉起 dev server
 * 与脚本自己启动的实例抢端口。
 *
 * 用法:
 *   pnpm dev:desktop:saas                                        # 默认连 https://aizhs.top
 *   NEXT_PUBLIC_API_BASE_URL=https://api.aizhs.top pnpm dev:desktop:saas   # 换后端
 *   node scripts/desktop-dev-saas.mjs --keep-dev-server          # 保留 8801 现有 dev server
 */
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webDir = path.join(repoRoot, 'apps', 'web')
const desktopDir = path.join(repoRoot, 'apps', 'desktop')
const DEV_PORT = 8801
const DESKTOP_EXE = 'ihui-desktop.exe'
const nextBin = path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next')

const keepDevServer = process.argv.includes('--keep-dev-server')
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://aizhs.top').replace(/\/+$/, '')
// WS 默认走 api 子域:实测主域 aizhs.top 对 /cozeZhsApi/*、/v1/ai/capabilities/* 的
// WebSocket 升级失败(000),而 api.aizhs.top 全路径返回 101(见 apps/web/src/lib/ws-url.ts)。
const wsBase = (process.env.NEXT_PUBLIC_WS_BASE_URL || 'https://api.aizhs.top').replace(/\/+$/, '')

/** 注入到 next dev 进程的线上后端地址(NEXT_PUBLIC_* 会被编译进客户端产物) */
const devEnv = {
  NEXT_PUBLIC_API_BASE_URL: apiBase,
  NEXT_PUBLIC_STREAM_API_BASE_URL: process.env.NEXT_PUBLIC_STREAM_API_BASE_URL || apiBase,
  NEXT_PUBLIC_WS_BASE_URL: wsBase,
  NEXT_PUBLIC_AI_SERVICE_URL: process.env.NEXT_PUBLIC_AI_SERVICE_URL || apiBase,
  // 服务端侧变量(SSR 取数),保持与客户端同源,避免回落到未启动的本地 8802
  API_URL: apiBase,
  AI_SERVICE_URL: apiBase,
}

const log = (msg) => console.log(`[desktop-dev-saas] ${msg}`)

/** 查询监听指定端口的 PID 列表(Windows netstat;Linux/macOS 用 lsof 兜底) */
function listenersOfPort(port) {
  if (process.platform === 'win32') {
    const r = spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
    if (r.status !== 0 || !r.stdout) return []
    return [
      ...new Set(
        r.stdout
          .split('\n')
          .filter((line) => line.includes('LISTENING') && new RegExp(`[:.]${port}\\s`).test(line))
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((pid) => /^\d+$/.test(pid)),
      ),
    ]
  }
  const r = spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' })
  return r.status === 0 && r.stdout ? r.stdout.split('\n').filter(Boolean) : []
}

/** 停止占用 8801 的进程,释放端口给带线上 env 的 dev server */
function freePort(port) {
  const pids = listenersOfPort(port)
  if (pids.length === 0) {
    log(`端口 ${port} 空闲,无需释放`)
    return
  }
  log(`端口 ${port} 被占用(pid=${pids.join(',')}),停止以注入线上后端地址...`)
  for (const pid of pids) {
    spawnSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' })
  }
}

/** 停止残留的桌面端实例(否则 cargo 链接阶段删不掉 exe → os error 5) */
function stopRunningDesktop() {
  if (process.platform !== 'win32') return
  const r = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${DESKTOP_EXE}`], { encoding: 'utf8' })
  if (!r.stdout || !r.stdout.includes(DESKTOP_EXE)) {
    log('无残留桌面端实例')
    return
  }
  log(`检测到运行中的 ${DESKTOP_EXE},先停止(避免 cargo 链接失败)...`)
  spawnSync('taskkill', ['/IM', DESKTOP_EXE, '/F'], { stdio: 'ignore' })
}

/** 轮询等待端口可连接 */
async function waitForPort(port, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ port, host: '127.0.0.1' })
      const done = (v) => {
        socket.destroy()
        resolve(v)
      }
      socket.setTimeout(1000)
      socket.once('connect', () => done(true))
      socket.once('error', () => done(false))
      socket.once('timeout', () => done(false))
    })
    if (ok) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

log('线上后端地址:')
for (const [k, v] of Object.entries(devEnv)) log(`  ${k} = ${v}`)

if (!keepDevServer) freePort(DEV_PORT)
stopRunningDesktop()

// detached 常驻:脱离本脚本/会话生命周期,关闭终端后桌面端仍可正常使用
const nextBinExists = spawnSync(process.execPath, ['-e', `require('node:fs').accessSync(${JSON.stringify(nextBin)})`], { stdio: 'ignore' })
if (nextBinExists.status !== 0) {
  console.error(`[desktop-dev-saas] 未找到 next 二进制: ${nextBin}\n请先执行 pnpm install`)
  process.exit(1)
}

log(`启动常驻 dev server: http://localhost:${DEV_PORT}`)
const dev = spawn(process.execPath, [nextBin, 'dev', '--turbopack', '-p', String(DEV_PORT)], {
  cwd: webDir,
  env: { ...process.env, ...devEnv },
  detached: true,
  stdio: 'ignore',
})
dev.unref()

const ready = await waitForPort(DEV_PORT)
if (!ready) {
  console.error(`[desktop-dev-saas] dev server 在超时时间内未监听 ${DEV_PORT},请检查 ${webDir} 下依赖是否完整`)
  process.exit(1)
}
log(`dev server 已就绪(pid=${dev.pid})`)

// 覆盖 beforeDevCommand:dev server 已由本脚本启动,Tauri 不再重复拉起
const configOverride = JSON.stringify({ build: { beforeDevCommand: '' } })
const npmExec = process.env.npm_execpath ? process.execPath : 'pnpm'
const args = process.env.npm_execpath
  ? [process.env.npm_execpath, '--filter', '@ihui/desktop', 'exec', 'tauri', 'dev', '--config', configOverride]
  : ['--filter', '@ihui/desktop', 'exec', 'tauri', 'dev', '--config', configOverride]

log('启动 Tauri 桌面端(首次需编译 Rust,约 30-60s)...')
const r = spawnSync(npmExec, args, {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
  shell: !process.env.npm_execpath,
})
process.exit(r.status ?? 1)
