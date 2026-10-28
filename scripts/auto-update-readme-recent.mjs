#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// scripts/auto-update-readme-recent.mjs
// ─────────────────────────────────────────────────────────────────────────
// 提交时依据 git log 自动刷新四个 README 的 "RECENT UPDATES" 标记区间(最近更新小节)。
// 设计立点(李总诉求:文档随开发自动跟上,不要单独起会话催更,也不要独立定时任务 —— 直接做进提交钩子):
//   · 与 scripts/sync-readme-numbers.mjs(数字块)同族,都是"派生副本随提交自动重算"的确定性产物;
//   · 不依赖 AI / 不联网 / 不调用外部程序 ⇒ 毫秒级,绝不阻塞提交;
//   · 增量基线存于 .doc-autoupdate/last-sha(上次处理到的 commit);取 last-sha..HEAD 的提交(排除 merge),
//     按日期分组,按 conventional-commit 类型打 emoji + 本地化标签;
//   · 四语言各自用本地化"类型标签 + 区块标题",条目正文用原 commit subject(中英混排,开发者自解释),
//     保证四语言同源、事实一致;
//   · 仅替换 BEGIN/END RECENT UPDATES 标记之间的内容,标记外(含特性总览等人工撰写区)一律不动;
//   · 与既有条目去重靠增量基线(只处理 last-sha 之后的提交),新条目置顶,总日期组封顶(~15),超出丢最旧;
//   · 安全闸:仅当"块外内容"相对索引版本无差异时才 git add,绝不把他人/他席未提交的 prose 改动吞进本次提交。
// 退出码 0 = 成功(无论是否写盘);非 0 = git 取材失败。
// ─────────────────────────────────────────────────────────────────────────
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const READMES = [
  { file: 'README.md', lang: 'zh' },
  { file: 'README.en.md', lang: 'en' },
  { file: 'README.ko.md', lang: 'ko' },
  { file: 'README.ja.md', lang: 'ja' },
]
export const BEGIN = '<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->'
export const END = '<!-- END RECENT UPDATES -->'
const BASELINE = path.join(ROOT, '.doc-autoupdate', 'last-sha')
const MAX_GROUPS = 15

/**
 * 锚点存续判据(纯函数,零 IO ⇒ 可被测试直接构造正反面)。
 *
 * 立它的理由(2026-10-23 实测的失效型):旧实现在 `indexOf(BEGIN)`/`indexOf(END)` 任一发 -1
 * 时 `continue` —— 既不写盘也**不出声**,而 `touched` 仍为 0,函数末尾于是打印
 * `✅ 最近更新无新增提交,跳过`。于是"本器在这份文档上结构上已经干不了活"这件事,
 * 在钩子日志、post-commit 留痕和退出码三处**全都记成绿**(AGENTS §0.3「没判绝不写成判过」)。
 * 而本仓当下正在发生的形态更糟:活文档归并器(`union-converge` 的行级 union、
 * `merge-live-doc` 的"无锚点⇒追加到文件末尾")把 HEAD 侧内容整段甩到 `END` **之后**,
 * 块内块外同时存在同族条目 ⇒ 锚点一旦成双或错位,`indexOf` 取到的那一对会把中间内容
 * 当成"块内"整段覆盖掉(静默吞别人的行)。
 *
 * 所以判据分四态,且**非 ok 一律不落盘、逐条点名、整体记未判定**:
 *   ok        恰一枚 BEGIN、恰一枚 END、BEGIN 在前
 *   missing   任一标记缺失
 *   ambiguous 任一标记出现 ≥2 枚(`indexOf` 的静默覆盖面)
 *   inverted  END 在 BEGIN 之前(区间不成立)
 * 失效方向恒为「多要一次定向说明」(AGENTS §0.10):宁可这轮不刷新最近更新,
 * 也绝不把"追加到文件尾"当成出路 —— 那正是尾部腐坏的来源。
 *
 * @param {string} text 文档全文
 * @param {string} begin BEGIN 标记
 * @param {string} end   END 标记
 * @returns {{state:'ok'|'missing'|'ambiguous'|'inverted', beginCount:number, endCount:number, reason:string}}
 */
export function assessAnchors(text, begin, end) {
  const beginCount = text.split(begin).length - 1
  const endCount = text.split(end).length - 1
  const base = { beginCount, endCount }
  if (beginCount === 0 || endCount === 0)
    return { ...base, state: 'missing', reason: `标记缺失(BEGIN ${beginCount} 枚 / END ${endCount} 枚)` }
  if (beginCount > 1 || endCount > 1)
    return {
      ...base,
      state: 'ambiguous',
      reason: `锚点成双(BEGIN ${beginCount} 枚 / END ${endCount} 枚)⇒ indexOf 只会取第一对,` +
        '其余会被当成块内整段覆盖,拒绝落盘',
    }
  if (text.indexOf(end) < text.indexOf(begin))
    return { ...base, state: 'inverted', reason: 'END 在 BEGIN 之前,标记区间不成立' }
  return { ...base, state: 'ok', reason: '' }
}

/**
 * 本器产出形态的「块外散落」探测器(纯函数,只数不判)。
 *
 * 为什么探这一维:归并器把块内条目甩到 `END` 之后时,产出的字节与块内**一模一样**
 * (`- <emoji> <类型标签>:<commit subject> (<hash>)`)。块内由本器负责,块外那几百行
 * 既无人重算、又永远不会被裁(MAX_GROUPS 只管块内)——它就是 README 尾部腐坏的主体,
 * 而此前**没有任何器物看得见它**(静默,AGENTS §12f)。
 * 这里刻意只**点名不删**:删块外内容是归并决策,权在席与主席,不在刷新器。
 *
 * @param {string} text 文档全文
 * @param {string} begin BEGIN 标记
 * @param {string} end   END 标记
 * @param {string[]} labels 六族类型标签(各语言)
 * @param {string[]} emojis 类型 emoji 集
 * @returns {number} 块外命中枚数;标记区间不成立时返回 -1(未判定,不冒充 0)
 */
export function countEntriesOutsideBlock(text, begin, end, labels, emojis) {
  const bi = text.indexOf(begin)
  const ei = text.indexOf(end)
  if (bi === -1 || ei === -1 || ei < bi) return -1
  const outside = text.slice(0, bi) + '\n' + text.slice(ei + end.length)
  const labelAlt = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const emojiAlt = emojis.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  // 逐行判 ⇒ 只需要 `m`,**绝不带 `g`**:`g` 的 `lastIndex` 会在 `filter(re.test)` 之间跨行残留,
  // 于是相邻两条只数到一条(自检 B2 实测抓到,即此型)。
  const re = new RegExp(`^[-*]?\\s*(?:${emojiAlt})\\s*(?:${labelAlt}):.*\\([0-9a-f]{7,40}\\)\\s*$`, 'm')
  return outside.split('\n').filter((l) => re.test(l)).length
}

const TYPE_EMOJI = { feat: '🚀', fix: '🐞', refactor: '♻️', perf: '⚡', docs: '📚', other: '🔧' }
const TYPE_LABELS = {
  feat: { zh: '新功能/改进', en: 'Feature/Improvement', ko: '기능/개선', ja: '機能/改善' },
  fix: { zh: '修复', en: 'Fix', ko: '수정', ja: '修正' },
  refactor: { zh: '重构', en: 'Refactor', ko: '리팩터', ja: 'リファクタ' },
  perf: { zh: '性能', en: 'Perf', ko: '성능', ja: 'パフォーマンス' },
  docs: { zh: '文档', en: 'Docs', ko: '문서', ja: 'ドキュメント' },
  other: { zh: '工程/其他', en: 'Chore/Other', ko: '기타', ja: 'その他' },
}
/** 四语言全部类型标签 + 全部类型 emoji(块外散落探测的形态词表;单源 = 上面这两张表,不再抄第二份) */
const ALL_LABELS = Object.values(TYPE_LABELS).flatMap((m) => Object.values(m))
const ALL_EMOJIS = Object.values(TYPE_EMOJI)
// 内部台账/守门记账类噪声:这些 commit 是工程治理自洽动作,不是用户可感知的"项目改动",落 README 反而显脏。
// 2026-10-22 补两条**自激**来源(实测 post-commit 回写 → auto-commit 收编 → 又生成条目,每 3 分钟一枚):
//   · `README 最近更新` —— 本器自己产出的文档收口提交,记进去等于把"更新 README"这件事再写进 README;
//   · `chore(auto):`    —— auto-commit-quiet 的收编提交,它落地 README 回写后又会触发下一次回写。
const NOISE_RE = /自动回捞|台账|登记行|随勾|收账|回写|被回写|README 最近更新|^chore\(auto\)/

function git(args) {
  // 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + quotepath + 显式 stdio/windowsHide
  // 由 gitRaw 同源提供,不再自拼裸 'git' 派生。
  return gitRaw(args, ROOT, { maxBuffer: 64 * 1024 * 1024 })
}

/** 判断 SHA 是否真实存在于本仓库(防止基线指向已不在当前历史的提交,导致 git log <sha>..HEAD 报错卡死钩子)。 */
function commitExists(sha) {
  try {
    git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`])
    return true
  } catch {
    return false
  }
}

/** 取 last-sha 基线(文件不存在 / 内容为空 / SHA 不在本仓库 ⇒ 退回 HEAD~20,首次回填近 20 条)。 */
function readBaseline() {
  try {
    const s = fs.readFileSync(BASELINE, 'utf8').trim()
    if (s && commitExists(s)) return s
  } catch {
    /* 文件不存在 */
  }
  try {
    return git(['rev-parse', 'HEAD~20']).trim()
  } catch {
    return git(['rev-parse', 'HEAD']).trim()
  }
}

/** 取 last-sha..HEAD 的提交,按日期分组,识别 conventional-commit 类型。 */
function collectSince(sinceSha) {
  const out = git([
    'log',
    `${sinceSha}..HEAD`,
    '--no-merges',
    '--pretty=format:%h%x09%ad%x09%s',
    '--date=short',
  ])
    .trim()
  if (!out) return []
  const byDate = new Map()
  for (const line of out.split('\n')) {
    const [hash, date, subject] = line.split('\t')
    if (!date || !subject) continue
    if (NOISE_RE.test(subject)) continue // 跳过内部台账/守门记账噪声
    const m = /^(\w+)(?:\([^)]*\))?\s*:\s*(.*)$/.exec(subject)
    const rawType = m ? m[1].toLowerCase() : 'other'
    const type = TYPE_LABELS[rawType] ? rawType : 'other'
    const body = (m ? m[2] : subject).trim()
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push({ hash, type, subject: body })
  }
  return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

/** 把一个日期组的提交渲染成某语言的文本块。 */
function renderGroup(date, entries, lang) {
  const lines = [`**${date}**`]
  for (const e of entries) {
    const emoji = TYPE_EMOJI[e.type]
    const label = TYPE_LABELS[e.type][lang]
    lines.push(`- ${emoji} ${label}:${e.subject} (${e.hash})`)
  }
  return lines.join('\n')
}

/** 把若干日期组拼接为块文本,并封顶到 MAX_GROUPS(丢弃最旧的尾部组)。 */
function buildInner(newGroups, existingInner) {
  const parts = newGroups.slice()
  if (existingInner.trim()) parts.push(existingInner.trim())
  // 按 "\n\n" 切分为日期组(组内 bullet 单行、组间空行),取前 MAX_GROUPS 组。
  const groups = parts.join('\n\n').split('\n\n').filter(Boolean)
  const capped = groups.slice(0, MAX_GROUPS)
  return capped.join('\n\n')
}

/** 取块外内容(标记之前 + 标记之后);用于判断除自动区外是否另有改动。 */
function outsideBlock(text) {
  const bi = text.indexOf(BEGIN)
  const ei = text.indexOf(END)
  if (bi === -1 || ei === -1) return text
  return text.slice(0, bi) + '\n' + text.slice(ei + END.length)
}

function main() {
  const sinceSha = readBaseline()
  const groups = collectSince(sinceSha)
  const headSha = git(['rev-parse', 'HEAD']).trim()

  let touched = 0
  const staged = []
  const skipped = []
  /** 锚点不成立 ⇒ 该文档本轮拒写,逐条留名(不静默、不冒充"无新增提交") */
  const refused = []
  /** 块外散落条目登记(只点名) */
  const strayOutside = []

  for (const { file, lang } of READMES) {
    const p = path.join(ROOT, file)
    if (!fs.existsSync(p)) continue
    const wt = fs.readFileSync(p, 'utf8')
    const verdict = assessAnchors(wt, BEGIN, END)
    if (verdict.state !== 'ok') {
      refused.push({ file, state: verdict.state, reason: verdict.reason })
      console.error(`❌ 拒写 ${file}:${verdict.state} —— ${verdict.reason}(锚点不成立时绝不追加、绝不覆盖,请人工修标记后重跑)`)
      console.log(`REFUSED:${file}:${verdict.state}`)
      continue
    }
    const bi = wt.indexOf(BEGIN)
    const ei = wt.indexOf(END)
    // 块外散落探测:只点名、不删(删除权在归并决策方,不在刷新器)
    const stray = countEntriesOutsideBlock(wt, BEGIN, END, ALL_LABELS, ALL_EMOJIS)
    if (stray < 0) {
      console.error(`❌ 未判定 ${file}:块外条目探测取不到区间(与锚点判据同一条规矩,不冒充 0)`)
      console.log(`UNJUDGED_STRAY:${file}`)
    } else if (stray > 0) {
      strayOutside.push({ file, n: stray })
      console.error(
        `⚠️ ${file}:本器产出形态的条目有 ${stray} 枚落在 RECENT UPDATES 标记**之外**` +
          '(归并器"无锚点⇒追加文件尾"的指纹;块外那些永不会被 MAX_GROUPS 裁,也不会被本器重算)',
      )
      console.log(`STRAY_OUTSIDE:${file}:${stray}`)
    }
    const existingInner = wt.slice(bi + BEGIN.length, ei).replace(/^\n+|\n+$/g, '')
    const newGroups = groups.map(([date, entries]) => renderGroup(date, entries, lang))
    const inner = buildInner(newGroups, existingInner)
    // 无新提交且既存内容未变 ⇒ 幂等跳过(不写盘)
    if (newGroups.length === 0 && inner === existingInner) continue
    const head = wt.slice(0, bi + BEGIN.length)
    const tail = wt.slice(ei) // 含 END 及之后
    const newText = head + '\n' + inner + '\n' + tail
    fs.writeFileSync(p, newText)
    touched++
    // 安全闸:仅当"块外内容"相对索引版本无差异时,才 git add,避免吞并他人在飞 prose 改动。
    let idxText = null
    try {
      idxText = git(['show', `:${file}`])
    } catch {
      idxText = null
    }
    const safe = idxText !== null && outsideBlock(wt) === outsideBlock(idxText)
    if (safe) {
      git(['add', file])
      staged.push(file)
      console.log(`  ✅ ${file}: 最近更新已刷新并加入 staged`)
      console.log(`STAGED:${file}`)
    } else {
      skipped.push(file)
      console.log(
        `  ⚠️  ${file}: 最近更新已写盘,但块外另有未提交差异,已跳过 git add(请单独提交,避免吞并他人在飞改动)`,
      )
      console.log(`SKIP_PROSE:${file}`)
    }
  }

  // 基线只在**真的写盘**时推进(2026-10-22 根治):
  // 旧实现无论 touched 是否为 0 都写 last-sha ⇒ post-commit 每跑一次就把基线文件弄脏,
  // 即使范围里只有噪声提交也要再回捞一枚"只有指针"的提交。留在原地即可:下次重扫
  // 同一批噪声提交是无害的(NOISE_RE 过滤后仍不产条目),而真实提交进来时会正常生成。
  if (touched > 0) {
    try {
      fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
      fs.writeFileSync(BASELINE, headSha + '\n')
    } catch {
      /* 基线写入失败不致命,下次会重试 */
    }
  }

  if (touched === 0 && refused.length === 0) console.log('  ✅ 最近更新无新增提交,跳过')
  if (refused.length > 0) {
    console.error(
      `❌ 未判定:${refused.length}/${REFUSE_SCOPE} 份被审 README 的 RECENT UPDATES 锚点不成立` +
        ` ⇒ 本轮整批不出具合格证(拒写已逐条点名;AGENTS §0.3「没判绝不写成判过」、§0.10「失效方向是多要一次说明,` +
        '绝不是多放一次」)',
    )
    for (const r of refused) console.error(`   · ${r.file}:${r.state} —— ${r.reason}`)
    if (strayOutside.length > 0) {
      console.error(`   · 块外散落条目:${strayOutside.map((s) => `${s.file} ${s.n} 枚`).join('、')}`)
    }
    return 2
  }
  if (strayOutside.length > 0)
    console.error(
      `⚠️ 块外散落条目共 ${strayOutside.reduce((a, s) => a + s.n, 0)} 枚(${strayOutside
        .map((s) => `${s.file} ${s.n}`)
        .join('、')})—— 本器不删,但也不再对它们保持沉默`,
    )
  return 0
}

/** 拒写面的分母(点名用,避免"3/4"里的 4 从别处飘来) */
const REFUSE_SCOPE = READMES.length

/**
 * 自检:锚点判据与块外探测的构造面(零 IO、正反成对)。
 * CLI 真跑一次的"不落盘"证明在镜像测试 `scripts/tests/auto-update-readme-recent.test.mjs`
 * (那里在 mkScratch 的临时仓里跑,绝不在真仓试写 —— 守门 208 / AGENTS §15c)。
 */
function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (name, cond) => {
    if (cond) { pass++; console.log(`  ✅ ${name}`) } else { fail++; console.log(`  ❌ ${name}`) }
  }
  const good = `x\n${BEGIN}\n**2026-01-01**\n- 🐞 修复:样例 (abcdef12345)\n${END}\ny\n`
  ok('A1 单对锚点 ⇒ ok', assessAnchors(good, BEGIN, END).state === 'ok')
  ok('A2 缺 END ⇒ missing 且报枚数', (() => { const v = assessAnchors(`x\n${BEGIN}\n内容`, BEGIN, END); return v.state === 'missing' && v.endCount === 0 })())
  ok('A3 缺 BEGIN ⇒ missing', assessAnchors(`内容\n${END}`, BEGIN, END).state === 'missing')
  ok('A4 锚点成双 ⇒ ambiguous(不接受 indexOf 取第一对)', (() => {
    const t = `${BEGIN}\nin\n${END}\n${BEGIN}\nin2\n${END}\n`
    const v = assessAnchors(t, BEGIN, END)
    return v.state === 'ambiguous' && v.beginCount === 2 && v.endCount === 2
  })())
  ok('A5 END 在 BEGIN 之前 ⇒ inverted', assessAnchors(`${END}\n${BEGIN}\n`, BEGIN, END).state === 'inverted')
  ok('B1 条目全在块内 ⇒ 块外计数 0(不把自家产出算成散落)', countEntriesOutsideBlock(good, BEGIN, END, ALL_LABELS, ALL_EMOJIS) === 0)
  ok('B2 块外散落被数到(中/英两种类型标签同族)', countEntriesOutsideBlock(
    `${good}- 🚀 新功能/改进:尾巴上的一枚 (1234567)\n- 🐞 Fix:a stray entry in english (abcdef12345)\n`,
    BEGIN, END, ALL_LABELS, ALL_EMOJIS,
  ) === 2)
  ok('B3 取不到区间 ⇒ -1 未判定,不冒充 0', countEntriesOutsideBlock('没有标记的文档', BEGIN, END, ALL_LABELS, ALL_EMOJIS) === -1)
  ok('B4 散文行(无 emoji/无括号 sha)不被数进来', countEntriesOutsideBlock(`${good}\n- 一条普通说明,不带提交号\n`, BEGIN, END, ALL_LABELS, ALL_EMOJIS) === 0)
  console.log(`\n自检:pass ${pass} / fail ${fail}`)
  return fail === 0 ? 0 : 1
}

export const __test__ = {
  assessAnchors,
  countEntriesOutsideBlock,
  BEGIN,
  END,
  READMES,
  TYPE_LABELS,
  TYPE_EMOJI,
  ALL_LABELS,
  ALL_EMOJIS,
  selfTest,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    if (process.argv.slice(2).includes('--self-test')) process.exit(selfTest())
    process.exit(main())
  } catch (e) {
    console.error(`❌ auto-update-readme-recent 失败:${(e && e.message) || e}`)
    process.exit(2)
  }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
