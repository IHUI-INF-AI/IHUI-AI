// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门(只读尺子,不进提交链、不进 CI)台账「正文被吃掉」的两型残行 —— 2026-10-23 立。
 *
 * 本文件是 `scripts/lib/ledger-eaten-rows.mjs` 的**薄壳**:判据、取材、结论全部住在那一层,
 * 这里只做 argv 取值与打印(§0.6 单一真相源 / §22c 测试 import 源脚本判据,禁止第二份实现)。
 * 判据形态、射程与已知空档、以及"为什么行识别必须复用 parseTaskRows"都写在那个头注里,
 * 不在这里复述一遍(复述即漂移)。
 *
 * ## 为什么它**不**接提交链(§12e 恒红门禁令)
 *
 *  1. 它判的是**历史存量**:HEAD 面现读的残行是谁写的、哪一轮合并吃掉的,与"本次提交了什么"
 *     没有结构上的关系 —— 提交者修不了别人被吃掉的正文。挂成提交门 ⇒ 每次提交都红 ⇒
 *     逼人 `--no-verify` ⇒ 连带废掉该提交上全部守门(本仓最高代价的失效型)。
 *  2. 票面口径本身要求"先造尺、量出命中集,之后才谈是哪个器物产的、怎么修"——
 *     判据先于修法上提交链,等于用一道门去催一个还没有出口的事。
 *  3. 升 blocking 的前置 = **存量归零**(§0.2)。今天存量不为零(现读见末行 empty=/truncated=),
 *     所以这道门连"warn 档挂 pre-commit"都不挂:它只被人或巡检器**读数**,不拦任何人。
 *
 * 用法(全部只读,不改盘、不 `git add`):
 *   node scripts/check-ledger-eaten-rows.mjs                 # 判 HEAD blob(全量档)
 *   node scripts/check-ledger-eaten-rows.mjs --staged        # 判索引 blob
 *   node scripts/check-ledger-eaten-rows.mjs --worktree      # 人工逃生舱:判工作树副本
 *   node scripts/check-ledger-eaten-rows.mjs --root <仓库根>  # 换取材根(测试与另一处签出用)
 *
 * 机读末行:
 *   `LEDGER-EATEN-ROWS-RESULT state=clean|warn|undetermined empty=<n|NA> truncated=<n|NA> open=<n|NA> rows=<n|NA> face=<head|staged|worktree>`
 * 退出码:0 = 判定完成(命中几枚都是 0)/ 2 = 未判定或用法错。
 *
 * 镜像测试:`scripts/tests/check-ledger-eaten-rows.test.mjs`。
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { pathToFileURL } from 'node:url'

import { parseArgv, run, USAGE } from './lib/ledger-eaten-rows.mjs'

const RESULT_NA =
  'LEDGER-EATEN-ROWS-RESULT state=undetermined empty=NA truncated=NA open=NA rows=NA face=none'

function main() {
  const argv = process.argv.slice(2)
  const a = parseArgv(argv)
  if (a.error !== null) {
    console.log(`❌ 用法错 —— ${a.error}`)
    for (const l of USAGE) console.log(l)
    console.log(RESULT_NA)
    return 2
  }
  if (a.help) {
    for (const l of USAGE) console.log(l)
    return 0
  }
  const got = run({ root: a.root, face: a.face })
  for (const l of got.lines) console.log(l)
  return got.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    console.log(RESULT_NA)
    process.exit(2)
  }
}

export const __test__ = { main, RESULT_NA }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
