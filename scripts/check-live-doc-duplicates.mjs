#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-live-doc-duplicates.mjs
// ─────────────────────────────────────────────────────────────────────────
/**
 * 守门:活文档不得被"同一形态的副本"越堆越厚(2026-10-25 立,守门 245)。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,blocking,
 * skipEnv = HUSKY_SKIP_LIVE_DOC_DUPLICATES,stagedTriggers = 六份活文档)。
 *
 * —— 立因(现读为证,不是推演)——
 * README.md 在 HEAD 面上 4,653,356 字节 / 15,334 行,同形态行最多重复 596 次;`A: Yes.` 一行
 * 有 1,176 份。历史是单调翻倍(4 → 51 → 99 → 198 → 296 → 589 → 1176),每一次 union 合并
 * 就把两侧各自那份**同号不同值**的段落一起收下 —— 行级 union 的守恒只判"不丢行",
 * 判不出"同一段落被复制了一千份",所以全仓没有一道门拦得住它(门 173 只逐键比数字,
 * 门 130/203 只管台账登记行)。后果是用户可见的:GitHub 上打开的 README 是 4.6MB 的重复垃圾。
 *
 * —— 判据 ——
 * 折叠器住在 scripts/dedupe-live-doc.mjs(唯一实现),本门 import 它的 `planCollapse`,
 * 问"这份文档里有多少行是某更早行的副本"。副本数 = 该文档在本门的读数。
 * 只折"重复副本",不折"内容":形态 = 数字归一 + 空白折叠,长度 ≥ MIN_SHAPE_LEN 才算;
 * 代码围栏内整区不参与(示例里合法地反复);短行(表格分隔、纯符号)不参与(形态信息量不足)。
 *
 * —— 档位:按文档各自差值棘轮(锚点 = 该文档在锚点面的自身副本数,只拦新增)——
 * 为什么不是一刀切零容忍:AGENTS.md / PROJECT_PLAN.md 现在仍有存量(现读值见输出),
 * 把与本次提交无关的存量判红就是恒红门(§12e),唯一结局是逼人 --no-verify 连带废掉全部守门。
 * README.md 已在本枚被收敛到 0 副本 ⇒ 对它而言棘轮等效于零容忍:再加一份副本就红。
 * 出口只有一条,且是当场可跑的:node scripts/dedupe-live-doc.mjs <文档> --apply
 *
 * 取材面纪律(§0.4):全量档判 HEAD blob、--staged 判索引 blob、--worktree 仅人工逃生舱;
 * 两面旗同给 ⇒ exit 2;取不到 ⇒ 未判定(不记绿也不冒红);枚举到 0 份被审文档 ⇒ 判死。
 *
 * 用法:node scripts/check-live-doc-duplicates.mjs [--staged|--worktree] [--self-test] [--json]
 * 退出码:0 无新增副本 / 1 判红 / 2 未判定
 */
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 折叠判据只许有一份(§22c):住在 dedupe-live-doc.mjs,本门不复制形态算法
import { __test__ as DEDUPE } from './dedupe-live-doc.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** 被审面:多会话共写的活文档 + 四语言 README(union 的射程就是重复的射程)。 */
export const AUDITED_DOCS = [
  'README.md',
  'README.en.md',
  'README.ko.md',
  'README.ja.md',
  'AGENTS.md',
  'PROJECT_PLAN.md',
]

/** 一份文档的副本读数(行数,不是形态组数)。 */
export function duplicateCount(text) {
  return DEDUPE.planCollapse(text).drop.size
}

/** 面读取:全量档 HEAD blob、--staged 索引 blob、--worktree 盘上(人工逃生舱)。 */
function readFace(relPath, face) {
  if (face === 'worktree') {
    const p = path.join(ROOT, relPath)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  }
  const ref = face === 'staged' ? `:./${relPath}` : `HEAD:${relPath}`
  const r = spawnSync('git', ['show', ref], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
    encoding: 'buffer',
  })
  if (r.status !== 0) return null
  return r.stdout.toString('utf8')
}

/**
 * 锚点面读数:--staged 的锚 = 同一文档的 HEAD blob;全量档的锚 = HEAD^ blob。
 * 取不到锚 ⇒ 返回 null,调用方按"未判定"处理(不拿 0 冒充"锚上没违规",那是白名单)。
 */
function anchorCount(relPath, face) {
  const ref = face === 'staged' ? `HEAD:${relPath}` : `HEAD^:${relPath}`
  const text = face === 'staged' ? readFace(relPath, 'head') : readFaceAt(ref)
  if (text === null) return null
  return duplicateCount(text)
}

function readFaceAt(ref) {
  const r = spawnSync('git', ['show', ref], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
    encoding: 'buffer',
  })
  if (r.status !== 0) return null
  return r.stdout.toString('utf8')
}

export function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })
  const long = '对外关键数字声明(与本页生成块同源,均现算):606 张表 · 4557 API 路由 · 25 个 WebSocket 端点'
  const long2 = '对外关键数字声明(与本页生成块同源,均现算):608 张表 · 4558 API 路由 · 25 个 WebSocket 端点'
  ok('读数按行数而非形态组数', duplicateCount([long, long, long2].join('\n')) === 2)
  ok('换了数字的同形态副本同样计入(本族的真实形态)', duplicateCount([long, long2].join('\n')) === 1)
  ok('唯一内容不产生读数', duplicateCount([long, '另一段完全不同的说明文字,长度足够参与形态折叠'].join('\n')) === 0)
  ok('短行不计(表格分隔符不是副本)', duplicateCount(['| --- | --- |', '| --- | --- |'].join('\n')) === 0)
  ok(
    '代码围栏内的反复不计(示例合法重复)',
    duplicateCount(['```', long, long, '```'].join('\n')) === 0,
  )
  // 反向锁:摘掉折叠器里的数字归一(改成逐字比较)会看不见"换了数字的那一份"
  const raw = new Set()
  let naive = 0
  for (const l of [long, long2].join('\n').split('\n')) {
    if (raw.has(l)) naive++
    else raw.add(l)
  }
  ok('逐字比较会漏掉换数字的副本(所以形态归一是必须的)', naive === 0 && duplicateCount([long, long2].join('\n')) === 1)
  let rc = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (!c.pass) rc = 1
  }
  console.log(`self-test ${cases.filter((c) => c.pass).length}/${cases.length}`)
  return rc
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const faceFlags = ['--staged', '--worktree'].filter((f) => argv.includes(f))
  if (faceFlags.length > 1) {
    console.error('❌ 两面旗同给(§0.4)⇒ 未判定')
    return 2
  }
  const face = argv.includes('--staged') ? 'staged' : argv.includes('--worktree') ? 'worktree' : 'head'
  const docs = AUDITED_DOCS.filter((d) => {
    if (face === 'worktree') return existsSync(path.join(ROOT, d))
    const r = spawnSync('git', ['ls-tree', face === 'staged' ? '--name-only' : '-r', '--name-only', face === 'staged' ? ':' : 'HEAD', d], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: false,
    })
    return r.status === 0 && r.stdout.trim() !== ''
  })
  if (docs.length === 0) {
    console.error('❌ 被审文档枚举到 0 份 ⇒ 判死,不出具合格证(§0.3)')
    return 2
  }
  const rows = []
  let red = 0
  let undetermined = 0
  for (const doc of docs) {
    const text = readFace(doc, face)
    if (text === null) {
      console.error(`❌ ${doc} 在 ${face} 面取不到 ⇒ 未判定,不记绿`)
      undetermined++
      continue
    }
    const now = duplicateCount(text)
    const anchor = anchorCount(doc, face)
    if (anchor === null && face !== 'worktree') {
      console.error(`❌ ${doc} 的锚点面取不到 ⇒ 未判定(不拿"锚上 0"冒充)`)
      undetermined++
      continue
    }
    const base = face === 'worktree' ? now : anchor
    const delta = now - base
    if (delta > 0) {
      red++
      rows.push({ doc, now, base, delta })
    } else rows.push({ doc, now, base, delta })
  }
  const label = face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树(人工逃生舱)' : 'HEAD blob'
  console.log(`[live-doc-duplicates] 面=${label} 被审 ${docs.length} 份`)
  for (const r of rows)
    console.log(
      `  ${r.delta > 0 ? '❌' : r.now > 0 ? '⚠' : '✅'} ${r.doc.padEnd(16)} 副本行 ${String(r.now).padStart(5)}` +
        `  锚点 ${r.base === null ? '未判定' : String(r.base).padStart(5)}  差值 ${r.delta > 0 ? '+' : ''}${r.delta}`
    )
  if (argv.includes('--json')) console.log(JSON.stringify({ face, rows, red, undetermined }))
  if (undetermined > 0) {
    console.error(`❌ ${undetermined} 份文档未判定 ⇒ 不出具合格证`)
    return 2
  }
  if (red > 0) {
    console.error(
      `❌ ${red} 份文档的副本行数比锚点面多 ⇒ 判红。同一段落被逐次合并翻倍就是本门立因的那一族。` +
        ` 出路:node scripts/dedupe-live-doc.mjs ${rows.filter((r) => r.delta > 0).map((r) => r.doc).join(' ')} --apply`
    )
    return 1
  }
  console.log('✅ 无新增副本(存量只报数;棘轮锚点 = 该文档在锚点面的自身读数)')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = { duplicateCount, AUDITED_DOCS, readFace }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
