// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 客户端会话定期回灌(2026-10-24 立)—— 客户端为主策略的取数端。
 *
 * 链路:本机 Trae 客户端信封(scripts/lib/trae-auth-extract.mjs 解密)→ stdin JSON →
 * apps/api/scripts/relay-trae-session-sync.ts(tsx,判据 + 落库 + credVersion+1)。
 * 由 apps/api/src/workers/relay-account-pool-worker.ts 的 `trae-session-sync` 定时任务
 * 每 10 分钟派发;也可人工跑:
 *
 *   node scripts/sync-trae-client-session.mjs [--dry-run] [--json]
 *
 * 判据(同票不写 / 池内更新不写 / 客户端更新才写)在 ts 脚本内,本文件只做提取与编排,
 * 不复制第二份规则(§0.6)。退出码:0 全部处理完(含 skip)/ 1 落库失败 / 2 未判定
 * (本机没有 Trae 客户端 / 信封解不开 / tsx 缺失)。
 *
 * 安全:令牌只在两个进程的管道里流动,任何输出都不含凭据明文。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const API_DIR = path.join(ROOT, 'apps', 'api')
const SYNC_TS = path.join(API_DIR, 'scripts', 'relay-trae-session-sync.ts')

export function parseArgs(argv) {
  const options = { dryRun: false, json: false, help: false, error: null }
  for (const a of argv) {
    if (a === '--dry-run') options.dryRun = true
    else if (a === '--json') options.json = true
    else if (a === '--help' || a === '-h') options.help = true
    else options.error = `未知参数: ${a}`
  }
  return options
}

/** 提取结果 → 同步脚本的 stdin 载荷(纯函数,测试锁形状;绝不带凭据以外的东西) */
export function buildPayload(extracted) {
  const accounts = (Array.isArray(extracted?.accounts) ? extracted.accounts : []).map((a) => ({
    uid: a.uid,
    token: a.token,
    ...(a.refreshToken ? { refreshToken: a.refreshToken } : {}),
    ...(a.expiresAt ? { expiresAt: a.expiresAt } : {}),
    ...(a.refreshExpiresAt ? { refreshExpiresAt: a.refreshExpiresAt } : {}),
    // 设备材料(2026-10-25):新版 ExchangeToken 用设备私钥签名换票;缺它池子只能走
    // 旧通道,桌面渠道签发的票会被 10101 拒。随会话一起回灌,池侧自愈。
    ...(a.deviceId ? { deviceId: a.deviceId } : {}),
    ...(a.machineId ? { machineId: a.machineId } : {}),
    ...(a.deviceKeyPem ? { deviceKeyPem: a.deviceKeyPem } : {}),
    ...(a.devicePubPem ? { devicePubPem: a.devicePubPem } : {}),
    // 档案快照(2026-10-28):一键切号写回信封的原料,随会话一并回灌(落 secretsEnc 加密档)
    ...(a.profile ? { profile: a.profile } : {}),
    // 会话模板(2026-10-27):本机当前登录号的账号资料(凭证已剔除)。随票回灌让池侧
    // 「登录本机」模板与本机保持一致;池侧按合并语义落 secretsEnc,不会抹掉设备材料。
    ...(a.sessionTemplate ? { sessionTemplate: a.sessionTemplate } : {}),
  }))
  return { providerCode: 'trae', accounts, meta: extracted?.meta ?? {} }
}

function resolveTsx() {
  for (const candidate of [
    path.join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function runSyncTs(payloadText, dryRun) {
  const tsx = resolveTsx()
  if (!tsx) {
    return Promise.resolve({
      code: 2,
      json: null,
      error: '未找到 tsx(apps/api/node_modules/tsx);先在仓根 pnpm install',
    })
  }
  const args = [tsx, SYNC_TS, '--stdin', '--json']
  if (dryRun) args.push('--dry-run')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: API_DIR,
      windowsHide: true,
      // 带输入必须三段全接管(AGENTS §12g)
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), 120_000)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ code: 2, json: null, error: e.message })
    })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      // ts 侧 stdout 可能混有 db 连接等噪音行(console.log)⇒ 逐行找可解析的 JSON 汇总
      let json = null
      for (const line of stdout.split(/\r?\n/)) {
        const t = line.trim()
        if (!t.startsWith('{')) continue
        try {
          json = JSON.parse(t)
        } catch {
          /* 不是汇总行,继续找 */
        }
      }
      resolve({
        code: signal ? 2 : (code ?? 2),
        json,
        error: json
          ? null
          : (stderr || `退出码 ${code ?? '?'}${signal ? ` 信号 ${signal}` : ''}`).slice(0, 300),
      })
    })
    child.stdin.write(payloadText)
    child.stdin.end()
  })
}

async function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n`)
    return 2
  }
  if (parsed.help) {
    process.stdout.write(
      '用法: node scripts/sync-trae-client-session.mjs [--dry-run] [--json]\n' +
        '读取本机 Trae 客户端会话并回灌号池(客户端为主策略的取数端;判据在 apps/api/scripts/relay-trae-session-sync.ts)。\n',
    )
    return 0
  }

  const { extractTraeAccount } = await import(
    pathToFileURL(path.join(ROOT, 'scripts', 'lib', 'trae-auth-extract.mjs')).href
  )
  let extracted
  try {
    extracted = extractTraeAccount()
  } catch (e) {
    process.stderr.write(
      `❌ 提取失败(未判定): [${e?.code ?? 'extract-failed'}] ${e instanceof Error ? e.message : String(e)}\n`,
    )
    return 2
  }
  const meta = extracted.meta
  process.stderr.write(
    `提取: uid=${meta.uid} 名称=${meta.name} token到期=${meta.tokenExpiresAt ?? '-'} ` +
      `rt到期=${meta.refreshExpiresAt ?? '-'} 指纹=${meta.tokenFingerprint} (access ${meta.accessTokenLength}B / refresh ${meta.refreshTokenLength}B)\n`,
  )

  const result = await runSyncTs(JSON.stringify(buildPayload(extracted)), parsed.dryRun)
  if (result.error) {
    process.stderr.write(`❌ 同步失败(未判定): ${result.error}\n`)
    return 2
  }
  if (parsed.json && result.json) {
    process.stdout.write(`${JSON.stringify(result.json)}\n`)
  } else if (result.json) {
    const s = result.json
    process.stderr.write(
      `回灌完成: applied=${s.applied} skipped=${s.skipped} missing=${s.missing} failed=${s.failed}${s.dryRun ? '(dry-run 未写)' : ''}\n`,
    )
    for (const r of s.rows ?? []) {
      process.stderr.write(
        `  ${r.uid} ${r.decision}${r.applied ? ' ✓已写' : ''}${r.error ? ` (${r.error})` : ''}\n`,
      )
    }
  }
  return result.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(2)
    })
}

export const __test__ = { parseArgs, buildPayload }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
