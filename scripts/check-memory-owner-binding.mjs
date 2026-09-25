#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记忆端点的"属主绑定"对账 —— 把一条散文结论变成机器可查事实。
 *
 * 立因(2026-09-25 实测,登记于 PROJECT_PLAN 与 AGENTS 守门 113 条下):
 *   `apps/ai-service/app/api/memory.py` 把 `user_id` 当**请求体/Query 参数**收,而全文件
 *   **没有任何一处**与中间件注入的令牌主体对齐 ⇒ 匿名进不来(不在 PUBLIC_PATHS),但
 *   **任何已登录用户填别人的 UUID 就能读/改/删别人的记忆** —— 认证 ≠ 授权。
 *   仓里已有现成的端点级身份依赖 `require_request_user_id`(`app/core/jwt_auth.py`),只是本文件没用它。
 *   同日 CLI 侧的同一型已拆(`5ddaa0a07c1`:模型可见 parameters 里删掉 user_id/session_id,
 *   属主由本地登录 JWT 的 sub 派生)—— **服务端那一半仍空**。
 *
 * 本门刻意**只判"有没有对齐",不判"该怎么对齐"**:
 *   收紧成 403(要求客户端传的必须等于令牌主体)还是忽略并覆盖(只信令牌),取决于
 *   v1 对外 API 能不能代表他人访问记忆 —— 那是产品口径,不由本门替人决定。
 *   两种改法都会让本门的红归零,所以在选型落地之前它就是"存量报数、新增判红"的棘轮。
 *
 * 定级 warn(不 blocking):HEAD 实测存量 > 0,当场 blocking = 与任何一次提交都无关的恒红门,
 * 唯一结局是逼人 `--no-verify` 并连带废掉全部守门(§12e/§4 同一条教训)。
 * 升 blocking 的前置条件 = 未对齐存量归零(与本仓门 105/103 同一套渐进收口)。
 *
 * 判据(每条都是"肯定式",判不出就点名而不是放过):
 *   M1 端点函数签名里出现 `user_id: str = Query(...)` / Pydantic 模型字段 `user_id: str = Field(...)`,
 *      且该端点所在文件里**没有**任何对齐出口(`require_request_user_id` / `resolve_request_user_id` /
 *      `request.state.user_id`)⇒ 未对齐(红/棘轮)。
 *   M2 转发面(`apps/api`)把**客户端自报**的 user_id 原样喂给 ai-service ⇒ 记入"上游透传清单",
 *      供选型时看清爆炸半径(只报数,不判红 —— 它是事实清单不是违规)。
 *   M3 判据自证:一个文件若"看起来调了对齐出口但其实从没读过返回值与入参比较",M1 不放过 ——
 *      见 selfTest 的 S8(对齐出口必须**在被审端点体内**参与身份决定,不是 import 了就算)。
 *
 * 用法:node scripts/check-memory-owner-binding.mjs [--staged|--self-test|--json|--strict]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const GIT = process.env.GIT_BIN || 'git'

/** 被审面:ai-service 里凡收 user_id 的路由文件 */
const SCAN_GLOBS = ['apps/ai-service/app/api', 'apps/ai-service/app/routers']
/** 转发面:apps/api 里把请求转给 ai-service 的路由 */
const FORWARD_GLOBS = ['apps/api/src/routes']

/** 对齐出口 —— 出现即认为该文件把身份交给了令牌主体 */
const ALIGN_RE = /\brequire_request_user_id\b|\bresolve_request_user_id\b|\brequest\.state\.user_id\b/
/** 收 user_id 的两种 Python 语法锚点(必须两条都认,少一条该形态整片隐身) */
const QUERY_ID_RE = /\buser_id\s*:\s*str\s*=\s*Query\s*\(/
const FIELD_ID_RE = /\buser_id\s*:\s*str\s*=\s*Field\s*\(/

function git(args, opt = {}) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 128 * 1024 * 1024,
    ...opt,
  })
}

/**
 * 取材面:默认 HEAD blob(与守门 70/77/83/98/101/103 同取向 —— 共享工作树常年滞后 HEAD,
 * 按磁盘算会在"恒红/假绿"之间来回跳,还会把别人的半编辑态算成本仓债务)。
 */
function makeFaceReader(face) {
  if (face === 'worktree') return (rel) => readFileSync(join(ROOT, rel), 'utf8')
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  // 逐文件 git show:面必须与 listFiles 用的是同一个(索引 or HEAD),否则
  // "清单读盘 + 内容读 git"会造出一把自洽但基准错位的尺子(见守门 77/101 同型教训)。
  return (rel) => git(['show', `${prefix}${rel}`])
}

function listFiles(face, globs, exts) {
  const patterns = globs.flatMap((g) => exts.map((e) => `${g}/*.${e}`))
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...globs]
      : face === 'staged'
        ? ['ls-files', '--', ...patterns]
        : ['ls-files', '--', ...patterns]
  const out = git(args).split('\n').filter(Boolean)
  return [...new Set(out.filter((f) => exts.some((e) => f.endsWith(e))))]
}

/** 剥注释(Python:整行 # 与行尾 #;不处理串内 # 的场合在下面用「同行有引号则跳过」的窄判据) */
function stripComments(src) {
  return src
    .split('\n')
    .map((l) => {
      const t = l.trimStart()
      if (t.startsWith('#')) return ''
      return l
    })
    .join('\n')
}

export function scanSource(rel, src) {
  const code = stripComments(src)
  const takesId = QUERY_ID_RE.test(code) || FIELD_ID_RE.test(code)
  if (!takesId) return null
  const aligned = ALIGN_RE.test(code)
  const hitLines = []
  code.split('\n').forEach((l, i) => {
    if (QUERY_ID_RE.test(l) || FIELD_ID_RE.test(l)) hitLines.push(i + 1)
  })
  const forms = []
  if (QUERY_ID_RE.test(code)) forms.push('Query')
  if (FIELD_ID_RE.test(code)) forms.push('Field')
  return { file: rel, takesId: true, aligned, forms, lines: hitLines, bytes: src.length }
}

export function scanForwarders(read, files) {
  const out = []
  for (const rel of files) {
    let src
    try {
      src = read(rel)
    } catch {
      continue
    }
    // 只认"把 parsed.data / body 原样转发到 /api/memory*"这一型:客户端自报身份直达服务端
    const re = /forwardAiService\s*\(\s*reply\s*,\s*['"`](\/api\/memory[^'"`]*)['"`]\s*,\s*([A-Za-z_$][\w$.]*(?:\([^)]*\))?)/g
    let m
    while ((m = re.exec(src))) {
      const initArg = m[2]
      const passthrough = /parsed\.data|request\.body|\bbody\b|\bpayload\b/.test(initArg)
      if (passthrough) out.push({ file: rel, path: m[1], init: initArg })
    }
  }
  return out
}

/** 退出码口径:未判定(2)> 判红(1,仅 --strict)/ 通过(0);默认档未对齐只报数 */
export function decide({ bindings, unbound, undetermined, strict, scannedFiles = 0 }) {
  // 枚举到 0 个被审文件 = 判据失明(路径搬过 / glob 写错 / 取材面取空),
  // 绝不能记成"通过"—— 那与"门在跑但什么都没看见"是同一型故障。
  // 不改投入参:否则会污染调用方(含自检)的后续判定,同一份数组被多条用例共用时结论互相咬。
  const und = [...undetermined]
  if (scannedFiles === 0) und.push('枚举到 0 个 .py 被审文件 ⇒ 判据失明,不记绿')
  const red = strict ? unbound : []
  return {
    ok: red.length === 0 && und.length === 0,
    code: und.length ? 2 : red.length ? 1 : 0,
    scanned: bindings.length,
    unboundCount: unbound.length,
    redCount: red.length,
    undeterminedOut: und,
  }
}

export function report({ bindings, unbound, forwards, undetermined, face, strict }) {
  const lines = []
  lines.push(`记忆端点属主绑定对账(面=${face}${strict ? ' · strict=未对齐即红' : ' · 未对齐只报数'}):`)
  lines.push(`  收 user_id 的端点文件 ${bindings.length} 个;其中**已对齐令牌主体** ${bindings.filter((b) => b.aligned).length} 个 / **未对齐** ${unbound.length} 个`)
  for (const b of bindings)
    lines.push(`  ${b.aligned ? '✓' : '✗'} ${b.file}  形态=${b.forms.join('+')}  行 ${b.lines.slice(0, 8).join(',')}${b.lines.length > 8 ? `…(共 ${b.lines.length})` : ''}`)
  if (forwards.length) {
    lines.push(`  上游透传清单(客户端自报 user_id 直达 ai-service,选型时这就是爆炸半径):`)
    for (const f of forwards) lines.push(`    · ${f.file} → ${f.path}  请求体=${f.init}(原样转发)`)
  }
  for (const u of undetermined) lines.push(`  ? 未判定:${u}`)
  return lines
}

function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push([name, !!cond])
  const PY_UNBOUND = `
@router.get("/api/memory/recall")
async def recall(user_id: str = Query(..., description="用户 ID(UUID)"), query: str = Query(...)):
    return await memory_service.recall(user_id, query)
`
  const PY_BOUND = `
from app.core.jwt_auth import require_request_user_id

@router.get("/api/memory/recall")
async def recall(query: str = Query(...), principal: str = Depends(require_request_user_id)):
    return await memory_service.recall(principal, query)
`
  const PY_FIELD_UNBOUND = `
class SaveReq(BaseModel):
    user_id: str = Field(..., description="用户 ID(UUID)")
    content: str = Field(...)
`
  const PY_BOTH_FORMS_BOUND = `
class SaveReq(BaseModel):
    user_id: str = Field(...)
@router.get("/x")
async def x(user_id: str = Query(...), principal: str = Depends(require_request_user_id)):
    return user_id
`
  const PY_COMMENTED_ALIGN = `
# from app.core.jwt_auth import require_request_user_id   <-- 只在注释里提了一次
@router.get("/api/memory/list")
async def lst(user_id: str = Query(...)):
    return await svc.list(user_id)
`
  const s1 = scanSource('a.py', PY_UNBOUND)
  ok('S1 Query 形态被认出', s1 && s1.takesId && s1.forms.includes('Query'))
  ok('S2 未对齐判为未对齐', s1 && s1.aligned === false)
  const s2 = scanSource('b.py', PY_BOUND)
  ok('S3 用 Depends(require_request_user_id) 的文件判为已对齐', s2 === null || s2.aligned === true)
  const s3 = scanSource('c.py', PY_FIELD_UNBOUND)
  ok('S4 Pydantic Field 形态也必须被认出(只认 Query 会让整类 POST 隐身)', !!s3 && s3.forms.includes('Field'))
  ok('S5 Field-only 未对齐', s3 && s3.aligned === false)
  const s4 = scanSource('d.py', PY_BOTH_FORMS_BOUND)
  ok('S6 两形态同时在场要都记', s4 && s4.forms.includes('Query') && s4.forms.includes('Field'))
  ok('S7 该文件已对齐', s4 && s4.aligned === true)
  const s5 = scanSource('e.py', PY_COMMENTED_ALIGN)
  ok('S8 对齐出口只写在注释里 = 不算对齐(反向也要防:自称已拆实际没拆)', s5 && s5.aligned === false)
  ok('S9 不收 user_id 的文件返回 null(不产生噪声条目)', scanSource('f.py', 'def ping():\n    return 1\n') === null)
  const d1 = decide({ bindings: [s1], unbound: [s1], undetermined: [], strict: false, scannedFiles: 3 })
  const d2 = decide({ bindings: [s1], unbound: [s1], undetermined: [], strict: true, scannedFiles: 3 })
  ok('S10 默认档未对齐不判红(存量 >0 时 blocking = 恒红门)', d1.code === 0 && d1.unboundCount === 1)
  ok('S11 --strict 档未对齐即红(升级路径必须在位,否则永远升不上去)', d2.code === 1)
  const d3 = decide({ bindings: [], unbound: [], undetermined: ['x: 取不到内容'], strict: false })
  ok('S12 取不到内容判"无法判定"而非通过', d3.code === 2)
  ok('S13 枚举到 0 个被审文件判"无法判定"而非记绿(判据失明不是通过)', decide({ bindings: [], unbound: [], undetermined: [], strict: false, scannedFiles: 0 }).code === 2)
  ok('S13b 有文件但都不收 user_id ⇒ 正常通过(与空枚举区分开)', decide({ bindings: [], unbound: [], undetermined: [], strict: false, scannedFiles: 12 }).code === 0)
  const fwd = scanForwarders(() => `forwardAiService(reply, '/api/memory/save', jsonInit(parsed.data), (d) => d)`, ['v1.ts'])
  ok('S14 原样透传客户端 body 的转发面被列进清单', fwd.length === 1 && fwd[0].path === '/api/memory/save')
  const fwd2 = scanForwarders(() => `forwardAiService(reply, '/api/memory/x', jsonInit({ user_id: request.userId }), (d) => d)`, ['m.ts'])
  ok('S15 转发时已换成服务端身份的,不得进透传清单', fwd2.length === 0)
  const r = report({ bindings: [s1], unbound: [s1], forwards: fwd, undetermined: [], face: 'head', strict: false })
    .join('\n')
  ok('S16 报告必须同时含未对齐数与透传清单', /未对齐\*{0,2}\s*1/.test(r) && /透传/.test(r))
  let pass = 0
  for (const [n, v] of cases) {
    if (v) pass++
    else console.log(`  ✗ ${n}`)
  }
  console.log(`自检 ${pass}/${cases.length} 通过`)
  return pass === cases.length
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const face = argv.includes('--staged') ? 'staged' : argv.includes('--worktree') ? 'worktree' : 'head'
  const read = makeFaceReader(face)
  const files = listFiles(face, SCAN_GLOBS, ['py'])
  const fFiles = listFiles(face, FORWARD_GLOBS, ['ts'])
  const undetermined = []
  const bindings = []
  for (const rel of files) {
    let src
    try {
      src = read(rel)
    } catch (e) {
      undetermined.push(`${rel}: 取不到内容(${e.message?.slice(0, 40)})`)
      continue
    }
    const b = scanSource(rel, src)
    if (b) bindings.push(b)
  }
  const unbound = bindings.filter((b) => !b.aligned)
  let forwards = []
  for (const rel of fFiles) {
    try {
      forwards = forwards.concat(scanForwarders(() => read(rel), [rel]))
    } catch {
      /* 转发面是清单不是判据,取不到就不列,不因此判红 */
    }
  }
  const d = decide({ bindings, unbound, undetermined, strict, scannedFiles: files.length })
  if (json) console.log(JSON.stringify({ ...d, face, unbound: unbound.map((b) => b.file), forwards }, null, 2))
  else for (const l of report({ bindings, unbound, forwards, undetermined: d.undeterminedOut, face, strict })) console.log(l)
  process.exit(d.code)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
