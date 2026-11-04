// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出点名与出路 */
/**
 * check-staged-downgrade.mjs —— 「旧 blob 回写」守门(2026-11-03 立,守门 298)。
 *
 * 立因(实测):apps/miniapp-taro 的 4 个组件(Badge/Input/Tooltip/VipBadge)被 guardian 的
 * `sweepUiMirrorLeg` → `gen-ui-mirror.mjs --apply` 反复以**旧档**写回工作树:
 * 派生器把 RN 壳的绑定声明当唯一权威,而 RN 侧尚未做 token 化(仍是 px-2.5 / text-xs),
 * 于是每次派生都把小程序已 token 化(text-label / px-md)的声明覆盖回祖先版本;
 * 随后收编/并行会话把这些旧 blob `git add` 进共享索引。逐字证据:
 * 工作树 blob = `766687c346^` / `ec9802df54^`(或中途 766 自身),与 HEAD 版本只差这几行声明。
 *
 * 判据(整 blob,不掺行级推断):
 *   对 staged 的 M 文件,index blob ≠ HEAD blob,且 index blob **逐字等于该路径某个祖先提交的
 *   blob** ⇒ 内容比 HEAD 旧,判红并点名「路径 + 祖先提交 + HEAD oid」。这正是 30c
 *   (`check-stale-copy.mjs` 只认 merge-base 之前的基线祖先)与 84 R1(整 blob 近祖先回写)之间
 *   那一格:回退到父提交/近几枚提交的旧检出档。
 *
 * 合法回滚(唯一的放行口):提交正文里写
 *   `intentional-revert: <依据>`(行首、大小写不敏感、依据去空白后 ≥8 字符)
 * 则本门放行并逐条留痕到 `.ihui-agent/state/intentional-revert.jsonl`(留痕失败不影响放行,
 * 但会打印警告)。没有该声明一律判红 —— 失效方向是"多要一次定向说明",不是"多放一次"。
 *
 * 取材纪律(门 118):只判**索引 blob**(`git diff --cached` + `:path`),不读工作区;
 * 所有 git 子进程经 `scripts/lib/face-reader.mjs`(stdio / timeout / batch 统一在层内)。
 *
 * 退出码(§0.3):0 = 无回写/合法回滚/索引面暂无改动(不适用,**不是判绿**);1 = 有幻影回写;
 *   2 = 该跑没跑成(未判定)。空索引不折成 pass(上一轮"判 0 个暂存改动文件"报绿即此型假绿)。
 * 应急放行:`HUSKY_SKIP_STALE_DOWNGRADE=1 git commit ...`(不推荐;跳过会留痕)。
 *
 * 用法:
 *   node scripts/check-staged-downgrade.mjs                 # 判当前索引(pre-commit 面)
 *   node scripts/check-staged-downgrade.mjs --json          # 机读
 *   node scripts/check-staged-downgrade.mjs --self-test     # 纯临时仓夹具自检(不碰真仓)
 *   node scripts/check-staged-downgrade.mjs --message-file=F # 指定提交正文(默认读 COMMIT_EDITMSG)
 */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatchOids, gitRaw } from './lib/face-reader.mjs'
import {
  ANCESTOR_WINDOW_DEFAULT,
  ancestorBlobOf,
  intentionalRevertOf,
  describeMatch,
} from './lib/ancestor-downgrade.mjs'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const GATE_ID = '298'
const SKIP_ENV = 'HUSKY_SKIP_STALE_DOWNGRADE'
const REVERT_LEDGER_REL = '.ihui-agent/state/intentional-revert.jsonl'

/** 索引面:staged 的 M 路径清单(-z:路径里的空格/换行都不会被拆错)。 */
export function stagedModifiedPaths(root = ROOT) {
  const raw = String(gitRaw(['diff', '--cached', '--raw', '-z', '--diff-filter=M'], root))
  const tokens = raw.split('\0').filter(Boolean)
  const paths = []
  for (let i = 0; i < tokens.length; i += 1) {
    // 形态:":<modes> <old> <new> M" + NUL + path + NUL
    if (!tokens[i].startsWith(':')) continue
    const p = tokens[i + 1]
    if (p && !p.startsWith(':')) paths.push(p)
    i += 1
  }
  return [...new Set(paths)]
}

/**
 * 判一轮。返回五态对象(调用方不得把 undetermined / not-applicable 折成 pass):
 *   { state:'pass', judged, paths }
 *   { state:'not-applicable', judged:0, paths:[] }   ← 索引面无暂存改动,没东西可判,不记绿
 *   { state:'waived', judged, stale:[...], rationale }
 *   { state:'fail', judged, stale:[...] }
 *   { state:'undetermined', judged, why }
 */
export function judge({ root = ROOT, message = '', windowSize = ANCESTOR_WINDOW_DEFAULT } = {}) {
  let paths
  try {
    paths = stagedModifiedPaths(root)
  } catch (e) {
    return { state: 'undetermined', judged: 0, why: `索引面取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
  // 空索引 = 没有判据对象,不是"判过且通过"(§0.3:枚举到 0 个候选判死不记绿)。
  if (paths.length === 0) return { state: 'not-applicable', judged: 0, stale: [], paths: [] }
  let oids
  try {
    const specs = []
    for (const p of paths) specs.push(`HEAD:${p}`, `:${p}`)
    oids = catBatchOids(root, specs)
  } catch (e) {
    return { state: 'undetermined', judged: 0, why: `索引/HEAD blob 取不到:${String(e?.message ?? e).split('\n')[0]}` }
  }
  const stale = []
  let judged = 0
  for (const p of paths) {
    const headOid = oids.get(`HEAD:${p}`)
    const indexOid = oids.get(`:${p}`)
    if (!headOid || !indexOid) {
      return { state: 'undetermined', judged, why: `${p} 的 HEAD/索引 blob 取不到(不猜)` }
    }
    if (headOid.toLowerCase() === indexOid.toLowerCase()) continue
    const anc = ancestorBlobOf(p, indexOid, { root, windowSize })
    if (!anc.judged) return { state: 'undetermined', judged, why: `${p}: ${anc.why}` }
    judged += 1
    if (anc.match) {
      stale.push({ path: p, headOid: headOid.toLowerCase(), indexOid: indexOid.toLowerCase(), ancestor: anc.match.commit })
    }
  }
  if (stale.length === 0) return { state: 'pass', judged, stale: [], paths }
  const revert = intentionalRevertOf(message)
  if (revert.ok) return { state: 'waived', judged, stale, rationale: revert.rationale }
  return { state: 'fail', judged, stale }
}

/** 合法回滚留痕:尽力而为,失败只警告,不影响放行判序。 */
function appendRevertLedger(root, { stale, rationale }) {
  const abs = join(root, REVERT_LEDGER_REL)
  try {
    mkdirSync(dirname(abs), { recursive: true })
    const at = new Date().toISOString()
    for (const s of stale) {
      appendFileSync(
        abs,
        JSON.stringify({
          at,
          gate: GATE_ID,
          path: s.path,
          headOid: s.headOid,
          stagedOid: s.indexOid,
          ancestorCommit: s.ancestor,
          rationale,
        }) + '\n',
        'utf8',
      )
    }
    return { ok: true, path: REVERT_LEDGER_REL }
  } catch (e) {
    return { ok: false, why: `留痕失败:${String(e?.message ?? e).split('\n')[0]}` }
  }
}

/** 提交正文来源:显式参数 > 环境变量 > 当前仓库 COMMIT_EDITMSG;取不到 ⇒ 空串(按未声明判)。 */
export function commitMessageOf({ root = ROOT, messageFile = null, message = null } = {}) {
  if (typeof message === 'string') return message
  const file = messageFile || process.env.IHUI_DOWNGRADE_MESSAGE_FILE || null
  if (file) {
    const abs = isAbsolute(file) ? file : resolve(root, file)
    return existsSync(abs) ? readFileSync(abs, 'utf8') : ''
  }
  try {
    const p = String(gitRaw(['rev-parse', '--git-path', 'COMMIT_EDITMSG'], root)).trim()
    const abs = isAbsolute(p) ? p : resolve(root, p)
    return existsSync(abs) ? readFileSync(abs, 'utf8') : ''
  } catch {
    return ''
  }
}

function failBlock(result) {
  const lines = []
  lines.push(`❌ [${GATE_ID}] 检出 ${result.stale.length} 个路径把**旧 blob** 写回了暂存区(内容逐字等于祖先版本,HEAD 已有更新档):`)
  for (const s of result.stale) {
    lines.push(
      `   - ${s.path}  暂存 ${s.indexOid.slice(0, 10)} = 祖先 ${s.ancestor.slice(0, 10)} 的原样;HEAD 现读 ${s.headOid.slice(0, 10)}`,
    )
  }
  lines.push('   ⇒ 这不是"改回旧写法",是把旧检出档搬进共享索引;提交后会把 HEAD 的新版本静默回退。')
  lines.push('   出口 ① 取 HEAD 形态重新施加你的改动:git restore --source=HEAD -- <文件>,再重做本次编辑;')
  lines.push('   出口 ② 只想落地单文件而不碰共享工作树:node scripts/object-space-land.mjs(自带同族守卫);')
  lines.push(`   出口 ③ 确属有意回滚:在提交正文写一行 \`intentional-revert: <依据>\`(本门放行并留痕 ${REVERT_LEDGER_REL});`)
  lines.push(`   应急放行:${SKIP_ENV}=1 git commit ...(不推荐;跳过会留痕)`)
  lines.push('   取证:node scripts/check-staged-downgrade.mjs --self-test(6 例,含正反例与近/远祖先)')
  return lines
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⚠️ [${GATE_ID}] 已由 ${SKIP_ENV}=1 跳过旧 blob 回写判定(本次提交不给合格证)`)
    return 0
  }
  const json = argv.includes('--json')
  const messageFile = (argv.find((a) => a.startsWith('--message-file=')) || '').slice('--message-file='.length) || null
  const message = (argv.find((a) => a.startsWith('--message=')) || '').slice('--message='.length) || null
  const result = judge({ message: commitMessageOf({ messageFile, message }) })
  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else if (result.state === 'pass') {
    console.log(`✅ [${GATE_ID}] 旧 blob 回写守门通过(判 ${result.judged} 个暂存改动文件,无历史版本回写)`)
  } else if (result.state === 'not-applicable') {
    console.log(`⏭️ [${GATE_ID}] 不适用:索引面 0 个暂存改动文件(没有判据对象,未判绿也未判红)`)
  } else if (result.state === 'waived') {
    console.log(`⚠️ [${GATE_ID}] 有意回滚放行(${result.stale.length} 个路径),依据:${result.rationale}`)
    for (const s of result.stale) console.log(`   - ${describeMatch(s.path, { commit: s.ancestor })}`)
    const led = appendRevertLedger(ROOT, result)
    console.log(led.ok ? `   ↳ 已留痕 ${led.path}` : `   ↳ ⚠️ ${led.why}(放行判定不受影响)`)
  } else if (result.state === 'fail') {
    for (const line of failBlock(result)) console.error(line)
  } else {
    console.error(`? [${GATE_ID}] 未判定:${result.why}`)
  }
  if (result.state === 'fail') return 1
  if (result.state === 'undetermined') return 2
  return 0 // pass / waived / not-applicable:不适用不等于判绿,但也不拦提交
}

// ---------- 自检(临时仓夹具,不碰真仓) ----------

function makeRepo(seed = 'v1') {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-staged-downgrade-'))
  const g = (args) => String(gitRaw(args, dir)).trim()
  g(['init', '-q'])
  g(['config', 'user.email', 'selftest@local'])
  g(['config', 'user.name', 'selftest'])
  g(['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, 'f.ts'), `${seed}\n`, 'utf8')
  g(['add', 'f.ts'])
  g(['commit', '-q', '-m', 'v1'])
  return { dir, g }
}

function stageText(dir, g, text) {
  writeFileSync(join(dir, 'f.ts'), text, 'utf8')
  g(['add', 'f.ts'])
}

function selfTest() {
  const out = []
  const ok = (name, cond) => out.push({ name, ok: Boolean(cond) })
  const cleanup = []
  try {
    // T1 远祖先:三枚提交后把 v1 内容搬回索引 ⇒ 红
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'v2\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'v3\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v3'])
      stageText(dir, g, 'v1\n')
      const r = judge({ root: dir })
      ok('T1 旧 blob 暂存判红', r.state === 'fail' && r.stale[0]?.path === 'f.ts')
    }
    // T2 直接父版本回写 ⇒ 红(30c 只看基线祖先,这一格看不见)
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'beta\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'v1\n')
      const r = judge({ root: dir })
      ok('T2 父版本(HEAD 更新档)回写判红', r.state === 'fail')
    }
    // T3 合法回滚声明 ⇒ 放行 + 留痕
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'beta\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'v1\n')
      const r = judge({ root: dir, message: 'fix: 回滚\n\nintentional-revert: 撤销 token 化,RN 侧尚未迁移\n' })
      const led = r.state === 'waived' ? appendRevertLedger(dir, r) : { ok: false }
      ok('T3 合法回滚放行并留痕', r.state === 'waived' && led.ok === true)
    }
    // T4 全新内容(不等于任何祖先)⇒ 不判
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'beta\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'gamma-brand-new\n')
      const r = judge({ root: dir })
      ok('T4 新内容不判', r.state === 'pass' && r.judged === 1)
    }
    // T5 无暂存 ⇒ 不判
    {
      const { dir } = makeRepo()
      cleanup.push(dir)
      const r = judge({ root: dir })
      ok('T5 无暂存 ⇒ not-applicable(不记绿)', r.state === 'not-applicable' && r.judged === 0 && r.paths.length === 0)
    }
    // T6 空口声明(依据过短)⇒ 仍红
    {
      const { dir, g } = makeRepo()
      cleanup.push(dir)
      stageText(dir, g, 'beta\n'); g(['add', 'f.ts']); g(['commit', '-q', '-m', 'v2'])
      stageText(dir, g, 'v1\n')
      const r = judge({ root: dir, message: 'chore\n\nintentional-revert: 回滚\n' })
      ok('T6 依据过短不放行', r.state === 'fail')
    }
  } finally {
    for (const d of cleanup) {
      try {
        rmSync(d, { recursive: true, force: true })
      } catch {
        /* 清理失败不影响判据 */
      }
    }
  }
  for (const c of out) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  const passed = out.filter((c) => c.ok).length
  console.log(`─── 自检 ${passed}/${out.length} ───`)
  return passed === out.length ? 0 : 1
}

export const __test__ = { stagedModifiedPaths, judge, commitMessageOf, appendRevertLedger, selfTest }

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exit(main())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
