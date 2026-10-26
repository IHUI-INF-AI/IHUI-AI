#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产号池接入器物(2026-10-26 立)——把本机 Trae 票(含设备证明密钥对)送进生产号池。
 *
 * 为什么需要它:桌面渠道签发的 Trae 票只能由签发它的设备身份续(ExchangeToken 带 DeviceProof),
 * 而生产机没有 Trae 客户端 ⇒ 必须由本机把「票 + deviceId/machineId + 两把 PEM」一起投递,
 * 由**生产进程**用它自己的 CREDENTIALS_ENCRYPTION_KEY 加密落库(绕过进程直接写库会解不开)。
 *
 * 凭据纪律:admin JWT 只从环境变量 `IHUI_ADMIN_JWT` 读,**不落盘、不进日志、不进 argv**
 * (argv 会被 ps 看到);载荷文件由 `--payload` 指定,读入后只打印字段存在性,绝不回显明文。
 *
 * 用法:
 *   IHUI_ADMIN_JWT=<token> node scripts/relay-prod-ingest.mjs \
 *     --payload .ihui-agent/state/prod-ingest/trae-account.json \
 *     --base https://api.aizhs.top [--dry-run]
 * 退出码(现读):0 成功 / 1 上游拒绝或校验失败 / 2 未判定(缺凭据/缺载荷/网络不可达)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

/** 载荷自检:四件套缺一不可(缺了生产侧刷不动票,投递就没意义) */
export function judgePayload(p) {
  const problems = []
  const acc = p?.accounts?.[0]
  if (!acc) return ['载荷里没有 accounts[0]']
  if (p.providerCode !== 'trae') problems.push(`providerCode 应为 trae,实际 ${p.providerCode}`)
  for (const k of ['uid', 'token', 'refreshToken', 'deviceId', 'deviceKeyPem', 'devicePubPem']) {
    if (typeof acc[k] !== 'string' || acc[k].trim() === '') problems.push(`缺 ${k}`)
  }
  if (acc.deviceKeyPem && !/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(acc.deviceKeyPem))
    problems.push('deviceKeyPem 不是 PEM 私钥形态')
  if (acc.devicePubPem && !/-----BEGIN PUBLIC KEY-----/.test(acc.devicePubPem))
    problems.push('devicePubPem 不是 PEM 公钥形态')
  return problems
}

async function main() {
  const base = (arg('--base') ?? 'https://api.aizhs.top').replace(/\/+$/, '')
  const payloadPath = arg('--payload')
  const dryRun = process.argv.includes('--dry-run')
  if (!payloadPath) {
    console.error('❌ 缺 --payload <文件>')
    return 2
  }
  let payload
  try {
    payload = JSON.parse(readFileSync(resolve(ROOT, payloadPath), 'utf8'))
  } catch (e) {
    console.error(`❌ 载荷读不出/非法 JSON:${e?.message ?? e} ⇒ 未判定`)
    return 2
  }
  const problems = judgePayload(payload)
  if (problems.length > 0) {
    console.error('❌ 载荷自检不过(投递前就拦,不把半成品送生产):')
    for (const p of problems) console.error('   - ' + p)
    return 1
  }
  const acc = payload.accounts[0]
  console.log(
    `载荷: provider=trae uid=${String(acc.uid).slice(0, 4)}**** deviceId=${acc.deviceId} ` +
      `keyPem=${acc.deviceKeyPem.length}B pubPem=${acc.devicePubPem.length}B`,
  )

  const jwt = process.env.IHUI_ADMIN_JWT ?? ''
  if (!jwt.trim()) {
    console.error(
      '❌ 缺 IHUI_ADMIN_JWT(admin 会话令牌,只从环境变量读,不进 argv/日志)⇒ 未判定',
    )
    return 2
  }
  if (dryRun) {
    console.log('DRY-RUN:载荷与凭据齐备,未发请求')
    return 0
  }

  const url = `${base}/api/admin/relay/accounts/import`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    console.error(`❌ 网络不可达(${url}):${e?.message ?? e} ⇒ 未判定`)
    return 2
  }
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    console.error(`❌ 生产拒绝:HTTP ${res.status} ${text.slice(0, 300)}`)
    return res.status === 401 || res.status === 403 ? 2 : 1
  }
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* 非 JSON 也按成功处理,但回读验证会兜底 */
  }
  const item = body?.data?.items?.[0] ?? body?.items?.[0] ?? null
  console.log(
    `✅ 导入返回:HTTP ${res.status} status=${item?.status ?? '?'} uid=${item?.uid ?? '?'} reason=${item?.reason ?? '-'}`,
  )
  if (item && item.status !== 'imported' && item.status !== 'updated') {
    console.error('❌ 生产侧未按预期写入(见 reason)⇒ 需人工确认')
    return 1
  }
  console.log('提示:生产侧是否真能自续,以生产 worker 下轮 sweep 的 last_refresh_at 为准(本器只证投递成功)。')
  return 0
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(await main())
export const __test__ = { judgePayload }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
