#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对外文档数字清偿器(配套守门 173 check-doc-numbers.mjs 的写回侧器物)
 *
 * 在修什么:
 *   门 173 的 DN2 散文判据自述"谁最后碰这篇文档,谁负责把这篇对齐",但 HEAD 面积压了
 *   上万处存量违规 ⇒ 任何人手工改 README 都被挡死(§12e 恒红门的镜像形态:改不动)。
 *   本器把"可安全写回 / 历史叙述应挂豁免 / 框图需人工"三态分开,只动该动的行。
 *
 * 判据零复算(§0.6):
 *   违规点一律 import 门 173 的 `findStaleClaims`(含块屏蔽与行内 doc-num-exempt 出口),
 *   现算值一律 import `collectNumbers`;定位替换 span 时复用的是门自己的 `CLAIMS` 措辞表,
 *   本器**不写第二份"找数字"的正则**。span 数与门报的违规数逐 key 对不上 ⇒ 整行落 manual。
 *
 * 三态分桶(按行裁决,行内全部违规随行走同一桶):
 *   manual  行内含制表框线(│｜┌┐└┘├┤─)且(替换改变行宽 ∨ 命中点定位失败 ∨ 同时是叙述句);
 *           含"当前总量声明"以外的历史叙述但又落在框图里的也只交人工。一行都不自动动。
 *   exempt  非框图行且命中历史叙述特征:数字→数字的口径迁移叙述(如 "176 llms → 101 llms";
 *           刻意不认裸 `→`,README 有 1229 行 FAQ 答案以 → 起头,那是当前声明不是叙述)、含回顾词
 *           (当年/当时/曾经/已被/原为/漏网口径)、位于 changelog 类列表项(项目符行 +
 *           提交号括注,或最近一个上级标题点名 最近更新/更新日志/Changelog/Recent Updates)。
 *           写回 = 行尾追加 `<!-- doc-num-exempt: 自动判定为历史叙述(<特征>),非当前总量声明 -->`
 *           (带原因、逐行生效,与门 173 S20 同一条锁)。
 *   replace 其余:用该 violation 自己的行做行级替换,只替换门措辞表命中的那一段数字;
 *           原写法带千位逗号则新值同形带逗号。框图行仅当替换后行长逐字不变才落 replace。
 *
 * 纪律:
 *   默认 dry-run 只打印分桶计数 + 样例 + manual 清单落 `.ihui-agent/tmp/scrub-doc-numbers/manual-list.jsonl`;
 *   `--apply` 才写盘,写盘前把每篇原文逐字节备份到 `.ihui-agent/state/doc-numbers-pre-apply-<时间戳>-<篇名>.md`,
 *   并做规划-写盘之间的回读 CAS(文件在规划后被别席改过 ⇒ 整轮拒绝,exit 2 未判定)。
 *   取材面恒为 worktree(人工逃生舱,§0.4 同面同轮:文档与现算值同取 worktree 面)。
 *   取不到被审文档 / 块未闭合(danglingBlock)⇒ exit 2 显式「未判定」,既不记成功也不记失败(§0.3)。
 *   `--apply` 完成后自证:复跑 findStaleClaims ⇒ 剩余 replace 桶必须 = 0,且 manual 集不得新增
 *   (除本轮已知条目外的新 manual ⇒ exit 1 点名);replace=0 但门仍红时显式说明是
 *   exempt/manual 未处置,绝不谎称已清偿。
 *   幂等:连跑两次第二轮必报"本轮零改动"。
 *
 * 手动:
 *   node scripts/scrub-doc-numbers.mjs              # dry-run(默认)
 *   node scripts/scrub-doc-numbers.mjs --apply      # 备份 + 写回 + 自证
 *   node scripts/scrub-doc-numbers.mjs --self-test  # 构造面成对夹具(每桶摘掉判据即翻红)
 * 本器刻意不进提交链(§12e:它是清偿器不是判据;判红权仍归门 173)。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { AUDITED_DOCS, CLAIMS, UPDATES_BEGIN, UPDATES_END, findStaleClaims, toInt } from './check-doc-numbers.mjs'
import { collectNumbers } from './gen-doc-numbers.mjs'
import { readWorktreeFile } from './lib/face-reader.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15/守门 70,禁 process.cwd) */
const ROOT = resolve(SCRIPT_DIR, '..')

export const BACKUP_DIR = join(ROOT, '.ihui-agent', 'state')
export const REPORT_DIR = join(ROOT, '.ihui-agent', 'tmp', 'scrub-doc-numbers')
export const MANUAL_LIST = join(REPORT_DIR, 'manual-list.jsonl')

/** 分桶特征(纯文本判据,全部可被 --self-test 成对证明;不含"找数字"的逻辑) */
export const BOX_RE = /[│｜┌┐└┘├┤─]/
/**
 * 口径迁移叙述的形态:**数字 → 数字**(旧值被新值替换的记录,如 "176 llms → 101 llms")。
 * 刻意不认"行内任意一处 →"——README 的 FAQ 答案行有 1229 行以 "→" 起头(它只是答案标记,
 * 句中的 "176 大模型" 是**没过期的当前总量声明**,该 replace);裸箭头会把它们错埋进 exempt,
 * 等于用豁免掩违规。数字两侧距离收窄到 20 字符,堵掉"上一句结尾数字 … 下一句开头数字"的假配对。
 */
export const ARROW_MIGRATION_RE = /\d[\d,]*(?:[^\d\n]{0,20}→[^\n]{0,20}?\d[\d,]*)/
export const RETROSPECT_RE = /当年|当时|曾经|已被|原为|漏网口径/
export const BULLET_RE = /^[ \t]*[-*+][ \t]/
export const SHA_PAREN_RE = /[(（]\s*[0-9a-f]{7,40}\s*[)）]/
export const UPDATES_HEADING_RE = /最近更新|更新日志|变更日志|Changelog|CHANGELOG|Recent\s+Updates/i

/** 行尾豁免标记的唯一写法(必须带原因,门 173 的 S20 才认)。 */
export function exemptMarker(features) {
  return `<!-- doc-num-exempt: 自动判定为历史叙述（${features.join('、')}），非当前总量声明 -->`
}

/** 最近的上级标题是否点名"最近更新/Changelog"类区块。 */
export function headingSaysUpdates(lines, idx0, lookback = 80) {
  for (let i = idx0 - 1; i >= 0 && idx0 - i <= lookback; i -= 1) {
    const h = /^#{1,6}\s+(.*)$/.exec(lines[i] ?? '')
    if (h) return UPDATES_HEADING_RE.test(h[1])
  }
  return false
}

/** 历史叙述特征集(空数组 = 不是叙述句)。 */
export function detectNarrative(body, lines, idx0) {
  const feats = []
  const am = ARROW_MIGRATION_RE.exec(body)
  if (am) feats.push(`口径迁移叙述(数字→数字:"${am[0].slice(0, 30)}")`)
  const w = RETROSPECT_RE.exec(body)
  if (w) feats.push(`回顾词(${w[0]})`)
  if (BULLET_RE.test(body) && SHA_PAREN_RE.test(body)) feats.push('changelog 列表项(项目符行带提交号括注)')
  else if (BULLET_RE.test(body) && headingSaysUpdates(lines, idx0)) feats.push('位于最近更新/Changelog 节内的列表项')
  return feats
}

/** 带千位逗号写法则新值同形带逗号(展示层格式化,不涉判据)。 */
export function formatLike(digits, want) {
  return String(digits).includes(',') ? want.toLocaleString('en-US') : String(want)
}

/**
 * 用门自己的 CLAIMS 在本行定位每个违规的数字 span 并生成替换后的行。
 * 任一 (key,found) 的命中数与门报违规数不等、span 重叠、命中 0 处 ⇒ 返回 null(交 manual)。
 * @returns {{newLine:string}|null} newLine 不含行尾 \r(调用方自行接回)
 */
export function applySpansToLine(body, vios, numbers) {
  const byKey = new Map()
  for (const v of vios) {
    if (!byKey.has(v.key)) byKey.set(v.key, [])
    byKey.get(v.key).push(v)
  }
  const spans = []
  for (const [key, list] of byKey) {
    const claim = CLAIMS.find((c) => c.key === key)
    if (!claim) return null
    const want = numbers[key]
    if (!Number.isFinite(want)) return null
    claim.re.lastIndex = 0
    const hitsByFound = new Map()
    let m
    while ((m = claim.re.exec(body))) {
      const digits = claim.pick(m)
      if (digits === undefined) continue
      const found = toInt(digits)
      if (!Number.isFinite(found) || found === want) continue
      const at = m.index + m[0].indexOf(digits)
      if (!hitsByFound.has(found)) hitsByFound.set(found, [])
      hitsByFound.get(found).push({ at, digits, found })
    }
    // 逐 found 值对账:该值在门报的违规数必须等于本行命中的 span 数,缺一多一都不改。
    for (const [found, hs] of hitsByFound) {
      if (countFound(list, found) !== hs.length) return null
    }
    for (const v of list) {
      const hs = hitsByFound.get(v.found)
      if (!hs) return null
      for (const h of hs) {
        if (!spans.some((s) => s.at === h.at && s.digits === h.digits)) {
          spans.push({ at: h.at, digits: h.digits, text: formatLike(h.digits, want) })
        }
      }
    }
  }
  if (spans.length === 0) return null
  spans.sort((a, b) => a.at - b.at)
  for (let i = 1; i < spans.length; i += 1) if (spans[i].at < spans[i - 1].at + spans[i - 1].digits.length) return null
  let out = body
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    const s = spans[i]
    out = out.slice(0, s.at) + s.text + out.slice(s.at + s.digits.length)
  }
  return { newLine: out }
}

function countFound(list, found) {
  let n = 0
  for (const v of list) if (v.found === found) n += 1
  return n
}

/**
 * 对一篇文档出裁决:行级分桶 + 写回 edits(行号 1 基来自门,替换只换该行)。
 * @returns {{rel:string, edits:{index:number,from:string,newLine:string}[], buckets:{replace:object[],exempt:object[],manual:object[]}, checked:number, danglingBlock:boolean, total:number}}
 */
export function planDoc(rel, text, numbers) {
  const lines = text.split('\n')
  const scan = findStaleClaims(text, numbers)
  const perLine = new Map()
  for (const v of scan.violations) {
    if (!perLine.has(v.line)) perLine.set(v.line, [])
    perLine.get(v.line).push(v)
  }
  const buckets = { replace: [], exempt: [], manual: [] }
  const edits = []
  for (const [lineNo, vios] of perLine) {
    const idx = lineNo - 1
    const raw = lines[idx] ?? ''
    const hasCr = raw.endsWith('\r')
    const body = hasCr ? raw.slice(0, -1) : raw
    const box = BOX_RE.test(body)
    const feats = detectNarrative(body, lines, idx)
    const spans = applySpansToLine(body, vios, numbers)
    let verdict
    let reason = ''
    if (box) {
      if (feats.length) {
        verdict = 'manual'
        reason = '框图行且含叙述特征(替换与挂标记都会动宽度/边框)'
      } else if (!spans) {
        verdict = 'manual'
        reason = '框图行且命中点定位失败'
      } else if (spans.newLine.length !== body.length) {
        verdict = 'manual'
        reason = `框图行替换会改变行宽(${body.length}→${spans.newLine.length}),框线将塌`
      } else {
        verdict = 'replace'
      }
    } else if (feats.length) {
      verdict = 'exempt'
    } else if (!spans) {
      verdict = 'manual'
      reason = '命中点与门读数无法对账(span 定位失败),不猜着改'
    } else {
      verdict = 'replace'
    }
    for (const v of vios) {
      buckets[verdict].push({
        file: rel,
        line: lineNo,
        bucket: verdict,
        reason,
        features: feats,
        key: v.key,
        found: v.found,
        want: v.want,
        excerpt: v.excerpt,
      })
    }
    const eol = hasCr ? '\r' : ''
    if (verdict === 'replace') edits.push({ index: idx, from: raw, newLine: spans.newLine + eol })
    else if (verdict === 'exempt') edits.push({ index: idx, from: raw, newLine: `${body} ${exemptMarker(feats)}${eol}` })
  }
  return { rel, edits, buckets, checked: scan.checked, danglingBlock: scan.danglingBlock, total: scan.violations.length }
}

/** 行级写回 + 双向守恒断言:改动行集合必须恰等于规划行集合(不增行、不删行、不碰别的行)。 */
export function applyPlan(text, edits) {
  const lines = text.split('\n')
  const out = [...lines]
  const planned = new Set()
  for (const e of edits) {
    if (lines[e.index] !== e.from) throw new Error(`行 ${e.index + 1} 现文与规划底稿不一致(文件在规划后被改动)`)
    out[e.index] = e.newLine
    planned.add(e.index)
  }
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] !== lines[i] && !planned.has(i)) throw new Error(`非规划行 ${i + 1} 发生变化(守恒断言不过,拒绝写盘)`)
  }
  return out.join('\n')
}

export function bucketCounts(plans) {
  const c = { replace: 0, exempt: 0, manual: 0, total: 0 }
  for (const p of plans) {
    c.replace += p.buckets.replace.length
    c.exempt += p.buckets.exempt.length
    c.manual += p.buckets.manual.length
    c.total += p.total
  }
  return c
}

/**
 * 退出码决策(纯函数,三态不并桶):
 *   undetermined ⇒ 2(取不到被审面 / 块未闭合 / 写盘前 CAS 失配)
 *   applied 且写回后剩余 replace 桶 > 0 ⇒ 1(点名)
 *   其余 ⇒ 0(dry-run 只报分析结论;门是否仍红由文案显式说,不由本器代判绿)
 */
export function decideExitCode({ undetermined, applied, postApplyRemainingReplace }) {
  if (undetermined) return 2
  if (applied && postApplyRemainingReplace > 0) return 1
  return 0
}

function manualKeyOf(e) {
  return `${e.file}:${e.line}:${e.key}:${e.found}`
}

/** --apply 后自证:剩余 replace 必须 0;manual 集只许是本轮已点名的那些。 */
export function verifyAfterApply(textsBefore, plansBefore, textsAfter) {
  const problems = []
  const knownManual = new Set()
  for (const p of plansBefore) for (const e of p.buckets.manual) knownManual.add(manualKeyOf(e))
  for (const [rel, text] of textsAfter) {
    const before = textsBefore.get(rel)
    if (text === before) continue
    const afterPlan = planDoc(rel, text, lastNumbers)
    if (afterPlan.buckets.replace.length > 0) {
      for (const e of afterPlan.buckets.replace) problems.push(`剩余 replace:${rel}:${e.line} \`${e.key}\` ${e.found}→${e.want}`)
    }
    for (const e of afterPlan.buckets.manual) {
      if (!knownManual.has(manualKeyOf(e))) problems.push(`新增 manual:${rel}:${e.line} ${e.reason} —— ${e.excerpt}`)
    }
  }
  return problems
}

let lastNumbers = null

function selfTest() {
  const numbers = {
    dbTables: 583,
    apiRoutes: 4363,
    aiServiceRoutes: 548,
    wsEndpoints: 25,
    llmModels: 101,
    publishPlatforms: 38,
    testFiles: 2104,
    i18nLanguages: 5,
    ciWorkflows: 46,
    guardianGates: 188,
    appPackages: 9,
  }
  let pass = 0
  let fail = 0
  const ok = (name, cond) => {
    if (cond) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.log(`  ❌ ${name}`)
    }
  }
  // A1/A2 成对:回顾词行落 exempt;同形无词行落 replace(摘掉叙述判据 ⇒ A1 变 replace = 翻红)
  const a1 = planDoc('README.md', '当年约 110 道守门对全队同时失效\n', numbers)
  ok('A1 叙述句(当年)⇒ exempt 且标记带原因', a1.buckets.exempt.length === 1 && a1.buckets.replace.length === 0 && a1.edits[0].newLine.includes('doc-num-exempt: 自动判定为历史叙述'))
  const a2 = planDoc('README.md', '现在总共 110 道守门脚本在跑\n', numbers)
  ok('A2 同形非叙述 ⇒ replace(分桶不是万能豁免)', a2.buckets.replace.length === 1 && a2.edits[0].newLine.includes('188 道守门脚本'))
  // B → 迁移叙述:数字→数字形态才算;裸箭头(FAQ 答案标记行)不算(成对夹具)
  const b1 = planDoc('README.md', '- 补齐对外口径(176 llms → 101 llms)\n', numbers)
  ok('B1 数字→数字迁移叙述 ⇒ exempt', b1.buckets.exempt.length === 1 && b1.buckets.replace.length === 0)
  const b2 = planDoc('README.md', '→ **IHUI-AI**。176 大模型统一调度\n', numbers)
  ok('B2 行首裸 → 是答案标记不是迁移叙述 ⇒ 句中 176 照 replace', b2.buckets.replace.length === 1 && b2.edits[0].newLine.includes('101 大模型'))
  // C changelog 列表项(项目符 + 提交号括注)
  const c1 = planDoc('README.md', '- 📚 文档:登记 110 道守门脚本 (333fd91)\n', numbers)
  ok('C1 changelog 项(带提交号)⇒ exempt', c1.buckets.exempt.length === 1)
  const c2 = planDoc('README.md', '登记 110 道守门脚本 (333fd91)\n', numbers)
  ok('C2 去项目符不再是 changelog 项 ⇒ replace(特征判据有界)', c2.buckets.replace.length === 1)
  // C3 上级标题为"最近更新"的裸列表项
  const c3 = planDoc('README.md', '## 最近更新\n\n- 现有 110 道守门脚本\n', numbers)
  ok('C3 位于「最近更新」节内的列表项 ⇒ exempt', c3.buckets.exempt.length === 1)
  // D 框图行、替换不改宽 ⇒ 允许 replace;E 改宽 ⇒ manual
  const d1 = planDoc('README.md', '技术护城河 │ 4561 API 路由 │\n', numbers)
  ok('D1 框图行替换不改宽 ⇒ replace 且行宽逐字不变', d1.buckets.replace.length === 1 && d1.edits[0].newLine.length === d1.edits[0].from.length)
  const e1 = planDoc('README.md', '│ 250 个 WebSocket 端点 │\n', numbers)
  ok('E1 框图行替换改宽 ⇒ manual 一行不动', e1.buckets.manual.length === 1 && e1.edits.length === 0 && e1.buckets.manual[0].reason.includes('行宽'))
  const e2 = planDoc('README.md', '合计 250 个 WebSocket 端点\n', numbers)
  ok('E2 同数字非框图行 ⇒ replace(框图判据不吞普通行)', e2.buckets.replace.length === 1)
  // F 幂等:replace 与 exempt 写回后复跑 ⇒ 零违规零改动
  const f1 = applyPlan('现在总共 110 道守门脚本在跑\n', a2.edits)
  ok('F1 replace 写回后复跑 findStaleClaims = 0 违规(幂等)', findStaleClaims(f1, numbers).violations.length === 0)
  const f2 = applyPlan('当年约 110 道守门对全队同时失效\n', a1.edits)
  ok('F2 exempt 标记写回后复跑 = 0 违规(幂等,门认行内出口)', findStaleClaims(f2, numbers).violations.length === 0)
  // G span/违规数对账:同键同值两处、只报一处 ⇒ null(落 manual);报两处 ⇒ 正常替换
  const gBad = applySpansToLine('542 张表,再 542 张表', [{ key: 'dbTables', found: 542, want: 583 }], numbers)
  const gGood = applySpansToLine('542 张表,再 542 张表', [
    { key: 'dbTables', found: 542, want: 583 },
    { key: 'dbTables', found: 542, want: 583 },
  ], numbers)
  ok('G span 数≠门读数 ⇒ 拒改(null→manual);相等 ⇒ 两处全替', gBad === null && gGood !== null && (gGood.newLine.match(/583/g) || []).length === 2)
  // H 千位逗号写法同形保持
  const h1 = planDoc('README.en.md', 'Our platform exposes 4,415 API routes\n', numbers)
  ok('H1 "4,415" 写回为 "4,363"(保留分组形态)', h1.buckets.replace.length === 1 && h1.edits[0].newLine.includes('4,363 API routes'))
  // I applyPlan 守恒:规划底稿与现文不符 ⇒ 抛(别席在飞保护)
  let threw = false
  try {
    applyPlan('别的文本在跑\n', a2.edits)
  } catch {
    threw = true
  }
  ok('I applyPlan 行前像失配 ⇒ 拒绝(不覆盖别席改动)', threw)
  // J 退出码三态不并桶
  ok(
    'J decideExitCode:未判定=2 > 剩余replace=1 > 其余=0',
    decideExitCode({ undetermined: true, applied: true, postApplyRemainingReplace: 0 }) === 2 &&
      decideExitCode({ undetermined: false, applied: true, postApplyRemainingReplace: 3 }) === 1 &&
      decideExitCode({ undetermined: false, applied: true, postApplyRemainingReplace: 0 }) === 0 &&
      decideExitCode({ undetermined: false, applied: false, postApplyRemainingReplace: 9 }) === 0,
  )
  // K 悬空块由门点名、本器交回人工(不静默把整篇当块内)
  const k1 = planDoc('README.md', `<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->\n542 张表\n`, numbers)
  ok('K danglingBlock(块未闭合)⇒ 门体点名,裁决交回人工', k1.danglingBlock === true)
  // L RECENT UPDATES 块由门整体屏蔽 ⇒ 块内数字根本不进本器射程(与门同面,零复算)
  const l1 = planDoc('README.md', `${UPDATES_BEGIN}\n- 补齐口径(176 llms)\n${UPDATES_END}\n`, numbers)
  ok('L 更新块内数字不被本器处置(屏蔽住在门里)', l1.total === 0)
  console.log(`\n自检:pass ${pass} / fail ${fail}`)
  return fail === 0 ? 0 : 1
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const apply = argv.includes('--apply')
  const texts = new Map()
  const missing = []
  for (const rel of AUDITED_DOCS) {
    let t = null
    try {
      t = readWorktreeFile(ROOT, rel)
    } catch {
      t = null
    }
    if (typeof t === 'string') texts.set(rel, t)
    else missing.push(rel)
  }
  if (texts.size < AUDITED_DOCS.length) {
    console.error(`❌ 未判定:被审文档读不到(${missing.join(', ')})⇒ 既不记成功也不记失败;先确认工作树在场再跑`)
    return 2
  }
  let derived
  try {
    derived = collectNumbers({ root: ROOT, face: 'worktree' })
  } catch (e) {
    console.error(`❌ 未判定(现算值取不到):${e?.message ?? e}`)
    return 2
  }
  lastNumbers = derived.numbers
  const plans = []
  for (const [rel, text] of texts) {
    const p = planDoc(rel, text, derived.numbers)
    if (p.danglingBlock) {
      console.error(`❌ 未判定:${rel} 的生成块/更新块未闭合(有 begin 无 end)⇒ 屏蔽面会吞到文末,本轮拒绝处置任何一篇(既不记成功也不记失败)`)
      return 2
    }
    plans.push(p)
  }
  const c = bucketCounts(plans)
  console.log(`face=worktree · 门 173 违规共 ${c.total} 处(命中判据 ${plans.reduce((a, p) => a + p.checked, 0)} 处)· 分桶:replace=${c.replace} exempt=${c.exempt} manual=${c.manual}`)
  for (const p of plans) {
    console.log(`  ${p.rel}:违规 ${p.total} ⇒ replace=${p.buckets.replace.length} exempt=${p.buckets.exempt.length} manual=${p.buckets.manual.length}`)
  }
  for (const bucket of ['replace', 'exempt', 'manual']) {
    const all = plans.flatMap((p) => p.buckets[bucket])
    if (all.length === 0) continue
    console.log(`── ${bucket} 样例(共 ${all.length} 条,前 ${Math.min(all.length, 5)} 条)`)
    for (const e of all.slice(0, 5)) console.log(`   ${e.file}:${e.line} \`${e.key}\` ${e.found}→${e.want}${e.reason ? ` · ${e.reason}` : ''} —— ${e.excerpt}`)
  }
  const manualAll = plans.flatMap((p) => p.buckets.manual)
  if (manualAll.length > 0) {
    mkdirSync(REPORT_DIR, { recursive: true })
    writeFileSync(MANUAL_LIST, manualAll.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
    console.log(`manual 全量清单(一行都不会自动动)⇒ ${MANUAL_LIST}`)
  }
  if (c.total === 0) {
    console.log('✅ 本轮零改动:门 173 散文判据零违规(若门仍报红,红源在 DN1 生成块,跑 node scripts/gen-doc-numbers.mjs --markdown)')
    return 0
  }
  if (!apply) {
    if (c.replace === 0) {
      console.log(`ℹ️ dry-run:replace 桶=0,但门仍会红 —— 未处置的是 exempt=${c.exempt}(--apply 挂标记)与 manual=${c.manual}(只交人工)。本器不声称已清偿。`)
    } else {
      console.log(`ℹ️ dry-run:--apply 将写回 ${c.replace} 行、给 ${c.exempt} 行挂 doc-num-exempt 标记、跳过 ${c.manual} 行(manual 一行不动)。`)
    }
    return 0
  }
  // ---- --apply ----
  const newDocs = new Map()
  try {
    for (const p of plans) newDocs.set(p.rel, applyPlan(texts.get(p.rel), p.edits))
  } catch (e) {
    console.error(`❌ 未判定(写回守恒断言不过):${e?.message ?? e} ⇒ 一个字都没写;文件在规划后被别席改动,请重跑`)
    return 2
  }
  if (newDocs.size === 0) {
    console.log('本轮零改动(无可写回行)')
    return 0
  }
  const editsCount = plans.reduce((a, p) => a + p.edits.length, 0)
  if (editsCount === 0) {
    console.log(`本轮零改动:replace=0 exempt=0,门仍红的残余是 manual=${c.manual}(需人工裁定,本器代不了)。不声称已清偿。`)
    return 0
  }
  // CAS:规划底稿 ↔ 写盘瞬间的盘上内容必须逐字节一致(别席在飞 ⇒ 整轮拒绝)
  for (const [rel, oldText] of texts) {
    let now = null
    try {
      now = readWorktreeFile(ROOT, rel)
    } catch {
      now = null
    }
    if (now !== oldText) {
      console.error(`❌ 未判定:${rel} 在规划与写盘之间被改动 ⇒ CAS 失配,一个字都不写;重跑本器取新底稿`)
      return 2
    }
  }
  const ts = stamp()
  mkdirSync(BACKUP_DIR, { recursive: true })
  for (const [rel, text] of texts) {
    const backup = join(BACKUP_DIR, `doc-numbers-pre-apply-${ts}-${rel.replace(/[^\w.]/g, '_')}.md`)
    writeFileSync(backup, text, 'utf8')
    console.log(`🗂 原文备份:${backup}`)
  }
  for (const [rel, text] of newDocs) {
    writeFileSync(join(ROOT, rel), text, 'utf8')
    const back = readFileSync(join(ROOT, rel), 'utf8')
    if (back !== text) {
      console.error(`❌ 未判定:${rel} 写后回读与期望不一致(§13),备份见 ${BACKUP_DIR}/doc-numbers-pre-apply-${ts}-*.md`)
      return 2
    }
  }
  // 自证:复跑门判据
  const after = new Map()
  for (const rel of AUDITED_DOCS) after.set(rel, readWorktreeFile(ROOT, rel))
  lastNumbers = collectNumbers({ root: ROOT, face: 'worktree' }).numbers
  const problems = verifyAfterApply(texts, plans, after)
  const c2 = bucketCounts(plans.map((p) => planDoc(p.rel, after.get(p.rel), lastNumbers)))
  if (problems.length > 0 || c2.replace > 0) {
    for (const x of problems) console.error(`❌ 自证不过:${x}`)
    console.error(`结论:剩余 replace=${c2.replace} ⇒ 不为 0,本器判失败(备份在 ${BACKUP_DIR}/doc-numbers-pre-apply-${ts}-*.md)`)
    return 1
  }
  console.log(
    `✅ SCRUB-RESULT state=applied 写回=${editsCount} 行 · 剩余 replace=0 · exempt 已挂标记=${c.exempt} · manual 原样保留=${c.manual}`,
  )
  if (c.manual > 0) console.log('⚠️ 门仍会红:manual 桶一行未动(需人工裁定,清单见上),本器不声称已清偿。')
  else if (c2.total > 0) console.log(`⚠️ 写回后仍有残余违规 ${c2.total} 处(exempt=${c2.exempt} manual=${c2.manual}),不声称已清偿。`)
  else console.log('✅ 散文判据本轮清零(生成块 DN1 如需刷新:node scripts/gen-doc-numbers.mjs --markdown)')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  planDoc,
  applyPlan,
  applySpansToLine,
  detectNarrative,
  headingSaysUpdates,
  exemptMarker,
  formatLike,
  bucketCounts,
  decideExitCode,
  verifyAfterApply,
  BOX_RE,
  ARROW_MIGRATION_RE,
  RETROSPECT_RE,
  SHA_PAREN_RE,
  UPDATES_HEADING_RE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
