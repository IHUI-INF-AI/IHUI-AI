// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// Guardian 复核接线对账(V3 #80 的判据,2026-09-27 立)。
//
// 钉两件事,都属本仓最高频失效型「造好没装车 = 没有」:
//  - W1 复核出口 `request_guardian_review(` 必须在**生产面**有调用点
//    (apps/ai-service/app/** 的非测试 .py;注释/文档字符串/import 行都不算装车);
//  - W2/W3/W4 "未复核"态不得被静默折叠成通过:
//    · W2 出口模块自身必须在位,且 `to_event_payload` 的载荷形状永远含
//      "status" 与 "unavailable_reason" 两键(缺席与"无风险"必须可分辨);
//    · W3 reviewed_* 状态字面量只许出现在出口模块一处 —— 别处手写这两个
//      字符串 = 伪造复核合格证,判红(注释里的提及不算,判据面先剥注释);
//    · W4 含调用点的生产文件必须同时引用 `to_event_payload(` —— 复核跑了
//      但结论没随事件下发给用户 = 没装车。
//
// 接线现状(如实登记,不冒充):本门由主会话接线,当前**未**接入提交链;
// 手动问责入口 `node scripts/check-guardian-review-wired.mjs`。
// 紧急跳过(接入提交链后生效):HUSKY_SKIP_GUARDIAN_REVIEW_WIRED=1。
//
// 取材口径同 70/77/83/98/101/103/118:全量判 HEAD blob、--staged 判索引 blob、
// --worktree 仅人工逃生舱、两面旗同给 exit 2、面取不到判"无法判定"、
// 枚举到 0 个候选判死不记绿。
//
// 已知边界(不冒充判了):本门只看"调用点在 + 形状锁在 + 无外部伪造字面量",
// 不判复核内容质量;复核提示词/模型质量属 apps/ai-service/tests/test_guardian_review.py
// 的三态断言面。Python 遮罩本门自带(仓内共享遮罩 scripts/lib/code-mask.mjs 只覆盖
// JS 语法,套 Python 会把多行 docstring 判失配 —— 语言不同,不构成第二份同名实现)。

import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// 被审面:ai-service 的应用代码(生产面);测试目录/夹具不进调用点统计。
const SCAN_DIR = 'apps/ai-service/app'
const MODULE_REL = 'apps/ai-service/app/services/guardian_review.py'
const REVIEW_CALL_RE = /request_guardian_review\s*\(/g
const REVIEWED_LITERALS_RE =
  /(["'])reviewed_no_alternative\1|(["'])reviewed_alternative_found\2/g
const PAYLOAD_REF_RE = /to_event_payload\s*\(/

function isTestish(rel) {
  const base = rel.split('/').pop() || ''
  return (
    /(^|\/)tests?\//.test(rel) ||
    /^test_.*\.py$/.test(base) ||
    base === 'conftest.py'
  )
}

/**
 * Python 面遮罩:把注释(和可选的字符串)抹成等长空格,行号不变。
 * strings=false 时只抹 # 注释、保留字符串字面量(W3 要看的正是字符串)。
 * 状态机逐字符扫:三引号串、单双引号串(含转义)、# 注释;未闭合引号只抹到行尾
 * (方向与守门 70/131 相同:宁可少判,不可把整文件吞进假状态后失明)。
 */
export function maskPythonSurface(src, { strings = true } = {}) {
  if (typeof src !== 'string') return ''
  const out = src.split('')
  const blank = (from, to) => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '
  }
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '#') {
      let j = src.indexOf('\n', i)
      if (j < 0) j = src.length
      blank(i, j)
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      if (src.slice(i, i + 3) === c + c + c) {
        const close = src.indexOf(c + c + c, i + 3)
        const end = close < 0 ? src.length : close + 3
        if (strings) blank(i, end)
        i = end
        continue
      }
      let j = i + 1
      let closed = false
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src[j] === c) {
          j++
          closed = true
          break
        }
        if (src[j] === '\n') break
        j++
      }
      if (strings && closed) blank(i, j)
      else if (strings && !closed) blank(i, src.indexOf('\n', i) < 0 ? src.length : src.indexOf('\n', i))
      i = j
      continue
    }
    i++
  }
  return out.join('')
}

/** 在模块全文里取 GuardianReviewResult.to_event_payload 方法体(形状锁的作用域)。 */
export function extractResultPayloadBody(src) {
  const cls = src.indexOf('class GuardianReviewResult')
  if (cls < 0) return null
  const def = src.indexOf('def to_event_payload', cls)
  if (def < 0) return null
  // 方法体终止:同缩进(4 空格)的下一个 def/class,或缩进 ≤0 的行(__all__ 等)
  const rest = src.slice(def)
  const lines = rest.split('\n')
  let end = lines.length
  for (let k = 1; k < lines.length; k++) {
    const line = lines[k]
    if (/^\s*$/.test(line)) continue
    const indent = line.length - line.trimStart().length
    const token = line.trimStart()
    if (indent <= 4 && (token.startsWith('def ') || token.startsWith('@') || indent === 0)) {
      end = k
      break
    }
  }
  return lines.slice(0, end).join('\n')
}

/**
 * 纯判据:输入生产面文件清单(已按被审面取到内容),输出问题/备注/未判定。
 * files: Array<{path, text|null}>;text=null 表示该枚举路径在面上读不到内容。
 */
export function decide({ files }) {
  const problems = []
  const notes = []
  const undetermined = []

  const pyFiles = (files || []).filter(
    (f) => typeof f.path === 'string' && f.path.endsWith('.py') && !isTestish(f.path),
  )
  if (pyFiles.length === 0) {
    undetermined.push(`生产面枚举到 0 个 .py(${SCAN_DIR}/**)—— 空扫不记绿`)
    return { problems, notes, undetermined }
  }

  const moduleFile = pyFiles.find((f) => f.path === MODULE_REL)
  // ---- W1:生产调用点(先剥注释与字符串再判) ----
  const callSites = []
  for (const f of pyFiles) {
    if (f.path === MODULE_REL) continue // 出口模块自身(def/import 面)不算消费方
    if (f.text === null || f.text === undefined) {
      undetermined.push(`面上枚举到但取不到内容:${f.path}(不静默算已判)`)
      continue
    }
    const masked = maskPythonSurface(f.text, { strings: true })
    const hits = masked.match(REVIEW_CALL_RE)
    if (hits && hits.length > 0) callSites.push({ path: f.path, count: hits.length })
  }
  if (callSites.length === 0) {
    problems.push(
      `W1 复核出口 request_guardian_review( 在生产面零调用点(${SCAN_DIR}/** 非测试,` +
        '注释/文档字符串/import 均不计)—— 「造好没装车 = 没有」,V3 #80 的闭环退化为死模块',
    )
  } else {
    notes.push(
      `W1 生产调用点 ${callSites.length} 个文件 / ${callSites.reduce((a, b) => a + b.count, 0)} 处: ` +
        callSites.map((c) => `${c.path}(${c.count})`).join(', '),
    )
  }

  // ---- W2:出口模块在位 + 载荷形状锁 ----
  if (!moduleFile || moduleFile.text === null || moduleFile.text === undefined) {
    problems.push(
      `W2 复核出口模块缺失或不可读:${MODULE_REL} —— 没有出口,谈不上复核`,
    )
  } else {
    const body = extractResultPayloadBody(moduleFile.text)
    if (body === null) {
      problems.push('W2 GuardianReviewResult.to_event_payload 在出口模块里找不到(形状锁失去对象)')
    } else {
      for (const key of ['"status"', '"unavailable_reason"']) {
        if (!body.includes(key)) {
          problems.push(
            `W2 to_event_payload 载荷缺形状键 ${key} —— 缺席必须可与"无风险"分辨,少一态都不行`,
          )
        }
      }
    }
    for (const constName of [
      'GUARDIAN_REVIEW_STATUS_NOT_REVIEWED',
      'GUARDIAN_REVIEW_STATUS_NO_ALTERNATIVE',
      'GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND',
    ]) {
      if (!moduleFile.text.includes(constName)) {
        problems.push(`W2 出口模块不再定义三态常量 ${constName} —— 状态字面量是线协议`)
      }
    }
  }

  // ---- W3:reviewed_* 字面量只许出口模块一家持有(注释剥掉、字符串保留后判) ----
  for (const f of pyFiles) {
    if (f.path === MODULE_REL) continue
    if (f.text === null || f.text === undefined) continue
    const noComments = maskPythonSurface(f.text, { strings: false })
    const hits = noComments.match(REVIEWED_LITERALS_RE)
    if (hits && hits.length > 0) {
      problems.push(
        `W3 ${f.path} 在出口模块之外手写复核结论字面量(${hits.length} 处)—— ` +
          '「未复核」不得被别处折叠成通过,合格证只能由出口模块签发',
      )
    }
  }

  // ---- W4:调用点文件必须同时把结论载荷挂出去 ----
  if (callSites.length > 0) {
    const payloadCarriers = callSites.filter((c) => {
      const f = pyFiles.find((x) => x.path === c.path)
      return f && typeof f.text === 'string' && PAYLOAD_REF_RE.test(maskPythonSurface(f.text, { strings: true }))
    })
    if (payloadCarriers.length === 0) {
      problems.push(
        'W4 调用点文件无一引用 to_event_payload( —— 复核跑了但三态结论没随事件下发,' +
          '用户看不见 = 没交付',
      )
    }
  }

  return { problems, notes, undetermined, callSiteFiles: callSites.length }
}

// ---------------- 取材面 ----------------

function enumerateWorktreePy(root) {
  // worktree 面按磁盘走:新交付在 git add 之前也必须可判(人工排查/验收面的定义)。
  const out = []
  const walk = (dirAbs, dirRel) => {
    let entries
    try {
      entries = readdirSync(dirAbs, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const rel = dirRel ? `${dirRel}/${e.name}` : e.name
      if (e.isDirectory()) {
        if (e.name === '__pycache__' || e.name === 'node_modules') continue
        walk(path.join(dirAbs, e.name), rel)
      } else if (e.isFile() && e.name.endsWith('.py')) {
        out.push(rel)
      }
    }
  }
  walk(path.join(root, SCAN_DIR), SCAN_DIR)
  return out.sort()
}

function enumerate(root, face) {
  if (face === 'worktree') return enumerateWorktreePy(root)
  const listed =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', SCAN_DIR], root, {
          maxBuffer: 32 << 20,
        })
      : gitRaw(['ls-files', '--', SCAN_DIR], root, { maxBuffer: 32 << 20 })
  return listed
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.endsWith('.py'))
}

function readFace(root, face) {
  const rels = enumerate(root, face)
  if (face === 'worktree') {
    return rels.map((rel) => ({ path: rel, text: readWorktreeFile(root, rel) }))
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = specs.length ? catBatch(root, specs, { maxBuffer: 1 << 28 }) : new Map()
  return rels.map((rel, i) => ({ path: rel, text: got.get(specs[i]) ?? null }))
}

// ---------------- CLI ----------------

export function runAudit({ root = ROOT, face } = {}) {
  const sel = face
    ? { face, error: null }
    : selectFace({ staged: false, worktree: false, def: 'head' })
  if (sel.error) return { face: null, problems: [sel.error], notes: [], undetermined: [] }
  let files
  try {
    files = readFace(root, sel.face)
  } catch (e) {
    if (e instanceof Undetermined) {
      return { face: sel.face, problems: [], notes: [], undetermined: [`取材失败:${e.message}`] }
    }
    throw e
  }
  const res = decide({ files })
  return { face: sel.face, scanned: files.length, ...res }
}

function printReport(out) {
  const lines = []
  lines.push(`[guardian-review-wired] 面=${out.face ?? '不可判'} 扫描生产 .py ${out.scanned ?? 0} 个`)
  for (const n of out.notes) lines.push(`  · ${n}`)
  for (const u of out.undetermined) lines.push(`  ? 未判定:${u}`)
  for (const p of out.problems) lines.push(`  ❌ ${p}`)
  if (out.problems.length > 0) lines.push(`结论:判红(${out.problems.length} 个问题)`)
  else if (out.undetermined.length > 0) lines.push('结论:无法判定 —— 拒绝出具合格证')
  else lines.push('结论:✅ 复核出口已装车且三态不可折叠')
  console.log(lines.join('\n'))
}

function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })

  const MODULE_OK = `
GUARDIAN_REVIEW_STATUS_NOT_REVIEWED = "not_reviewed"
GUARDIAN_REVIEW_STATUS_NO_ALTERNATIVE = "reviewed_no_alternative"
GUARDIAN_REVIEW_STATUS_ALTERNATIVE_FOUND = "reviewed_alternative_found"
class GuardianReviewResult:
    def applicable_alternative(self, t):
        return None
    def to_event_payload(self):
        payload = {
            "status": self.status,
            "unavailable_reason": self.unavailable_reason,
        }
        return payload
def request_guardian_review(tool, args): ...
`
  const CONSUMER_OK = `
from .guardian_review import request_guardian_review
class Loop:
    async def _request_approval(self, tc):
        review = await request_guardian_review(tc.name, tc.args)
        await self.emit(guardian_review=review.to_event_payload())
`
  const files = (a, b) => [
    { path: MODULE_REL, text: a },
    { path: 'apps/ai-service/app/services/agent_loop_v2.py', text: b },
  ]
  const ok = decide({ files: files(MODULE_OK, CONSUMER_OK) })
  t('① happy:出口在位+调用点在+载荷挂出 ⇒ 零问题', ok.problems.length === 0 && ok.undetermined.length === 0)

  const noCall = decide({
    files: files(MODULE_OK, `
from .guardian_review import request_guardian_review
class Loop:
    async def x(self):
        return None
`),
  })
  t('② 阳性对照:把调用点摘掉(import 还在)⇒ 必判 W1 红', noCall.problems.some((p) => p.startsWith('W1')))

  const commentOnly = decide({
    files: files(MODULE_OK, `
# request_guardian_review(tc.name, tc.args) 这里只是解释性注释
class Loop:
    """文档字符串里提 request_guardian_review( 也不算装车"""
    async def x(self):
        return None
`),
  })
  t('③ 反向对照:调用形态只出现在注释/文档字符串 ⇒ 仍判 W1 红(注释不算装车)', commentOnly.problems.some((p) => p.startsWith('W1')))

  const testOnly = decide({
    files: [
      { path: MODULE_REL, text: MODULE_OK },
      { path: 'apps/ai-service/tests/test_guardian_review.py', text: CONSUMER_OK },
    ],
  })
  t('④ 反向对照:只有测试面调用 ⇒ W1 红(测试不算生产消费者)', testOnly.problems.some((p) => p.startsWith('W1')))

  const forged = decide({
    files: files(
      MODULE_OK,
      CONSUMER_OK + `
def lie():
    return {"status": "reviewed_no_alternative"}
`,
    ),
  })
  t('⑤ 折叠防线:消费方在出口模块外手写 reviewed_* 字面量 ⇒ W3 红', forged.problems.some((p) => p.startsWith('W3')))

  const commentForge = decide({
    files: files(
      MODULE_OK,
      CONSUMER_OK + '\n# 注意:别处不得写 "reviewed_alternative_found" 这种字面量\n',
    ),
  })
  t('⑥ 折叠防线不误伤解释:该字面量只出现在注释 ⇒ 不判 W3(判据不得判自己的散文)', !commentForge.problems.some((p) => p.startsWith('W3')))

  const shapeBroken = decide({
    files: files(
      MODULE_OK.replace('            "unavailable_reason": self.unavailable_reason,\n', ''),
      CONSUMER_OK,
    ),
  })
  t('⑦ 形状锁:to_event_payload 丢 "unavailable_reason" 键 ⇒ W2 红', shapeBroken.problems.some((p) => p.startsWith('W2')))

  const moduleGone = decide({
    files: [{ path: 'apps/ai-service/app/services/agent_loop_v2.py', text: CONSUMER_OK }],
  })
  t('⑧ 出口模块整体缺失 ⇒ W2 红(删出口=最彻底的摘线)', moduleGone.problems.some((p) => p.startsWith('W2')))

  const noPayload = decide({
    files: files(MODULE_OK, `
review = await request_guardian_review(tc.name, tc.args)
`),
  })
  t('⑨ 跑了不播报:调用点在但没引 to_event_payload( ⇒ W4 红', noPayload.problems.some((p) => p.startsWith('W4')))

  const empty = decide({ files: [] })
  t('⑩ 空枚举判死:生产面 0 个 .py ⇒ 未判定而非通过', empty.problems.length === 0 && empty.undetermined.length > 0)

  const unreadable = decide({
    files: [
      { path: MODULE_REL, text: MODULE_OK },
      { path: 'apps/ai-service/app/services/x.py', text: null },
    ],
  })
  t('⑪ 枚举到但内容取不到 ⇒ 点名未判定,不静默', unreadable.undetermined.length > 0)

  const m = maskPythonSurface('a = "x # not comment"\n# real\nb = request_guardian_review(1)\n')
  t('⑫ 遮罩:串内 # 不截行,行注释剥净,代码保留(行号不变)', (() => {
    const lines = m.split('\n')
    return lines.length === 4 && lines[1].trim() === '' && lines[2].includes('request_guardian_review(')
  })())

  const pass = cases.filter((c) => c.ok).length
  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  console.log(`--self-test:${pass}/${cases.length} 通过`)
  return pass === cases.length ? 0 : 1
}

function main(argv) {
  if (process.env.HUSKY_SKIP_GUARDIAN_REVIEW_WIRED === '1') {
    console.log('[guardian-review-wired] HUSKY_SKIP_GUARDIAN_REVIEW_WIRED=1,跳过(已留痕于本次提交说明)')
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    return 2
  }
  let out
  try {
    out = runAudit({ root: ROOT, face: sel.face })
  } catch (e) {
    console.error(`[guardian-review-wired] 脚本异常:${e?.stack || e}`)
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
  } else {
    printReport(out)
  }
  if (out.problems.length > 0) return 1
  if (out.undetermined.length > 0) return 2
  return 0
}

export const __test__ = { decide, maskPythonSurface, extractResultPayloadBody, MODULE_REL, SCAN_DIR, selfTest }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}
