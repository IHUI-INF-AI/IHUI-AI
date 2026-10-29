#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * check-live-doc-merge-recall.mjs —— 普通 `git merge` 把**已结清登记行**按旧形态带回的只读探测器。
 *
 * 立因(2026-10-28,台账票「普通 git merge 合并活文档会绕开 union 判据」):实测枚
 * `34e6c5e72c10ca28e150f0c7b397cbc683901de6`(Merge origin/main … into …)把「完成即删兜底轮削掉
 * 文件尾」票的 `- [ ]` 旧形态带回 HEAD 与 origin/main。把同一组三面喂给 `liveDocExpectedCounts`
 * 得 want=0 ⇒ **判据是有效的,失效在通道**:该次合并没走 `union-converge` / `merge-live-doc`,
 * 普通三方合并按「对侧相对基底新增」直接取回。
 *
 * 判据**只有一份**:本器直接 import `union-converge.mjs` 的 `liveDocExpectedCounts`(§0.6 单一真相源),
 * 自己不做任何行计数公式、不复制 `declaredDropCaps` / `yieldedIdCaps` / `archiveDropCaps` 的语义。
 * 本器只做一件事:把三面喂给那一张期望重数表,再问"结果面里有没有它判 0 份的未勾登记行"。
 *
 * 只查 `- [ ]` 登记行:票面事故的形态就是"结清行按结清**前**的旧形态回来",而其它行
 * (已勾行/散文/空行)在合并里合法地多一份并不等于回捞 —— 把面收窄到这一型才不会变成噪声门。
 *
 * 退出码(§0.3 三档):0 无回捞嫌疑 / 1 判出嫌疑并逐条点名 / 2 取不到面或判据抛错(未判定,
 * 既不记绿也不冒红)。取不到 `.ihui-agent/state/` 台账时 `declaredDropCaps` 结构上认不出已摘行,
 * 本器如实落 2 而不是 0 —— 失效方向必须是"多要一次定向说明"。
 *
 * 用法:
 *   node scripts/check-live-doc-merge-recall.mjs [--last N] [--json] [--self-test]
 *   默认 --last 10:扫最近 10 枚 merge commit。
 *
 * 接线:`.husky/post-merge`(普通 merge 落点后立刻探测,只警告不阻塞 merge 结果) +
 * 人工/CI 随时可跑。**不进提交链**(§12e:判的是历史合并事实,提交者结构上满足不了)。
 */
import { gitRaw } from './lib/face-reader.mjs'
import { liveDocExpectedCounts } from './union-converge.mjs'
import { pathToFileURL } from 'node:url'

const FILE = 'PROJECT_PLAN.md'
const OPEN_ROW_RE = /^\s*- \[ \]/

/**
 * 纯判据:给定三面与**当前 HEAD 面**,返回"本侧已行使处置权、却被合并原样带回且至今仍在"的嫌疑清单。
 *
 * 三条同时成立才判(缺一即不报 —— 探测器的失效方向必须是"少报",否则它自己就成了噪声门):
 *   ① 该未勾行在**合并结果面**的份数 > 期望份数(`liveDocExpectedCounts` 判它该有几份);
 *   ② 该行在**本侧(合并第一父)**是 0 份 —— 本侧已删/已结清,处置权已行使;
 *      只有 ② 成立才是"带回";本侧本来就有那一行(长期未勾票)时 ① 也会命中,但那是恒有票不是回捞。
 *   ③ 该行在**当前 HEAD 面仍然存在** —— 已经修掉的历史事故不再报,否则本器永远红。
 *
 * @param {{oursText:string, theirsText:string, baseText:string, headText:string, nowText:string}} faces
 * @returns {{ok:boolean, rows?:Array<{row:string, inHead:number, expected:number}>, why?:string}}
 */
export function recalledRowsOf({ oursText, theirsText, baseText, headText, nowText }) {
  let want
  try {
    want = liveDocExpectedCounts(oursText, theirsText, baseText)
  } catch (e) {
    return { ok: false, why: `liveDocExpectedCounts 抛错:${e?.message ?? e}` }
  }
  const openCount = (text) => {
    const m = new Map()
    for (const line of String(text ?? '').split('\n')) {
      if (!OPEN_ROW_RE.test(line)) continue
      m.set(line, (m.get(line) || 0) + 1)
    }
    return m
  }
  const got = openCount(headText)
  const own = openCount(oursText)
  const now = openCount(nowText)
  const rows = []
  for (const [row, inHead] of got) {
    const expected = want.get(row) || 0
    if (inHead <= expected) continue // ① 不成立
    if ((own.get(row) || 0) > 0) continue // ② 本侧本来就有,不是带回
    if ((now.get(row) || 0) === 0) continue // ③ 已被修掉,不报历史
    rows.push({ row, inHead, expected })
  }
  return { ok: true, rows }
}

function git(args) {
  return gitRaw(args, process.cwd())
}

function blobOf(rev) {
  try {
    return git(['show', `${rev}:${FILE}`])
  } catch {
    return null
  }
}

/** 取最近 N 枚 merge commit(第一父 + 至少第二父) */
export function mergeCommitsOf(last) {
  const raw = git(['rev-list', `--max-count=${Math.max(1, last) * 4}`, 'HEAD'])
  const out = []
  for (const sha of raw.split('\n').filter(Boolean)) {
    const parents = git(['rev-list', '--parents', '-n', '1', sha]).trim().split(/\s+/).slice(1)
    if (parents.length >= 2) out.push({ sha, parents })
    if (out.length >= last) break
  }
  return out
}

export function auditMerge({ sha, parents }, nowText) {
  const ours = blobOf(parents[0])
  const theirs = blobOf(parents[1])
  const head = blobOf(sha)
  if (ours === null || theirs === null || head === null)
    return { sha, ok: false, why: `${FILE} 在 ${sha} 的某一面取不到(未判定)` }
  let mb
  try {
    mb = git(['merge-base', parents[0], parents[1]]).trim()
  } catch (e) {
    return { sha, ok: false, why: `merge-base 取不到:${e?.message ?? e}` }
  }
  const base = mb ? blobOf(mb) : null
  if (base === null) return { sha, ok: false, why: `基底 ${mb} 的 ${FILE} 取不到(未判定)` }
  const verdict = recalledRowsOf({
    oursText: ours,
    theirsText: theirs,
    baseText: base,
    headText: head,
    nowText,
  })
  return { sha, ...verdict }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const lastIdx = argv.indexOf('--last')
  const last = lastIdx >= 0 ? Number(argv[lastIdx + 1]) : 10
  const asJson = argv.includes('--json')
  if (!Number.isInteger(last) || last <= 0) {
    console.error('❌ --last 需要正整数')
    return 2
  }
  let merges
  try {
    merges = mergeCommitsOf(last)
  } catch (e) {
    console.error(`❓ 未判定:取 merge 清单失败 ${e?.message ?? e}`)
    return 2
  }
  const nowText = blobOf('HEAD')
  if (nowText === null) {
    console.error(`❓ 未判定:当前 HEAD 面的 ${FILE} 取不到`)
    return 2
  }
  if (merges.length === 0) {
    console.log('[merge-recall] 最近窗口内没有 merge commit ⇒ 本器无话可说(不记绿)')
    return 0
  }
  const results = merges.map((m) => auditMerge(m, nowText))
  const undet = results.filter((r) => r.ok === false)
  const hits = results.filter((r) => r.ok === true && r.rows.length > 0)
  if (asJson) {
    console.log(JSON.stringify({ file: FILE, scanned: merges.length, hits, undetermined: undet }, null, 1))
  } else {
    for (const h of hits) {
      console.log(`❌ ${h.sha} 带回 ${h.rows.length} 条未勾登记行(期望份数 < 实际份数):`)
      for (const r of h.rows.slice(0, 10))
        console.log(`   · 期望 ${r.expected} 份 / 实际 ${r.inHead} 份:${r.row.slice(0, 120)}`)
    }
    for (const u of undet) console.log(`❓ ${u.sha} 未判定:${u.why}`)
    console.log(
      `[merge-recall] 扫 ${merges.length} 枚 merge:判出 ${hits.length} 枚带回、${undet.length} 枚未判定`,
    )
  }
  if (undet.length > 0) return 2
  return hits.length > 0 ? 1 : 0
}

function selfTest() {
  const ROW = '- [ ] G-1 新增'
  const cases = [
    // 正例:对侧相对基底新增的未勾行,本侧没有 ⇒ 期望 1 份、结果面 1 份 ⇒ 不算回捞
    { n: '对侧新增、份数吻合 ⇒ 不报', f: { oursText: '', theirsText: ROW, baseText: '', headText: ROW, nowText: ROW }, want: 0 },
    // 反证:结果面比期望多一份 ⇒ 判出
    { n: '份数超出期望 ⇒ 报', f: { oursText: '', theirsText: ROW, baseText: '', headText: `${ROW}\n${ROW}`, nowText: `${ROW}\n${ROW}` }, want: 1 },
    // 反证②:本侧本来就有那一行(长期未勾票) ⇒ 不是"带回",不报
    { n: '本侧本来就有 ⇒ 不报', f: { oursText: ROW, theirsText: ROW, baseText: '', headText: `${ROW}\n${ROW}`, nowText: `${ROW}\n${ROW}` }, want: 0 },
    // 反证③:历史事故已修(当前 HEAD 面已无该行) ⇒ 不报历史
    { n: '当前面已无该行 ⇒ 不报历史', f: { oursText: '', theirsText: ROW, baseText: '', headText: `${ROW}\n${ROW}`, nowText: '' }, want: 0 },
  ]
  let fail = 0
  for (const c of cases) {
    const r = recalledRowsOf(c.f)
    if (!r.ok || r.rows.length !== c.want) {
      console.log(`❌ 自检不符[${c.n}]:期望 ${c.want} 条嫌疑,实得 ${r.ok ? r.rows.length : r.why}`)
      fail++
    }
  }
  console.log(fail === 0 ? `✅ 自检 ${cases.length}/${cases.length} 通过` : `❌ 自检 ${fail} 项不符`)
  return fail === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { recalledRowsOf, mergeCommitsOf, auditMerge, FILE, OPEN_ROW_RE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
