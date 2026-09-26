// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门注册表插入器(把一道新门插进 scripts/guardian-runner.mjs 的检查集;常驻工具,不在提交链。
 * 2026-09-27 立,工程工具收口票。)
 *
 * 为什么在仓里(成因写死在头注,票面要求):收的是 wire-gate-r24 + fix-runner-block 两份,它们踩过三坑:
 *  ① **取号只认单引号形态**:wire-gate 用 /^\s*id: '(\d+)',/ 现读 HEAD blob 取 max+1 —— 若注册表里存在
 *     `id: "999"`(双引号),它既不算进"已占用"、产出的新块又与按 `id: '(\d+)'` 解析的一切判据
 *     (含守门 89 的撞号检测)互相隐身。现判据:取号同时认 `id: 'NN'` 与 `id: "NN"` 两种形态;
 *  ② **产出必须用仓内既有单引号风格**:wire-gate 用 JSON.stringify 生成字符串 ⇒ 整块双引号,
 *     由 fix-runner-block 整块重写善后(那次实测:双引号块"对一切按单引号解析的判据隐身")。
 *     现固定用手写单引号转义(jsQ),禁止 JSON.stringify;
 *  ③ **零损失判据 = 结构等值**,不是重复行计数(wire-gate 第一版把块内合法复用的 `  },`/空行
 *     算成"凭空多出 1322 条",整块从未落地成功)。落盘前再 `node --check` 自证语法 ——
 *     注册表坏了 = 整条 pre-commit 中止(守门 89 R8 记过同型崩点让 3 枚提交被迫 --no-verify)。
 * 底稿一律从当下 HEAD 现取(该文件的共享工作树副本实测滞后 HEAD 数十行,按工作树提交 = 一批守门静默摘线)。
 *
 * CLI 契约(env 驱动):
 *  GATE_LABEL     必填,label 字段(长描述)
 *  GATE_SCRIPT    必填,runner 的 script 字段(如 check-foo.mjs)
 *  GATE_SKIP_ENV  必填,skipEnv 字段(如 HUSKY_SKIP_FOO)
 *  GATE_SECTION   可选,块抬头注释用的短名(缺省 = 整条 GATE_LABEL,不做 slice 截断 —— wire-gate
 *                 的 slice(0,24) 曾把注释截成半句,由 fix-runner-block 善后)
 *  GATE_TRIGGERS  可选,`;` 分隔的 stagedTriggers
 *  GATE_HINT      可选,多行 onFailHint(每行一条,行间以 \n 连接)
 *  GATE_MSG       可选,提交信息(缺省 "feat(gates): 新守门 <script> 接进提交链")
 *  GATE_TARGET    可选,目标注册表路径(缺省 scripts/guardian-runner.mjs;测试通道)
 *  GATE_ROOT      测试/换仓通道:仓库根(缺省 = 本脚本所在仓根)
 * 退出码:0 = 已落地且回读证明单引号 id 行在位(stdout 最后一行只打新 id,便于接力);
 *        1 = 业务拒绝(锚点缺失/不止一处 / 结构等值不成立 / node --check 不过 / CAS 未抢到 / 回读缺失或见双引号残留 / 索引锁龄超上限);
 *        2 = 用法或环境错(缺必填 env / 根不可当仓库问)。
 *
 * ⚠️ 本工具只**插块**,不改 runner 其余任何行;它自己不是守门,头注不得声称"已接提交链"。
 */

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

import {
  ABSENT,
  alignSharedIndex,
  casUpdateRef,
  commitTreeWithIndex,
  git,
  headBlobOf,
  resolveHeadRef,
  sameLines,
  writeBlob,
} from './lib/bypass-git.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const MAX_CAS_ATTEMPTS = 12
const DEFAULT_TARGET = 'scripts/guardian-runner.mjs'
const ANCHOR_RE = /^\s*\/\/ --- info \(1 项\) ---\s*$/
const ID_RE = /^\s*id:\s*(['"])(.*?)\1[,\s]*$/

const norm = (s) => s.replace(/\r\n/g, '\n')

/** 单引号 JS 字符串字面量(仓内风格);禁止 JSON.stringify —— 那会产出双引号形态(见头注 ②)。 */
export function jsQ(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r')}'`
}

/** 从注册表全文取号:数字 id 的最大值 + 1;**单引号与双引号两种形态都算已占用**。 */
export function nextIdOf(text) {
  const used = []
  for (const m of text.matchAll(new RegExp(ID_RE, 'gm'))) {
    if (/^\d+$/.test(m[2])) used.push(Number(m[2]))
  }
  const dupes = used.filter((v, i) => used.indexOf(v) !== i)
  return { nextId: String((used.length ? Math.max(...used) : 0) + 1), used: used.length, dupes }
}

/** 生成注册块(行数组),形态与仓内既有块逐字同形(单引号、label 换行缩进 6、onFailHint join)。 */
export function buildEntry({ id, section, label, script, skipEnv, triggers = [], hint = [] }) {
  return [
    `  // --- ${section}(1 项,blocking)---`,
    '  {',
    `    id: ${jsQ(id)},`,
    '    label:',
    `      ${jsQ(label)},`,
    `    script: ${jsQ(script)},`,
    '    args: [],',
    "    mode: 'blocking',",
    `    skipEnv: ${jsQ(skipEnv)},`,
    triggers.length > 0 ? `    stagedTriggers: [${triggers.map((t) => jsQ(t)).join(', ')}],` : '    stagedTriggers: [],',
    '    onFailHint: [',
    "      '',",
    ...hint.map((l) => `      ${jsQ(l)},`),
    "      '',",
    "    ].join('\\n'),",
    '  },',
    '',
  ]
}

/**
 * 组装 + 结构等值自证(唯一的零损失判据,禁止重复行计数):
 * next == base[0..anchorIdx) ⊕ entry ⊕ base[anchorIdx..)。锚点必须恰好一处。
 */
export function spliceInto(baseLines, entry, anchorRe = ANCHOR_RE) {
  const hits = baseLines.map((l, i) => (anchorRe.test(l) ? i : -1)).filter((i) => i >= 0)
  if (hits.length !== 1) return { ok: false, reason: hits.length === 0 ? 'no-anchor' : `multi-anchor:${hits.length}` }
  const at = hits[0]
  const next = [...baseLines.slice(0, at), ...entry, ...baseLines.slice(at)]
  const headOk = sameLines(next.slice(0, at), baseLines.slice(0, at))
  const tailOk = sameLines(next.slice(at + entry.length), baseLines.slice(at))
  return { ok: headOk && tailOk, next, anchorAt: at }
}

/** `node --check` 自证语法(注册表坏了 = 整条 pre-commit 中止,必须在写盘之前判)。 */
export function checkSyntax(file) {
  try {
    execFileSync(process.execPath, ['--check', file], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 8 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e?.stderr ?? e?.message ?? e).split(/\r?\n/)[0] }
  }
}

export function readGateArgs(env = process.env) {
  const root = env.GATE_ROOT ? resolve(env.GATE_ROOT) : REPO_ROOT
  const target = env.GATE_TARGET || DEFAULT_TARGET
  const label = env.GATE_LABEL ?? ''
  const script = env.GATE_SCRIPT ?? ''
  const skipEnv = env.GATE_SKIP_ENV ?? ''
  const section = env.GATE_SECTION || label
  const triggers = String(env.GATE_TRIGGERS ?? '').split(';').map((s) => s.trim()).filter(Boolean)
  const hint = String(env.GATE_HINT ?? '').split('\n').map(norm).filter((l) => l.trim() !== '')
  const msg = env.GATE_MSG || `feat(gates): 新守门 ${script} 接进提交链`
  if (!label || !script || !skipEnv) return { error: '缺 GATE_LABEL / GATE_SCRIPT / GATE_SKIP_ENV ⇒ 拒绝执行' }
  if (!resolveHeadRef({ root })) return { error: `${root} 不是可用仓库(HEAD 不可解析或 detached)⇒ 无法判定,不落` }
  return { root, target, label, script, skipEnv, section, triggers, hint, msg }
}

async function main() {
  const a = readGateArgs()
  if (a.error) {
    console.error(`❌ ${a.error}`)
    process.exit(2)
  }
  const { root, target, label, script, skipEnv, section, triggers, hint, msg } = a

  let landed = ''
  let parentSha = ''
  let newId = ''
  let dblBefore = 0
  for (let attempt = 1; attempt <= MAX_CAS_ATTEMPTS; attempt++) {
    const head = git(['rev-parse', 'HEAD'], { root })
    if (headBlobOf(head, target, { root }) === ABSENT) {
      console.error(`❌ ${target} 不在 HEAD 里 ⇒ 注册表本体缺席,不猜,拒绝落地`)
      process.exit(1)
    }
    const baseLines = norm(git(['show', `${head}:${target}`], { root, raw: true })).split('\n')
    // 存量双引号 id 行(别人欠的债)只登记基线数 —— 判据是"我没新加",不是"整文件为零";
    // 按"为零"判会把不相干的历史存量变成对本人提交的恒红拦阻(§12e 同型)。
    dblBefore = baseLines.filter((l) => l.includes('id: "')).length
    const taken = nextIdOf(baseLines.join('\n'))
    newId = taken.nextId
    if (taken.dupes.length > 0) {
      console.log(`⚠️ HEAD 版 runner 已有重复数字 id(与本票无关,先登记):${[...new Set(taken.dupes)].join(', ')} ⇒ 请人工裁决后再插号`)
    }
    const entry = buildEntry({ id: newId, section, label, script, skipEnv, triggers, hint })
    // 生成块自身必须是单引号风格(本票立项那一型的正向锁):块里出现 `id: "` 直接拒,不写盘
    if (entry.some((l) => l.includes('id: "')) || !entry.includes(`    id: ${jsQ(newId)},`)) {
      console.error('❌ 生成的注册块不是单引号 id 形态 ⇒ 内部错位,拒绝落地')
      process.exit(1)
    }
    const built = spliceInto(baseLines, entry)
    if (!built.ok) {
      console.error(
        built.reason === 'no-anchor'
          ? '❌ 找不到 info 段锚点 ⇒ 注册表结构已漂,拒绝凭猜插入'
          : String(built.reason).startsWith('multi-anchor')
            ? `❌ info 段锚点不止一处(${built.reason})⇒ 不猜,拒绝写盘`
            : '❌ 新内容不等于"HEAD ⊕ 本块插入"⇒ 拒绝写盘',
      )
      process.exit(1)
    }
    const text = built.next.join('\n')
    const scratch = mkScratch('gate-insert-')
    let blob
    try {
      const f = join(scratch, 'runner.candidate.mjs')
      writeFileSync(f, text, { encoding: 'utf8' })
      const syn = checkSyntax(f)
      if (!syn.ok) {
        console.error(`❌ 新 runner 语法不通过,拒绝落地:${syn.error}`)
        process.exit(1)
      }
      blob = writeBlob(text, { root })
    } finally {
      rmScratch(scratch)
    }
    const { commit } = commitTreeWithIndex({ root, parent: head, message: msg, entries: [{ path: target, blob }], baseRef: head })
    if (casUpdateRef(commit, head, { root })) {
      landed = commit
      parentSha = head
      console.log(`✅ 第 ${attempt} 次 CAS 成功 id=${newId} HEAD=${commit}`)
      break
    }
    console.log(`⚠️ 第 ${attempt} 次 CAS 失败(别人先推进了 HEAD),按当下 HEAD 重新取号重试`)
  }
  if (landed === '') {
    console.error(`❌ ${MAX_CAS_ATTEMPTS} 次均未抢到 CAS,主索引未动`)
    process.exit(1)
  }

  // 回读:单引号 id 行必须在位、脚本名必须在位、双引号 id 形态**不得因本块增加**
  // (基线数 dblBefore 由每轮尝试现读 —— 别人的历史双引号行只随它去,判据盯"我加了几条")
  const now = norm(git(['show', `${landed}:${target}`], { root, raw: true }))
  const idLine = `    id: ${jsQ(newId)},`
  const present = now.split('\n').filter((l) => l === idLine).length
  const doubleQuote = now.split('\n').filter((l) => l.includes('id: "')).length
  const scriptOk = now.includes(`    script: ${jsQ(script)},`)
  if (present !== 1 || !scriptOk || doubleQuote > dblBefore) {
    console.error(`❌ 回读不符:id 单引号行 ${present} 处(应 1)/ script 在位=${scriptOk} / 双引号 id ${doubleQuote} 处(基线 ${dblBefore},不得增加)`)
    process.exit(1)
  }
  console.log(`✅ 回读:id 行单引号在位 1 处 / 双引号 id 增量 0(基线 ${dblBefore})/ script 行在位`)

  const align = alignSharedIndex({ root, paths: [target], parentRef: parentSha })
  if (align.lockAbandoned) {
    console.error('❌ .git/index.lock 锁龄超上限:不代删别人的锁,请人工确认持有者后重跑')
    process.exit(1)
  }
  if (align.failed) {
    console.error(`❌ 索引对齐未完成:${align.error ?? '轮次耗尽'}`)
    process.exit(1)
  }
  console.log(`✅ 主索引已对齐 ${align.moved.length + align.already.length}/1 路径(移动 ${align.moved.length} / 已就位 ${align.already.length})`)
  for (const s of align.skipped) console.log(`⚠️ 未动(归属他人):${s.path}(${s.reason})`)
  for (const u of align.undetermined) console.log(`⚠️ 未判定:${u.path}(${u.reason})`)
  console.log(newId)
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { jsQ, nextIdOf, buildEntry, spliceInto, checkSyntax, readGateArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
