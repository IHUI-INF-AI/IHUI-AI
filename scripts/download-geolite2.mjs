#!/usr/bin/env node
/**
 * 下载 MaxMind GeoLite2-City 数据库(设备维度风控 GeoIP 服务用)。
 *
 * 用法:
 *   1. 在 .env 设置 MAXMIND_LICENSE_KEY=<你的key>
 *      (或临时 $env:MAXMIND_LICENSE_KEY=<key>;node scripts/download-geolite2.mjs)
 *   2. node scripts/download-geolite2.mjs
 *
 * 数据库下载到 apps/api/data/GeoLite2-City.mmdb
 * 注册免费账号获取 license key: https://www.maxmind.com/en/geolite2/signup
 *
 * 退出码:
 *   0 = 成功 / 无 license key(可选增强,跳过下载)
 *   1 = 下载或解压失败
 *
 * 依赖:Node 内置模块(fs/path/zlib/child_process),不新增 npm 依赖。
 *      解压用系统 tar(Windows 10 1803+ 自带 System32\tar.exe;macOS/Linux 自带)。
 */
import { spawnSync } from 'node:child_process'
import { createWriteStream, mkdirSync, existsSync, renameSync, rmSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TARGET_DIR = join(__dirname, '..', 'apps', 'api', 'data')
const TARGET_PATH = join(TARGET_DIR, 'GeoLite2-City.mmdb')

const LICENSE_KEY = process.env.MAXMIND_LICENSE_KEY?.trim()
const DOWNLOAD_URL = `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${LICENSE_KEY}&suffix=tar.gz`

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

function log(color, msg) {
  console.log(`${color}${msg}${C.reset}`)
}

// 无 license key:可选增强,exit 0 不报错
if (!LICENSE_KEY) {
  log(C.yellow, '⚠ 未配置 MAXMIND_LICENSE_KEY,跳过 GeoLite2-City 下载(可选增强)。')
  log(C.dim, '  注册免费账号获取 license key: https://www.maxmind.com/en/geolite2/signup')
  log(C.dim, '  配置后:在 .env 设置 MAXMIND_LICENSE_KEY=<key> 后重跑本脚本。')
  log(C.dim, '  不配置时 geoip 服务降级为 ip-api.com 免费 API(45 req/min,够用)。')
  process.exit(0)
}

// 系统 tar 是否可用(Windows 10 1803+ 自带 System32\tar.exe)
const tarCheck = spawnSync('tar', ['--version'], { shell: process.platform === 'win32' })
if (tarCheck.status !== 0) {
  log(C.red, '✗ 系统未安装 tar 命令,无法解压 GeoLite2 tar.gz。')
  log(C.dim, '  Windows 10 1803+ 自带(System32\\tar.exe);Linux/macOS 通常预装。')
  process.exit(1)
}

mkdirSync(TARGET_DIR, { recursive: true })

// 临时文件:下载 tar.gz 到 os.tmpdir
const tmpDir = join(tmpdir(), `geolite2-${Date.now()}`)
mkdirSync(tmpDir, { recursive: true })
const tarGzPath = join(tmpDir, 'GeoLite2-City.tar.gz')

log(C.cyan, '⬇ 下载 GeoLite2-City.tar.gz ...')
log(C.dim, `  URL: ${DOWNLOAD_URL.replace(LICENSE_KEY, '<key>')}`)

try {
  const resp = await fetch(DOWNLOAD_URL, { redirect: 'follow' })
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
  }
  const buffer = Buffer.from(await resp.arrayBuffer())
  if (buffer.length < 1000) {
    // MaxMind 错误响应通常很短(< 1KB),正常 tar.gz 至少几 MB
    const text = buffer.toString('utf8').slice(0, 300)
    throw new Error(`响应过小(${buffer.length} 字节),可能是错误的 license key 或限流。预览: ${text}`)
  }
  const { writeFileSync } = await import('node:fs')
  writeFileSync(tarGzPath, buffer)
  log(C.green, `✓ 下载完成(${(buffer.length / 1024 / 1024).toFixed(2)} MB)`)
} catch (e) {
  log(C.red, `✗ 下载失败: ${e.message}`)
  rmSync(tmpDir, { recursive: true, force: true })
  process.exit(1)
}

// 解压 tar.gz 到临时目录,提取其中的 .mmdb(MaxMind tar 内目录名含日期版本号)
log(C.cyan, '📦 解压 tar.gz ...')
const extractResult = spawnSync('tar', ['-xzf', tarGzPath, '-C', tmpDir], {
  shell: process.platform === 'win32',
})
if (extractResult.status !== 0) {
  log(C.red, `✗ 解压失败: ${extractResult.stderr?.toString().trim() || '未知错误'}`)
  rmSync(tmpDir, { recursive: true, force: true })
  process.exit(1)
}

// 在解压目录中查找 .mmdb 文件(tar 解压后通常是 GeoLite2-City_YYYYMMDD/GeoLite2-City.mmdb)
let mmdbPath = null
function findMmdb(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findMmdb(full)
      if (found) return found
    } else if (entry.name.endsWith('.mmdb')) {
      return full
    }
  }
  return null
}
mmdbPath = findMmdb(tmpDir)
if (!mmdbPath) {
  log(C.red, '✗ 解压后未找到 .mmdb 文件')
  rmSync(tmpDir, { recursive: true, force: true })
  process.exit(1)
}

// 移到目标路径
renameSync(mmdbPath, TARGET_PATH)
rmSync(tmpDir, { recursive: true, force: true })

log(C.green, `✓ GeoLite2-City.mmdb 已就位: ${TARGET_PATH}`)
log(C.dim, '  geoip 服务下次启动时自动加载;无需重启,首次查询时 lazy 加载。')
process.exit(0)
