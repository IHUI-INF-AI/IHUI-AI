#!/usr/bin/env node
/**
 * IndexNow 批量提交脚本
 *
 * 用途:把 apps/web/app/sitemap.ts 中所有公开路由批量提交到 IndexNow
 *      (Bing / Yandex / Naver 共用同一 API),加速搜索引擎收录。
 *
 * 用法:
 *   node scripts/indexnow-submit.mjs                 # 实际提交(默认 host=aizhs.top)
 *   node scripts/indexnow-submit.mjs --dry-run       # 仅预览 URL 列表与 payload,不提交
 *   node scripts/indexnow-submit.mjs --key <key>     # 自定义密钥
 *   node scripts/indexnow-submit.mjs --host <host>   # 自定义 host(默认 aizhs.top)
 *
 * 密钥机制:
 *   - IndexNow 要求站点根目录可访问 https://{host}/{key}.txt,内容为 key 本身。
 *   - 首次运行自动生成 32 位 hex 密钥并写入 apps/web/public/{key}.txt。
 *   - 后续运行复用 public/ 下已有的 *.txt 密钥文件(取第一个)。
 *
 * 退出码:0=成功(或 dry-run);1=提交失败/配置错误。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

// ---------- 参数解析 ----------
const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
const HOST = argValue('--host') || 'aizhs.top'
const DRY_RUN = argv.includes('--dry-run')
const KEY_ARG = argValue('--key')

const SITEMAP_PATH = join(ROOT, 'apps', 'web', 'app', 'sitemap.ts')
const PUBLIC_DIR = join(ROOT, 'apps', 'web', 'public')
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

// ---------- 1. 解析 sitemap.ts 提取路由 ----------
function extractPaths(sitemapContent) {
  const paths = []
  // 匹配 PAGES 数组里的 path: '...' 或 path: "..."
  const re = /path:\s*(['"])(.*?)\1/g
  let m
  while ((m = re.exec(sitemapContent)) !== null) {
    paths.push(m[2])
  }
  return paths
}

// ---------- 2. 密钥管理 ----------
// dry-run 时不写盘,只在内存生成一个示例密钥用于预览 payload。
function loadOrCreateKey() {
  // 优先用 --key 显式传入
  if (KEY_ARG) return KEY_ARG

  // 复用 public/ 下已存在的 IndexNow 密钥文件(*.txt 内容是 32 hex)
  if (existsSync(PUBLIC_DIR)) {
    const files = readdirSync(PUBLIC_DIR).filter((f) => /^[0-9a-f]{32}\.txt$/i.test(f))
    if (files.length > 0) {
      return files[0].replace(/\.txt$/i, '')
    }
  }

  // dry-run:只在内存生成示例密钥,不写盘(预览无副作用)
  if (DRY_RUN) {
    const sample = randomBytes(16).toString('hex')
    console.log(`🔑 (DRY-RUN) 生成示例密钥(未写盘): ${sample}`)
    return sample
  }

  // 实际提交:生成新密钥并写入 public/{key}.txt
  const key = randomBytes(16).toString('hex') // 32 位 hex
  if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true })
  const keyFile = join(PUBLIC_DIR, `${key}.txt`)
  writeFileSync(keyFile, key, 'utf8')
  console.log(`🔑 生成新 IndexNow 密钥并写入: ${keyFile}`)
  return key
}

// ---------- 3. 主流程 ----------
function main() {
  if (!existsSync(SITEMAP_PATH)) {
    console.error(`❌ 找不到 sitemap.ts: ${SITEMAP_PATH}`)
    process.exit(1)
  }

  const sitemapContent = readFileSync(SITEMAP_PATH, 'utf8')
  const paths = extractPaths(sitemapContent)
  if (paths.length === 0) {
    console.error('❌ 未能从 sitemap.ts 解析到任何 path,请检查文件格式。')
    process.exit(1)
  }

  const key = loadOrCreateKey()
  const keyLocation = `https://${HOST}/${key}.txt`
  // path 为 '' 时代表首页,拼成根 URL
  const urlList = paths.map((p) => `https://${HOST}${p || '/'}`)

  const payload = {
    host: HOST,
    key,
    keyLocation,
    urlList,
  }

  console.log('═'.repeat(64))
  console.log(`📦 IndexNow 批量提交${DRY_RUN ? ' (DRY-RUN,不实际提交)' : ''}`)
  console.log('═'.repeat(64))
  console.log(`🌐 Host:         ${HOST}`)
  console.log(`🔑 Key:          ${key}`)
  console.log(`📍 KeyLocation:  ${keyLocation}`)
  console.log(`🔗 URL 数量:     ${urlList.length}`)
  console.log('─'.repeat(64))
  urlList.forEach((u, i) => console.log(`  ${String(i + 1).padStart(3, ' ')}. ${u}`))
  console.log('─'.repeat(64))
  console.log('Payload:')
  console.log(JSON.stringify({ ...payload, urlList: `[${urlList.length} urls]` }, null, 2))

  if (DRY_RUN) {
    console.log('─'.repeat(64))
    console.log('✅ DRY-RUN 完成,未发送任何请求。去掉 --dry-run 实际提交。')
    return
  }

  // ---------- 4. 提交到 IndexNow ----------
  console.log('─'.repeat(64))
  console.log('🚀 提交中...')
  submit(payload)
    .then((status) => {
      console.log('═'.repeat(64))
      console.log(`✅ 提交完成。HTTP ${status}`)
      console.log('   IndexNow 通常在几分钟到 24 小时内处理完毕。')
      console.log(`   验证密钥文件可访问: ${keyLocation}`)
    })
    .catch((err) => {
      console.error('═'.repeat(64))
      console.error(`❌ 提交失败: ${err.message}`)
      process.exit(1)
    })
}

async function submit(payload) {
  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })
  // IndexNow: 200=已接受并已索引 / 202=已接受待处理 / 422=无效
  if (res.status === 200 || res.status === 202) return res.status
  const body = await res.text().catch(() => '')
  throw new Error(`IndexNow 返回 HTTP ${res.status}${body ? `: ${body}` : ''}`)
}

main()
