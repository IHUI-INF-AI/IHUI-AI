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
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const READMES = [
  { file: 'README.md', lang: 'zh' },
  { file: 'README.en.md', lang: 'en' },
  { file: 'README.ko.md', lang: 'ko' },
  { file: 'README.ja.md', lang: 'ja' },
]
const BEGIN = '<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->'
const END = '<!-- END RECENT UPDATES -->'
const BASELINE = path.join(ROOT, '.doc-autoupdate', 'last-sha')
const MAX_GROUPS = 15

const TYPE_EMOJI = { feat: '🚀', fix: '🐞', refactor: '♻️', perf: '⚡', docs: '📚', other: '🔧' }
const TYPE_LABELS = {
  feat: { zh: '新功能/改进', en: 'Feature/Improvement', ko: '기능/개선', ja: '機能/改善' },
  fix: { zh: '修复', en: 'Fix', ko: '수정', ja: '修正' },
  refactor: { zh: '重构', en: 'Refactor', ko: '리팩터', ja: 'リファクタ' },
  perf: { zh: '性能', en: 'Perf', ko: '성능', ja: 'パフォーマンス' },
  docs: { zh: '文档', en: 'Docs', ko: '문서', ja: 'ドキュメント' },
  other: { zh: '工程/其他', en: 'Chore/Other', ko: '기타', ja: 'その他' },
}
// 内部台账/守门记账类噪声:这些 commit 是工程治理自洽动作,不是用户可感知的"项目改动",落 README 反而显脏。
const NOISE_RE = /自动回捞|台账|登记行|随勾|收账|回写|被回写/

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
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
  let staged = []
  let skipped = []

  for (const { file, lang } of READMES) {
    const p = path.join(ROOT, file)
    if (!fs.existsSync(p)) continue
    const wt = fs.readFileSync(p, 'utf8')
    const bi = wt.indexOf(BEGIN)
    const ei = wt.indexOf(END)
    if (bi === -1 || ei === -1 || ei < bi) continue // 无标记区间 ⇒ 跳过
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

  // 无论是否写盘,都先把基线推进到当前 HEAD,避免下次重复处理同一批。
  try {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true })
    fs.writeFileSync(BASELINE, headSha + '\n')
  } catch {
    /* 基线写入失败不致命,下次会重试 */
  }

  if (touched === 0) console.log('  ✅ 最近更新无新增提交,跳过')
  process.exit(0)
}

try {
  main()
} catch (e) {
  console.error(`❌ auto-update-readme-recent 失败:${(e && e.message) || e}`)
  process.exit(2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
