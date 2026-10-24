#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:apps/api 身份主体取值的单一真相源对账(2026-10-25 立)。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,blocking,
 * skipEnv = HUSKY_SKIP_IDENTITY_PRINCIPAL_SOURCE,stagedTriggers = apps/api/src/)。
 *
 * —— 立因(不是假设,是这一枚实测出来的)——
 * `apps/api/src/routes/crew.ts` 的 requireAuthUser 读 `req.user?.userId`,
 * `knowledge-rag.ts` 八处读 `(req.user as { userId? })?.userId`。而
 * · @fastify/jwt 把 `request.user` `decorateRequest(name, null)`(index.js:173/186),
 * · 本仓 authenticate() 走 jose 校验,只写 `request.userId` / `request.jwtPayload`
 *   (plugins/auth.ts:115/211),全仓对 `request.user` **零生产赋值点**、且从不调 jwtVerify()
 * ⇒ 这些读数**恒为 undefined/null**,于是:
 * · crew:13 个端点整体退化为"采信客户端自报 userId",`GET /sessions` 因
 *   orchestrator.listSessions('') 不拼 where ⇒ 返回**全员**会话;
 * · knowledge:`resolveOwner(undefined, paramOwner)` 永远走 paramOwner 分支 ⇒
 *   匿名调用按任意 ownerUuid 读/删他人知识库。
 * 两族注册时(server.register(..., {prefix}))均无鉴权 preHandler;server.ts:276 的
 * onRoute 只注入网络分段 config,**不注入鉴权** —— 所以这不是"有门看不见",是根本没有门。
 *
 * 同一族早在 2026-08-06 就发生过一次并修过一处(openclaw-routes.ts:169 的注释原文即
 * "读取 request.user 恒为 undefined → 所有用户塌缩为 'anonymous' → 跨用户读写删 IDOR"),
 * 当时只修那一个点、没装闸,于是同族在两处静默复发 15 个月。本门就是把那一族的出口焊死。
 *
 * —— 三条判据 ——
 * W1 身份取自第二名字(绝对零容忍,存量已由本枚归零):
 *    生产面把 `req|request|reply.request` 的 `.user` 当主体用 —— 即其后接
 *    `.userId` / `?.userId`,或整体 cast 成含 `userId` 的形状。
 *    合法对照:`body.user` / `norm.user = req.user`(OpenAI 请求体的 user 参数,
 *    是**透传给上游的字符串**,不是登录主体)不命中,因为判据要求"取到 userId 那一层"。
 * W2 主体取值链里混进客户端自报字段(差值棘轮,锚点 = 该文件在锚点面的自身存量):
 *    一个 `??` / `||` 链的两端,一端是客户端容器(body|data|query|payload|params|rest|
 *    metadata|form|input|args|opts|options 及 req/request 的 body/query/params 子路径)
 *    的身份字段,另一端是令牌主体(request.userId / authUser / principal...)——
 *    **两个方向都算**:客户端在前等于直接越权,令牌在前等于"未挂鉴权时静默改用客户端值"。
 *    为什么不一开始就零容忍:回查现读存量 >0(其中 agent-extended.ts:578 是已论证、
 *    顶层已挂 requireAuth 的合法暂留),按 §12e 升 blocking 的前置是存量归零,故本维只拦增量。
 * W3 测试夹具给生产从不填充的字段赋值(绝对零容忍,存量已由本枚归零):
 *    `__tests__` 里 `request.user = ...` / `req.user = ...` —— 它把测试接上一条生产走不到
 *    的路径,用例绿而线上恒空(§22c 判据单源的反面:oracle 也不能双源)。
 *
 * —— 取材面纪律(§0.4)——
 * 全量档判 HEAD blob、`--staged` 判索引 blob、`--worktree` 仅人工逃生舱;清单与内容同面同轮;
 * 两面旗同给 ⇒ exit 2;取不到被审面 ⇒ exit 2 显式「未判定」,不记绿也不冒红(§0.3);
 * 枚举到 0 个候选文件 ⇒ 判死,exit 2。
 *
 * 用法:node scripts/check-identity-principal-source.mjs [--staged|--worktree] [--json]
 *       node scripts/check-identity-principal-source.mjs --self-test
 * 退出码:0 = 无判红 / 1 = 判红 / 2 = 未判定(面旗矛盾、取材失败、候选为 0)
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// 遮罩只有一台(§横向口径):静态 import,不留"库式调用方拿到未遮罩判据"这条暗道 ——
// 异步懒加载曾在镜像测试里当场暴露过这一型。
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE = 'apps/api/src'

/** 身份字段名(客户端容器里出现的即视为"自报主体")。 */
const IDENTITY_FIELD = String.raw`(?:userId|userUuid|ownerUuid|ownerId|subjectId|principalId|operatorId|user_id)`
/** 客户端可控容器(其 `.userId` 属自报身份)。`b`/`q` 是本仓 route 里 body/query 的惯用短别名。 */
const CLIENT_ROOT = String.raw`(?:b|q|body|data|query|payload|params|rest|metadata|form|input|args|opts|options|req\.body|request\.body|req\.query|request\.query|req\.params|request\.params)`
/** 令牌主体侧读数(auth 层唯一注入点及其别名)。 */
const TOKEN_ROOT = String.raw`(?:req|request|reply\.request)\.userId|authUser|principalUserId|principal|tokenUserId`

/**
 * W1:身份取自 auth 层从不填充的第二名字 `request.user`。
 * 先按 §横向口径遮注释与字符串(判代码结构 ⇒ 两族都遮),否则本门会把
 * crew.ts / knowledge-rag.ts 里"立因说明"那几行注释读成违规 —— 那是会自我咬死的形式。
 */
function judgeW1(src) {
  const code = maskForJudge(src)
  const hits = []
  const re = new RegExp(
    String.raw`(req|request|reply\.request|rq)(\.user)(\?\.|\.)\s*(?:userId\b)` +
      String.raw`|(req|request|rq)(\.user)\s+as\s+\{[^}]*\buserId\b`,
    'g',
  )
  for (const m of code.matchAll(re)) {
    hits.push({ at: m.index, text: snippet(src, m.index) })
  }
  return hits
}

/**
 * W2:主体取值 = 客户端自报字段 与 令牌主体 的同一条 ?? / || 链。
 * 逐行判(链不会跨行),对每个匹配再要求"链左是客户端侧、链右是令牌侧"或反之。
 */
function judgeW2(src) {
  const code = maskForJudge(src)
  const hits = []
  const clientSide = new RegExp(String.raw`\b(?:${CLIENT_ROOT})\s*(?:\?\.)?\.(?:${IDENTITY_FIELD})\b`)
  const tokenSide = new RegExp(String.raw`(?:${TOKEN_ROOT})\b`)
  const lines = code.split('\n')
  const orig = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 具名出口:`isSystemAdmin(req, {includeInternalChannel:false})` 显式特权判定 —— 客户端
    // 参数只在"管理员"这一支参与,不构成越权(本门错误信息指定的正是这条出口)。
    // 收窄到同一行、且必须是具名谓词:换成 ?? 链把特权判定藏起来仍然会被判红。
    if (/isSystemAdmin\s*\(/.test(line)) continue
    if (!/\?\?|\|\|/.test(line)) continue
    // 整行双端探测(不以"身份词"当链起点):`const u = q.userId || authUser` 里变量名
    // 不含 userId,按链起点扫会整条漏判 —— 客户端自报与令牌主体出现在同一条 ??/|| 链即违规,
    // 两个方向都算(客户端在前=直接越权;令牌在前=未挂鉴权时静默改用客户端值)。
    if (clientSide.test(line) && tokenSide.test(line))
      hits.push({ line: i + 1, text: (orig[i] ?? line).trim().slice(0, 140) })
  }
  return hits
}

/** W3:测试夹具给生产从不填充的字段赋值。 */
function judgeW3(src) {
  const code = maskForJudge(src)
  const hits = []
  const re = new RegExp(String.raw`(?:req|request)\.user\s*=[^=]`, 'g')
  for (const m of code.matchAll(re)) hits.push({ at: m.index, text: snippet(src, m.index) })
  return hits
}

function maskForJudge(src) {
  return maskCommentsAndStrings(src)
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length
}
function snippet(src, idx) {
  const start = src.lastIndexOf('\n', idx) + 1
  return src.slice(start, src.indexOf('\n', idx) < 0 ? undefined : src.indexOf('\n', idx)).trim().slice(0, 120)
}

/** git 调用一律显式接管 stdio(§12g),并按 input 决定 stdin 档位。 */
function git(args, opts = {}) {
  const stdio = opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio, timeout: 60_000 })
}

/** 被审面清单与内容同源(§0.4):head → HEAD blob;staged → 索引 blob;worktree → 人工逃生舱。 */
function faceSpecs(face) {
  if (face === 'head') {
    const r = git(['ls-tree', '-r', '--name-only', 'HEAD', '--', SCOPE])
    if (r.status !== 0) return { err: `ls-tree 失败: ${r.stderr.trim()}` }
    return { files: r.stdout.split('\n').filter((f) => f.endsWith('.ts')) }
  }
  if (face === 'staged') {
    const r = git(['ls-files', '-s', '--', SCOPE])
    if (r.status !== 0) return { err: `ls-files 失败: ${r.stderr.trim()}` }
    return {
      files: r.stdout
        .split('\n')
        .filter(Boolean)
        .map((l) => l.split('\t').slice(1).join('\t'))
        .filter((f) => f.endsWith('.ts')),
    }
  }
  const r = git(['ls-files', '--', SCOPE])
  if (r.status !== 0) return { err: `ls-files 失败: ${r.stderr.trim()}` }
  return { files: r.stdout.split('\n').filter((f) => f.endsWith('.ts')), worktree: true }
}

function readFace(face, file) {
  if (face === 'worktree') {
    const p = path.join(ROOT, file)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  }
  const rev = face === 'staged' ? ':' : 'HEAD:'
  const r = git(['show', `${rev}${file}`])
  return r.status === 0 ? r.stdout : null
}

async function collect(face, files) {
  const findings = []
  const stock = []
  const undetermined = []
  let unreadable = 0
  for (const file of files) {
    const src = readFace(face, file)
    if (src === null) {
      unreadable++
      continue
    }
    const isTest = /[\\/]__tests__[\\/]|\.test\.ts$/.test(file)
    if (!isTest) {
      for (const h of judgeW1(src))
        findings.push({ dim: 'W1', file, line: lineOf(src, h.at), text: h.text })
      // W2 差值棘轮:锚点 = 该文件在锚点面自身的 W2 数(§0.5)。
      // 变多 ⇒ 本枚把新违规带进来 ⇒ 判红(逐条点名);持平或减少 ⇒ 存量只报数(§12e)。
      const cur = judgeW2(src)
      if (cur.length) {
        const anchor = await countW2AtAnchor(file)
        if (anchor.count === null) undetermined.push({ dim: 'W2', file, reason: `锚点面(${anchor.face})取不到` })
        else if (cur.length > anchor.count)
          for (const h of cur)
            findings.push({ dim: 'W2', file, line: h.line, text: h.text, anchor: anchor.count })
        else for (const h of cur) stock.push({ dim: 'W2', file, line: h.line, text: h.text, anchor: anchor.count })
      }
    } else {
      for (const h of judgeW3(src))
        findings.push({ dim: 'W3', file, line: lineOf(src, h.at), text: h.text })
    }
  }
  return { findings, stock, undetermined, unreadable }
}

/** 棘轮锚点:该文件在锚点面(HEAD 面判 HEAD^,索引面判 HEAD)上的 W2 数。取不到 ⇒ 未判定。 */
const anchorCache = new Map()
async function countW2AtAnchor(file) {
  const anchorFace = process.argv.includes('--staged') ? 'HEAD' : 'HEAD^'
  const key = `${anchorFace}:${file}`
  if (anchorCache.has(key)) return anchorCache.get(key)
  const rev = anchorFace === 'HEAD' ? 'HEAD:' : 'HEAD^:'
  const r = git(['show', `${rev}${file}`])
  const out =
    r.status === 0 ? { face: anchorFace, count: judgeW2(r.stdout).length } : { face: null, count: null }
  anchorCache.set(key, out)
  return out
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()

  const faceFlags = ['--staged', '--worktree'].filter((f) => argv.includes(f))
  if (faceFlags.length > 1) {
    console.error('❌ 两面旗同给(§0.4 禁止):不回落另一个面 ⇒ 未判定')
    return 2
  }
  const face = faceFlags[0] === '--staged' ? 'staged' : faceFlags[0] === '--worktree' ? 'worktree' : 'head'
  if (!existsSync(path.join(ROOT, 'scripts', 'lib', 'code-mask.mjs'))) {
    console.error('❌ 取不到 scripts/lib/code-mask.mjs(全仓唯一遮罩实现)⇒ 未判定,不降级裸判')
    return 2
  }
  const listed = faceSpecs(face)
  if (listed.err) {
    console.error(`❌ 被审面(${face})清单取不到:${listed.err} ⇒ 未判定`)
    return 2
  }
  if (listed.files.length === 0) {
    console.error(`❌ 被审面(${face})在 ${SCOPE} 枚举到 0 个候选 ⇒ 判死,不记绿`)
    return 2
  }

  const { findings, stock, undetermined, unreadable } = await collect(face, listed.files)
  const label = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(人工逃生舱)' }[face]
  const w2Files = new Set(stock.map((s) => s.file))
  console.log(`[identity-principal] 面=${label} 候选 ${listed.files.length} 个 / 取材失败 ${unreadable} 个`)
  for (const f of findings) console.log(`  ❌ ${f.dim} ${f.file}:${f.line}  ${f.text}`)
  if (stock.length) {
    console.log(`  ⚠ W2 存量(只报数,§12e 不逼跳门)${stock.length} 处 / ${w2Files.size} 个文件:`)
    for (const s of stock) console.log(`     ${s.file}:${s.line}  ${s.text}`)
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face, candidates: listed.files.length, unreadable, findings, stock, undetermined }))
  }
  if (unreadable > 0 || undetermined.length > 0) {
    for (const u of undetermined) console.error(`  ❓ ${u.dim} ${u.file} 未判定:${u.reason}(不记绿也不冒红)`)
    console.error(`❌ 取材失败 ${unreadable} 个 / 锚点未判定 ${undetermined.length} 个 ⇒ 未判定,不出具合格证`)
    return 2
  }
  if (findings.length) {
    console.error(
      `❌ 判红 ${findings.length} 处。出口:身份只读 request.userId(W1/W3)、` +
        `主体不得与客户端自报字段同链(W2);确需按 userId 代操作的一档,` +
        `走 isSystemAdmin(req, {includeInternalChannel:false}) 显式特权判定,而不是 ?? 链。`,
    )
    return 1
  }
  console.log(`✅ 无判红(W1 身份第二名字 0 / W3 假 oracle 0;W2 存量 ${stock.length} 处待清偿,只拦新增)`)
  return 0
}

/** 自检:每档各有成对夹具(命中夹具 + 合法对照),并锁"摘掉遮罩即误报"这一自我咬死形式。 */
function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })

  const w1Bad = `const authUser = (req.user as { userId?: string } | undefined)?.userId\n`
  const w1Bad2 = `  return req.user?.userId\n`
  const w1Good = `  const authUser = req.userId\n  if (req.user !== undefined) body.user = req.user\n`
  ok('W1 命中 cast 形态', judgeW1(w1Bad).length === 1)
  ok('W1 命中可选链形态', judgeW1(w1Bad2).length === 1)
  ok('W1 放过合法读数(含透传 body.user)', judgeW1(w1Good).length === 0)

  const w2a = `        userId: q.userId || authUser,\n`
  const w2b = `    const subjectId = request.userId ?? query.userId\n`
  const w2Good = `    const userId = request.userId\n`
  const w2Good2 = `    const targetUserId = body.userId\n`
  ok('W2 命中客户端在前', judgeW2(w2a).length === 1)
  ok('W2 命中令牌在前(未鉴权即静默改用客户端值)', judgeW2(w2b).length === 1)
  ok('W2 放过纯令牌读数', judgeW2(w2Good).length === 0)
  ok('W2 放过无链的纯客户端读数', judgeW2(w2Good2).length === 0)
  // 具名出口的成对夹具:同一行加了 isSystemAdmin 特权判定 ⇒ 不算;摘掉它 ⇒ 立刻算。
  const w2Admin = `    const userId = isSystemAdmin(req, ADMIN_JWT_ONLY) ? q.userId || '' : authUser\n`
  const w2NoAdmin = `    const userId = true ? q.userId || '' : authUser\n`
  ok('W2 放过 isSystemAdmin 显式特权分支', judgeW2(w2Admin).length === 0)
  ok('W2 摘掉具名谓词即翻红(出口不是白名单)', judgeW2(w2NoAdmin).length === 1)
  ok('W2 报表取原文而非遮罩后的文本', judgeW2(`const userId = q.userId || authUser // 说明\n`).every((h) => h.text.includes('authUser')))
  // 链起点盲区反向锁(2026-10-25 由镜像测试抓出):变量名里没有 userId 时,
  // 按"身份词起链"的旧扫法会整条漏判 —— 整行双端探测才咬得住。
  ok('W2 变量名不含身份词也必须抓到', judgeW2('        const u = q.userId || authUser\n').length === 1)
  ok('W2 同形但右侧是字面量的不算越权', judgeW2("        const u = q.userId || ''\n").length === 0)
  // 假阳反向锁:`q` 是 `req` 的子串,缺词边界时 req.userId 会被读成客户端自报
  // (实测把 rate-limit 的 req.userId || req.ip 也算成越权 ⇒ 噪声即缺陷)。
  ok('W2 不把 req.userId 里的 q 当客户端读数', judgeW2("  const u = req.userId ?? 'x'\n").length === 0)
  ok('W2 放过 rate-limit key 取 ip', judgeW2("  keyGenerator: (req) => req.userId || req.ip,\n").length === 0)

  const w3Bad = `    request.user = admin\n`
  const w3Good = `    request.userId = admin.userId\n    request.jwtPayload = admin\n`
  ok('W3 命中假 oracle', judgeW3(w3Bad).length === 1)
  ok('W3 放过按生产字段填充的夹具', judgeW3(w3Good).length === 0)

  // 反向锁(变异自证):三档成对 —— 摘掉 judge 内部的 maskForJudge 调用,
  // 第一档立刻翻红(注释里的 "req.user?.userId" 会被当成代码命中)。
  const commentOnly = `// 立因:此前读 req.user?.userId 恒为 undefined\nconst x = req.userId\n`
  ok('遮罩确实在生效(遮后≠原文)', maskForJudge(commentOnly) !== commentOnly)
  ok('W1 注释里的同形字面量不算命中', judgeW1(commentOnly).length === 0)
  ok('W1 真代码里的同形字面量必须算命中', judgeW1(`const y = req.user?.userId\n`).length === 1)

  let rc = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (!c.pass) rc = 1
  }
  console.log(`self-test ${cases.filter((c) => c.pass).length}/${cases.length}`)
  return rc
}

export const __test__ = { judgeW1, judgeW2, judgeW3, maskForJudge, SCOPE }

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
if (isDirectRun) {
  main()
    .then((rc) => process.exit(rc))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
