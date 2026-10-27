#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像 purge 内容完好对账(§22 配套 · 内容门;把"机主令永禁"的镜像内容变成提交时硬红)
 *
 * 立因(2026-10-23 本会话实测,不是假想):`union-converge` 的 LIVE_DOCS 走**行 union**
 * (跑者的行永存;对侧对基底行的改写/删除全部丢失)⇒ 已 purge 的镜像内容被对侧旧基线原样补回。
 * 实测两例:① AGENTS.md §5b「git 网络与推送」120 行旧镜像断言复活(Gitee/GitCode 由
 * `mirror-to-cn.yml` CI 镜像,本地手推 = 违反架构 —— 与 2026-10-23 的整体弃用直接矛盾);
 * ② README.md 两处徽章回归(已由 68e4b42399 修复)。
 * 行 union 的 `declaredDropCaps` 只覆盖台账登记行,覆盖不到"机主令永禁的镜像内容"这一族;
 * 守门 168(`check-merge-deletion-resurrection.mjs`)只判**文件级**复活,结构性看不见行级复活 ——
 * 徽章回归它没叫。本门补上这一格:射程内任何一面出现镜像内容 ⇒ exit 1。
 *
 * 判据(逐行;一行多条命中只计最先的一条,M1→M4 序):
 *   M1 `gitcode.com/IHUI-AI` —— 死仓 URL(GitCode 仓 2026-10-23 已删,指向它的链接都是死的);
 *   M2 `gitee.com/JLSLSSZWHYXGS_0/IHUI-AI`(仓库根链接 = 徽章/clone 入口;`/releases/`
 *      资产路径豁免 —— 桌面端安装包仍作为 Gitee release 附件分发,docs/RELEASE.md 明载);
 *   M3 同行含「国内镜像」且含 `gitee|gitcode` —— 徽章标签 + 镜像链接的组合
 *      (npm registry 的「国内镜像」散文不在射程:行内无 gitee/gitcode);
 *   M4 行含 `mirror-to-cn` 且不含弃用标记(弃用|已删除|不再写回|退役|2026-10-23)——
 *      陈旧的「镜像在役」断言;purged 文本因写明「已于 2026-10-23 整体弃用并删除」而豁免。
 *
 * 射程(10 个文档):4 版 README + AGENTS.md + purge 批次覆盖的 5 个文档
 * (docs/marketing/cn-launch-post.md、docs/marketing/multi-platform-distribution.md、
 *  docs/engineering/readme-01-positioning.md、docs/RELEASE.md、scripts/README.md)。
 * PROJECT_PLAN.md **刻意不在射程**:它的镜像叙事是历史台账(G-116 等登记行),不是"在役"断言,
 * 收进来就是恒红门(§12e)。
 *
 * 面(§22 横向口径):默认判 HEAD blob;`--staged` 判索引 blob;`--worktree` 仅人工逃生舱。
 * 两面旗同给 ⇒ exit 2;取不到被审面 ⇒ 未判定 exit 2(不记绿也不冒红);射程文件在该面不存在
 * ⇒ 按 absent 跳过并报数;十个全缺 ⇒ 判定面不对 ⇒ 未判定 exit 2(少扫不红是假绿)。
 *
 * 定级:绝对零容忍(不是差值棘轮)—— 本门防的是"机主令永禁"的内容回潮,提交链上任何一面出现即红;
 * 射程文件现行 HEAD 面命中为 0(2026-10-23 实测),故不存在恒红。
 *
 * 用法:
 *   node scripts/check-mirror-purge-intact.mjs            # 全量档(HEAD 面)
 *   node scripts/check-mirror-purge-intact.mjs --staged   # 提交链档(索引面)
 *   node scripts/check-mirror-purge-intact.mjs --json     # 机器可读结论
 *   node scripts/check-mirror-purge-intact.mjs --self-test # 真临时仓端到端取证(25 例)
 *   node scripts/check-mirror-purge-intact.mjs --fix      # 写回出口:摘掉工作树副本里的禁止行(不判定)
 *   node scripts/check-mirror-purge-intact.mjs --fix --dry-run # 干跑:只报"将会改什么",零写盘
 * 退出码:判定档 0 = 干净;1 = 判红(点名文件/行/判据);2 = 未判定或用法错。
 *   --fix 档只出 0(写回出口按其自身口径完成,含 0 改动)或 2(未判定/用法错),**永不产出 1** ——
 *   "红/绿"是判定轮的语言,写档不判档(纪律全文见下方写回区块头注)。
 * 镜像测试:node --test scripts/tests/check-mirror-purge-intact.test.mjs(16 例,含 T1 方向锁)。
 * 紧急跳过:HUSKY_SKIP_MIRROR_PURGE_INTACT=1(必须在提交信息里写明理由与清偿票)。
 *
 * 接线状态:已接入 guardian-runner 注册表(守门 237,blocking,skipEnv=HUSKY_SKIP_MIRROR_PURGE_INTACT;
 * stagedTriggers = 射程 10 文档;注册落地后本行随注册表现状维护,镜像测试 T1 双向锁死)。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { normalizeInputBytes } from './lib/generated-input-pin.mjs'
import { FACE_LABEL, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/** 紧急跳过变量(注册块 skipEnv 与本常量必须同值,镜像测试 T10 锁死)。 */
export const SELF_SKIP = 'HUSKY_SKIP_MIRROR_PURGE_INTACT'

/**
 * 射程:purge 批次覆盖过的 10 个文档。
 * PROJECT_PLAN.md 刻意不在内 —— 它的镜像叙事是历史台账(G-116 等登记行),不是"在役"断言。
 */
export const SCOPE_FILES = [
  'README.md',
  'README.en.md',
  'README.ja.md',
  'README.ko.md',
  'AGENTS.md',
  'docs/marketing/cn-launch-post.md',
  'docs/marketing/multi-platform-distribution.md',
  'docs/engineering/readme-01-positioning.md',
  'docs/RELEASE.md',
  'scripts/README.md',
]

/** 行级单模判据(M1/M2):一行命中即违规。 */
export const LINE_CRITERIA = [
  { code: 'M1', re: /gitcode\.com\/IHUI-AI/i, note: 'GitCode 死仓 URL(该仓 2026-10-23 已删,指向它的链接都是死的)' },
  {
    code: 'M2',
    re: /gitee\.com\/JLSLSSZWHYXGS_0\/IHUI-AI(?!\/releases)/i,
    note: 'Gitee 仓库根链接(徽章/clone 入口;/releases/ 资产路径豁免:桌面端安装包仍作 release 附件分发)',
  },
]

/** M3:徽章标签「国内镜像」与镜像链接同行。 */
export const BADGE_LABEL_RE = /国内镜像/
export const MIRROR_HOST_RE = /gitee|gitcode/i

/** M4:镜像作业在役断言(行内有弃用标记则豁免)。 */
export const MIRROR_WORKFLOW_RE = /mirror-to-cn/i
export const DEPRECATION_RE = /弃用|已删除|不再写回|退役|2026-10-23/

/**
 * 逐行扫描(纯函数,可构造输入直接证明)。
 * 一行多条命中只计最先的一条(M1→M2→M3→M4)—— 同一行出多条会把一份回潮读成两份,
 * 与守门 168「同一路径两条取证只计一条」同一条纪律。
 * @returns {{line:number,code:string,note:string,excerpt:string}[]}
 */
export function scanText(text) {
  const out = []
  const lines = String(text).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const excerpt = line.trim().replace(/\s+/g, ' ').slice(0, 160)
    let hit = null
    for (const c of LINE_CRITERIA) {
      if (c.re.test(line)) {
        hit = c
        break
      }
    }
    if (!hit && BADGE_LABEL_RE.test(line) && MIRROR_HOST_RE.test(line)) {
      hit = { code: 'M3', note: '徽章标签「国内镜像」与镜像链接同行' }
    }
    if (!hit && MIRROR_WORKFLOW_RE.test(line) && !DEPRECATION_RE.test(line)) {
      hit = { code: 'M4', note: '镜像作业在役断言(行内无弃用标记)' }
    }
    if (hit) out.push({ line: i + 1, code: hit.code, note: hit.note, excerpt })
  }
  return out
}

/** 判定面对应的 cat-file 规格(worktree 面不走 batch,返回相对路径仅作占位)。 */
export function faceSpec(face, rel) {
  if (face === 'staged') return `:${rel}`
  if (face === 'head') return `HEAD:${rel}`
  return rel
}

/** CLI 旗标 → 判定面;两面旗同给由 selectFace 报错(face=null)。 */
export function faceFromArgv(argv) {
  return selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
}

/**
 * 单轮对账(可注入 root 以便自检在真临时仓里端到端跑)。
 * 射程内容一律走 face-reader 入口(catBatch / readWorktreeFile),不自派生 git、不自己 readFileSync。
 * @returns {{face:string,state:'clean'|'violation'|'undetermined',scope:number,absent:string[],violations:object[],undetermined:string|null,exit:number}}
 */
export function runCheck(root, face) {
  const absent = []
  const violations = []
  const texts = new Map()
  let undetermined = null

  if (face === 'worktree') {
    for (const rel of SCOPE_FILES) {
      try {
        texts.set(rel, readWorktreeFile(root, rel))
      } catch (e) {
        undetermined = `${FACE_LABEL.worktree} 取不到 ${rel}: ${e.message}`
        break
      }
    }
  } else {
    const specs = SCOPE_FILES.map((rel) => faceSpec(face, rel))
    let m = null
    try {
      m = catBatch(root, specs)
    } catch (e) {
      undetermined = `${FACE_LABEL[face]} 取不到被审面: ${e.message}`
    }
    if (m) {
      for (const rel of SCOPE_FILES) texts.set(rel, m.get(faceSpec(face, rel)) ?? null)
    }
  }

  if (!undetermined) {
    for (const rel of SCOPE_FILES) {
      const text = texts.get(rel)
      if (text === null || text === undefined) {
        absent.push(rel)
        continue
      }
      for (const v of scanText(text)) violations.push({ rel, ...v })
    }
    if (absent.length === SCOPE_FILES.length) {
      undetermined = `射程 ${SCOPE_FILES.length} 个文件在 ${FACE_LABEL[face]} 全部不存在 ⇒ 判定面不对(不是"干净")`
    }
  }

  const state = undetermined ? 'undetermined' : violations.length ? 'violation' : 'clean'
  return {
    face,
    state,
    scope: SCOPE_FILES.length,
    absent,
    violations,
    undetermined,
    exit: state === 'undetermined' ? 2 : state === 'violation' ? 1 : 0,
  }
}

/** 人类可读报告(结论行机器可 grep)。 */
export function report(r, { json = false } = {}) {
  if (json) {
    console.log(JSON.stringify(r, null, 2))
    return
  }
  const byCode = {}
  for (const v of r.violations) byCode[v.code] = (byCode[v.code] || 0) + 1
  const codeStr = Object.entries(byCode)
    .map(([c, n]) => `${c}×${n}`)
    .join(' ')
  console.log(
    `[mirror-purge-intact] 面=${r.face} · 射程 ${r.scope} · 缺 ${r.absent.length} · 判红 ${r.violations.length}${codeStr ? ` (${codeStr})` : ''}`,
  )
  for (const v of r.violations) console.log(`  ${v.rel}:${v.line} [${v.code}] ${v.note} | ${v.excerpt}`)
  for (const rel of r.absent) console.log(`  (缺) ${rel}`)
  if (r.undetermined) console.log(`[mirror-purge-intact] 未判定:${r.undetermined}`)
  console.log(
    `MIRROR-PURGE-RESULT state=${r.state} face=${r.face} scope=${r.scope} absent=${r.absent.length} violations=${r.violations.length}`,
  )
}

/* ───────── 写回出口(--fix,2026-10-27 立) ─────────
 *
 * 立因:本门 blocking 而**只判不修**。多会话共享工作区 + 旁路落地(commit-tree+CAS 只推进 HEAD、
 * 不写工作树)⇒ 已 purge 的镜像旧文案被"收编滞后工作树副本"的链路反复带回 HEAD,实测已人工清过
 * 4 次(最近一枚 68cf199cdc27,做法 = 取 HEAD blob ⊕ 只删命中行)。恒红门的唯一结局是逼人
 * --no-verify 连带废掉全部守门(§12e/§12f)⇒ 按"blocking 门必须自带修复出口"补上本档。
 * 纪律照抄同型先例 `check-miniapp-generated.mjs` 的 `--heal-ui-routes` 档。
 *
 * 本档永远不会做的事:
 *   ① 用自己的输出替代判定 —— 判据函数(scanText/runCheck)与判定档退出码**一字未动**,
 *      本档只报"改没改、为什么没改",结论行是 MIRROR-PURGE-FIX-RESULT,不是 MIRROR-PURGE-RESULT;
 *   ② 覆盖别人的在飞改动 —— 某文档工作树副本 ≠ 被审面副本 ⇒ **那一份**拒绝改写并点名,
 *      其余各份照改,跳过可见不静默(判序先验磁盘副本自身有没有禁止行:磁盘已净 ⇒ clean,
 *      所以"上一轮 --fix 摘过而尚未入库"的形态不会被误读成在飞);
 *   ③ 造面上不存在/磁盘上不存在或别人未入库的新文档 —— skip/refuse 出口,绝不 writeFileSync;
 *   ④ 替"改写后仍可能命中"背书 —— 落盘前对产物再跑一次同一把 scanText,仍有命中即拒绝;
 *   ⑤ 接受与判定混用的旗标 —— --fix 与 --json / --worktree 同给 = 用法错 exit 2
 *      (--worktree 下面副本≡磁盘,在飞副本闸失明);--fix --staged 合法(对照索引面)。
 *
 * git add 绝不做(同先例):写回属于工作树,提交者是别人——本档不替任何人把改动塞进提交。
 */

/**
 * 单份文档一次写回允许摘除的最大行数。
 * 上限依据(全现读,不是拍的):历史回潮的单文档命中峰值 = 3 行
 * (68cf199cdc27 之前的 README.md,M1×2+M2×1,scanText 旧 blob 实测);旧 AGENTS.md §5b
 * 整块 120 行里按行判据实际命中 1 行。即便取"回潮块整段每行都命中"的最坏形态(≈120 行)
 * 也远在 150 之下;超过 150 行意味着已经不是"回潮"这个形态(整份文档被换/生成器错位),
 * 必须让人看见而不是门自动背书。
 */
export const MAX_FIX_REMOVED_LINES = 150

/**
 * 摘除命中行(纯函数,判据零复算:命中集直接来自 scanText —— 行级局部判据,删行不造新行)。
 * @returns {{violations:object[], removed:number, fixedText:string}}
 */
export function stripViolatingLines(text) {
  const violations = scanText(text)
  const hit = new Set(violations.map((v) => v.line))
  const lines = String(text).split('\n')
  const kept = []
  for (let i = 0; i < lines.length; i++) if (!hit.has(i + 1)) kept.push(lines[i])
  return { violations, removed: lines.length - kept.length, fixedText: kept.join('\n') }
}

/**
 * 单文档写回决策(纯函数):给面副本与磁盘副本,返回该动/不该动及原因。
 * 判序即纪律:磁盘无禁止行 ⇒ clean(幂等锁在第一位)⇒ 面缺失/在飞/超量级逐一拒绝并点名。
 * @returns {{action:'clean'|'skip'|'refuse'|'fix', why:string, removed?:number, fixedText?:string, violations?:object[]}}
 */
export function decideFix({ faceText, diskText, maxRemoved = MAX_FIX_REMOVED_LINES }) {
  if (diskText === null) return { action: 'skip', why: '磁盘上没有该文档(别人在删/尚未落地)⇒ 写回出口不造文件' }
  const info = stripViolatingLines(diskText)
  if (info.violations.length === 0) return { action: 'clean', why: '磁盘副本无禁止行 ⇒ 零改动(幂等)', removed: 0 }
  if (faceText === null)
    return {
      action: 'refuse',
      why: `被审面上没有该文档而磁盘副本含 ${info.violations.length} 处禁止行 ⇒ 那是别人未入库的新文档,门不动它`,
      violations: info.violations,
    }
  if (normalizeInputBytes(diskText) !== normalizeInputBytes(faceText))
    return {
      action: 'refuse',
      why: `工作树副本 ≠ 面副本 ⇒ 这份上有别人的在飞改动(禁止行随其改动一并交人工),门不覆盖`,
      violations: info.violations,
    }
  if (info.removed > maxRemoved)
    return {
      action: 'refuse',
      why: `本次将摘 ${info.removed} 行 > 上限 ${maxRemoved} ⇒ 不是回潮量级(疑似整份文档被换),拒绝改写、磁盘一字节未动`,
      violations: info.violations,
    }
  return { action: 'fix', why: `摘除 ${info.removed} 行`, fixedText: info.fixedText, removed: info.removed, violations: info.violations }
}

/** --fix 旗标互斥校验(纯函数):返回冲突说明;null = 无冲突。 */
export function fixArgConflict(argv) {
  if (!argv.includes('--fix')) return null
  if (argv.includes('--json')) return '--fix 是写回出口(不判定),不得与 --json 同给'
  if (argv.includes('--worktree')) return '--fix 的在飞副本闸要对照被审面;--worktree 面下面副本≡磁盘、闸失明 ⇒ 不得同用'
  return null
}

/** 命中判据的计数摘要(报告行用,顺序稳定)。 */
function codesSummary(violations) {
  const byCode = {}
  for (const v of violations || []) byCode[v.code] = (byCode[v.code] || 0) + 1
  return Object.entries(byCode)
    .map(([c, n]) => `${c}×${n}`)
    .join(' ')
}

/**
 * 射程 10 文档的写回出口(不判绿不判红)。取材与判定轮同面同轮(catBatch 面 + readWorktreeFile 磁盘)。
 * @param {{root:string, face?:'head'|'staged', dryRun?:boolean, log?:(s:string)=>void, maxRemoved?:number}} opts
 * @returns {{rows:object[], state:string, fixed:number, refused:number, clean:number, skipped:number}}
 *   取不到被审面 ⇒ catBatch 抛 Undetermined,由 main 落 exit 2(未判定 ≠ 已写回)。
 */
export function fixDocuments({ root, face = 'head', dryRun = false, log = (s) => console.log(s), maxRemoved = MAX_FIX_REMOVED_LINES }) {
  if (face === 'worktree') throw new Error('fixDocuments 不接受 worktree 面(在飞副本闸会失明)')
  const specs = SCOPE_FILES.map((rel) => faceSpec(face, rel))
  const m = catBatch(root, specs)
  const rows = []
  let fixed = 0
  let refused = 0
  let clean = 0
  let skipped = 0
  for (let i = 0; i < SCOPE_FILES.length; i++) {
    const rel = SCOPE_FILES[i]
    const faceText = m.get(specs[i]) ?? null
    const diskText = readWorktreeFile(root, rel)
    const d = decideFix({ faceText, diskText, maxRemoved })
    const row = { rel, action: d.action, removed: d.removed ?? 0, codes: codesSummary(d.violations), why: d.why }
    if (d.action === 'fix') {
      // 纪律④:落盘前对产物再验一次同一把尺 —— 理论上删行不造新命中,验不过说明判据本身坏了,当场拒绝。
      if (scanText(d.fixedText).length > 0) {
        row.action = 'refuse'
        row.why = '改写产物再扫仍有命中 ⇒ 不落盘(这不该发生,发生即判据坏了,交人工)'
        refused += 1
        rows.push(row)
        continue
      }
      if (!dryRun) writeFileSync(join(root, rel), d.fixedText, 'utf8')
      fixed += 1
    } else if (d.action === 'refuse') refused += 1
    else if (d.action === 'clean') clean += 1
    else skipped += 1
    rows.push(row)
  }
  const state = fixed > 0 ? 'fixed' : refused > 0 ? 'refused' : 'clean'
  log(
    `[mirror-purge-intact --fix] 面=${face}(${FACE_LABEL[face]})${dryRun ? ' · 干跑(零写盘)' : ''} · 射程 ${SCOPE_FILES.length}:改写 ${fixed} / 拒绝 ${refused} / 已净 ${clean} / 跳过 ${skipped}`,
  )
  for (const r of rows) {
    if (r.action === 'clean') continue
    const icon = r.action === 'fix' ? (dryRun ? '🔍' : '✍️') : r.action === 'refuse' ? '⛔' : '⏭️'
    log(`  ${icon} ${r.rel} —— [${r.action}]${r.codes ? ` (${r.codes})` : ''} ${r.why}`)
  }
  log('  ℹ️ 本档只写回、不判定:红/绿仍由同面的判定轮说;面未被触动,复检请再跑不带 --fix 的本脚本(改动留给人 git add)。')
  log(`MIRROR-PURGE-FIX-RESULT state=${state} dryRun=${dryRun} fixed=${fixed} refused=${refused} clean=${clean} skipped=${skipped}`)
  return { rows, state, fixed, refused, clean, skipped }
}

/**
 * §22c 自检 harness:传函数当 cond 必须记红 —— 断言从未求值与"断言为假"是两回事,
 * 后者会被打成 ❌,前者会假装通过。镜像测试用 `__test__.makeAssert` 直接证明这条分支。
 */
export function makeAssert(sink = console.log) {
  const state = { pass: 0, fails: [] }
  const ok = (name, cond, note = '') => {
    if (typeof cond === 'function') {
      state.fails.push(name)
      sink(`❌ ${name} —— cond 是函数 ⇒ 断言从未求值(§22c:应写成 (() => {...})())`)
      return
    }
    if (cond === true) {
      state.pass++
      sink(`✅ ${name}`)
      return
    }
    state.fails.push(name)
    sink(`❌ ${name}${note ? ` —— ${note}` : ` —— 实得 ${JSON.stringify(cond)}`}`)
  }
  return { ok, state }
}

/** 自检:真临时仓(mkScratch,§26 夹具唯一落点)端到端 + 纯函数成对,18 例。 */
function selfTest() {
  const dir = mkScratch('ihui-mirror-purge-')
  const { ok, state } = makeAssert()
  const g = (...a) => gitRaw(a, dir)
  try {
    g('init', '-q', '-b', 'main')
    g('config', 'user.email', 't@t')
    g('config', 'user.name', 't')

    // 射程一:AGENTS.md = 2026-10-23 被复活过的旧镜像断言行(M4 阳性,原文照抄现场)
    writeFileSync(
      join(dir, 'AGENTS.md'),
      '- **git 网络与推送**:同步一律 `git fetch <remote> main`;**agent 禁止手写 `git push**;Gitee/GitCode 由 `mirror-to-cn.yml` CI 镜像,本地手推 = 违反架构。收尾核验只跑 `node scripts/git-push-converge.mjs`。\n',
      'utf8',
    )
    // 射程二:README.md = 徽章块两行(M2/M3 与 M1 阳性)+ 第三行 M3 独立射程构造
    // (有厂牌名、但 URL 不是那两个仓库根形态 ⇒ M1/M2 都不中,只有 M3 中 ——
    //  徽章行本身会被 M2/M1 抢先,见 ② 的"一行只计最先一条"纪律)
    writeFileSync(
      join(dir, 'README.md'),
      [
        '[![Gitee](https://img.shields.io/badge/国内镜像-Gitee-red)](https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI)',
        '[![GitCode](https://img.shields.io/badge/国内镜像-GitCode-blue)](https://gitcode.com/IHUI-AI/IHUI-AI)',
        '- **国内镜像**:Gitee / GitCode(仓库地址见置顶评论,勿再引用)',
        '',
      ].join('\n'),
      'utf8',
    )
    // 射程三:README.en.md = 三条全豁免行(M2 releases 资产 / npm 国内镜像 / 带弃用标记的 mirror-to-cn)
    writeFileSync(
      join(dir, 'README.en.md'),
      [
        '- 安装包下载:https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/v1/Setup.exe',
        '- 装依赖用国内镜像更稳:npm config set registry https://registry.npmmirror.com',
        '- 镜像作业已于 2026-10-23 整体弃用并删除,mirror-to-cn.yml 不再写回这两个远端。',
        '',
      ].join('\n'),
      'utf8',
    )
    g('add', '-A')
    g('commit', '-qm', 'fixture: 复活内容 + 豁免行')

    // ── ① 端到端 HEAD 面 ──
    const head = runCheck(dir, 'head')
    ok('① AGENTS.md 旧断言 M4 命中并点名行号', head.violations.some((v) => v.rel === 'AGENTS.md' && v.code === 'M4' && v.line === 1), JSON.stringify(head.violations))
    ok('① README.md 徽章 M1/M2 各命中一次', ['M1', 'M2'].every((c) => head.violations.filter((v) => v.rel === 'README.md' && v.code === c).length === 1), JSON.stringify(head.violations.filter((v) => v.rel === 'README.md')))
    ok('① README.md 第三行 M3 独立射程命中(有厂牌名、无仓库根 URL)', head.violations.some((v) => v.rel === 'README.md' && v.code === 'M3' && v.line === 3), JSON.stringify(head.violations.filter((v) => v.rel === 'README.md')))
    ok('① README.en.md 三条豁免行零命中', !head.violations.some((v) => v.rel === 'README.en.md'), JSON.stringify(head.violations.filter((v) => v.rel === 'README.en.md')))
    ok('① 端到端退出码 = 1', head.exit === 1, String(head.exit))
    ok('① state = violation', head.state === 'violation', head.state)
    ok('① 未入夹具的射程文件按 absent 报数(不静默少扫)', head.absent.length === SCOPE_FILES.length - 3, JSON.stringify(head.absent))

    // ── ② 一行多命中只计一条(徽章行同时含 M2 与 M3) ──
    const badge = '[![Gitee](https://img.shields.io/badge/国内镜像-Gitee-red)](https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI)'
    ok('② 一行多命中只计一条(M2 抢先,不出 M3)', scanText(`${badge}\n`).length === 1 && scanText(`${badge}\n`)[0].code === 'M2', JSON.stringify(scanText(`${badge}\n`)))

    // ── ③ staged 面 ──
    writeFileSync(join(dir, 'README.ja.md'), '国内镜像: https://gitcode.com/IHUI-AI/IHUI-AI\n', 'utf8')
    g('add', 'README.ja.md')
    const staged = runCheck(dir, 'staged')
    ok('③ staged 面抓到索引里的新违规(M1)', staged.violations.some((v) => v.rel === 'README.ja.md' && v.code === 'M1'), JSON.stringify(staged.violations.filter((v) => v.rel === 'README.ja.md')))
    ok('③ staged 面新入库文件不算 absent', !staged.absent.includes('README.ja.md'), JSON.stringify(staged.absent))

    // ── ④ worktree 面(人工逃生舱):与 HEAD 面同结论 ──
    g('reset', '-q', '--hard', 'HEAD')
    const wt = runCheck(dir, 'worktree')
    ok('④ worktree 面与 HEAD 面违规数一致', wt.exit === 1 && wt.violations.length === head.violations.length, `${wt.violations.length} vs ${head.violations.length}`)

    // ── ⑤ 面选择 ──
    const both = faceFromArgv(['--staged', '--worktree'])
    ok('⑤ 两面旗同给 ⇒ 面选择报错(face=null)', Boolean(both.error) && both.face === null, JSON.stringify(both))
    ok('⑤ 默认面 = head', faceFromArgv([]).face === 'head', faceFromArgv([]).face)
    ok('⑤ --staged → staged 面', faceFromArgv(['--staged']).face === 'staged', faceFromArgv(['--staged']).face)

    // ── ⑥ 射程全缺 ⇒ 未判定 exit 2 ──
    const empty = mkScratch('ihui-mirror-purge-empty-')
    try {
      gitRaw(['init', '-q', '-b', 'main'], empty)
      gitRaw(['config', 'user.email', 't@t'], empty)
      gitRaw(['config', 'user.name', 't'], empty)
      writeFileSync(join(empty, 'unrelated.txt'), 'x\n', 'utf8')
      gitRaw(['add', '-A'], empty)
      gitRaw(['commit', '-qm', 'fixture: 无射程文件'], empty)
      const e = runCheck(empty, 'head')
      ok('⑥ 射程全缺 ⇒ 未判定 exit 2(不是"干净")', e.state === 'undetermined' && e.exit === 2 && e.absent.length === SCOPE_FILES.length, `${e.state}/${e.exit} ${e.undetermined || ''}`)
    } finally {
      rmScratch(empty)
    }

    // ── ⑦ makeAssert 行为锁 ──
    const probe = makeAssert(() => {})
    probe.ok('函数 cond 必须记红', () => {})
    ok('⑦ makeAssert 对函数 cond 记红(§22c)', probe.state.fails.length === 1 && probe.state.pass === 0, JSON.stringify(probe.state))

    // ── ⑧ 射程形状 ──
    ok('⑧ 射程含 4 版 README + AGENTS.md,共 10 个', SCOPE_FILES.length === 10 && SCOPE_FILES.includes('README.en.md') && SCOPE_FILES.includes('AGENTS.md'), String(SCOPE_FILES.length))
    ok('⑧ PROJECT_PLAN.md 不在射程(历史台账叙事不拦)', !SCOPE_FILES.includes('PROJECT_PLAN.md'), JSON.stringify(SCOPE_FILES))
    ok('⑧ 射程全是文档(无代码路径)', SCOPE_FILES.every((f) => f.endsWith('.md')), JSON.stringify(SCOPE_FILES))

    // ── ⑨ 写回出口(--fix):真能修自己判的事 + 幂等 + 面不受触动 + 在飞/超限拒改 ──
    // 此刻磁盘 == HEAD 面(reset --hard 后),HEAD 面含 4 处命中(AGENTS.md×1 + README.md×3)。
    const fix1 = fixDocuments({ root: dir, face: 'head', log: () => {} })
    ok('⑨ 第一轮写回改写 2 份(README.md+AGENTS.md),拒绝 0', fix1.fixed === 2 && fix1.refused === 0, JSON.stringify(fix1.rows.filter((r) => r.action !== 'clean' && r.action !== 'skip')))
    ok('⑨ 写回后 worktree 面零命中(阳性对照:器物真能修它判的事)', runCheck(dir, 'worktree').violations.length === 0, JSON.stringify(runCheck(dir, 'worktree').violations))
    ok('⑨ 写回不触动面:HEAD 面照旧判红(写档不冒判)', runCheck(dir, 'head').state === 'violation', runCheck(dir, 'head').state)
    const bytesAfter1 = { agents: readWorktreeFile(dir, 'AGENTS.md'), readme: readWorktreeFile(dir, 'README.md') }
    const fix2 = fixDocuments({ root: dir, face: 'head', log: () => {} })
    ok('⑨ 幂等:第二轮 0 改写且磁盘逐字节同形(在飞闸不误伤自己的写回)', fix2.fixed === 0 && readWorktreeFile(dir, 'AGENTS.md') === bytesAfter1.agents && readWorktreeFile(dir, 'README.md') === bytesAfter1.readme, JSON.stringify(fix2.rows.filter((r) => r.action === 'fix')))

    // 超限:造一份 151 行命中的射程文档入库(磁盘==面),写回必须拒绝且一字节不动
    const over = Array.from({ length: MAX_FIX_REMOVED_LINES + 1 }, (_, i) => `- 镜像仓库地址:https://gitcode.com/IHUI-AI/IHUI-AI#${i}`).join('\n') + '\n'
    mkdirSync(join(dir, 'docs'), { recursive: true })
    writeFileSync(join(dir, 'docs', 'RELEASE.md'), over, 'utf8')
    g('add', 'docs/RELEASE.md')
    g('commit', '-qm', 'fixture: 超限回潮')
    const fix3 = fixDocuments({ root: dir, face: 'head', log: () => {} })
    const overRow = fix3.rows.find((r) => r.rel === 'docs/RELEASE.md')
    ok('⑨ 超限拒改:摘除量 > 上限 ⇒ refuse 且磁盘未动', overRow?.action === 'refuse' && readWorktreeFile(dir, 'docs/RELEASE.md') === over, JSON.stringify(overRow))
    ok('⑨ 超限轮其余各份保持 0 改写(fixed=0)', fix3.fixed === 0, String(fix3.fixed))
  } finally {
    rmScratch(dir)
  }
  for (const f of state.fails) console.error(`❌ ${f}`)
  console.log(`MIRROR-PURGE-SELFTEST-RESULT pass=${state.pass} fail=${state.fails.length}`)
  process.exit(state.fails.length ? 1 : 0)
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('用法:node scripts/check-mirror-purge-intact.mjs [--staged|--worktree] [--json] [--self-test]')
    console.log('     node scripts/check-mirror-purge-intact.mjs --fix [--staged] [--dry-run]  # 写回出口(不判定)')
    console.log('退出码:判定档 0 干净 / 1 判红 / 2 未判定或用法错;--fix 档只出 0 或 2,永不产出 1。')
    process.exit(0)
  }
  if (argv.includes('--self-test')) {
    selfTest()
    return
  }
  const doFix = argv.includes('--fix')
  const conflict = doFix ? fixArgConflict(argv) : null
  if (conflict) {
    console.error(`[mirror-purge-intact] 用法错:${conflict}`)
    process.exit(2)
  }
  const { face, error } = faceFromArgv(argv)
  if (error) {
    console.error(`[mirror-purge-intact] 用法错:${error}`)
    process.exit(2)
  }
  const root = assertRepoRoot(process.cwd(), '本门')
  if (doFix) {
    try {
      fixDocuments({ root, face, dryRun: argv.includes('--dry-run') })
    } catch (e) {
      console.error(`[mirror-purge-intact --fix] 未判定:${e?.message ?? e}(写回出口坏了不冒充写回成功)`)
      process.exit(2)
    }
    process.exit(0)
  }
  const r = runCheck(root, face)
  report(r, { json: argv.includes('--json') })
  process.exit(r.exit)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  SELF_SKIP,
  SCOPE_FILES,
  LINE_CRITERIA,
  BADGE_LABEL_RE,
  MIRROR_HOST_RE,
  MIRROR_WORKFLOW_RE,
  DEPRECATION_RE,
  scanText,
  faceSpec,
  faceFromArgv,
  runCheck,
  report,
  makeAssert,
  MAX_FIX_REMOVED_LINES,
  stripViolatingLines,
  decideFix,
  fixArgConflict,
  fixDocuments,
}
