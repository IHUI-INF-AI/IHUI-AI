#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-i18n-duplicate-namespaces.mjs — i18n JSON 重复命名空间/重复键守门
 *
 * 背景(两次同款真实事故,2026-09-08 立规则):
 *   ① automations 命名空间重复 → JSON last-wins 静默遮蔽,块独占的 delete 键全部丢失;
 *   ② en.json 尾部重复 repoWiki 块(zh-TW 值) → 遮蔽文件头部的正确英文块,
 *      check-i18n-broken-en 才间接暴露。
 *   根因:标准 JSON.parse 对重复键静默取最后一个,reviver 也无济于事
 *   (Walk 阶段重复键已被 parser 去重)→ 写入侧(会话追加块而非编辑既有块)零反馈。
 *
 * 原理:字符级扫描 — 维护对象深度栈,每层一个已见键集合;
 *   捕获每一段完整字符串(处理反斜杠转义),若其后下一个非空白字符为 ":" 则判定为键,
 *   在当前层查重。与嵌套/数组无关,不依赖 JSON.parse 语义。
 *
 * 扫描范围:packages/i18n/messages 下全部 .json 文件(递归,全部语言 × 全部端)
 *
 * **本门判的是哪一面(2026-09-26 收口,口径同 36/56/60/124)**:默认判 **HEAD blob**,
 * `--staged` 判**索引 blob**(这次提交会带走的那一份),`--worktree` 只是人工排查与测试夹具的
 * 逃生舱,两个面旗同给 ⇒ exit 2;任一面取不到 ⇒ **exit 2「无法判定」**,既不记绿也不冒红,
 * 且**不回落**到另一个面。枚举与内容**同面同轮**(清单来自 `ls-tree`/`ls-files`,正文来自同一次
 * `cat-file --batch`)。收口前的形态是"按磁盘判 + 不认识 `--staged`",而 guardian-runner 在 pre-commit
 * 模式会给每道门追加 `--staged` ⇒ 并行会话在 `packages/i18n/messages/**` 里的半编辑语料会把一枚
 * 与它无关的提交钉红:实测同日同一份门代码,按磁盘判 **exit 1(4 个语言文件数百处重复键)**,
 * 而 `git archive HEAD` 干净检出判 **exit 0** —— 那条红一天内出现过 4 次,每次都被迫 `--no-verify`,
 * 而一次绕过约等于全部 156 道门对该提交作废(§12e 同型)。**这就是"按磁盘判的门"的真实代价:
 * 它不是偶尔误判,而是每台并发机器上天天替别人受红。**
 *
 * 2026-09-26 另修一处独立缺陷(与判定面无关,但同属"尺子量错东西"那一型):
 * 原 `const ROOT = process.cwd()` 让"扫哪棵树"由调用者**站在哪个目录**决定。守门 70 的镜像测试
 * 就为此 13/14 恒红 —— 测试靠 cwd 定位夹具,而脚本按 cwd 扫到了真仓(不是判据错,是调用方式失效)。
 * 现 ROOT 由脚本自身位置推导(AGENTS §15:不得硬编码盘符),并保留**只给测试用**的
 * `--root <dir>` 通道,但它**只在 `--worktree` 档有效** —— 换根却仍按 HEAD/索引读会读到另一个仓的
 * 内容,那是双根分裂,直接判死。
 *
 * 退出码:
 *   0 — 无重复
 *   1 — 发现重复命名空间/重复键(blocking)
 *   2 — 无法判定(两面旗同给 / 该面取不到 / 枚举到 0 个 .json / `--root` 用错档或缺参数值)
 *
 * 调用方:scripts/guardian-runner.mjs 第 2f 项(blocking)
 * 跳过:HUSKY_SKIP_I18N_DUP_NS=1
 */
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 取材只走这一层(绝对路径 git / safe.directory / quotepath / windowsHide / maxBuffer /
// "输出被截断 ⇒ 无法判定"),各门自己写一遍就会各漏一遍 —— 口径同守门 36/124/56/60。
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const SKIP_ENV = 'HUSKY_SKIP_I18N_DUP_NS'
/** 扫描根的默认锚点:**由脚本自身位置推导**,不是 process.cwd()(见上方 2026-09-26 那条修正) */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 枚举面(相对路径前缀);磁盘面的 `join(root, …)` 形态留在 `listJsonRelPaths` 的 worktree 分支里 */
const MESSAGES_REL = 'packages/i18n/messages'

/** 纯函数:argv → 判定面。默认 **HEAD blob**;口径与守门 36/56/60/124 逐字同形。 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工排查 / 测试夹具的逃生舱,提交链不走这档)',
}

/**
 * 按判定面枚举 messages 下的 .json 清单。
 * - git 面:`ls-tree`(HEAD)/ `ls-files`(索引)只出**路径**,内容一律交给 `readFaceInputs`
 *   在同一次 `cat-file --batch` 里读满 —— 枚举与内容必须同面同轮,否则并发会话推进瞬间
 *   会拿"HEAD 的清单 × 索引的内容"造出一把自洽却错位的尺子(本仓记过多次)。
 * - 磁盘面:递归 readdir(旧行为,原样保留)。
 */
export function listJsonRelPaths(root, face, messagesRel = MESSAGES_REL) {
  if (face === 'worktree') {
    const dir = join(root, messagesRel)
    const walk = (d) => {
      const out = []
      for (const name of readdirSync(d)) {
        const p = join(d, name)
        if (statSync(p).isDirectory()) out.push(...walk(p))
        else if (name.endsWith('.json')) out.push(p)
      }
      return out
    }
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return null
    return walk(dir).map((p) => relative(root, p).split(sep).join('/'))
  }
  const args =
    face === 'staged'
      ? ['ls-files', '--', messagesRel]
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', messagesRel]
  const out = gitRaw(args, root)
  if (out === null) return null
  return out
    .split('\n')
    .filter((l) => l.trim() && l.endsWith('.json'))
    .sort()
}

/**
 * 同面同轮读满整份清单:一次 `cat-file --batch`。
 * 任一文件取不到 ⇒ 抛 `Undetermined`(调用方折成 exit 2,**不回落**到磁盘或另一个面)。
 */
export function readFaceInputs(root, face, rels) {
  if (face === 'worktree') {
    const out = new Map()
    for (const rel of rels) {
      const t = readWorktreeFile(root, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树取不到 ${rel}`)
      out.set(rel, t)
    }
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(root, specs, { maxBuffer: 1 << 28 })
  const out = new Map()
  for (let i = 0; i < rels.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${rels[i]}`)
    out.set(rels[i], t)
  }
  return out
}

/**
 * 纯函数:argv → 扫描根。`--root <dir>` 是显式**测试通道**(镜像测试用它把夹具指到临时目录),
 * 生产入口从不带它。缺参数值 ⇒ 返回 error 而**不静默退回默认根** —— 那会把"我以为在扫夹具"
 * 变成"其实扫了真仓",正是本文件原来那个 cwd 缺陷的另一种复发形态。
 * 换根**不换判定面**:无论哪个根,读的都是磁盘。
 */
export function rootFromArgv(argv, def = ROOT) {
  const i = argv.indexOf('--root')
  if (i === -1) {
    const inline = argv.find((a) => a.startsWith('--root='))
    if (!inline) return { root: def, error: null }
    const value = inline.slice('--root='.length)
    return value
      ? { root: resolve(value), error: null }
      : { root: null, error: '--root= 后面必须给目录' }
  }
  const value = argv[i + 1]
  if (!value || value.startsWith('--'))
    return { root: null, error: '--root 需要一个目录参数(不得静默退回仓库根)' }
  return { root: resolve(value), error: null }
}

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/**
 * 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 ——
 * 匿名 exit 2 = 不可诊断(守门 36/93 同型教训:一个编码/权限错误不得伪装成业务结论)。
 */
const known = (e) => (e instanceof Undetermined ? e.message : (e?.stack ?? String(e)))

/**
 * 字符级重复键检测。
 * 返回 Array<{ line, key }>:重复键及其所在行号。
 */
function findDuplicateKeys(text) {
  const duplicates = []
  /** 每层对象的已见键集合;栈顶 = 当前层 */
  const stack = []
  let line = 1
  let i = 0
  const n = text.length

  const peekNonWs = (from) => {
    let j = from
    while (j < n) {
      const ch = text[j]
      if (ch === '\n') {
        /* 行号在主循环统一推进,这里只跳过 */
      }
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') j++
      else break
    }
    return j
  }

  while (i < n) {
    const ch = text[i]
    if (ch === '\n') {
      line++
      i++
      continue
    }
    if (ch === '{') {
      stack.push(new Set())
      i++
      continue
    }
    if (ch === '}') {
      stack.pop()
      i++
      continue
    }
    if (ch === '"') {
      // 读取完整字符串(处理转义)
      let j = i + 1
      let raw = ''
      while (j < n) {
        const c = text[j]
        if (c === '\\') {
          raw += c + (text[j + 1] ?? '')
          j += 2
          continue
        }
        if (c === '"') break
        raw += c
        j++
      }
      // j 指向收尾引号;下一个非空白字符为 ":" → 这是键
      const after = peekNonWs(j + 1)
      if (text[after] === ':' && stack.length > 0) {
        const keys = stack[stack.length - 1]
        if (keys.has(raw)) duplicates.push({ line, key: raw.slice(0, 60) })
        else keys.add(raw)
      }
      i = j + 1
      continue
    }
    i++
  }
  return duplicates
}

function main() {
  const argv = process.argv.slice(2)
  if (process.env[SKIP_ENV] === '1') {
    console.log(`${C.yellow}⚠ ${SKIP_ENV}=1 已跳过 i18n 重复命名空间守门(不推荐)${C.reset}`)
    process.exit(0)
  }
  const faceSel = faceFromArgv(argv)
  if (faceSel.error) {
    console.log(`${C.red}❌ 无法判定:${faceSel.error}${C.reset}`)
    process.exit(2)
  }
  const face = faceSel.face
  const sel = rootFromArgv(argv)
  if (sel.error) {
    console.log(`${C.red}❌ 无法判定:${sel.error}${C.reset}`)
    process.exit(2)
  }
  // `--root` 只换**磁盘面**的扫描根(给镜像测试指夹具用);git 面一律以本仓为根,
  // 因为"换根"对 HEAD/索引没有意义 —— 换根却仍按 git 面读会读到另一个仓的内容,那是双根分裂。
  const root = sel.root
  if (face !== 'worktree' && root !== ROOT) {
    console.log(
      `${C.red}❌ 无法判定:--root 只在 --worktree 档有效(当前判定面:${FACE_TXT[face]})${C.reset}`,
    )
    process.exit(2)
  }

  let rels
  try {
    rels = listJsonRelPaths(root, face)
  } catch (e) {
    console.log(`${C.red}❌ 无法判定:枚举失败 ${known(e)}${C.reset}`)
    process.exit(2)
  }
  if (rels === null) {
    console.log(
      `${C.yellow}⚠ 判定面(${FACE_TXT[face]})上没有 ${MESSAGES_REL} ⇒ 无法判定(空扫不记绿)${C.reset}`,
    )
    process.exit(2)
  }
  if (rels.length === 0) {
    // 空清单是本门要防的同一型故障:扫到 0 个文件却报"无重复键"。
    console.log(
      `${C.red}❌ 无法判定:判定面(${FACE_TXT[face]})上枚举到 0 个 .json ⇒ 判死而不记绿${C.reset}`,
    )
    process.exit(2)
  }
  let texts
  try {
    texts = readFaceInputs(root, face, rels)
  } catch (e) {
    console.log(`${C.red}❌ 无法判定:${known(e)}(不回落另一个面)${C.reset}`)
    process.exit(2)
  }
  const offenders = []

  for (const rel of rels) {
    const text = texts.get(rel)
    try {
      JSON.parse(text) // 合法性顺带校验(重复键对 JSON.parse 合法,但语法错误要报)
    } catch (e) {
      offenders.push({ rel, detail: `JSON 解析失败: ${e.message.slice(0, 120)}` })
      continue
    }
    const duplicates = findDuplicateKeys(text)
    if (duplicates.length > 0) {
      offenders.push({
        rel,
        detail: duplicates.map((d) => `L${d.line} "${d.key}" 重复`).join(', '),
      })
    }
  }

  console.log(
    `${C.cyan}${C.bold}🔎 i18n 重复命名空间守门(${MESSAGES_REL}, ${rels.length} 文件;判定面:${FACE_TXT[face]})${C.reset}`,
  )
  if (offenders.length === 0) {
    console.log(`${C.green}✅ 无重复命名空间/重复键${C.reset}`)
    // 末行仍是结论行(守门 36 同型口径:镜像测试按末行断言"这句话是关于哪个面的")。
    console.log(`[i18n-dup-ns] Found 0 个文件有重复键(判定面:${FACE_TXT[face]})${C.reset}`)
    process.exit(0)
  }
  console.log(
    `${C.red}${C.bold}❌ 发现 ${offenders.length} 个文件存在重复键(JSON last-wins 静默遮蔽;历史事故:automations delete 键丢失 / repoWiki 英文块被遮蔽)${C.reset}`,
  )
  for (const o of offenders) {
    console.log(`  ${C.red}❌ ${o.rel}${C.reset}`)
    console.log(`     ${C.dim}${o.detail}${C.reset}`)
  }
  console.log(
    `\n${C.yellow}修复:删除重复块,只保留正确的一份(编辑既有块,禁止文件尾部追加同名块)${C.reset}`,
  )
  console.log(`紧急跳过(不推荐):${C.cyan}${SKIP_ENV}=1 git commit ...${C.reset}`)
  // 结论行必须落在**末行**并写明判的是哪一面(守门 36 同型口径)。
  console.log(
    `[i18n-dup-ns] Found ${offenders.length} 个文件有重复键(判定面:${FACE_TXT[face]})${C.reset}`,
  )
  process.exit(1)
}

// §22d:CLI 直接执行才跑主流程;镜像测试 import 判据函数时不得有副作用
// (原文件顶层直接 main(),被 import 就会去扫一遍真仓并以 process.exit 结束测试进程)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  rootFromArgv,
  faceFromArgv,
  FACE_TXT,
  listJsonRelPaths,
  readFaceInputs,
  findDuplicateKeys,
  DEFAULT_ROOT: ROOT,
}
