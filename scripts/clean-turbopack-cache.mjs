#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * clean-turbopack-cache.mjs — Next.js Turbopack 持久化缓存卫生检查
 *
 * 背景(2026-08-27 根治):
 *   `next dev --turbopack` 的持久化缓存写入 apps/web/.next/dev/cache/turbopack/
 *   (RocksDB SSTable,单文件 256MB)。Next 16.2.12 不自动压缩/清理该缓存,
 *   数十次 dev 会话累积后实测膨胀到 34.4GB / 10758 个文件 → dev server 启动时
 *   加载 34GB 缓存库导致内存 20GB+、CPU 满载(进程 23200 实锤)。
 *   本脚本在每次 `pnpm --filter @ihui/web dev` 启动前检查,超阈值自动清理,
 *   从源头杜绝缓存失控。正常会话单次增长 <1GB,3GB 阈值安全(不影响冷热编译体验)。
 *
 * 用法:
 *   node scripts/clean-turbopack-cache.mjs            # 默认:超 3GB 自动清理
 *   node scripts/clean-turbopack-cache.mjs --force    # 无条件清理
 *   node scripts/clean-turbopack-cache.mjs --check    # 只报告不清理(exit 1=需清理)
 *   node scripts/clean-turbopack-cache.mjs --threshold 2048   # 自定义阈值 MB
 *   node scripts/clean-turbopack-cache.mjs --selftest # 内置自测(临时目录模拟验证统计/清理)
 */
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const TARGET = path.join(REPO_ROOT, 'apps', 'web', '.next', 'dev', 'cache', 'turbopack')
const DEFAULT_THRESHOLD_MB = 3072 // 3GB

function parseArgs(argv) {
  const args = { thresholdMB: DEFAULT_THRESHOLD_MB, force: false, check: false, selftest: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') args.force = true
    else if (argv[i] === '--check') args.check = true
    else if (argv[i] === '--selftest') args.selftest = true
    else if (argv[i] === '--threshold' && argv[i + 1]) {
      const v = Number(argv[++i])
      if (Number.isFinite(v) && v > 0) args.thresholdMB = v
    }
  }
  return args
}

/**
 * 内置自测(2026-08-27 立):在系统临时目录构造假的 turbopack 缓存结构,
 * 验证「递归统计(含嵌套子目录)+ MB 换算 + 阈值判定 + 删除清理」四步正确,
 * 防 2026-08-27 单位换算 bug 之类回归。无副作用,不触碰真实 .next。
 */
async function selfTest() {
  const results = []
  const check = (name, ok, detail = '') => {
    results.push([name, ok])
    console.log(`[turbopack-cache]   ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`)
  }

  console.log('[turbopack-cache] ===== 自测开始 =====')
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'turbocache-selftest-'))
  const fakeTarget = path.join(tmpRoot, 'dev', 'cache', 'turbopack')
  const verDir = path.join(fakeTarget, 'v16.2.12')
  try {
    await fs.mkdir(verDir, { recursive: true })
    // 已知大小:1MB + 5MB + 300KB + 嵌套子目录 200B
    const sizes = [1024 * 1024, 5 * 1024 * 1024, 300 * 1024]
    for (let i = 0; i < sizes.length; i++) {
      await fs.writeFile(path.join(verDir, `0000000${i}.sst`), Buffer.alloc(sizes[i], 7))
    }
    await fs.mkdir(path.join(verDir, 'nested'))
    await fs.writeFile(path.join(verDir, 'nested', 'x.meta'), Buffer.alloc(200, 9))

    const expectedBytes = sizes.reduce((a, b) => a + b, 0) + 200
    const actualBytes = await dirSizeBytes(fakeTarget)
    check('递归统计字节', actualBytes === expectedBytes, `期望 ${expectedBytes} / 实际 ${actualBytes}`)

    const mb = toMB(actualBytes)
    check('MB 换算', mb > 1 && mb < 100, `${mb.toFixed(2)} MB`)

    // 阈值判定:默认 3GB 不触发,1MB 触发
    check('阈值判定', toMB(actualBytes) > 1, '1MB 阈值应触发')

    await fs.rm(fakeTarget, { recursive: true, force: true })
    const gone = !(await fs.access(fakeTarget).then(() => true).catch(() => false))
    check('删除清理', gone, '目录已消失')
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
  }

  const allOk = results.every(([, ok]) => ok)
  console.log(`[turbopack-cache] ===== 自测${allOk ? '全部通过' : '存在失败'} =====`)
  process.exit(allOk ? 0 : 1)
}

// 统一按字节累加,递归时父层不再换算;MB 换算只在最外层(调用处)做一次。
// 2026-08-27 修复:原实现 dirSizeMB 递归返回 MB,父层当字节累加后又除 1024²,
// 导致唯一子目录(v16.2.12)的 778MB 被除成 0.0007MB → 超阈值自动清理永久失效。
async function dirSizeBytes(dir) {
  let total = 0
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch {
    // 目录不存在或不可读 → 视为 0
    return 0
  }
  for (const name of names) {
    const p = path.join(dir, name)
    try {
      const st = await fs.stat(p)
      if (st.isDirectory()) {
        total += await dirSizeBytes(p)
      } else if (st.isFile()) {
        total += st.size
      }
    } catch {
      // 文件在 stat 瞬间被删除(compaction 竞态) → 跳过,下次采样会补上
    }
  }
  return total
}

function toMB(bytes) {
  return bytes / 1024 / 1024
}

const args = parseArgs(process.argv.slice(2))

// 自测模式:不触碰真实 .next,走临时目录
if (args.selftest) {
  await selfTest()
}

const exists = await fs.access(TARGET).then(() => true).catch(() => false)

if (!exists) {
  console.log('[turbopack-cache] 缓存目录不存在,无需清理')
  process.exit(0)
}

const sizeMB = toMB(await dirSizeBytes(TARGET))
console.log(`[turbopack-cache] 缓存大小: ${sizeMB.toFixed(0)} MB / 阈值 ${args.thresholdMB} MB`)
console.log(`[turbopack-cache] 目录: ${TARGET}`)

if (args.check) {
  const needClean = args.force || sizeMB > args.thresholdMB
  console.log(`[turbopack-cache] CHECK: ${needClean ? '需要清理' : '健康'}`)
  process.exit(needClean ? 1 : 0)
}

if (args.force || sizeMB > args.thresholdMB) {
  console.log(`[turbopack-cache] 超出阈值,清理 ${sizeMB.toFixed(0)} MB ...`)
  try {
    await fs.rm(TARGET, { recursive: true, force: true })
    console.log('[turbopack-cache] 清理完成')
  } catch (err) {
    // 文件被占用(如另一窗口的 next dev 正在运行)时 Windows 抛 EPERM/EBUSY
    console.warn(`[turbopack-cache] 清理失败(可能有进程占用): ${err.message}`)
    console.warn('[turbopack-cache] 建议先停止所有 next dev 进程再重试')
  }
} else {
  console.log('[turbopack-cache] 健康,无需清理')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
