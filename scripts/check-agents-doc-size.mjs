#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * © 2026 智汇AI · 守门 207 —— AGENTS.md 体积守门(warn 起步)
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 立门因由:AGENTS.md 逐字注入每一轮对话。它长到 1.26MB / 3157 行时,新会话第 1 轮
 * 就占满上下文并被自动压缩 —— 强制规则看不见等于不存在。2026-10-14 压缩到 54.9KB /
 * 344 行(提交 e0f1fc316d),机主令把体积接进提交链防回潮。
 *
 * 为什么是 warn 而不是 blocking(§12e 恒红门禁令):判历史存量的门在存量归零前只能 warn。
 * 现读 HEAD 面 55,405 B > 预算 51,200 B ⇒ 存量 > 0。升 blocking 的前置 = 存量归零;
 * 注册条目(guardian-runner id '207')与本文件头注必须同值,改一边不改另一边 = 撒谎。
 *
 * 阈值出处(不自己发明数字):50KB 是仓内已写明的体积档 —— `scripts/check-project-plan-size.mjs`
 * 头注记着 2026-07-19 因"单次 Read 吃满上下文"立 50KB,2026-07-23 转 warn。本门**只判字节
 * 一个维度**,不另加"行数预算"这类第二维度:没有出处的数字就是凭感觉,而凭感觉的阈值会把
 * 一次正常的补登记读成违规。
 *
 * 取材口径(§0.4,与守门 70/77/83/98/101 同一条):全量档判 **HEAD blob**、`--staged` 判
 * **索引 blob**、`--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;取不到 ⇒ exit 2 显式
 * 「未判定」,既不记绿也不冒红。差值只作能见度:对 HEAD 面报 +/− 多少字节,HEAD 取不到
 * 就说取不到,**绝不把"不知道"当 0**。
 *
 * 用法:node scripts/check-agents-doc-size.mjs [--staged | --worktree] [--root <目录>] [--self-test]
 * 出口:0 在预算内 / 1 超预算(注册定级 warn ⇒ 只报警不拦)/ 2 未判定或用法错
 * ══════════════════════════════════════════════════════════════════════════
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  FACE_LABEL,
  Undetermined,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_LABEL = '[check-agents-doc-size]'

/** 被审文档(相对仓库根)。本门只管这一份,PROJECT_PLAN.md 由 96 号那族体积档管。 */
export const DOC_REL = 'AGENTS.md'
/** 50KB —— 出处见头注,不得在此另拍一个新数字。 */
export const BYTE_BUDGET = 50 * 1024

/**
 * 判决纯函数(镜像测试直接用它构造每一档,不靠真仓尺寸碰运气)。
 *
 * @param {{bytes:number, lines:number, headBytes?:number|null, budget?:number}} p
 *   headBytes = HEAD 面字节(取不到传 null ⇒ 不给差值)
 * @returns {{level:'green'|'warn'|'undetermined', text:string}}
 */
export function judgeSize({ bytes, lines, headBytes = null, budget = BYTE_BUDGET }) {
  if (!Number.isInteger(bytes) || bytes < 0 || !Number.isInteger(lines) || lines < 0) {
    return {
      level: 'undetermined',
      text: `量不出体积(bytes=${String(bytes)}, lines=${String(lines)})—— 未判定:既不记绿也不冒红`,
    }
  }
  const measured = `现读 ${bytes} B / ${lines} 行(预算 ${budget} B)`
  const trend = Number.isInteger(headBytes)
    ? `;对 HEAD 面(${headBytes} B)差值 ${bytes - headBytes >= 0 ? '+' : ''}${bytes - headBytes} B`
    : ';HEAD 面取不到 ⇒ 不给差值(不得当 0 用)'
  if (bytes > budget) {
    return {
      level: 'warn',
      text: `超预算 ${bytes - budget} B(${measured}${trend})`,
    }
  }
  return { level: 'green', text: `${measured}${trend} —— 在预算内` }
}

/**
 * 按面读被审文档正文。取不到一律抛 Undetermined(由 main 折成 exit 2),不静默回落另一个面。
 */
export function readDoc({ root, face }) {
  if (face === 'worktree') {
    const text = readWorktreeFile(root, DOC_REL)
    if (text === null) throw new Undetermined(`${FACE_LABEL.worktree} 没有 ${DOC_REL}`)
    return text
  }
  const spec = face === 'head' ? `HEAD:${DOC_REL}` : `:${DOC_REL}`
  const text = gitRaw(['show', spec], root)
  if (typeof text !== 'string') throw new Undetermined(`${FACE_LABEL[face]} 取不到 ${DOC_REL}`)
  return text
}

/** 字节与行数:行数按 LF 计(与 diff 口径一致),空文件算 0 行。 */
export function measure(text) {
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    lines: text.length === 0 ? 0 : text.split('\n').length,
  }
}

/**
 * 自检:每一档各有成对夹具(§"修复要带变异自证")。摘掉 budget 判别力 ⇒ 这里就该翻红,
 * 而不是让镜像测试只在"真仓恰好超预算"时才有意义。
 */
export function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })

  t('S1 预算内 ⇒ green', () => {
    const r = judgeSize({ bytes: 1000, lines: 10, headBytes: 1000, budget: 2000 })
    if (r.level !== 'green') throw new Error(`应 green,实得 ${r.level}`)
  })
  t('S2 恰好等于预算 ⇒ green(边界不判红)', () => {
    const r = judgeSize({ bytes: 2000, lines: 10, headBytes: 2000, budget: 2000 })
    if (r.level !== 'green') throw new Error(`边界应 green,实得 ${r.level}`)
  })
  t('S3 超预算 1 字节 ⇒ warn(判别力逐字节)', () => {
    const r = judgeSize({ bytes: 2001, lines: 10, headBytes: 2001, budget: 2000 })
    if (r.level !== 'warn') throw new Error(`应 warn,实得 ${r.level}`)
    if (!/超预算 1 B/.test(r.text)) throw new Error(`文案未点名超出量:${r.text}`)
  })
  t('S4 变胖 ⇒ 差值为正并写明', () => {
    const r = judgeSize({ bytes: 2500, lines: 10, headBytes: 2000, budget: 2000 })
    if (!/\+500 B/.test(r.text)) throw new Error(r.text)
  })
  t('S5 仍在预算外但比 HEAD 瘦 ⇒ 照报存量,不声称本次变坏', () => {
    const r = judgeSize({ bytes: 1800, lines: 10, headBytes: 2000, budget: 1500 })
    if (r.level !== 'warn') throw new Error(`应 warn,实得 ${r.level}`)
    if (!/-200 B/.test(r.text)) throw new Error(r.text)
  })
  t('S6 HEAD 取不到 ⇒ 明说"不给差值",不得当 0 用', () => {
    const r = judgeSize({ bytes: 100, lines: 1, headBytes: null, budget: 200 })
    if (!/不给差值/.test(r.text)) throw new Error(r.text)
    if (/对 HEAD 面/.test(r.text)) throw new Error(`写出了 HEAD 差值:${r.text}`)
    if (/\+\d+ B/.test(r.text)) throw new Error(`把"不知道"算成了增量:${r.text}`)
  })
  t('S7 量不出(bytes 非整数)⇒ undetermined,不是 green 也不是 warn', () => {
    for (const bad of [undefined, null, NaN, 1.5, -1]) {
      const r = judgeSize({ bytes: bad, lines: 1, budget: 200 })
      if (r.level !== 'undetermined') throw new Error(`bytes=${String(bad)} 应 undetermined,实得 ${r.level}`)
    }
  })
  t('S8 空文档 ⇒ green 且不炸(0 B / 0 行)', () => {
    const m = measure('')
    const r = judgeSize({ bytes: m.bytes, lines: m.lines, headBytes: 0, budget: 200 })
    if (r.level !== 'green' || m.bytes !== 0 || m.lines !== 0) throw new Error(JSON.stringify({ m, r }))
  })

  let fail = 0
  for (const c of cases) {
    try {
      c.fn()
      console.info(`  ✅ ${c.name}`)
    } catch (e) {
      fail++
      console.info(`  ❌ ${c.name} —— ${e.message}`)
    }
  }
  console.info(`${GATE_LABEL} 自检 ${cases.length} 例,失败 ${fail}`)
  return fail === 0 ? 0 : 1
}

/** CLI 主体:返回退出码(0 绿 / 1 超预算(warn)/ 2 未判定或用法错)。 */
export async function main(argv = process.argv.slice(2), root = REPO_ROOT) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.info(
      `用法: node scripts/check-agents-doc-size.mjs [--staged | --worktree] [--root <目录>] [--self-test]\n` +
        `守门 207(warn 起步): ${DOC_REL} 逐字注入每一轮对话,字节预算 ${BYTE_BUDGET}(出处见头注)。\n` +
        `出口:0 在预算内 / 1 超预算(注册定级 warn ⇒ 不拦提交)/ 2 未判定或用法错。\n` +
        `升 blocking 前置 = HEAD 面存量归零(§12e)。出路 = §1 两步归档移入 .ihui-agent/archive/。`
    )
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()

  if (argv.includes('--root')) {
    const i = argv.indexOf('--root')
    if (!argv[i + 1]) {
      console.error(`${GATE_LABEL} --root 缺参数值 ⇒ 用法错`)
      return 2
    }
    root = resolve(argv[i + 1])
  }

  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`${GATE_LABEL} ${picked.error}`)
    return 2
  }
  const face = picked.face

  let text
  try {
    text = readDoc({ root, face })
  } catch (e) {
    const why = e instanceof Undetermined ? e.message : String(e?.message ?? e)
    console.error(`${GATE_LABEL} ⚪ 未判定:${FACE_LABEL[face]} 取不到 ${DOC_REL} —— ${why}`)
    console.error('  取不到输入不记绿也不冒红(§0.3);若该面确实没有这份文档,请核实取材口径后用 --worktree 人工复看。')
    return 2
  }

  let headBytes = null
  try {
    headBytes = Buffer.byteLength(readDoc({ root, face: 'head' }), 'utf8')
  } catch {
    headBytes = null // 如实:HEAD 面取不到就不给差值
  }

  const m = measure(text)
  const v = judgeSize({ bytes: m.bytes, lines: m.lines, headBytes })
  const mark = v.level === 'green' ? '✅' : v.level === 'warn' ? '⚠️' : '⚪'
  console.info(`${GATE_LABEL} ${mark} 取材=${FACE_LABEL[face]} · ${v.text}`)
  if (v.level === 'warn') {
    console.info(
      `  💡 出路(§1 两步归档):把守门历史/取证叙述/重复登记副本整区逐字移入 .ihui-agent/archive/<按日>.md,` +
        `\n     原位置只留一句指针注记;归档 commit 必须带 pathspec。` +
        `\n     单独复验:node scripts/check-agents-doc-size.mjs --staged`
    )
  }
  if (v.level === 'warn') return 1
  if (v.level === 'undetermined') return 2
  return 0
}

/** §22c 镜像测试出口:判据与取材都从这里取,测试不复制第二份。 */
export const __test__ = { judgeSize, readDoc, measure, selfTest, DOC_REL, BYTE_BUDGET }

/** §22d 直接运行守卫:被 import 时不自跑。 */
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${GATE_LABEL} ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
