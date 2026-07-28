#!/usr/bin/env node
// indexnow-push.mjs — IndexNow 主动推送脚本(Bing/Yandex/Seznam 收录加速)
//
// 用途:站点每次发布/更新后,主动推送 URL 列表到 IndexNow,
//       让 Bing/Yandex/Seznam 在 24h 内发现新页面(无需等爬虫)。
//
// 用法:
//   # 1. 首次配置(只需一次)
//   #   1.1 访问 https://www.bing.com/webmasters/ 注册并验证 ihui.ai
//   #   1.2 在 Bing Webmaster Tools → Settings → IndexNow 获取 API key
//   #       或自行生成: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
//   #   1.3 把 key 写入 .env:INDEXNOW_KEY=<key>
//   #   1.4 把 key 字符串写到 apps/web/public/<key>.txt(无换行,1 行,内容就是 key 本身)
//   #   1.5 部署后验证:curl https://ihui.ai/<key>.txt 应返回 key 本身
//
//   # 2. 每次发布后推送
//   #   node scripts/marketing/indexnow-push.mjs                   # 推送 sitemap.xml 所有 URL
//   #   node scripts/marketing/indexnow-push.mjs --urls a,b,c      # 推送指定 URL
//   #   node scripts/marketing/indexnow-push.mjs --dry-run         # 仅打印,不发请求
//   #   node scripts/marketing/indexnow-push.mjs --sitemap <url>   # 自定义 sitemap URL
//
// 协议文档:https://www.indexnow.org/documentation
// IndexNow 端点:https://api.indexnow.org/indexnow(统一入口,Bing/Yandex/Seznam 共用)
//
// 环境变量:
//   INDEXNOW_KEY  - IndexNow API key(必填)
//   SITE_URL      - 站点根 URL(默认 https://ihui.ai)

import { readFileSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

// ==================== 配置 ====================
const SITE_URL = process.env.SITE_URL || 'https://ihui.ai'
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || ''
const ENDPOINTS = [
  'https://api.indexnow.org/indexnow', // IndexNow 统一入口(推荐)
  'https://www.bing.com/indexnow', // Bing 直接入口(冗余,加速收录)
]

// ==================== 参数解析 ====================
const args = process.argv.slice(2)
let urlsArg = null
let sitemapArg = null
let dryRun = false
let fromLocal = false
let help = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--urls' && args[i + 1]) urlsArg = args[i + 1].split(',').map((s) => s.trim()).filter(Boolean)
  if (args[i] === '--sitemap' && args[i + 1]) sitemapArg = args[i + 1]
  if (args[i] === '--dry-run') dryRun = true
  if (args[i] === '--from-local') fromLocal = true
  if (args[i] === '--help' || args[i] === '-h') help = true
}

if (help) {
  console.log(`
IndexNow 主动推送脚本

用法:
  node scripts/marketing/indexnow-push.mjs [options]

选项:
  --urls <url1,url2,...>  推送指定 URL(逗号分隔)
  --sitemap <url>         自定义 sitemap URL(默认: \${SITE_URL}/sitemap.xml)
  --from-local            从本地 apps/web/app/sitemap.ts 提取 URL(无需联网)
  --dry-run               仅打印待推送 URL,不发请求
  -h, --help              显示帮助

环境变量:
  INDEXNOW_KEY   IndexNow API key(必填)
  SITE_URL       站点 URL(默认 https://ihui.ai)

示例:
  # 推送 sitemap.xml 全部 URL
  node scripts/marketing/indexnow-push.mjs

  # 推送指定 URL
  node scripts/marketing/indexnow-push.mjs --urls https://ihui.ai/blog/post-1,https://ihui.ai/about

  # 从本地 sitemap.ts 提取(无需联网,用于 CI 预演)
  node scripts/marketing/indexnow-push.mjs --from-local

  # 试运行(不发送)
  node scripts/marketing/indexnow-push.mjs --dry-run

完整文档:https://www.indexnow.org/documentation
`)
  process.exit(0)
}

// ==================== 校验 ====================
if (!INDEXNOW_KEY && !dryRun) {
  console.error('\n[FAIL] INDEXNOW_KEY 未设置。\n')
  console.error('生成 key:')
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"\n')
  console.error('写入 .env:')
  console.error('  INDEXNOW_KEY=<key>\n')
  console.error('把 key 写到 apps/web/public/<key>.txt(无换行,内容就是 key 本身):')
  console.error('  echo "<key>" > apps/web/public/<key>.txt\n')
  console.error('部署后验证 key 文件可访问:')
  console.error('  curl https://ihui.ai/<key>.txt\n')
  console.error('提交 key 文件到 Bing Webmaster:')
  console.error('  https://www.bing.com/webmasters/ → Settings → IndexNow\n')
  process.exit(1)
}

if (INDEXNOW_KEY && INDEXNOW_KEY.length !== 32) {
  console.warn(`[WARN] INDEXNOW_KEY 长度异常: ${INDEXNOW_KEY.length} 字符(标准 32 字符 hex)`)
  console.warn('       继续执行,但 Bing 可能会拒绝')
}

// ==================== 获取 URL ====================
function extractUrlsFromSitemapTs() {
  // 从 apps/web/app/sitemap.ts 解析 PAGES 数组 + LOCALES
  // 格式:const PAGES = [ { path: '/foo', ... }, ... ]
  //     const LOCALES = ['zh-cn', 'en', ...]
  //     const SITE_URL = 'https://...'
  const localPath = resolve(PROJECT_ROOT, 'apps/web/app/sitemap.ts')
  if (!existsSync(localPath)) {
    throw new Error(`本地 sitemap.ts 不存在: ${localPath}`)
  }
  const content = readFileSync(localPath, 'utf-8')

  // 提取 SITE_URL
  const siteUrlMatch = content.match(/const SITE_URL\s*=\s*'([^']+)'/)
  const localSiteUrl = siteUrlMatch ? siteUrlMatch[1] : SITE_URL

  // 提取 LOCALES 数组
  const localesMatch = content.match(/const LOCALES\s*=\s*\[(.*?)\]\s*as\s+const/)
  const locales = localesMatch
    ? localesMatch[1]
        .split(',')
        .map((s) => s.trim().replace(/['"]/g, ''))
        .filter(Boolean)
    : ['zh-cn', 'en', 'ja', 'ko', 'zh-tw']

  // 提取 PAGES 数组中的 path 字段
  const pathRe = /\{\s*path:\s*'([^']+)'[^}]*\}/g
  const paths = []
  let m
  while ((m = pathRe.exec(content)) !== null) paths.push(m[1])

  // 每个 path 展开成 5 语言 URL
  const urls = []
  for (const path of paths) {
    urls.push(`${localSiteUrl}${path}`) // x-default
    for (const locale of locales) {
      urls.push(`${localSiteUrl}/${locale}${path}`)
    }
  }
  return urls
}

async function fetchSitemapUrls(sitemapUrl) {
  console.log(`[INFO] 拉取 sitemap: ${sitemapUrl}`)
  let res
  try {
    res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(10000) })
  } catch (e) {
    throw new Error(`sitemap 网络请求失败: ${e.message} (考虑使用 --from-local)`)
  }
  if (!res.ok) {
    throw new Error(`sitemap 拉取失败: HTTP ${res.status}`)
  }
  const xml = await res.text()
  const urls = []
  const re = /<loc>([^<]+)<\/loc>/g
  let m
  while ((m = re.exec(xml)) !== null) urls.push(m[1].trim())
  return urls
}

async function getUrls() {
  if (urlsArg) {
    console.log(`[INFO] 使用命令行传入的 ${urlsArg.length} 个 URL`)
    return urlsArg
  }
  if (fromLocal) {
    const urls = extractUrlsFromSitemapTs()
    console.log(`[INFO] 从本地 sitemap.ts 提取 ${urls.length} 个 URL (5 语言展开)`)
    return urls
  }
  const sitemapUrl = sitemapArg || `${SITE_URL}/sitemap.xml`
  try {
    return await fetchSitemapUrls(sitemapUrl)
  } catch (e) {
    console.warn(`[WARN] ${e.message}`)
    console.warn('[WARN] 自动回退到本地 sitemap.ts(用 --from-local 显式触发)')
    const urls = extractUrlsFromSitemapTs()
    console.log(`[INFO] 从本地 sitemap.ts 提取 ${urls.length} 个 URL (5 语言展开)`)
    return urls
  }
}

// ==================== 推送 ====================
function buildPayload(urls) {
  return {
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  }
}

async function pushToEndpoint(endpoint, urls) {
  const payload = buildPayload(urls)
  const t0 = Date.now()
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const dt = Date.now() - t0
    const codeMap = {
      200: 'OK — 已提交,URL 将在 24h 内被收录',
      202: 'Accepted — 已接受,稍后处理',
      400: 'Bad Request — payload 格式错误(检查 key/urlList 字段)',
      403: 'Forbidden — key 验证失败(检查 keyLocation URL 是否可访问)',
      422: 'Unprocessable — URL 不属于该 host(检查 SITE_URL 与 URL 域名一致)',
      429: 'Too Many Requests — 频率过高,稍后重试',
    }
    const msg = codeMap[res.status] || `HTTP ${res.status}`
    console.log(`  ${endpoint} → ${res.status} ${msg}  (${dt}ms)`)
    if (res.status >= 400) {
      const body = await res.text()
      if (body) console.log(`    响应体: ${body.slice(0, 200)}`)
    }
    return res.status
  } catch (e) {
    console.error(`  ${endpoint} → ERROR: ${e.message}`)
    return 0
  }
}

// ==================== 主流程 ====================
async function main() {
  console.log('============================================================')
  console.log('  IndexNow 批量推送 — 主动通知 Bing/Yandex/Seznam 收录')
  console.log('============================================================')
  console.log(`  站点: ${SITE_URL}`)
  console.log(`  Key: ${INDEXNOW_KEY ? INDEXNOW_KEY.slice(0, 8) + '...' + INDEXNOW_KEY.slice(-4) : '(未设置,Dry-run 模式)'}`)
  console.log(`  模式: ${dryRun ? 'DRY-RUN(不发送)' : '实际推送'}`)
  console.log()

  const urls = await getUrls()
  console.log(`[INFO] 共 ${urls.length} 个 URL 待推送`)
  if (urls.length === 0) {
    console.error('[FAIL] 无 URL 可推送,退出')
    process.exit(1)
  }

  // URL 列表预览
  console.log()
  console.log('[URL 预览] 前 5 个:')
  urls.slice(0, 5).forEach((u) => console.log(`  - ${u}`))
  if (urls.length > 5) console.log(`  ... +${urls.length - 5} 个`)
  console.log()

  if (dryRun) {
    console.log('[DRY-RUN] 跳过实际推送,以下为完整 URL 列表(可保存到 .trae-cn/tmp/indexnow-pending.json):')
    const pendingFile = resolve(PROJECT_ROOT, '.trae-cn/tmp/marketing-2026-07-28/indexnow-pending.json')
    writeFileSync(pendingFile, JSON.stringify({ urls, generated_at: new Date().toISOString() }, null, 2))
    console.log(`  已写入: ${pendingFile}`)
    console.log()
    console.log('[DRY-RUN] 退出(无任何网络操作)')
    process.exit(0)
  }

  // IndexNow 单次最多 10000 个 URL,超过分批
  const BATCH = 10000
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH)
    const batchIdx = Math.floor(i / BATCH) + 1
    console.log(`[BATCH ${batchIdx}] 推送 ${batch.length} 个 URL`)
    for (const ep of ENDPOINTS) {
      await pushToEndpoint(ep, batch)
    }
    console.log()
  }

  console.log('============================================================')
  console.log('  ✅ IndexNow 推送完成')
  console.log('============================================================')
  console.log('  Bing 收录进度:https://www.bing.com/webmasters/url-submission')
  console.log('  IndexNow 状态:https://www.indexnow.org/')
  console.log()
  console.log('  验证(24-48h 后):')
  console.log(`  site:${SITE_URL}  (Bing 搜索)`)
  console.log('============================================================')
}

main().catch((e) => {
  console.error('[FATAL]', e)
  process.exit(1)
})
