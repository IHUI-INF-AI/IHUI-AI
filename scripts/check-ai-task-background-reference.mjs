#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-ai-task-background-reference.mjs
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:asyncio 后台任务必须被强引用(2026-10-25 立,守门 247)。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,blocking,
 * skipEnv = HUSKY_SKIP_AI_TASK_BG_REF,stagedTriggers = apps/ai-service/)。
 *
 * —— 立因(现读为证)——
 * 事件循环对 `asyncio.create_task(...)` 返回的任务只握**弱引用**;把返回值直接丢弃的
 * fire-and-forget,任务可能在跑到一半时被 GC 静默回收且零报错。本仓 2026-10-25 全量普查
 * 量出 19 处真裸点,不是抽象风险:workflow_engine.py 用裸 create_task 起「工作流实例
 * 后台执行」—— 实例静默永逝;publish/scheduler.py 对已发帖文起小时级「存活监控」也裸
 * (监控断线没人知道);llm.py 的试用额度 consume、hook/db_sync/model_sync/skill/spec 各族的
 * 落库与告警同型。仓内 knowledge_card_extractor / audit_service 早已把这条写成模块内
 * 纪律(各带一个 pending-set),但三处三份、没有闸 —— 正是 §0.6「同类实现全仓只许一份」
 * 的反面。本枚收口成唯一出口 app/core/background_tasks.py 的 spawn(),并装这道闸。
 *
 * —— 判据 ——
 * W1(绝对零容忍)= 真裸:含 create_task(/ensure_future( 的 token 行(出判注释/doc 后),
 *    不满足任一合格形态 ⇒ 红。合格形态:
 *    ① 同行有 spawn( 包裹(迁移后绝大多数);
 *    ② 同行赋值 `.add(` `append(` ⇒ 归 W2 只报数(赋值形持有的 liveness 线级判不了,见 W2);
 *    ③ 上探 ≤3 行落在列表字面量/gather 参数里 ⇒ 同归 W2;
 *    ④ 豁免台账命中(scripts/data/ai-task-bare-exemptions.json,marker=调用行子串,带 reason+until;
 *      marker 在被审面消失 ⇒ 台账腐烂判红 —— 守门 108「验过才免且会到期」);
 *    ⑤ 同名函数定义 `async def create_task(`(publish.py 真实存在的端点名)不算调用。
 * W2(观测位,不判):赋值/集合/列表持有型现读 102 处 —— 局部变量持有没有登记强,理论同陷弱引用,
 *    但要判它需要 liveness;绝对零容忍会把这 102 处当场顶成恒红门(§12e),只拦新增又需要
 *    第二面锚点账。本枚把它们**只报数**,收敛路径 = 后续迁移波逐处改 spawn;W1 的红线先把
 *    「新增裸点」这种最坏的形态钉死。
 * W3(装车证明):唯一出口文件在位、非测试 importer ≥1(§0.9「造好没装车=没有」;
 *    calendar-boundary.ts 是前车之鉴)。
 *
 * 取材面纪律(§0.4):全量档判 HEAD blob、--staged 判索引 blob、--worktree 仅人工逃生舱;
 * 两面旗同给 ⇒ exit 2;取不到 ⇒ 未判定(不记绿也不冒红);在射程 py=0 ⇒ 判死。
 *
 * 用法:node scripts/check-ai-task-background-reference.mjs [--staged|--worktree] [--self-test]
 * 退出码:0 无判红 / 1 判红或装车失败 / 2 未判定
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitErrText, gitRaw } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE = 'apps/ai-service'
const SINGLE_SOURCE = 'apps/ai-service/app/core/background_tasks.py'
const EXEMPTIONS_FILE = 'scripts/data/ai-task-bare-exemptions.json'
const CALL_TOKEN_RE = /\.(?:create_task|ensure_future)\s*\(/
const DEF_ALIAS_RE = /^\s*(?:async\s+)?def\s+\w*(?:create_task|ensure_future)\b/
const HOLD_SAME_LINE_RE = /=|\.add\(|append\s*\(|spawn\s*\(/
const LIST_OPEN_RE = /\[\s*$|=\s*(?:asyncio\.)?gather\s*\(|await\s+asyncio\.gather\s*\(/

/**
 * 为什么这里不用 lib/code-mask.mjs 的遮罩:那把尺认双斜杠、星杠成对与模板字符串 —— 全 JS 形态;
 * Python 的井号行注释与三引号 doc 它既认不出真注释、还可能把正文吃成掩码。
 * py 面用本门自带的最小行状态机:整行注释与三引号 doc 区一律出判;这是「同一实现不适用」
 * 时的新判据,不是第二把同判据的尺(§0.6 只禁同判据重抄)。已知边界:行尾 `# ...create_task(`
 * 型 inline 注释会被放行(宁漏不误伤)——普查现读无此形态。
 */
export function pyCodeLines(text) {
  const lines = text.split(/\r?\n/)
  const out = []
  let inDoc = false
  for (const line of lines) {
    if (inDoc) {
      const n = line.split('"""').length - 1
      if (n >= 1) inDoc = false
      out.push('')
      continue
    }
    const n = line.split('"""').length - 1
    const trimmed = line.trimStart()
    let keep = trimmed.startsWith('#') ? '' : line
    if (n % 2 === 1) {
      inDoc = true
      keep = keep.split('"""')[0]
    } else if (n >= 2 && n % 2 === 0) {
      // 同行成对三引号(单行 docstring/内联串):剥掉每一段闭合三引号内容,保留引号外的代码
      let guard = 0
      while (/"""[^"]*?""".*/.test(keep) && guard++ < 50) keep = keep.replace(/"""[\s\S]*?"""/, '§')
      if (/"""[\s\S]*?"""$/.test(keep)) keep = keep.replace(/"""[\s\S]*?"""/, '§')
    }
    out.push(keep)
  }
  return out
}

/** W1/W2 单文件判据:返回 {bare:[{line,why}], held:n} —— line 是 1-based 原文行号。 */
export function scanFile(rel, text, exemptions = [], nowIso = new Date().toISOString()) {
  const bare = []
  let held = 0
  const rawLines = text.split(/\r?\n/)
  const maskLines = pyCodeLines(text)
  for (let i = 0; i < maskLines.length; i++) {
    const line = maskLines[i]
    if (!CALL_TOKEN_RE.test(line)) continue
    const orig = rawLines[i] ?? ''
    if (rel === SINGLE_SOURCE) continue // 唯一出口的实现处
    if (DEF_ALIAS_RE.test(orig)) continue // 同名函数定义,不是调用
    if (/spawn\s*\(/.test(line)) continue // 同行已被出口包裹
    if (HOLD_SAME_LINE_RE.test(line)) {
      held++
      continue
    }
    // 上探 ≤3 行:列表/gather 的结构持有(首行 `[` 或 `gather(` 开在元素行之前)
    let structHeld = false
    for (let back = 1; back <= 3 && i - back >= 0; back++) {
      const up = (maskLines[i - back] ?? '').trimEnd()
      if (LIST_OPEN_RE.test(up)) {
        structHeld = true
        break
      }
      if (up !== '' && /[^(,[]$/.test(up) && !/=\s*$/.test(up)) break // 无关语句停探
    }
    if (structHeld) {
      held++
      continue
    }
    const ex = exemptions.find(
      (e) => e.file === rel && typeof e.marker === 'string' && orig.includes(e.marker),
    )
    if (ex) {
      if (ex.until && String(ex.until) < nowIso.slice(0, 10)) {
        bare.push({ line: i + 1, why: `豁免已过期(${ex.until}):${ex.reason}` })
        continue
      }
      continue
    }
    bare.push({ line: i + 1, why: '返回值丢弃且无结构持有 —— 事件循环只握弱引用,任务可被 GC' })
  }
  return { bare, held }
}

/** 台账完整性(§0.8 验过才免且会到期):marker 不再命中被审面 ⇒ 腐烂点名。 */
export function findStaleExemptions(exemptions, readFace) {
  const stale = []
  for (const e of exemptions) {
    if (!e.file || typeof e.marker !== 'string') {
      stale.push({ ...e, why: '条目形状不合法(file/marker 必填)' })
      continue
    }
    const txt = readFace(e.file)
    if (txt === null) {
      stale.push({ ...e, why: '被豁免文件已不存在' })
      continue
    }
    if (!txt.includes(e.marker)) stale.push({ ...e, why: 'marker 已不在被审面(豁免空挂)' })
  }
  return stale
}

/** 判据单源(§0.6):files=[[rel,text]] + exemptions + readFace → 结论对象。 */
export function evaluate(files, exemptions, readFace, nowIso = new Date().toISOString()) {
  const violations = []
  const heldByFile = []
  let py = 0
  let importer = 0
  for (const [rel, text] of files) {
    if (!rel.startsWith(`${SCOPE}/`) || !rel.endsWith('.py')) continue
    if (rel.includes('/tests/') || /(^|\/)test_[^/]+\.py$/.test(rel)) continue
    if (text === null || text === undefined)
      return { undetermined: `取不到 ${rel}(不记绿也不冒红)` }
    py++
    if (rel !== SINGLE_SOURCE && /background_tasks import/.test(text)) importer++
    const r = scanFile(rel, text, exemptions, nowIso)
    for (const b of r.bare) violations.push({ file: rel, ...b })
    if (r.held > 0) heldByFile.push({ file: rel, n: r.held })
  }
  if (py === 0) return { undetermined: '在射程 py=0(判死,不作通过)' }
  if (readFace(SINGLE_SOURCE) === null) return { violations, stale: [], heldByFile, py, w3fail: '唯一出口不在被审面(造好没装车=没有)' }
  if (importer === 0) return { violations, stale: [], heldByFile, py, w3fail: '出口在位但 0 个非测试 importer' }
  const stale = findStaleExemptions(exemptions, readFace)
  return { violations, stale, heldByFile, py, importer }
}

/** 12 例成对夹具:每条必拒配不得误拒;摘判据即翻红。 */
export function selfTest() {
  const fails = []
  const check = (name, cond) => {
    if (!cond) fails.push(name)
  }
  const EX = [{ file: 'svc.py', marker: 'close()', reason: '测试 helper', until: '2027-01-01' }]
  check('W1 裸 create_task 判红', scanFile('svc.py', 'async def f():\n    asyncio.create_task(work())\n', []).bare.length === 1)
  check('spawn 形状不误伤', scanFile('svc.py', 'async def f():\n    spawn(work())\n', []).bare.length === 0)
  const assigned = scanFile('svc.py', 'async def f():\n    t = asyncio.create_task(w())\n', [])
  check('赋值型降级只报数', assigned.bare.length === 0 && assigned.held === 1)
  const inList = scanFile(
    'svc.py',
    'async def f():\n    pumps = [\n        asyncio.create_task(a()),\n        asyncio.create_task(b()),\n    ]\n',
    [],
  )
  check('列表结构持有不误伤', inList.bare.length === 0 && inList.held === 2)
  const defAlias = scanFile('svc.py', 'async def create_task(body):\n    return 1\n', [])
  check('同名 def 不是调用', defAlias.bare.length === 0)
  const commented = scanFile('svc.py', '# comment mentions asyncio.create_task(x)\nimport asyncio\n', [])
  check('井号注释行出判', commented.bare.length === 0)
  const doc = scanFile('svc.py', 'async def f():\n    """doc: asyncio.create_task(x) 提及"""\n    return 1\n', [])
  check('doc 提及出判', doc.bare.length === 0)
  const exempt = scanFile('svc.py', 'async def f():\n    asyncio.create_task(mgr.close())\n', EX)
  check('豁免有效期内放行', exempt.bare.length === 0)
  const expired = scanFile('svc.py', 'async def f():\n    asyncio.create_task(mgr.close())\n', [{ ...EX[0], until: '2020-01-01' }])
  check('豁免过期照判红', expired.bare.length === 1)
  check('台账腐烂(marker 消失)点名', findStaleExemptions(EX, () => '无 close 字样').length === 1)
  check('台账健康不误报', findStaleExemptions(EX, () => 'has close() ok').length === 0)
  check('在射程 0 判死', Boolean(evaluate([], [], () => null).undetermined))
  return fails
}

// ── CLI ────────────────────────────────────────────────────────────────────
/** 面清单:head=ls-tree -r HEAD;staged=ls-files;worktree=递归(排除 .venv 等第三方在场物)。 */
function listScope(face) {
  if (face === 'worktree') {
    if (!existsSync(path.join(ROOT, SCOPE))) return null
    const out = []
    const SKIP = new Set(['.venv', '__pycache__', 'node_modules', '.pytest_cache', '.mypy_cache', '.ruff_cache'])
    const walk = (dir) => {
      for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (!SKIP.has(e.name)) walk(`${dir}/${e.name}`)
        } else if (e.name.endsWith('.py')) out.push(`${dir}/${e.name}`)
      }
    }
    walk(SCOPE)
    return out
  }
  const args =
    face === 'staged'
      ? ['ls-files', '--cached', '--', SCOPE]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', SCOPE]
  // 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + safe.directory + quotepath + 显式 stdio
  // 由 gitRaw 提供,不再自拼裸 'git' 派生;maxBuffer 与原调用一致。取不到(非零退出/异常)仍返回 null。
  try {
    return gitRaw(args, ROOT, { maxBuffer: 1 << 28 })
      .split(/\r?\n/)
      .filter((s) => s.endsWith('.py'))
  } catch {
    return null
  }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const fails = selfTest()
    if (fails.length === 0) {
      console.log('[AI后台任务闸] --self-test 通过(12 例成对夹具)')
      process.exit(0)
    }
    for (const f of fails) console.log('  FAIL:', f)
    process.exit(1)
  }
  const useStaged = argv.includes('--staged')
  const useWorktree = argv.includes('--worktree')
  if (useStaged && useWorktree) {
    console.log('[AI后台任务闸] 无法判定:--staged 与 --worktree 同给')
    process.exit(2)
  }
  const face = useWorktree ? 'worktree' : useStaged ? 'staged' : 'head'
  const rels = listScope(face)
  if (rels === null) {
    console.log('[AI后台任务闸] 未判定:清单面读不到(git 派生失败/scope 不在)')
    process.exit(2)
  }
  const prefix = face === 'staged' ? ':' : face === 'head' ? 'HEAD:' : ''
  const want = [...new Set([...rels, EXEMPTIONS_FILE])]
  const specs = face === 'worktree' ? want : want.map((r2) => prefix + r2)
  let got
  try {
    got = catBatch(ROOT, specs, { maxBuffer: 1 << 29 })
  } catch (e) {
    console.log(`[AI后台任务闸] 未判定:取材失败 ${gitErrText(e)}`)
    process.exit(2)
  }
  const readFace = (rel) => {
    const v = got.get(prefix + rel)
    if (v !== undefined && v !== null) return v
    if (face === 'worktree' && existsSync(path.join(ROOT, rel)))
      return readFileSync(path.join(ROOT, rel), 'utf8')
    return null
  }
  let exemptions
  try {
    const exRaw = readFace(EXEMPTIONS_FILE)
    exemptions = exRaw === null ? [] : JSON.parse(exRaw)
    if (!Array.isArray(exemptions)) throw new Error('非数组')
  } catch (e) {
    console.log(`[AI后台任务闸] 未判定:豁免台账坏 ${String(e).slice(0, 90)}`)
    process.exit(2)
  }
  const files = rels.map((rel) => [rel, readFace(rel)])
  const res = evaluate(files, exemptions, readFace)
  if (res.undetermined) {
    console.log(`[AI后台任务闸] 未判定:${res.undetermined}`)
    process.exit(2)
  }
  for (const v of res.violations) console.log(`  W1 ${v.file}:${v.line} ${v.why}`)
  for (const s of res.stale) console.log(`  台账 ${s.file}: ${s.why}`)
  const heldN = res.heldByFile.reduce((a, h) => a + h.n, 0)
  if (res.violations.length + res.stale.length > 0) {
    console.log(
      `[AI后台任务闸] ❌ 判红 ${res.violations.length + res.stale.length} 处(W1 真裸 ${res.violations.length} + 台账腐烂 ${res.stale.length})`,
    )
    console.log('  出路:fire-and-forget 一律 app.core.background_tasks.spawn(...);需要结果就 await')
    console.log('  确属合法 ⇒ scripts/data/ai-task-bare-exemptions.json 登记(marker=调用行子串,reason+until)')
    process.exit(1)
  }
  if (res.w3fail) {
    console.log(`[AI后台任务闸] ❌ W3 装车:${res.w3fail}`)
    process.exit(1)
  }
  console.log(
    `[AI后台任务闸] ✅ 无判红(py ${res.py} | W1 0 | 持有型 ${heldN} 只报数见头注 W2 | 豁免 ${exemptions.length} | importer ${res.importer})`,
  )
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = { pyCodeLines, scanFile, evaluate, findStaleExemptions, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
