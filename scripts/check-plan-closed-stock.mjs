#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-plan-closed-stock.mjs —— 「完成即删」提交口守门(2026-10-20 立,机主令:
 * "所有已完成的任务不要存着里,完成了就应该消失 删掉 …… 要彻底根治,固定完成立即删掉记录")。
 *
 * 立因(全是现读,不是推理):
 *   ① 归档机制已于 2026-10-16 退役(不留档、不归档、翻勾后整行删除),但**没有任何一道闸**
 *      在提交口强制"删"这一半 —— 结果 2026-10-20 现读:一次清扫后 HEAD 面 0 条,当天又被
 *      并发提交/合并回带到 120 条,再清一遍又带回 3 条。规则靠会话事后手工清扫,永远追不上。
 *   ② 不能简单上"绝对零容忍":门 71(check-plan-line-loss)的正当移除通道 (c) 要求
 *      "开放行的减少,只有**同枚提交里 closed 计数相应增加**才算被翻勾"。若禁止任何提交
 *      留下已勾行,就永远造不出这枚配平翻勾,反而把每条结清都变成"无凭据减少"被回捞
 *      (本机 2026-10-20 实测:10 条正是靠补一枚配平翻勾才停止回捞)。
 *
 * 判据(两档,一面一形):
 *   S1 **滞留**(blocking,仅 `--staged`,索引 blob 面):被审面里的已勾登记行,其复合主键在
 *      **基线面(HEAD)里也已是已勾** ⇒ 本次提交把这枚"上一轮就该删掉的已完成行"又往后
 *      带了一整枚提交 ⇒ 判红。刚翻勾的(HEAD 面上还不存在这条已勾行)给一枚宽限 ⇒ 绿,
 *      门 71 的配平凭据因此仍然造得出来。带回旧已勾行(并发旧基线/合并吞并的典型形态)
 *      两个面同键都在 ⇒ 当场红,谁带回来的谁当场删掉。
 *   S2 **存量**(全量档,HEAD blob 面):只报数、永不判红 —— 这一档与"谁在本次提交里做了什么"
 *      无关,按 §12e 恒红门禁令,与提交内容无关的红唯一结局是逼人 --no-verify 并连带废掉
 *      全部守门。兜底清扫归 `scripts/strip-stale-closed-rows.mjs`(挂 git-guardian 巡检轮)。
 *
 * 三面纪律(AGENTS §0.4 / 守门 118):全量档判 HEAD blob,`--staged` 判索引 blob,
 * `--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;取不到被审面 ⇒ exit 2 显式「未判定」,
 * 不记绿也不冒红(§0.3)。复合主键与已勾形态一律 import `scripts/lib/plan-task-index.mjs`
 * 的单一实现(§0.6 / §22c),本门不抄第二份"什么算同一件事"。
 *
 * 用法:
 *   node scripts/check-plan-closed-stock.mjs --staged     (pre-commit,blocking)
 *   node scripts/check-plan-closed-stock.mjs              (全量档,只报数)
 *   node scripts/check-plan-closed-stock.mjs --worktree   (人工逃生舱)
 *   node scripts/check-plan-closed-stock.mjs --self-test  (判据自检)
 * 应急跳过(须带原因,裸标记不放行):HUSKY_SKIP_PLAN_CLOSED_STOCK=1 由 runner 承接,本门只点名。
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { compositeKeyOf, parseTaskRows } from './lib/plan-task-index.mjs'
// 取材一律走层(守门 118):散写 cat-file 会让"清单与内容不同面同轮"这一型悄悄发生。
import { catBatch, selectFace } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = 'PROJECT_PLAN.md'

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m' }

/**
 * 一面上的**已勾登记行**(state==='done')。
 * 身份 = 复合主键(编号 + 正文前缀,`compositeKeyOf` 单源);拿不到主键的行退到整行逐字面,
 * 因为"退化成 null 就看不见"的方向是漏判(少拦一条滞留只是多要一次说明,
 * 但把滞留读成不存在就是本门立项防的那一型)。
 * 同一主键的多枚已勾拷贝**逐枚全部入册**(2026-10-22 根治,本机实读 G-928/G-960 两型):
 * 此前每个主键只留首枚,第二枚拷贝被首枚遮蔽而不在滞留集里;清扫器摘掉首枚后复量时
 * 第二枚才冒头 ⇒ H3"摘后滞留集==跳过集"恒不自洽,台账提交管道实质卡死。
 * 未勾行永不入本册(门 71 的保护面,本门零射程),故同号未勾副本也不得遮蔽已勾拷贝的检出。
 * @returns {Map<string,Array<{line:number,raw:string}>>} 身份 → 该主键的全部命中行(按行序)
 */
export function closedRowsOf(content) {
  const out = new Map()
  let rows
  try {
    rows = parseTaskRows(String(content ?? ''))
  } catch {
    return null // 判据异常 ⇒ 未判定,由调用方落 exit 2,不冒充"没有已勾行"
  }
  for (const r of rows) {
    if (r.state !== 'done') continue
    let id = null
    try {
      id = compositeKeyOf(r.raw)
    } catch {
      id = null
    }
    if (!id) id = `raw:${r.raw}`
    const hit = out.get(id)
    if (hit) hit.push({ line: r.line, raw: r.raw })
    else out.set(id, [{ line: r.line, raw: r.raw }])
  }
  return out
}

/**
 * S1 滞留判定(纯函数):被审面与基线面**同主键都已勾**的行 = 跨枚留着没删的已完成记录。
 * 同主键的多枚已勾拷贝**逐枚全部上报**(判定口径不变:仍是"两面对同一复合主键都已勾";
 * 变的是检出完备性 —— 首枚不再吞掉后续拷贝,否则摘完首枚复量会冒出"新"滞留,
 * 清扫器 H3 恒拒、台账提交管道卡死,2026-10-22 本机实读 G-928/G-960 两型)。
 * @returns {{stale:Array<{line:number,raw:string}>, faceClosed:number, baseClosed:number, undetermined:boolean}}
 */
export function staleClosedVerdict(faceContent, baseContent) {
  const face = closedRowsOf(faceContent)
  const base = closedRowsOf(baseContent)
  if (face === null || base === null)
    return { stale: [], faceClosed: 0, baseClosed: 0, undetermined: true }
  const stale = []
  for (const [id, rows] of face) if (base.has(id)) stale.push(...rows)
  return { stale, faceClosed: face.size, baseClosed: base.size, undetermined: false }
}

/**
 * 同面同轮取被审面与基线面(§0.4):两枚 spec 一次 `catBatch` 取回。
 * 层抛(超限/超时/git 不可用)⇒ null ⇒ 调用方落「未判定」,绝不回落到另一个面(§0.3/§0.4)。
 * @returns {Map|null} spec → 文本(取不到的那枚为 null)
 */
function readPair(faceSpec, baseSpec) {
  try {
    return catBatch(ROOT, [faceSpec, baseSpec], { timeout: 120000 })
  } catch {
    return null
  }
}

/** 自检:纯函数夹具,不碰仓库、不落盘。 */
function selfTest() {
  const FRESH = '- [ ] G-1 P1 测试票:要做一件事'
  const FLIPPED = '- [x] ✅(2026-10-20/某席) G-1 P1 测试票:要做一件事'
  const OTHER = '- [ ] G-2 另一件事'
  const cases = [
    {
      n: '刚翻勾(HEAD 面还没有这条已勾行)⇒ 不判红,门 71 的配平凭据造得出来',
      face: [FLIPPED, OTHER].join('\n'),
      base: [FRESH, OTHER].join('\n'),
      stale: 0,
    },
    {
      n: '滞留(上一枚已翻勾、这一枚仍留着)⇒ 判红',
      face: [FLIPPED, OTHER].join('\n'),
      base: [FLIPPED, OTHER].join('\n'),
      stale: 1,
    },
    {
      n: '并发旧基线把已删的已勾行带回(同主键两文件面都在)⇒ 判红',
      face: [FLIPPED].join('\n'),
      base: [FLIPPED, OTHER].join('\n'),
      stale: 1,
    },
    {
      n: '正文漂开但复合主键相同(编号+标题前缀一致)⇒ 仍算同一枚滞留行',
      face: ['- [x] ✅(2026-10-20/甲) G-1 P1 测试票:要做一件事〔补了进度注记〕'].join('\n'),
      base: [FLIPPED].join('\n'),
      stale: 1,
    },
    {
      n: '摘除后(被审面 0 条已勾)⇒ 绿,且未勾行不受影响',
      face: [FRESH, OTHER].join('\n'),
      base: [FLIPPED, OTHER].join('\n'),
      stale: 0,
    },
    {
      n: '未勾行永远不在已勾集里(门 71 的保护面与本门互不越界)',
      face: [FRESH, OTHER].join('\n'),
      base: [FRESH, OTHER].join('\n'),
      stale: 0,
    },
    {
      n: '注释掉的伪登记行不算(HTML 占位不是台账)',
      face: ['<!-- - [x] G-9 占位 -->', OTHER].join('\n'),
      base: ['<!-- - [x] G-9 占位 -->', OTHER].join('\n'),
      stale: 0,
    },
    {
      n: '空面 ⇒ 0 滞留(不冒红)',
      face: '',
      base: '',
      stale: 0,
    },
    {
      // 2026-10-22 根治(G-928/G-960 型):同主键两枚已勾拷贝必须逐枚全报,
      // 否则摘掉首枚后复量会冒出"新"滞留 ⇒ 清扫器 H3 恒拒、台账提交管道卡死。
      n: '同主键两枚滞留已勾拷贝 ⇒ 逐枚全报(首枚不遮蔽后续拷贝)',
      face: [FLIPPED, '- [x] ✅(2026-10-20/某席) G-1 P1 测试票:要做一件事〔第二枚拷贝〕'].join('\n'),
      base: [FLIPPED, '- [x] ✅(2026-10-20/某席) G-1 P1 测试票:要做一件事〔第二枚拷贝〕'].join('\n'),
      stale: 2,
    },
    {
      // 票面夹具:同一编号既有未勾行又有滞留已勾行 ⇒ 已勾拷贝照报,不被未勾副本遮蔽。
      n: '同号一行未勾+一行滞留已勾 ⇒ 检出已勾拷贝(未勾副本零射程、不遮蔽)',
      face: [FRESH, FLIPPED, OTHER].join('\n'),
      base: [FRESH, FLIPPED, OTHER].join('\n'),
      stale: 1,
    },
  ]
  let fails = 0
  for (const c of cases) {
    const v = staleClosedVerdict(c.face, c.base)
    const ok = !v.undetermined && v.stale.length === c.stale
    if (!ok) {
      fails++
      console.log(`${C.red}✗${C.reset} ${c.n} —— 实得 stale=${v.stale.length} 期望 ${c.stale}`)
    } else {
      console.log(`${C.green}✓${C.reset} ${c.n}`)
    }
  }
  // 反证:判据被掏空(恒返回 0)必须至少咬掉一条正例,否则"自检全绿"可以是零射程
  const hollow = staleClosedVerdict(cases[1].face, cases[1].base)
  if (hollow.stale.length === 0) {
    fails++
    console.log(`${C.red}✗ 反证失败:滞留夹具没被判出 ⇒ 判据可能根本没接上${C.reset}`)
  } else {
    console.log(`${C.green}✓${C.reset} 反证:滞留夹具确有牙(${hollow.stale.length} 条)`)
  }
  console.log(`${C.cyan}自检 ${cases.length + 1 - fails}/${cases.length + 1}${C.reset}`)
  return fails ? 1 : 0
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) process.exit(selfTest())

  const staged = args.includes('--staged')
  const worktree = args.includes('--worktree')
  const picked = selectFace({ staged, worktree })
  if (picked.error) {
    console.error(`${C.red}两面旗同给(§0.4):${C.reset}${picked.error} ⇒ 未判定,不落结论`)
    process.exit(2)
  }

  // 被审面 + 基线面:一档一对,同面同轮(§0.4)。全量档比 HEAD↔HEAD^(= "上一枚就已经留着")。
  const objectFace = picked.face !== 'worktree'
  const faceSpec =
    picked.face === 'staged' ? ':' + FILE : picked.face === 'worktree' ? null : 'HEAD:' + FILE
  const baseSpec = picked.face === 'staged' || picked.face === 'worktree' ? 'HEAD:' + FILE : 'HEAD^:' + FILE
  const faceName =
    picked.face === 'staged'
      ? '索引 blob'
      : picked.face === 'worktree'
        ? '工作树(人工逃生舱)'
        : 'HEAD blob'

  let faceText = null
  let baseText = null
  if (objectFace) {
    const got = readPair(faceSpec, baseSpec)
    if (got === null) {
      console.error(
        `${C.yellow}⏭ 未判定:${C.reset}取材层取不到(${faceSpec} / ${baseSpec})⇒ 不记绿也不冒红(§0.3)`,
      )
      process.exit(2)
    }
    faceText = got.get(faceSpec)
    baseText = got.get(baseSpec)
  } else {
    // 人工逃生舱:唯一允许读盘的一档;基线仍取 HEAD blob
    try {
      faceText = readFileSync(path.join(ROOT, FILE), 'utf8')
    } catch {
      faceText = null
    }
    const got = readPair(baseSpec, baseSpec)
    baseText = got === null ? null : got.get(baseSpec)
  }

  if (faceText === null || baseText === null || faceText === undefined || baseText === undefined) {
    console.error(
      `${C.yellow}⏭ 未判定:${C.reset}被审面(${faceName})或基线面取不到 ⇒ 不记绿也不冒红(§0.3)`,
    )
    process.exit(2)
  }

  const v = staleClosedVerdict(faceText, baseText)
  if (v.undetermined) {
    console.error(`${C.yellow}⏭ 未判定:登记行解析异常 ⇒ 不得读成"没有已完成行"(§0.3)${C.reset}`)
    process.exit(2)
  }

  if (!staged) {
    // S2 全量档:只报数。与本次提交内容无关的红只会逼人跳门(§12e),兜底交给自动摘除器。
    console.log(
      `${v.faceClosed === 0 ? C.green + '✅' : C.cyan + '📊' + C.reset} ` +
        `已完成登记行存量 ${v.faceClosed} 条(面:${faceName};只报数不判红,出口 ` +
        `node scripts/strip-stale-closed-rows.mjs --apply)`,
    )
    for (const r of v.stale.slice(0, 10)) console.log(`   跨枚滞留 L${r.line} ${r.raw.slice(0, 100)}`)
    process.exit(0)
  }

  if (v.stale.length === 0) {
    console.log(
      `${C.green}✅ 完成即删守门:${C.reset}本次提交没有跨枚留着已勾行(被审面已勾 ${v.faceClosed} 条,` +
        `均为本枚首次翻勾;面:${faceName})`,
    )
    process.exit(0)
  }

  const allow = String(process.env.HUSKY_SKIP_PLAN_CLOSED_STOCK_REASON ?? '').trim()
  console.error(
    `${C.red}❌ 完成即删守门(S1 滞留):${C.reset}本次提交把 ${v.stale.length} 条**上一轮就已勾销、` +
      `本应随之删除**的登记行继续留在台账里(基线面同主键也是已勾 ⇒ 不是刚翻勾)。机主令:完成了就应该消失。`,
  )
  for (const r of v.stale.slice(0, 20)) console.error(`   ${C.red}·${C.reset} L${r.line} ${r.raw.slice(0, 110)}`)
  if (v.stale.length > 20) console.error(`   …另有 ${v.stale.length - 20} 条(全量档读数见 --staged 不带旗)`)
  console.error(
    `${C.yellow}出路(只有一条正解,不是放行):${C.reset} ① 同一枚提交里把「翻勾」与「摘行」合并做完,或紧随的下一枚提交里删掉这些行;\n` +
      `       ② 这些行是并发旧基线/合并带回的 ⇒ 直接删,不必先翻勾(结清凭据在提交信息里);\n` +
      `       ③ 无人提交的存量由 node scripts/strip-stale-closed-rows.mjs --apply 走对象空间清扫。\n` +
      `       确属误判 ⇒ 带原因跳过(裸标记不放行):HUSKY_SKIP_PLAN_CLOSED_STOCK=1 且 ` +
      `HUSKY_SKIP_PLAN_CLOSED_STOCK_REASON=<原因>。${allow ? `(当前原因:${allow})` : '(当前未给原因)'}`,
  )
  process.exit(1)
}

// 顶层只在直执行时跑主流程(§22d 双形态):测试/其他门 import 判据不得触发副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { closedRowsOf, staleClosedVerdict, FILE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
