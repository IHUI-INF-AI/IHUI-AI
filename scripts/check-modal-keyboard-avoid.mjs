#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 272:RN 弹层键盘避让对账(blocking;Modal 内含输入框而该 Modal 子树里没有
 * KeyboardAvoidingView ⇒ 判红 —— 2026-10-31 立,立门时存量已由前一批清到 0,故绝对零容忍)
 *
 * 为什么必须有门(不是便利脚本):
 * RN 的 <Modal> 是**独立原生窗**,挂在它外面的 KeyboardAvoidingView 对它不生效。iOS 没有
 * adjustResize 这回事,所以弹层里任何输入框都会被键盘整个盖住 —— 提现 2FA 面板、验证码 6 格、
 * 放大输入、模型搜索、2FA 取消,五处实测同一形态。这类缺陷不会编译报错、不会让 typecheck 变红,
 * 只有用户"打字打不了"才发现,正是必须机器守住的那一型。
 *
 * 判据口径:
 *  - 射程:apps/mobile-rn/src + packages/app/src 的 .tsx(共享屏层与端内同权,只守一端必然漂);
 *  - 形状:<Modal …> 子树里出现 <TextInput>,且该子树内没有 <KeyboardAvoidingView> ⇒ 违规;
 *  - 标签匹配带标识符边界([\\s/>]),否则 <ModalHost/> 这类同名前缀会被误判(实测踩过);
 *  - 取材面:全量档判 HEAD blob、--staged 判索引 blob、--worktree 仅人工逃生舱(守门 118 纪律);
 *    取不到内容一律「未判定」exit 2,不回落另一个面、不记绿(§0.3/§0.4)。
 *
 * 本门的盲区(不得把"零违规"读成"全端弹层输入都能打字"):
 *  跨文件封装看不见 —— BottomPops / 各类 Sheet 把 children 由调用方传入,Modal 在 A 文件、
 *  TextInput 写在 B 文件时,静态扫描结构上无法配对。那一条腿由
 *  apps/mobile-rn/tests/rn-sheet-keyboard-cta.test.tsx 与
 *  apps/mobile-rn/tests/rn-verify-code-modal-avoid.test.tsx 的渲染锁钉住(避让层住在
 *  Modal 内、且内容真的渲染在它里面)。两把尺各管一侧,谁也不替谁背书。
 *
 * 用法:node scripts/check-modal-keyboard-avoid.mjs [--staged | --worktree | --self-test]
 * 应急跳过:HUSKY_SKIP_MODAL_KEYBOARD_AVOID=1(会留痕,且必须给定向说明,§0.10)
 */
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FACE_LABEL,
  Undetermined,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_RELS = ['apps/mobile-rn/src', 'packages/app/src']
const SKIP_ENV = 'HUSKY_SKIP_MODAL_KEYBOARD_AVOID'

const argv = process.argv.slice(2)
const selfTest = argv.includes('--self-test')
const quiet = argv.includes('--quiet')
const wantHelp = argv.includes('--help') || argv.includes('-h')
const { face, error: faceErr } = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
})

/**
 * 核心判据:给一段 .tsx 源码,返回「有 TextInput 但没有避让层的 Modal 区间」。
 * 纯函数,零 IO —— 自检与主流程共用同一份实现(§22c:测试里不许另抄一份判据)。
 */
function findMissingAvoids(text) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const re = /<(\/?)(Modal|TextInput|KeyboardAvoidingView)(?![\w-])/g
  const open = []
  const out = []
  let m
  while ((m = re.exec(stripped))) {
    const closing = m[1] === '/'
    const tag = m[2]
    if (tag === 'Modal') {
      if (!closing) {
        // 自闭合的 <Modal /> 不可能承载输入,但也不会配对 —— 跳过,不猜
        const selfClosed = /\/>/.test(stripped.slice(m.index, stripped.indexOf('>', m.index) + 1))
        if (!selfClosed) open.push({ start: m.index, inputs: [], avoids: [] })
        continue
      }
      const r = open.pop()
      if (r && r.inputs.length > 0 && r.avoids.length === 0) {
        out.push({
          modalLine: stripped.slice(0, r.start).split('\n').length,
          inputs: r.inputs.map((i) => stripped.slice(0, i).split('\n').length),
        })
      }
      continue
    }
    if (open.length === 0) continue
    const r = open[open.length - 1]
    if (!closing && tag === 'TextInput') r.inputs.push(m.index)
    if (!closing && tag === 'KeyboardAvoidingView') r.avoids.push(m.index)
  }
  return out
}

function runSelfTest() {
  const fails = []
  const ok = (cond, msg) => {
    if (!cond) fails.push(msg)
  }
  // 夹具 1(红):Modal 内有输入、无避让
  ok(
    findMissingAvoids('<Modal><View><TextInput /></View></Modal>').length === 1,
    '夹具 1 失效:Modal 内裸 TextInput 必须判违规',
  )
  // 夹具 2(绿):避让层住在 Modal 内
  ok(
    findMissingAvoids('<Modal><KeyboardAvoidingView><TextInput /></KeyboardAvoidingView></Modal>')
      .length === 0,
    '夹具 2 失效:Modal 内有避让层必须放行',
  )
  // 夹具 3(绿):没有输入框的弹层不该被管
  ok(findMissingAvoids('<Modal><View><Text>hi</Text></View></Modal>').length === 0, '夹具 3 失效')
  // 夹具 4(边界):同名前缀标签不得被当成命中 —— 尺子用裸 indexOf 时这里会假绿
  ok(
    findMissingAvoids('<ModalHost><TextInputHost /></ModalHost>').length === 0,
    '夹具 4 失效:同名前缀标签被误判了',
  )
  // 夹具 5(反向):避让层在 Modal 之外不算修好
  ok(
    findMissingAvoids('<KeyboardAvoidingView><Modal><TextInput /></Modal></KeyboardAvoidingView>')
      .length === 1,
    '夹具 5 失效:挂在 Modal 外的避让层被当成有效',
  )
  if (fails.length > 0) {
    for (const f of fails) console.error(`[SELF-TEST FAIL] ${f}`)
    return 1
  }
  console.log('[SELF-TEST OK] 判据自检通过(红/绿/无输入/前缀边界/避让在外 5 组)')
  return 0
}

function listFiles(f) {
  const scoped = (p) => SRC_RELS.some((r) => p.startsWith(`${r}/`)) && p.endsWith('.tsx')
  if (f === 'worktree') {
    const prefix = ROOT.split(sep).join('/').length + 1
    return gitRaw(['ls-files', '--', ...SRC_RELS], ROOT)
      .split('\n')
      .map((s) => s.trim().split(sep).join('/'))
      .filter((p) => scoped(p) || scoped(p.slice(prefix)))
      .map((p) => (scoped(p) ? p : p.slice(prefix)))
  }
  const rev = f === 'staged' ? null : 'HEAD'
  const args =
    rev === null
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACM', '--', ...SRC_RELS]
      : ['ls-tree', '-r', '--name-only', rev, '--', ...SRC_RELS]
  return gitRaw(args, ROOT)
    .split('\n')
    .map((s) => s.trim())
    .filter(scoped)
}

function main() {
  if (wantHelp) {
    console.log('用法: node scripts/check-modal-keyboard-avoid.mjs [--staged|--worktree|--self-test]')
    console.log(`跳过开关:${SKIP_ENV}(应急用,须留痕)`)
    return 0
  }
  if (selfTest) return runSelfTest()
  if (faceErr) {
    console.error(`❌ ${faceErr}`)
    return 2
  }
  if (process.env[SKIP_ENV]) {
    console.error(`⚠️ 已跳过(${SKIP_ENV}=1)—— 跳过次数与原因按 §0.10 计入跳门留痕,不得当作已通过`)
    return 0
  }
  if (!quiet)
    console.log(`[check-modal-keyboard-avoid] 弹层键盘避让对账 | 判定面=${FACE_LABEL[face]}`)

  const files = listFiles(face)
  if (files.length === 0) {
    console.error('❌ 射程内一个文件都没枚举到 ⇒ 判死(枚举到 0 不等于没有,§0.3)')
    return 2
  }
  let texts
  if (face === 'worktree') {
    texts = new Map(files.map((rel) => [rel, readWorktreeFile(ROOT, rel)]))
  } else {
    const rev = face === 'staged' ? '' : 'HEAD'
    try {
      texts = catBatch(ROOT, files.map((r) => `${rev}:${r}`), { maxBuffer: 1 << 29 })
    } catch (e) {
      console.error(`❌ 无法判定:${e.message}`)
      return 2
    }
  }
  const violations = []
  let undetermined = 0
  for (const rel of files) {
    const text = face === 'worktree' ? texts.get(rel) : (texts.get(`${face === 'staged' ? '' : 'HEAD'}:${rel}`) ?? null)
    if (text === null || text === undefined) {
      undetermined += 1
      continue
    }
    for (const v of findMissingAvoids(text))
      violations.push({ rel, modalLine: v.modalLine, inputs: v.inputs.join(',') })
  }
  if (undetermined > 0)
    console.error(`⚠️ ${undetermined} 个文件取不到${FACE_LABEL[face]}内容 ⇒ 该维度未判定,不记绿`)
  if (violations.length > 0) {
    console.error(
      `❌ ${violations.length} 处弹层输入没有键盘避让层(RN Modal 是独立原生窗,挂在外面的 KAV 无效):`,
    )
    for (const v of violations.slice(0, 20))
      console.error(`   ${v.rel}:${v.modalLine} Modal 内 TextInput@${v.inputs} 无 KeyboardAvoidingView`)
    console.error(
      '   改法:把该 Modal 的唯一直接子容器就地换成 <KeyboardAvoidingView style={原容器} behavior={Platform.OS===\'ios\'?\'padding\':undefined}>;' +
        '若那层是带 onPress 的遮罩 Pressable,把遮罩点击下移一枚 StyleSheet.absoluteFill 的 Pressable(端内 5 处先例)。',
    )
    console.error(`   注意跨文件封装看不见:children 由调用方传入的弹层(BottomPops 等)由渲染锁守住,见文件头注。`)
    return 1
  }
  console.log(`✅ ${files.length} 个 .tsx 全数核对:无「Modal 内含输入框而无避让层」的形态`)
  return undetermined > 0 ? 2 : 0
}

export const __test__ = { findMissingAvoids, runSelfTest, SKIP_ENV, SRC_RELS }

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
