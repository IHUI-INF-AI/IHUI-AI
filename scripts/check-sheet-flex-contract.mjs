// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-sheet-flex-contract.mjs — sheet/弹窗 flex 弹性契约守门(2026-10-15 立)
 *
 * 【病理(实锤案例:HomeScreen 模型选择弹窗)】
 *   弹窗容器样式含百分比 `maxHeight: '70%'`,内部长列表(SectionList/FlatList/ScrollView/
 *   业务列表组件)以自然高度渲染 → 内容撑爆 maxHeight → flexbox 对所有 flexShrink:1(默认)
 *   的兄弟固定块(标题行 / tab 行 / 搜索框)按比例压扁 → tab 胶囊 33px 被压到 14px,
 *   背景条比文字矮,图标文字整体溢出穿帮("标签背景文字都错位没居中")。
 *
 * 【根治契约(三条,全项目必须遵守)】
 *   1. 弹窗/底部 sheet 容器用百分比 maxHeight 时,内部的滚动列表必须是「唯一弹性块」:
 *      调用处传 `style={{ flex: 1 }}`(或等价确定高度),列表内部滚动。
 *   2. 容器内的固定 chrome(标题/tab/搜索框/发丝线等)显式 `flexShrink: 0`,永不参与压缩。
 *   3. 例外出路(数据量天然有限、或组件自约束)必须在调用处以行注释豁免:
 *      `// sheet-flex-ok: <理由>`(放在列表 JSX 上一行或行尾),守门静默通过。
 *
 * 【本脚本静态断言】
 *   R1  bounded 容器(样式定义体含 maxHeight —— 百分比/数值/变量任意形态,或 height 定高)
 *       子树内的列表组件(原生 FlatList/SectionList/ScrollView + 白名单业务列表)
 *       必须有弹性契约:
 *       - 调用处 style 的内联值或被引用样式键的定义体含 flex|maxHeight|height,或
 *       - 带 `sheet-flex-ok` 豁免注释。
 *   R2  「需调用方契约」业务列表组件(SELF_CONSTRAINED=false 白名单)在 maxHeight 容器内
 *       同样必须有弹性契约或豁免(定高容器豁免:组件顶层 flex:1 自适应)。
 *   匹配大小写不敏感(覆盖 styles.xxx 与 shellStyles.xxx 两种引用形式,2026-10-15 实锤:
 *   首版正则小写 styles\. 漏匹配 shellStyles. 大写 S,导致全量漏检假 OK)。
 *
 *   白名单 SELF_CONSTRAINED=true 的组件:顶层样式已 flex:1(父级定高即可滚),调用方可不传。
 *
 * 用法:node scripts/check-sheet-flex-contract.mjs [--src <文件或目录>] [--staged|--worktree]  (退出码非 0 = 违规)
 *   --src:回归测试注入 fixture 用(单 .tsx 文件或目录),缺省扫 apps/mobile-rn/src 全量。
 *     fixture 属**外部输入**不判仓库内容 ⇒ 恒按磁盘读(守门 118 许可条款),面旗被忽略。
 * 取材口径(2026-10-16 迁 scripts/lib/face-reader.mjs,与守门 70/77/83/98/215 同取向):
 *   runner --staged ⇒ 索引 blob(取不到 = 无法判定,exit 2,不回退磁盘不静默跳过);
 *   check:sheet-flex / CI 缺省 ⇒ HEAD blob(并发会话刚 add 的新文件降级工作树,两面都无则跳过);
 *   --worktree = 人工逃生舱(磁盘)。
 * 接入:guardian-runner 门 214(pre-commit,blocking;原 213 已让位给盘根写入门)+ package.json check:sheet-flex。
 */
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { catBatch, gitRaw, readWorktreeFile, selectFace, FACE_LABEL } from './lib/face-reader.mjs'

const srcArgIdx = process.argv.indexOf('--src')
const SRC_ARG = srcArgIdx >= 0 ? process.argv[srcArgIdx + 1] : undefined
if (srcArgIdx >= 0 && !SRC_ARG) {
  console.error('[sheet-flex-contract] --src 需要一个路径参数(文件或目录)')
  process.exit(2)
}
const { face, error: faceErr } = selectFace({
  staged: process.argv.includes('--staged'),
  worktree: process.argv.includes('--worktree'),
  def: 'head',
})
if (faceErr) {
  console.error(`[sheet-flex-contract] ❌ ${faceErr}`)
  process.exit(2)
}
const REPO_ROOT = resolve(import.meta.dirname, '..')
// 展示基准(--src 时违规信息只带 fixture 文件名,与首版口径一致);不参与内容取材。
const DISPLAY_BASE = SRC_ARG ? dirname(resolve(SRC_ARG)) : REPO_ROOT
const SRC_REL = 'apps/mobile-rn/src'

/** 业务列表组件白名单:true = 组件顶层已 flex:1 自约束(定高父级即可滚),false = 必须调用方传契约 */
const BIZ_LIST_COMPONENTS = {
  ModelList: false, // 顶层 SectionList,无 root 约束 → 调用方必须传 style flex:1
  MaterialList: true, // root: { flex: 1 } 自约束
  AgentList: false, // container maxHeight 70%,需调用方契约
  ModelPickerList: false, // ChatScreen 用确定高度(参考 3192)
}
const NATIVE_LIST_TAGS = ['FlatList', 'SectionList', 'ScrollView', 'KeyboardAwareScrollView']

/** bounded 容器信号:样式定义体含 maxHeight(任意值,含变量)或 height(定高);minHeight 不算(\b 防误伤) */
const BOUNDED_HINT_RE = /\b(maxHeight|height)\s*:/
/** 弹性契约信号:flex:1 / 确定高度(\b 保证 flexGrow/flexShrink/minHeight/lineHeight 不误判) */
const CONTRACT_HINT_RE = /\b(flex|maxHeight|height)\b/i
/** 列表标签(原生 + 白名单业务) */
const LIST_TAG_RE = /<(FlatList|SectionList|ScrollView|KeyboardAwareScrollView|ModelList|MaterialList|AgentList|ModelPickerList)\b/g
/** 豁免注释 */
const OK_RE = /sheet-flex-ok\s*[:：]\s*([^\n*]{0,80})/

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(name)) out.push(p)
  }
  return out
}

/**
 * 收集文件内所有样式表的「变量名.键」→ 定义体(同时覆盖 StyleSheet.create 与
 * shellStyles 普通对象写法)。按变量名隔离键空间 —— 同名键冲突(如 4 个 StyleSheet
 * 都有 container)曾让后者定义覆盖前者,产生跨容器误报。只保留与 flex/height 相关的键:
 *   - 定义体含 maxHeight/height → bounded 容器候选
 *   - 定义体含 flex/maxHeight/height → 调用点引用它即视为有弹性契约
 */
function collectStyleBodies(src) {
  const map = new Map()
  const declRe = /\b([A-Za-z_]\w*)\s*=\s*(?:StyleSheet\.create\s*\(\s*)?\{/g
  let d
  while ((d = declRe.exec(src))) {
    const openIdx = d.index + d[0].length - 1
    const end = objectEnd(src, openIdx)
    if (end < 0) continue
    const keyRe = /([A-Za-z_]\w*)\s*:\s*\{([^{}]*?)\}/g
    const scope = src.slice(openIdx + 1, end)
    let k
    while ((k = keyRe.exec(scope))) {
      if (/(flex|maxHeight|height)/i.test(k[2])) map.set(`${d[1]}.${k[1]}`, k[2])
    }
  }
  return map
}

/** 从 openIdx 的 `{` 起做括号平衡,返回匹配 `}` 索引(无则 -1) */
function objectEnd(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return i
  }
  return -1
}

/** 标签平衡:从 startIdx(样式引用点,位于开标签内)找到其所在 View(含 Animated.View)的闭标签末尾 */
function findBlockEnd(src, startIdx) {
  // 单一 token 流:capt[1]=是否闭标签,capt[3]=是否自闭合(尾部 /)。
  // 勿拆成双正则同步扫描 —— lastIndex 重置/丢弃/自闭合误判三类 bug 均已实锤过
  const tokRe = /<(\/)?(\w+\.)?View(?=[\s/>])[^>]*?(\/)?>/g
  tokRe.lastIndex = startIdx
  let depth = 1
  let m
  while ((m = tokRe.exec(src))) {
    if (m[1]) {
      depth--
      if (depth === 0) return m.index + m[0].length
    } else if (!m[3]) {
      depth++ // 自闭合 <View ... /> 不进层(尾部 / 由 capt[3] 捕获)
    }
  }
  return -1 // 无闭合(语法异常),放弃该块
}

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length
}

const violations = []
const seen = new Set()

/** 按面枚举待审 .tsx,返回**仓库相对路径**(正斜杠)。--src 面(外部输入)按磁盘枚举。 */
function listFaceFiles(f) {
  if (SRC_ARG) {
    const abs = resolve(SRC_ARG)
    const files = statSync(abs).isDirectory() ? walk(abs) : [abs]
    return files.map((p) => relative(REPO_ROOT, p).replaceAll('\\', '/'))
  }
  if (f === 'staged') {
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACM', '--', SRC_REL], REPO_ROOT)
      .split('\n')
      .map((s) => s.trim())
      .filter((p) => p && /\.tsx$/.test(p))
  }
  if (f === 'worktree') {
    return walk(join(REPO_ROOT, SRC_REL)).map((p) => relative(REPO_ROOT, p).replaceAll('\\', '/'))
  }
  return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', SRC_REL], REPO_ROOT)
    .split('\n')
    .map((s) => s.trim())
    .filter((p) => p && /\.tsx$/.test(p))
}

/** 一次 cat-file --batch 预取整面正文 → Map<rel, text|null>(--src/worktree 面走 readWorktreeFile)。 */
function prefetchFace(f, rels) {
  const uniq = [...new Set(rels)]
  if (SRC_ARG || f === 'worktree') {
    const out = new Map()
    for (const rel of uniq) out.set(rel, readWorktreeFile(REPO_ROOT, rel))
    return out
  }
  const rev = f === 'staged' ? '' : 'HEAD'
  const specs = uniq.map((r) => `${rev}:${r}`)
  const got = catBatch(REPO_ROOT, specs, { maxBuffer: 1 << 29, timeout: 120000 })
  const out = new Map()
  for (let i = 0; i < uniq.length; i++) out.set(uniq[i], got.get(specs[i]) ?? null)
  return out
}

/** 面文本口径:staged 取不到 = 无法判定(exit 2,不回退磁盘);head 取不到降级工作树,再无则跳过。 */
function faceText(f, rel, prefetched) {
  const t = prefetched.get(rel)
  if (typeof t === 'string') return t
  if (SRC_ARG) {
    console.error(`[sheet-flex-contract] ❌ ${FACE_LABEL.worktree} 取不到 ${rel}`)
    process.exit(2)
  }
  if (f === 'staged') {
    console.error(`[sheet-flex-contract] ❌ ${FACE_LABEL.staged} 取不到 ${rel} —— --staged 面无法判定(exit 2,不回退磁盘、不静默跳过)`)
    process.exit(2)
  }
  return readWorktreeFile(REPO_ROOT, rel)
}

const files = listFaceFiles(face)
const prefetched = prefetchFace(face, files)

for (const fileRel of files) {
  const src = faceText(face, fileRel, prefetched)
  if (src === null) continue // head 面回退后仍无(两面都没有)→ 不判、不猜
  if (!/(?:[Ss]tyles\s*=|StyleSheet\.create)/.test(src)) continue
  // 展示路径:--src 时保持首版口径(只带 fixture 文件名);仓库面即仓库相对路径
  const rel = (SRC_ARG
    ? relative(DISPLAY_BASE, resolve(REPO_ROOT, fileRel))
    : fileRel
  ).replaceAll('\\', '/')

  const styleBodies = collectStyleBodies(src)

  // bounded 容器键:定义体含 maxHeight(任意形态)/height(定高)
  const boundedKeys = [...styleBodies].filter(([, body]) => BOUNDED_HINT_RE.test(body)).map(([k]) => k)
  if (boundedKeys.length === 0) continue

  for (const key of boundedKeys) {
    const isMaxH = /maxHeight\s*:/.test(styleBodies.get(key) ?? '')
    // 找到容器样式的所有 JSX 使用点;(?<![\w.]) 防止 a.shellStyles.key 之类前缀串扰
    const useRe = new RegExp(`(?<![\\w.])${key.replaceAll('.', '\\.')}\\b`, 'g')
    let use
    while ((use = useRe.exec(src))) {
      // 前置过滤:引用点必须真的位于 View/Animated.View 开标签内(depth=1 起算的前提)。
      // 若引用挂在 Pressable/Text 等非 View 元素上,标签平衡会跨界误包远处的列表(实锤:
      // collapseBtn/previewShareBtn 等按钮键曾把不相干的 FlatList 卷进块内)
      const tagStart = src.lastIndexOf('<', use.index)
      if (tagStart < 0 || !/^<(\w+\.)?View(?=[\s/>])/.test(src.slice(tagStart, tagStart + 40))) continue
      const end = findBlockEnd(src, use.index)
      if (end < 0) continue
      const block = src.slice(use.index, end)
      LIST_TAG_RE.lastIndex = 0
      let tag
      while ((tag = LIST_TAG_RE.exec(block))) {
        const name = tag[1]
        const tagIdx = use.index + tag.index
        const win = block.slice(tag.index, Math.min(block.length, tag.index + 800))
        const isBiz = name in BIZ_LIST_COMPONENTS
        const isNative = NATIVE_LIST_TAGS.includes(name)
        if (!isBiz && !isNative) continue
        // 业务自约束组件在「定高容器」里豁免;在 maxHeight 容器里仍需契约(maxHeight 非 bounded)
        if (isBiz && BIZ_LIST_COMPONENTS[name] && !isMaxH) continue
        // 豁免注释(上一行注释 / 行尾)
        if (OK_RE.test(src.slice(Math.max(0, tagIdx - 240), tagIdx + 200))) continue
        // 契约检查:列表自身 style 属性(标签前 300 字符内)——内联值或被引用样式键
        // 的定义体含 flex / maxHeight / height 即算有契约;style 写得太靠后视同无契约
        let hasContract = false
        const styleM = win.slice(0, 300).match(/style=\{([\s\S]*?)\}/)
        if (styleM) {
          let contractText = styleM[1]
          for (const tok of styleM[1].match(/[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?/g) ?? []) {
            const body = styleBodies.get(tok)
            if (body) contractText += ' ' + body
          }
          hasContract = CONTRACT_HINT_RE.test(contractText)
        }
        if (hasContract) continue
        const line = lineOf(src, tagIdx)
        const dedupe = `${rel}:${line}:${name}`
        if (seen.has(dedupe)) continue
        seen.add(dedupe)
        violations.push(
          `${rel}:${line} — bounded 容器样式「${key}」内 <${name}> 无弹性契约` +
            `(传 style={{ flex: 1 }} / 确定高度,或加 // sheet-flex-ok: <理由>)`,
        )
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`\n[sheet-flex-contract] 违规 ${violations.length} 处:`)
  for (const v of violations) console.error('  ✗ ' + v)
  console.error(
    '\n  契约:弹窗 maxHeight 容器内列表 = 唯一弹性块(style flex:1);固定 chrome 显式 flexShrink:0;\n' +
      '  数据天然有限可豁免:// sheet-flex-ok: <理由>\n',
  )
  process.exit(1)
}
console.log('[sheet-flex-contract] OK — 无弹窗列表 flex 契约违规')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
