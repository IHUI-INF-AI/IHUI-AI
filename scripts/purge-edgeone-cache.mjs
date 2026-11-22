#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * EdgeOne HTML 缓存刷新 —— 部署环收尾步骤(2026-11-17 立)
 *
 * 为什么需要它:EdgeOne 对 HTML 返回的是源站 Next 发出的
 * `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`。
 * 源站换包后,边缘节点在 SWR 窗口内仍会持续吐旧副本,而旧副本里引用的
 * `_next/static/chunks/*.js` 在新产物目录中已不存在 ⇒ 用户看到旧页面或白屏。
 * 实测两次构建 1087 个 chunk 差 1 个,但只要切流就可能命中这种"旧 HTML 引旧 chunk"。
 * 解法只能是部署后主动失效缓存(EdgeOne 不会因源站更新自动失效)。
 *
 * 设计约束:
 * - **失败不阻塞部署**:取不到密钥/SDK/接口异常一律 exit 0 并打印 SKIP/WARN,
 *   部署本身已经成功,刷新缓存是尽力而为的收尾。
 * - 凭据只从密钥库读(`scripts/lib/key-dir.mjs` 单一出口),不入仓、不落日志明文。
 * - SDK 装在仓库外工具目录(默认 D:/DevEnv/tools/tc-sdk),不污染生产依赖;
 *   换机后需在该目录 `npm i tencentcloud-sdk-nodejs-teo` 一次。
 *
 * 用法: node scripts/purge-edgeone-cache.mjs [--host aizhs.top] [--dry-run]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { resolveSecretsRoot } = await import('./lib/key-dir.mjs')

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = dirname(HERE)
const SDK_ROOT = process.env.IHUI_TEO_SDK_ROOT || 'D:/DevEnv/tools/tc-sdk'
const CRED_NAME = '腾讯云SecretKey.csv'
const ZONE_CACHE = join(REPO, 'deploy', 'run', 'edgeone-zone.json')

const argv = process.argv.slice(2)
const hostArg = argv.indexOf('--host')
const HOST = (hostArg >= 0 && argv[hostArg + 1]) || 'aizhs.top'
const DRY_RUN = argv.includes('--dry-run')

const out = (m) => console.log('[purge-cdn] ' + m)
const skip = (m) => {
  console.log('[purge-cdn] SKIP ' + m)
  process.exit(0)
}

// ① 凭据:密钥库根解析不出来就跳过,不猜盘符
const secretsRoot = resolveSecretsRoot()
if (!secretsRoot) skip('密钥库根目录取不到(候选盘均无 BaiduSyncdisk/密钥)')
const credPath = join(secretsRoot, CRED_NAME)
if (!existsSync(credPath)) skip('腾讯云凭据文件不存在:' + credPath)

const rows = readFileSync(credPath, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
const creds = rows
  .slice(1)
  .map((l) => l.split(',').map((s) => s.trim()))
  .filter((p) => p[0] && p[1])
  .map((p) => ({ secretId: p[0], secretKey: p[1] }))
if (creds.length === 0) skip('凭据文件里没有 SecretId,SecretKey 行:' + credPath)

// ② SDK:仓库外工具目录,缺了就跳过(部署不受影响)
const sdkPkg = join(SDK_ROOT, 'package.json')
const sdkModule = join(SDK_ROOT, 'node_modules', 'tencentcloud-sdk-nodejs-teo')
if (!existsSync(sdkModule)) skip('腾讯云 SDK 未安装(在 ' + SDK_ROOT + ' 执行 npm i tencentcloud-sdk-nodejs-teo)')
const requireSdk = createRequire(sdkPkg)
let sdk
try {
  sdk = requireSdk('tencentcloud-sdk-nodejs-teo')
} catch (e) {
  skip('SDK 加载失败:' + (e?.message || e))
}

const Client = sdk?.teo?.v20220901?.Client
if (!Client) skip('SDK 结构异常:缺 teo.v20220901.Client')

// ③ ZoneId:优先读本地缓存,否则 DescribeZones 查一次并落缓存(避免每轮多一次 API 调用)
const readZoneCache = () => {
  try {
    const raw = JSON.parse(readFileSync(ZONE_CACHE, 'utf8'))
    if (raw && raw.host === HOST && raw.zoneId) return raw.zoneId
  } catch {
    /* 缓存缺失/损坏都按"没有"处理 */
  }
  return null
}
const writeZoneCache = (zoneId, zoneName) => {
  try {
    mkdirSync(dirname(ZONE_CACHE), { recursive: true })
    writeFileSync(ZONE_CACHE, JSON.stringify({ host: HOST, zoneId, zoneName, at: new Date().toISOString() }, null, 2))
  } catch (e) {
    out('WARN zone 缓存写不进去(不影响刷新):' + (e?.message || e))
  }
}

let exitCode = 0
for (const c of creds) {
  const client = new Client({
    credential: { secretId: c.secretId, secretKey: c.secretKey },
    region: '',
    profile: { httpProfile: { endpoint: 'teo.tencentcloudapi.com', reqTimeout: 30 } },
  })
  try {
    let zoneId = readZoneCache()
    if (!zoneId) {
      const zones = await client.DescribeZones({ Limit: 100, Offset: 0 })
      const hit = (zones.Zones || []).find((z) => (z.ZoneName || '').toLowerCase() === HOST.toLowerCase())
      if (!hit) {
        out('WARN 账号下没有域名 ' + HOST + '(已有:' + JSON.stringify((zones.Zones || []).map((z) => z.ZoneName)) + ')')
        continue
      }
      zoneId = hit.ZoneId
      writeZoneCache(zoneId, hit.ZoneName)
    }

    if (DRY_RUN) {
      out('DRY 将失效 ' + HOST + ' 的 EDGE 缓存(zone=' + zoneId + ')')
      continue
    }

    const res = await client.CreatePurgeTask({
      ZoneId: zoneId,
      Type: 'purge_host',
      Targets: [HOST],
      Method: 'invalidate',
    })
    const failed = Array.isArray(res.FailedList) ? res.FailedList : []
    out('OK host=' + HOST + ' zone=' + zoneId + ' job=' + (res.JobId || '?') + ' failed=' + failed.length + (failed.length ? ' ' + JSON.stringify(failed) : ''))
  } catch (e) {
    out('WARN 刷新失败(不影响本轮发布):' + (e?.message || e))
    exitCode = 0 // 明确非阻塞:部署已经成功,这里是收尾
  }
}

process.exit(exitCode)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
