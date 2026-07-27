#!/usr/bin/env node
// IndexNow 批量提交脚本(2026-07-27 P1-4 SEO 资产补全)
//
// 主动推送 URL 给 4 个支持 IndexNow 协议的搜索引擎:
//   1. IndexNow(统一入口,分发到所有参与引擎)
//   2. Bing(微软必应,直接入口加速收录)
//   3. Yandex(俄罗斯搜索引擎)
//   4. Seznam(捷克搜索引擎)
//
// 与 scripts/notify-indexnow.mjs 的区别:
//   - notify-indexnow.mjs:2 endpoint(IndexNow + Bing),用环境变量 INDEXNOW_KEY
//   - 本脚本:4 endpoint(+ Yandex + Seznam),支持 --site/--key CLI 参数
//   两个脚本可共存,本脚本覆盖更多搜索引擎。
//
// 用法:
//   node scripts/indexnow-submit.mjs --site=https://ihui.ai --key=<your-key>
//   node scripts/indexnow-submit.mjs --site=https://ihui.ai --key=<key> --sitemap=https://ihui.ai/sitemap.xml
//   node scripts/indexnow-submit.mjs --site=https://ihui.ai --key=<key> --urls=https://ihui.ai/,https://ihui.ai/pricing
//
// 前置准备(只需一次):
//   1. 生成 key: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
//   2. 把 key 字符串写到 apps/web/public/<key>.txt(内容仅 key 本身,无换行)
//   3. 部署站点后验证:curl https://ihui.ai/<key>.txt 应返回 key 本身
//   4. 在 https://www.bing.com/webmasters/ 提交一次站点(后续自动收录)
//
// 退出码:0=全部成功,1=参数缺失/无 URL,2=部分或全部 endpoint 失败

const ENDPOINTS = [
  { name: 'IndexNow', url: 'https://api.indexnow.org/indexnow' },
  { name: 'Bing', url: 'https://www.bing.com/indexnow' },
  { name: 'Yandex', url: 'https://yandex.com/indexnow' },
  { name: 'Seznam', url: 'https://search.seznam.cz/indexnow' },
]

const STATUS_MAP = {
  200: 'OK — 已提交,URL 将在 24h 内被收录',
  202: 'Accepted — 已接受,稍后处理',
  400: 'Bad Request — 请求格式错误',
  403: 'Forbidden — key 验证失败(检查 keyLocation 是否可访问)',
  422: 'Unprocessable — URL 不属于该 host',
}

// 解析 --key=value 格式参数
function parseArgs(argv) {
  const args = {}
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--(\w+)=(.*)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
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

function buildPayload(host, key, urlList) {
  return {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList,
  }
}

async function pushToEndpoint(endpoint, payload) {
  const t0 = Date.now()
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const dt = Date.now() - t0
    const msg = STATUS_MAP[res.status] || `HTTP ${res.status}`
    const ok = res.status === 200 || res.status === 202
    console.log(`  ${endpoint.name.padEnd(10)} → ${res.status} ${msg}  (${dt}ms)`)
    return ok
  } catch (e) {
    console.error(`  ${endpoint.name.padEnd(10)} → ERROR: ${e.message}`)
    return false
  }
}

async function main() {
  const args = parseArgs(process.argv)

  const site = args.site || process.env.SITE_URL || 'https://ihui.ai'
  const key = args.key || process.env.INDEXNOW_KEY || ''

  if (!key) {
    console.error('\n[FAIL] --key 参数缺失,也未设置 INDEXNOW_KEY 环境变量')
    console.error('生成 key: node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"')
    console.error('用法: node scripts/indexnow-submit.mjs --site=https://ihui.ai --key=<key>\n')
    process.exit(1)
  }

  const host = site.replace(/^https?:\/\//, '').replace(/\/$/, '')

  // 获取 URL 列表:优先 --urls,其次 --sitemap,最后默认 sitemap.xml
  let urls
  if (args.urls) {
    urls = args.urls.split(',').map((s) => s.trim()).filter(Boolean)
    console.log(`[INFO] 使用 --urls 传入的 ${urls.length} 个 URL`)
  } else {
    const sitemapUrl = args.sitemap || `${site}/sitemap.xml`
    try {
      urls = await fetchSitemapUrls(sitemapUrl)
      console.log(`[INFO] 从 sitemap 解析到 ${urls.length} 个 URL`)
    } catch (e) {
      console.error(`[FAIL] ${e.message}`)
      process.exit(1)
    }
  }

  if (urls.length === 0) {
    console.error('[FAIL] 无 URL 可推送')
    process.exit(1)
  }

  // IndexNow 单次最多 10000 URL,超过分批
  const BATCH = 10000
  let allOk = true

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH)
    const batchNum = Math.floor(i / BATCH) + 1
    const totalBatches = Math.ceil(urls.length / BATCH)
    console.log(`\n[BATCH ${batchNum}/${totalBatches}] 推送 ${batch.length} 个 URL 到 4 个搜索引擎:`)

    const payload = buildPayload(host, key, batch)
    for (const ep of ENDPOINTS) {
      const ok = await pushToEndpoint(ep, payload)
      if (!ok) allOk = false
    }
  }

  console.log('\n[完成] IndexNow 批量推送结束。')
  console.log('  - Bing 收录进度: https://www.bing.com/webmasters/url-submission')
  console.log('  - IndexNow 协议状态: https://www.indexnow.org/')

  process.exit(allOk ? 0 : 2)
}

main().catch((e) => {
  console.error('[FATAL]', e)
  process.exit(1)
})
