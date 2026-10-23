#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder chat 契约探针 —— 用**官方 SDK** 真机发一条消息。
 *
 * 背景（2026-10-23 实测定案，详见 outputs/qoder-上游接口参数覆盖矩阵-2026-10-23.md）：
 * - chat 真实端点 = POST https://gateway.qoder.com.cn/algo/api/v2/service/pro/sse/agent_chat_generation
 *   （全量 1378 个 run、81188 次真实调用统计得出）
 * - `/algo/*` 路由要求 **umid 设备签名**（resources/umid/runtime-info.exe + sgsdk.dll），
 *   外部不可复刻 ⇒ 直连必然 403 {"code":"101","message":"Signature invalid"} 或挂住。
 * - 官方 SDK = @qoder-ai/qoder-cn-agent-sdk（真名 @ali/qodercn-agent-sdk-next v1.0.55），
 *   打包在 app.asar 内，worker 自己会走 umid 签名 ⇒ **这是唯一可持续的 chat 通路**。
 * - SDK 鉴权只接受 **PAT**：device token（dt-）会被 exchangePersonalToken 拒为
 *   access_token_invalid；本机 IDE 登录态里没有 PAT。
 *
 * 用法：
 *   QODER_PAT=<个人访问令牌> node scripts/qoder-sdk-chat-probe.mjs [prompt]
 *
 * PAT 生成入口：https://qoder.com.cn/account/integrations
 *
 * 本脚本只读、幂等、无副作用；失败如实退出非 0，绝不伪造成功。
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PROMPT = process.argv[2] || '只回复一个词: pong'
const TIMEOUT_MS = Number(process.env.QODER_PROBE_TIMEOUT_MS || 120000)

/** 候选安装根目录（env 优先，其余为常见落点） */
const APP_DIR_CANDIDATES = [
  process.env.QODER_APP_DIR,
  'D:/电脑软件/Qoder CN',
  'C:/Program Files/Qoder CN',
  'C:/Program Files (x86)/Qoder CN',
].filter(Boolean)

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

/** 解析出真正在跑的运行时根（优先 .qoder-versions/<最高版本>/） */
function resolveRuntimeRoot() {
  for (const dir of APP_DIR_CANDIDATES) {
    if (!isDir(dir)) continue
    const versionsDir = path.join(dir, '.qoder-versions')
    if (isDir(versionsDir)) {
      const vers = fs
        .readdirSync(versionsDir)
        .filter((v) => /^\d+\.\d+\.\d+$/.test(v))
        .sort((a, b) => {
          const pa = a.split('.').map(Number)
          const pb = b.split('.').map(Number)
          for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i]
          return 0
        })
      for (const v of vers) {
        const root = path.join(versionsDir, v)
        if (isFile(path.join(root, 'Qoder CN.exe'))) return { root, version: v }
      }
    }
    if (isFile(path.join(dir, 'Qoder CN.exe'))) return { root: dir, version: 'unknown' }
  }
  return null
}

const rt = resolveRuntimeRoot()
if (!rt) {
  console.error(
    'QODER_APP_NOT_FOUND: 未找到 Qoder CN 安装。请设置 QODER_APP_DIR 指向安装根目录（含 Qoder CN.exe）。',
  )
  process.exit(3)
}

const exePath = path.join(rt.root, 'Qoder CN.exe')
const sdkEntry = path.join(
  rt.root,
  'resources/app.asar/node_modules/@qoder-ai/qoder-cn-agent-sdk/dist/index.js',
)

// ── 非 Electron 环境：用 Electron-as-Node 重新拉起自己（Electron 的 fs 才能读 asar）──
if (!process.versions.electron) {
  if (!isFile(exePath)) {
    console.error(`QODER_EXE_MISSING: ${exePath}`)
    process.exit(3)
  }
  const r = spawnSync(exePath, [process.argv[1], PROMPT], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
  if (r.error) {
    console.error('SPAWN_FAIL:', r.error.message)
    process.exit(4)
  }
  process.exit(r.status ?? 1)
}

// ── Electron-as-Node 分支：加载官方 SDK 并发消息 ──
console.log(`[probe] runtime root = ${rt.root} (v${rt.version})`)

if (!fs.existsSync(sdkEntry)) {
  console.error(`SDK_NOT_FOUND: ${sdkEntry}`)
  process.exit(3)
}

const PAT = (process.env.QODER_PAT || '').trim()
const DEV_TOKEN = (process.env.QODER_DEV_TOKEN || '').trim()
const DEV_EXP = Number(process.env.QODER_DEV_TOKEN_EXP || 0)
if (!PAT && !DEV_TOKEN) {
  // 已跑过 `qoderclicn login` 的机器无需任何 token：worker 直接读 CLI 登录态。
  console.log(
    '[probe] 未提供 QODER_DEV_TOKEN / QODER_PAT ⇒ 改用 qodercli 已登录凭证(qodercliAuth)。\n' +
      '  推荐（2026-10-23 实证可用，无需 PAT、无需浏览器授权）：\n' +
      '    QODER_DEV_TOKEN=<dt-...> QODER_DEV_TOKEN_EXP=<到期毫秒> node scripts/qoder-sdk-chat-probe.mjs\n' +
      '  其余途径：qoderclicn login 完成浏览器授权；或 PAT https://qoder.com.cn/account/integrations',
  )
}

const timer = setTimeout(() => {
  console.error(`PROBE_TIMEOUT after ${TIMEOUT_MS}ms`)
  process.exit(2)
}, TIMEOUT_MS)

const mod = await import('file:///' + sdkEntry.replace(/\\/g, '/'))
console.log(
  `[probe] sdk loaded: exports=${Object.keys(mod).length} query=${typeof mod.query} accessToken=${typeof mod.accessToken}`,
)

const t0 = Date.now()
let n = 0
let streamed = ''
try {
  // 三条鉴权通道，按实证可靠度排序：
  // 1) jobToken —— IDE 把 device token 交给 worker 的官方通道
  //    (worker 侧 applyExternalToken(token,"host-job-token"))，**无需 PAT/浏览器**；
  // 2) accessToken(PAT) —— worker 走 exchangePersonalToken 换票；
  // 3) qodercliAuth —— 读 `qoderclicn login` 落盘的登录态。
  const auth =
    DEV_TOKEN && DEV_EXP
      ? mod.jobToken(async () => ({ token: DEV_TOKEN, expiresAt: DEV_EXP }))
      : PAT
        ? mod.accessToken(PAT)
        : mod.qodercliAuth()
  console.log(`[probe] auth = ${DEV_TOKEN && DEV_EXP ? 'jobToken(device token)' : PAT ? 'accessToken(PAT)' : 'qodercliAuth'}`)
  const it = mod.query({
    prompt: PROMPT,
    options: {
      cwd: process.cwd(),
      auth,
    },
  })
  for await (const msg of it) {
    n++
    const elapsed = Date.now() - t0
    if (msg && msg.type === 'assistant' && msg.message) {
      const txt = JSON.stringify(msg.message).slice(0, 300)
      console.log(`[probe] assistant#${n} (${elapsed}ms) ${txt}`)
      streamed += txt
    } else {
      console.log(`[probe] msg#${n} type=${msg && msg.type} (${elapsed}ms) ${JSON.stringify(msg).slice(0, 400)}`)
    }
    if (msg && msg.type === 'result') {
      console.log(
        `[probe] RESULT subtype=${msg.subtype} is_error=${msg.is_error} result=${JSON.stringify(msg.result)?.slice(0, 200)}` +
          ` errors=${JSON.stringify(msg.errors || [])} stop=${msg.stop_reason} credits=${msg.total_credits}`,
      )
      if (msg.is_error) {
        clearTimeout(timer)
        process.exit(1)
      }
    }
    if (n > 200) break
  }
  console.log(`[probe] DONE msgs=${n} elapsed=${Date.now() - t0}ms`)
  clearTimeout(timer)
  setTimeout(() => process.exit(Math.max(0, streamed.length ? 0 : 1)), 200)
} catch (e) {
  clearTimeout(timer)
  console.error(`[probe] QUERY_ERR ${e && e.name}: ${String(e && e.message).slice(0, 500)}`)
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
