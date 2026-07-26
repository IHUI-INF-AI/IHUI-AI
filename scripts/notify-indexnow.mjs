#!/usr/bin/env node
// IndexNow 主动推送协议 — 每次发布/更新后通知 Bing/Yandex/Seznam 收录
// 文档:https://www.indexnow.org/documentation
//
// 用法:
//   1. 首次配置(只需一次):
//      - 生成 key:node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
//      - 把 key 写到 .env: INDEXNOW_KEY=<生成的 key>
//      - 把 key 文件放到 apps/web/public/<key>.txt(内容就是 key 本身,无换行)
//      - 部署站点,确保 https://ihui.ai/<key>.txt 可访问
//      - 在 https://www.bing.com/webmasters/ 提交一次站点(后续自动收录)
//
//   2. 每次发布后推送:
//      node scripts/notify-indexnow.mjs                  # 推送 sitemap.xml 所有 URL
//      node scripts/notify-indexnow.mjs --urls url1,url2 # 推送指定 URL
//      node scripts/notify-indexnow.mjs --sitemap https://ihui.ai/sitemap.xml
//
//   3. CI 集成(可选):在 .github/workflows/release.yml 后加一步:
//      - run: node scripts/notify-indexnow.mjs
//        env:
//          INDEXNOW_KEY: ${{ secrets.INDEXNOW_KEY }}

const SITE_URL = process.env.SITE_URL || 'https://ihui.ai'
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || ''
const ENDPOINTS = [
  'https://api.indexnow.org/indexnow', // IndexNow 统一入口(推荐)
  'https://www.bing.com/indexnow', // Bing 直接入口(冗余,加速收录)
]

// 解析命令行参数
const args = process.argv.slice(2)
let urlsArg = null
let sitemapArg = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--urls' && args[i + 1]) urlsArg = args[i + 1].split(',').map((s) => s.trim()).filter(Boolean)
  if (args[i] === '--sitemap' && args[i + 1]) sitemapArg = args[i + 1]
}

if (!INDEXNOW_KEY) {
  console.error('\n[FAIL] INDEXNOW_KEY 未设置。')
  console.error('生成 key: node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"')
  console.error('写入 .env: INDEXNOW_KEY=<key>')
  console.error('放 key 文件: 把 <key> 字符串写到 apps/web/public/<key>.txt(无换行)')
  console.error('部署后验证: curl https://ihui.ai/<key>.txt 应返回 key 本身\n')
  process.exit(1)
}

async function fetchSitemapUrls(sitemapUrl) {
  console.log(`[INFO] 拉取 sitemap: ${sitemapUrl}`)
  const res = await fetch(sitemapUrl)
  if (!res.ok) throw new Error(`sitemap 拉取失败: HTTP ${res.status}`)
  const xml = await res.text()
  const urls = []
  const re = /<loc>([^<]+)<\/loc>/g
  let m
  while ((m = re.exec(xml)) !== null) urls.push(m[1].trim())
  return urls
}

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
      400: 'Bad Request — 格式错误',
      403: 'Forbidden — key 验证失败(检查 keyLocation 是否可访问)',
      422: 'Unprocessable — URL 不属于该 host',
    }
    const msg = codeMap[res.status] || `HTTP ${res.status}`
    console.log(`  ${endpoint} → ${res.status} ${msg}  (${dt}ms)`)
    return res.status
  } catch (e) {
    console.error(`  ${endpoint} → ERROR: ${e.message}`)
    return 0
  }
}

async function main() {
  let urls
  if (urlsArg) {
    urls = urlsArg
    console.log(`[INFO] 使用命令行传入的 ${urls.length} 个 URL`)
  } else {
    const sitemapUrl = sitemapArg || `${SITE_URL}/sitemap.xml`
    urls = await fetchSitemapUrls(sitemapUrl)
    console.log(`[INFO] 从 sitemap 解析到 ${urls.length} 个 URL`)
  }

  if (urls.length === 0) {
    console.error('[FAIL] 无 URL 可推送')
    process.exit(1)
  }

  // IndexNow 单次最多 10000 个 URL,超过分批
  const BATCH = 10000
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH)
    console.log(`\n[BATCH ${Math.floor(i / BATCH) + 1}] 推送 ${batch.length} 个 URL`)
    for (const ep of ENDPOINTS) {
      await pushToEndpoint(ep, batch)
    }
  }

  console.log('\n[OK] IndexNow 推送完成。')
  console.log('  - Bing 收录进度:https://www.bing.com/webmasters/url-submission')
  console.log('  - IndexNow 状态:https://www.indexnow.org/ 首页查看协议状态')
}

main().catch((e) => {
  console.error('[FATAL]', e)
  process.exit(1)
})
