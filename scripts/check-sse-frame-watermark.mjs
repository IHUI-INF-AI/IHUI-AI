// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:b76-13 票1「帧水位与纪元(logEpoch + (fromSeq,toSeq] + gap 判据)」。
//
// 在修什么
//   续流此前只有 HTTP 层的 Last-Event-ID —— 一个**不带纪元的裸 id 游标**:
//   它只回答"服务端接着哪儿发",不回答"客户端手上的状态属于哪个纪元"。
//   会话重建/fork/rewind 后 id 仍能对上而内容属于另一个纪元,消费端会静默拼接
//   两个纪元的状态。本门钉三件事:
//     ① 唯一出口在位:packages/shared/src/sse/agent-events.ts 导出
//        readFrameWatermark(三态:ok / invalid 判死 / undetermined,**不得**返回 {})
//        与 isFrameGap(三条件取或:generation-change ∨ epoch-change ∨ seq-discontinuity);
//     ② 读环接线:client.ts 的 SSE 读环真调水位闸(生产了 ≠ 到端了);
//     ③ 阳性对照翻面:真仓 packages/shared/src/sse 里 'fromSeq' 的命中数 ——
//        落地前为 0("看不见"型缺陷:对整型缺陷全盲而账面报绿,AGENTS §12f),
//        落地后必须 ≥1。**本对照从工作树现读**(不是 HEAD:本门不接提交链,
//        验收跑在工作树面上;主会话提交后 HEAD 面自然同步)。
//
// 跑法:`node scripts/check-sse-frame-watermark.mjs`(缺省档,exit 0 = 绿)
//       `node scripts/check-sse-frame-watermark.mjs --self-test`(内置红/绿对照)
// 本门由主会话决定是否挂提交链;--self-test 不依赖真仓通过与否。

import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

const OUTLET_FILE = 'packages/shared/src/sse/agent-events.ts'
const LOCAL_FILE = 'packages/api-client/src/frame-watermark.ts'
const READLOOP_FILE = 'packages/api-client/src/client.ts'

const OUTLET_MARKERS = [
  'export function readFrameWatermark',
  'export function isFrameGap',
  "'generation-change'",
  "'epoch-change'",
  "'seq-discontinuity'",
  "verdict: 'undetermined'",
  "verdict: 'invalid'",
]
const READLOOP_MARKERS = ["from './frame-watermark.js'"]
/** 读环闸标记:1 处定义 + 主循环与尾部残留两处调用 ⇒ 出现次数 ≥ 3 */
const READLOOP_GATE_MARKER = 'shouldDropByWatermark'

function countOccurrences(haystack, needle) {
  let n = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    n++
    i = haystack.indexOf(needle, i + needle.length)
  }
  return n
}

/** 缺省档:真仓工作树面三件套 + 阳性对照翻面。返回问题清单(空 = 绿)。 */
function checkRealRepo() {
  const problems = []
  const outletAbs = join(REPO_ROOT, OUTLET_FILE)
  if (!existsSync(outletAbs)) {
    problems.push(`唯一出口缺失:${OUTLET_FILE}`)
    return problems
  }
  const outlet = readFileSync(outletAbs, 'utf8')
  for (const marker of OUTLET_MARKERS) {
    if (!outlet.includes(marker)) problems.push(`唯一出口缺标记 ${marker}`)
  }
  const localAbs = join(REPO_ROOT, LOCAL_FILE)
  if (!existsSync(localAbs)) {
    problems.push(`api-client 同形移植缺失:${LOCAL_FILE}`)
  } else {
    const local = readFileSync(localAbs, 'utf8')
    for (const marker of ["'generation-change'", "'epoch-change'", "'seq-discontinuity'"]) {
      if (!local.includes(marker)) problems.push(`api-client 移植缺 gap 条件 ${marker}`)
    }
  }
  const readLoopAbs = join(REPO_ROOT, READLOOP_FILE)
  if (!existsSync(readLoopAbs)) {
    problems.push(`读环文件缺失:${READLOOP_FILE}`)
  } else {
    const loop = readFileSync(readLoopAbs, 'utf8')
    for (const marker of READLOOP_MARKERS) {
      if (countOccurrences(loop, marker) < 1) {
        problems.push(`读环未接线(缺 ${marker})`)
      }
    }
    if (countOccurrences(loop, READLOOP_GATE_MARKER) < 3) {
      problems.push(`读环未接线:${READLOOP_GATE_MARKER} 定义+两处调用应出现 ≥3 次`)
    }
  }
  // 阳性对照:落地前 grep 'fromSeq' = 0 ⇒ "看不见";落地后必须 ≥1
  const fromSeqHits = countOccurrences(outlet, 'fromSeq')
  if (fromSeqHits === 0) {
    problems.push(
      '阳性对照仍"看不见":packages/shared/src/sse 里 0 处 fromSeq —— 水位字段词汇未落地,本门对整型缺陷全盲',
    )
  }
  return problems
}

/** 内置红/绿对照:证明这把尺子有牙(缺出口的 fixture 必红,在位的必绿)。 */
function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'sse-watermark-selftest-'))
  try {
    const good = join(dir, 'good.ts')
    writeFileSync(
      good,
      [
        "export function readFrameWatermark(frame: unknown) {",
        "  return { verdict: 'undetermined' }",
        '}',
        "export function isFrameGap() { return 'generation-change' && 'epoch-change' && 'seq-discontinuity' }",
        'const fromSeq = 0',
        "export const x = { verdict: 'invalid' }",
      ].join('\n'),
    )
    const goodOut = outletMarkersMissing(readFileSync(good, 'utf8'))
    if (goodOut.length > 0) {
      console.error(`[sse-watermark] self-test FAIL: 在位 fixture 被判红: ${goodOut.join('; ')}`)
      return false
    }
    const bad = join(dir, 'bad.ts')
    writeFileSync(bad, 'export function unrelated() { return 1 }\n')
    const badOut = outletMarkersMissing(readFileSync(bad, 'utf8'))
    if (badOut.length === 0) {
      console.error('[sse-watermark] self-test FAIL: 空壳文件被判绿 —— 尺子没有牙')
      return false
    }
    console.log('[sse-watermark] self-test PASS(在位判绿 / 空壳判红)')
    return true
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function outletMarkersMissing(content) {
  return OUTLET_MARKERS.filter((m) => !content.includes(m))
}

function main() {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1)
  }
  const problems = checkRealRepo()
  if (problems.length > 0) {
    for (const p of problems) console.error(`[sse-watermark] hit: ${p}`)
    process.exit(1)
  }
  console.log('[sse-watermark] 绿:唯一出口在位 + 读环接线 + 阳性对照可见(fromSeq ≥ 1)')
  process.exit(0)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
