#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 控制面 strict 棘轮门(2026-09-30,票 b76-12c-2)。
 *
 * 病灶:协议边界缺「控制面 strict / 装饰面 .catch() 降级」二分 —— 未登记的字段被 zod
 * 静默剥掉,字段级失效一律表现为「功能没生效但没有任何一层红」。
 *
 * 判据:逐文件统计扫描面(apps/api/src/plugins/** 与 packages/shared/src/**,*.ts/*.tsx)里
 *   z.object( 数(含链式行首 `.object(` 写法 —— 仓内主流链式风格,字面只匹配 z.object(
 *   会让门对大半真实 schema 失明)与 `.strict()`/`.catch(` 数之和,**只减不增**。
 *   `.strict()` 与 `.catch(` 是显式声明的边界处置算子,增量必须走人审;`z.object` 增量
 *   若无配套 strict/catch 即为新的「剥离面」。
 *
 * 禁止项(违反即为本门的规避,不得以任何"降红"手段绕过):
 *   - 不得为降红把 `.strict()` 换成 `.passthrough()`/`looseObject`(那等于把剥离改成放行);
 *   - 不得把装饰字段塞进控制面 schema 来"顺手通过"(装饰载荷应走 `.optional().catch()` 降级);
 *   - 不得用字符串拼接/动态属性等手段隐藏 schema 声明让统计失明。
 *
 * 用法: node scripts/check-wire-strictness.mjs [--self-test]
 * 本脚本刻意**不接提交链**(guardian-runner / package.json scripts / .husky 均不归本脚本改),
 * 接链由守门持有人统一做(AGENTS §12f)。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 基线取立门当次现读值(2026-09-30,全量聚合)。
// 只减不增:后续任何改动让总和超过基线即红;清偿存量(降红)后可由守门持有人下调基线。
//
// [2026-09-30 基线吸收 68→91] 立门票 b76-12c-2 的当次读数 68 取自其 strict 化改动**落盘前**的工作树,
// 与立门提交 be6da32e6b 实际树统计(91,经 HEAD 树逐文件重算核证)不符。超出的 23 处全部来自
// wave-2 W3 提交 ac63a7084a「帧 schema」票对 packages/shared/src/sse/contract.ts 的落库:
// 5 处 .object( + 6 处 .strict() + 12 处 .catch(,全部集中在帧 schema 区段(contract.ts:977-1084),
// 逐行核对均为「控制面 .strict() 收紧 + 装饰性载荷 .optional().catch(undefined) 降级」的正当形态
// —— 恰是本门判据倡导的二分正向样本,非 .passthrough()/looseObject 剥离面,无任何未清偿红。
// 接链守门(2026-09-30)按当次真值吸收,head 树统计 91 = 工作树统计 91,期间零业务改动。
const BASELINE_TOTAL = 91

const SCAN_ROOTS = ['apps/api/src/plugins', 'packages/shared/src']
const EXTENSIONS = /\.(ts|tsx)$/

/** 单文件三算子计数:zod 对象声明(直写/链式) + strict 收紧 + catch 降级 */
export function countWireOperators(source) {
  const counts = { objectDecl: 0, strict: 0, catch: 0 }
  for (const line of source.split('\n')) {
    if (/z\.object\(/.test(line) || /^[ \t]*\.object\(/.test(line)) counts.objectDecl++
    if (/\.strict\(\)/.test(line)) counts.strict++
    if (/\.catch\(/.test(line)) counts.catch++
  }
  return counts
}

/** 判定:只减不增(低于/等于基线绿,超出红) */
export function judgeTotal(total, baseline = BASELINE_TOTAL) {
  return total <= baseline
}

function listScanFiles() {
  const out = execFileSync('git', ['ls-files', ...SCAN_ROOTS], {
    cwd: ROOT,
    encoding: 'utf8',
    // 本会话环境已知病:spawnSync 默认建 stdin 管道会 EBUSY —— stdin 走 ignore 规避
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => EXTENSIONS.test(s))
}

function run() {
  const files = listScanFiles()
  const perFile = []
  let total = 0
  for (const rel of files) {
    let src
    try {
      src = readFileSync(path.join(ROOT, rel), 'utf8')
    } catch {
      continue // 立门后已删除的跟踪文件跳过
    }
    const c = countWireOperators(src)
    const sum = c.objectDecl + c.strict + c.catch
    total += sum
    if (sum > 0) perFile.push({ file: rel, sum })
  }
  perFile.sort((a, b) => b.sum - a.sum)
  const worst10 = perFile.slice(0, 10)

  console.log(`[check-wire-strictness] scanned files: ${files.length}`)
  console.log(`[check-wire-strictness] total(z.object + .strict + .catch): ${total} (baseline ${BASELINE_TOTAL}, 只减不增)`)
  console.log('[check-wire-strictness] worst 10 files:')
  for (const w of worst10) console.log(`  ${String(w.sum).padStart(4)} ${w.file}`)

  if (!judgeTotal(total)) {
    console.error(
      `[check-wire-strictness] FAIL: total ${total} > baseline ${BASELINE_TOTAL} —— ` +
        '控制面边界只减不增被破坏。禁止换 .passthrough()/looseObject 降红;禁止把装饰字段塞进控制面 schema。',
    )
    process.exitCode = 1
    return
  }
  console.log('[check-wire-strictness] PASS')
}

// ---------- --self-test:不触盘,内嵌用例验证统计与判定逻辑 ----------
function selfTest() {
  const cases = []
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`[check-wire-strictness:self-test] FAIL: ${msg}`)
      process.exitCode = 1
    } else {
      cases.push(msg)
    }
  }

  // 直写 zod 风格
  const c1 = countWireOperators('const a = z.object({ x: 1 }).strict();\n')
  assert(c1.objectDecl === 1 && c1.strict === 1 && c1.catch === 0, '直写 z.object 链 .strict 计数正确')

  // 仓内链式风格(z 与 .object 分行)
  const c2 = countWireOperators('const b = z\n  .object({ x: 1 })\n  .strict()\n')
  assert(c2.objectDecl === 1 && c2.strict === 1, '链式换行 .object( 同计(否则门对主流风格失明)')

  // Promise .catch 与 schema .catch( 降级算子同计
  const c3 = countWireOperators('p.catch(f);\nconst s = z.object({}).catch(undefined);\n')
  assert(c3.objectDecl === 1 && c3.catch === 2, '.catch( 计数含 Promise 与 schema 两种')

  // 判定:只减不增
  assert(judgeTotal(BASELINE_TOTAL) === true, '等于基线 → 绿')
  assert(judgeTotal(BASELINE_TOTAL - 1) === true, '低于基线(清偿存量) → 绿')
  assert(judgeTotal(BASELINE_TOTAL + 1) === false, '超出基线 → 红')
  assert(judgeTotal(10, 10) === true, '自定义基线同判')
  assert(judgeTotal(11, 10) === false, '自定义基线超出 → 红')

  console.log(`[check-wire-strictness:self-test] ${cases.length} assertions passed`)
}

if (process.argv.includes('--self-test')) {
  selfTest()
  if (process.exitCode !== 1) console.log('[check-wire-strictness:self-test] ALL GREEN')
} else {
  run()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
