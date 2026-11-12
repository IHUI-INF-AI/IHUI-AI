// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-worktree-dev-banned.mjs —— worktree 开发隔离停用·防回归守门(§12d,2026-11-12 机主定案)
 *
 * 用法:
 *   node scripts/check-worktree-dev-banned.mjs            # 审判两个 create 出口仍处拒绝态(默认 strict)
 *   node scripts/check-worktree-dev-banned.mjs --json     # 机读输出
 *   node scripts/check-worktree-dev-banned.mjs --self-test # 自检(含阴性对照,验证判据真能判红)
 *
 * 退出码:
 *   0 = 两出口均仍处拒绝态(合规)
 *   1 = 发现 create 出口被改回可真建检出(违规,blocking)
 *   2 = 未判定(源文件读不到等)
 *
 * 判据(源码静态扫描,绝不真跑 create):
 *   agent-worktree.mjs   `if (has('--create'))` 块体必须含 EXIT_REFUSED 且不含 worktree add 真调用;
 *                        该入口字面量不得消失(整段删掉 = 可绕过)。
 *   worktree-isolate.mjs `cmd === 'new'` 分支必须含 EXIT_REFUSED 且不含 newWorktree( 真建树调用;
 *                        该分支字面量不得消失。
 *
 * 射程说明:本门只锁"开发用 create/new"两出口。§12d 明文豁免的两类不误伤 ——
 *   ① isolated-git.mjs(§12i pathspec 级私有索引隔离,非 worktree);
 *   ② safe-commit / sync-cross-end-cascade / close-merge-reconcile 为判据对拍建的临时派生检出
 *      (git worktree add --detach 到 scratch,用完即 prune)。本门只读上述两个文件的对应块。
 */
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { selectFace } from './lib/face-reader.mjs'
import { readFaceBatch } from './lib/gate-face.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const EXIT_OK = 0
export const EXIT_VIOLATION = 1
export const EXIT_UNKNOWN = 2

const TARGETS = {
  agentWorktree: { rel: 'scripts/agent-worktree.mjs', entry: "if (has('--create'))", kind: 'create' },
  worktreeIsolate: { rel: 'scripts/worktree-isolate.mjs', entry: "cmd === 'new'", kind: 'new' },
}

/** 从 openBraceIdx 的 `{` 起做大括号平衡(跳过字符串/模板/注释),返回闭合 `}` 的索引;失配返回 -1 */
export function scanBlock(src, openBraceIdx) {
  if (src[openBraceIdx] !== '{') return -1
  let depth = 0
  let i = openBraceIdx
  let state = 'normal'
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (state === 'normal') {
      if (c === '/' && n === '/') state = 'line'
      else if (c === '/' && n === '*') { state = 'block'; i += 2; continue }
      else if (c === "'") state = 'sq'
      else if (c === '"') state = 'dq'
      else if (c === '`') state = 'tpl'
      else if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) return i }
    } else if (state === 'line') {
      if (c === '\n') state = 'normal'
    } else if (state === 'block') {
      if (c === '*' && n === '/') { state = 'normal'; i += 2; continue }
    } else if (state === 'sq') {
      if (c === '\\') i++
      else if (c === "'") state = 'normal'
    } else if (state === 'dq') {
      if (c === '\\') i++
      else if (c === '"') state = 'normal'
    } else if (state === 'tpl') {
      if (c === '\\') i++
      else if (c === '`') state = 'normal'
    }
    i++
  }
  return -1
}

/** 取 entry 字面量所在 if 块的块体(含边界大括号之间的内容) */
export function blockBodyOf(src, entryLiteral) {
  const i = src.indexOf(entryLiteral)
  if (i < 0) return { found: false, body: '', line: 0 }
  const ob = src.indexOf('{', i)
  if (ob < 0) return { found: false, body: '', line: 0 }
  const cb = scanBlock(src, ob)
  if (cb < 0) return { found: false, body: '', line: 0 }
  return { found: true, body: src.slice(ob, cb + 1), line: src.slice(0, i).split('\n').length }
}

/** judge agent-worktree.mjs:--create 块必须仍处拒绝态 */
export function judgeAgentWorktree(src) {
  const findings = []
  const { found, body, line } = blockBodyOf(src, TARGETS.agentWorktree.entry)
  if (!found) {
    findings.push({ file: TARGETS.agentWorktree.rel, line: 0, reason: "--create 入口消失(可能被整段删掉 ⇒ 绕过 §12d)" })
    return { ok: false, findings }
  }
  if (!body.includes('EXIT_REFUSED')) {
    findings.push({ file: TARGETS.agentWorktree.rel, line, reason: "--create 块不再拒绝(EXIT_REFUSED 摘线)" })
  }
  if (/\bworktree\s+add\b/.test(body) || body.includes("git(['worktree','add'")) {
    findings.push({ file: TARGETS.agentWorktree.rel, line, reason: "--create 块出现 worktree add 真调用" })
  }
  return { ok: findings.length === 0, findings }
}

/** judge worktree-isolate.mjs:new 分支必须仍处拒绝态 */
export function judgeWorktreeIsolate(src) {
  const findings = []
  const { found, body, line } = blockBodyOf(src, TARGETS.worktreeIsolate.entry)
  if (!found) {
    findings.push({ file: TARGETS.worktreeIsolate.rel, line: 0, reason: "'new' 命令分支消失(可能被整段删掉 ⇒ 绕过 §12d)" })
    return { ok: false, findings }
  }
  if (!body.includes('EXIT_REFUSED')) {
    findings.push({ file: TARGETS.worktreeIsolate.rel, line, reason: "'new' 分支不再拒绝(EXIT_REFUSED 摘线)" })
  }
  if (body.includes('newWorktree(')) {
    findings.push({ file: TARGETS.worktreeIsolate.rel, line, reason: "'new' 分支改回调 newWorktree(真建树)" })
  }
  return { ok: findings.length === 0, findings }
}

export function buildArgs(argv) {
  return { selfTest: argv.includes('--self-test'), json: argv.includes('--json') }
}

function runSelfTest() {
  let pass = 0
  const assert = (cond, msg) => { if (!cond) throw new Error(`self-test 失败:${msg}`); pass++ }

  // 工具层
  const fake = "function f(){ if(x){ deep() } }"
  const ob = fake.indexOf('{')
  assert(scanBlock(fake, ob) === fake.lastIndexOf('}'), 'scanBlock 应跳过内层块平衡到最外闭合')
  assert(scanBlock("const s='}nope'", 0) === -1, 'scanBlock 非 { 起点返回 -1')
  const strCase = "const s='}nope'; if(a){b()}"
  const strOb = strCase.indexOf('{')
  assert(
    scanBlock(strCase, strOb) > strOb && scanBlock(strCase, strOb) !== -1,
    'scanBlock 应忽略字符串里的 }(返回真实闭合位,不是 -1)',
  )

  // 阳性:现读真实源码
  const awSrc = readFileSync(join(ROOT, TARGETS.agentWorktree.rel), 'utf8')
  const wiSrc = readFileSync(join(ROOT, TARGETS.worktreeIsolate.rel), 'utf8')
  assert(judgeAgentWorktree(awSrc).ok, 'agent-worktree --create 现应为拒绝态')
  assert(judgeWorktreeIsolate(wiSrc).ok, 'worktree-isolate new 现应为拒绝态')

  // 阴性对照改用最小伪造源码喂 judge(不依赖真实源码的精确空白,稳健):
  // 阴性 A:agent-worktree --create 块改回真建检出(worktree add)
  const fakeAW = "if (has('--create')) {\n  git(['worktree','add','-b',br,p,base])\n  return\n}\nif (has('--remove')) {\n}"
  const jA = judgeAgentWorktree(fakeAW)
  assert(!jA.ok, '阴性A:agent-worktree 改回 worktree add 应判红')
  assert(jA.findings.some((f) => /worktree add/.test(f.reason)), '阴性A 应点名 worktree add')

  // 阴性 A2:块体只是摘掉 EXIT_REFUSED、但没建树(空操作)⇒ 仍应红(拒绝态被摘线)
  const fakeAW2 = "if (has('--create')) {\n  console.log('creating')\n  return\n}"
  const jA2 = judgeAgentWorktree(fakeAW2)
  assert(!jA2.ok, '阴性A2:摘掉 EXIT_REFUSED 应判红')

  // 阴性 B:worktree-isolate new 改回调 newWorktree(真建树)
  const fakeWI = "if (cmd === 'new') {\n  return (await newWorktree({slug})).exit\n}\nif (cmd === 'land') {\n}"
  const jB = judgeWorktreeIsolate(fakeWI)
  assert(!jB.ok, '阴性B:worktree-isolate 改回 newWorktree 应判红')
  assert(jB.findings.some((f) => /newWorktree/.test(f.reason)), '阴性B 应点名 newWorktree')

  // 阴性 C:入口字面量删掉
  const negC = awSrc.replace("if (has('--create'))", "if (has('--create-disabled'))")
  const jC = judgeAgentWorktree(negC)
  assert(!jC.ok, '阴性C:--create 入口消失应判红')
  assert(jC.findings.some((f) => /入口消失/.test(f.reason)), '阴性C 应点名入口消失')

  // 阴性 D:new 分支摘掉 EXIT_REFUSED 摘线(仍不调 newWorktree,但拒绝态被摘)⇒ 应红
  const fakeWID = "if (cmd === 'new') {\n  console.log('ok')\n}\nif (cmd === 'land') {\n}"
  const jD = judgeWorktreeIsolate(fakeWID)
  assert(!jD.ok, '阴性D:摘掉 EXIT_REFUSED 应判红')

  console.log(`self-test 通过: ${pass} 项断言(含 4 个阴性对照)`)
  return EXIT_OK
}

function main() {
  const argv = process.argv.slice(2)
  const { selfTest, json } = buildArgs(argv)
  if (selfTest) process.exit(runSelfTest())

  // 判面层:默认 HEAD 面(全量审计);--staged 判索引面;--worktree 仅人工逃生舱。
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 未判定:${error}`)
    process.exit(EXIT_UNKNOWN)
  }

  // 同面同轮取满两份被审源文件(经认证取材层 readFaceBatch),取不到一律 exit 2 不回落另一面。
  const rels = Object.values(TARGETS).map((t) => t.rel)
  let blobs
  try {
    blobs = readFaceBatch(ROOT, face, rels)
  } catch (e) {
    console.error(`❌ 未判定:取材失败(${face} 面) ${e.message}`)
    process.exit(EXIT_UNKNOWN)
  }

  let allOk = true
  const report = {}
  for (const key of Object.keys(TARGETS)) {
    const t = TARGETS[key]
    const src = blobs.get(t.rel)
    if (src === null || src === undefined) {
      console.error(`❌ 未判定:${face} 面读不到 ${t.rel}`)
      process.exit(EXIT_UNKNOWN)
    }
    const r = key === 'agentWorktree' ? judgeAgentWorktree(src) : judgeWorktreeIsolate(src)
    report[t.rel] = r
    if (!r.ok) {
      allOk = false
      for (const f of r.findings) console.error(`🚧 [§12d] ${f.file}:${f.line} ${f.reason}`)
    }
  }
  if (json) {
    console.log(JSON.stringify(report, null, 2))
    process.exit(allOk ? EXIT_OK : EXIT_VIOLATION)
  }
  if (allOk) {
    console.log(`✅ [§12d] 两个 worktree 开发 create 出口均仍处拒绝态(合规;判面=${face})`)
    process.exit(EXIT_OK)
  }
  console.error('🚧 [§12d] worktree 开发隔离停用被破坏 —— 有人把 create 出口改回了可真建检出。')
  console.error('   §12d(2026-11-12 机主定案):本项目禁止用 git worktree 做并行开发隔离(合并收尾成本过高)。')
  console.error('   合法改法:先由机主撤销 §12d 条款并同步改判据,不得绕门。')
  console.error('   单独复现:node scripts/check-worktree-dev-banned.mjs')
  console.error('   应急放行:HUSKY_SKIP_WORKTREE_DEV_BANNED=1 git commit(commit message 写明责任归属)')
  process.exit(EXIT_VIOLATION)
}

export const __test__ = { scanBlock, blockBodyOf, judgeAgentWorktree, judgeWorktreeIsolate, buildArgs }

const isMain = process.argv[1] && normalize(process.argv[1]) === normalize(fileURLToPath(import.meta.url))
if (isMain) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
