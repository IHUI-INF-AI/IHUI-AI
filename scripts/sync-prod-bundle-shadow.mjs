#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prod-bundle 影子副本清偿器(BUG-62,2026-11-06 立)
 *
 * 方向**唯一**:入库源(tracked,git 跟踪) → 被 .gitignore 忽略的运行副本(runner)。
 * 生产机实跑的是 runner,两侧不一致时「线上行为与仓内代码无关」;本器物只做一件事:
 * 把登记对里漂移的 runner 覆写成 tracked 的**逐字节**副本(Buffer 直写,不做任何
 * 文本/编码往返,也不要手工 cp —— 那正是本器物要替代的做法)。
 *
 * 判据不放水:PAIRS 直接 import check-prod-bundle-shadow.mjs(§0.6 单一真相源),
 * 不复制第二份清单,也不碰那道门的 S0–S3;清偿完由 check-prod-bundle-shadow.mjs
 * 独立复判。本器物只清偿 S3(字节不等),不代判 S0/S1/S2,更不改它们的退出码语义。
 *
 * 用法:
 *   node scripts/sync-prod-bundle-shadow.mjs --check   # 只读档:只报漂移,不写盘;有漂移 exit 1
 *   node scripts/sync-prod-bundle-shadow.mjs            # 清偿档:写 runner;已等值的对零写盘
 * 退出码:0=全部逐字节等值(或已清偿完毕) 1=--check 下仍有漂移 2=无法判定(源缺失/IO 失败)
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// check 脚本顶层有 HUSKY_SKIP_PROD_BUNDLE_SHADOW 的早退分支;动态 import 前先清掉,
// 免得被 import 的那道门把本清偿器一起 exit(0) —— 那会是一次静默假绿。
delete process.env.HUSKY_SKIP_PROD_BUNDLE_SHADOW
const { PAIRS } = await import('./check-prod-bundle-shadow.mjs')

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE_PREFIX = 'deploy/prod-bundle/'
const checkOnly = process.argv.includes('--check')
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

let drift = 0
let synced = 0
let unjudged = 0
for (const p of PAIRS) {
  // 护栏:清偿只许落在被忽略的 prod-bundle 目录内,绝不写回入库源或越界路径。
  if (!p.runner.startsWith(BUNDLE_PREFIX)) {
    console.log(`  ❌ 拒绝越界写入(不是 ${BUNDLE_PREFIX} 前缀): ${p.runner}`)
    unjudged += 1
    continue
  }
  const tAbs = join(REPO, p.tracked)
  const rAbs = join(REPO, p.runner)
  if (!existsSync(tAbs)) {
    console.log(`  ❌ 入库源不存在(登记表有配对而仓内没源): ${p.tracked}`)
    unjudged += 1
    continue
  }
  let tb
  let rb
  try {
    tb = readFileSync(tAbs)
    rb = existsSync(rAbs) ? readFileSync(rAbs) : null
  } catch (e) {
    console.log(`  ⚠ 读取失败 ${p.tracked} / ${p.runner}: ${e.message}`)
    unjudged += 1
    continue
  }
  if (rb !== null && sha1(tb) === sha1(rb)) continue
  drift += 1
  if (checkOnly) {
    console.log(
      `  ❌ 影子漂移 ${p.runner}  <-  ${p.tracked}` +
        (rb === null ? '(运行副本不存在)' : ` (入库源 ${tb.length} 字节 / 运行副本 ${rb.length} 字节)`),
    )
    continue
  }
  try {
    mkdirSync(dirname(rAbs), { recursive: true })
    writeFileSync(rAbs, tb) // Buffer 直写 ⇒ 逐字节等值
    synced += 1
    console.log(`  ✅ 已清偿 ${p.tracked} → ${p.runner} (${tb.length} 字节)`)
  } catch (e) {
    console.log(`  ❌ 写入失败 ${p.runner}: ${e.message}`)
    unjudged += 1
  }
}

if (unjudged > 0) {
  console.log(`❌ ${unjudged} 对无法判定 —— 不记为通过`)
  process.exit(2)
}
if (checkOnly) {
  console.log(
    drift === 0
      ? `✅ --check: ${PAIRS.length} 对全部逐字节等值(未写盘)`
      : `❌ --check: ${drift}/${PAIRS.length} 对影子漂移(未写盘;跑不带 --check 的清偿档修复)`,
  )
  process.exit(drift === 0 ? 0 : 1)
}
console.log(
  `✅ 清偿完成:新写 ${synced} 份运行副本;原有 ${PAIRS.length - drift} 对已逐字节等值`,
)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
