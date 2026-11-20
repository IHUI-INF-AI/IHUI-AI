#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * toggle 图标语义守门 — 拦住「常驻开关的图标画反了」这一型。
 *
 * 立因(2026-11-21,用户实报「桌面端窗口置顶按钮逻辑正好相反」):
 *   顶栏图钉按钮带 `aria-pressed` + 高亮底,又紧邻 Min/Max/Close 这类纯状态按钮簇;
 *   而它的图标写成 `pinned ? <PinOff/> : <Pin/>` —— 画的是"点下去会发生什么",
 *   于是已置顶(高亮)时显示"划掉的图钉",被读成"当前未置顶",视觉与状态正好相反。
 *   功能链路本身没错,错在**图标语义**。会话分组置顶、移动分组对话框的置顶钮同型。
 *
 * 判据(BLOCKING):<button> 片段同时满足三条 ⇒ 命中
 *   1) 带 `aria-pressed={…}`(常驻开关),或 `data-state={… ? 'on' : 'off'}`;
 *   2) 片段内出现图标三元 `cond ? <A/> : <B/>`;
 *   3) 真值支 A 属于「解除型」图标族(ACTION_OFF)⇒ pressed=true 时画"关闭/解除",
 *      与高亮态相反。
 *   反向形态 `cond ? <Pin/> : <PinOff/>`(真值支=开启态)是正确写法,绿。
 *
 * 刻意**不**判(各自治义正确,判了就是误报/恒红):
 *   - `role="menuitem"` 的一次性菜单项 —— 动作图标 + 文字("置顶/取消置顶")是正确的;
 *   - 片段内存在可见文字的按钮 —— 文字已说明动作,图标跟文字走;
 *   - 关闭态族图标(VolumeX / MicOff / VideoOff / CameraOff / Unlock 等):
 *     "静音/关麦"本身就是当前状态,真值支用它们是对的;
 *   - `aria-expanded` 的展开/收起控件(侧栏搜索的 X)—— 面板自身可见,不属常驻开关语义。
 *
 * 豁免:行内 `toggle-icon-exempt: <原因>`(必须带原因,进守门 108 存活期表)。
 *
 * 用法:
 *   node scripts/check-toggle-icon-semantics.mjs --staged    pre-commit(命中即 exit 1)
 *   node scripts/check-toggle-icon-semantics.mjs             全量(HEAD 面,命中即 exit 1)
 *   node scripts/check-toggle-icon-semantics.mjs --worktree  人工逃生舱:判磁盘(不作提交门禁)
 *   node scripts/check-toggle-icon-semantics.mjs --self-test 判据自检
 *   node scripts/check-toggle-icon-semantics.mjs --help
 *
 * 取材面纪律(AGENTS §0.4):`--staged` 判**索引 blob**、全量判 **HEAD blob**、
 * `--worktree` 仅人工逃生舱;取不到 ⇒ exit 2「未判定」,绝不回落另一个面。
 *
 * 跳过方法(紧急):HUSKY_SKIP_TOGGLE_ICON_SEMANTICS=1 git commit ...
 */
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
} from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 扫描根:前端 UI 面(与 check-no-emoji-icons 的 UI_SCAN_ROOTS 同语义)。 */
const SCAN_ROOTS = [
  'apps/web/src',
  'packages/app/src',
  'apps/mobile-rn/src',
  'apps/miniapp-taro/src',
  'packages/ui-react/src',
]
const SCAN_EXTS = ['.tsx', '.jsx']

/**
 * 「解除型」图标族:真值支(=已开启)出现这些 = 图标在画"关闭/解除"动作 ⇒ 读反。
 * 只收语义确定的解除族;关闭态族(VolumeX/MicOff/…)不在其中,见头注。
 */
const ACTION_OFF_ICONS = [
  'PinOff',
  'BellOff',
  'StarOff',
  'HeartOff',
  'BookmarkOff',
  'BookmarkX',
  'EyeOff',
  'MailOff',
  'MessageSquareOff',
  'MessageCircleOff',
  'UserX',
]

const ACTION_OFF_RE = new RegExp(`^(${ACTION_OFF_ICONS.join('|')})$`)

const SKIP_ENV = 'HUSKY_SKIP_TOGGLE_ICON_SEMANTICS'

const HELP_TEXT = `
check-toggle-icon-semantics.mjs — toggle 图标语义守门(常驻开关禁用动作式图标)

用法:
  node scripts/check-toggle-icon-semantics.mjs --staged     pre-commit 模式(命中即 exit 1)
  node scripts/check-toggle-icon-semantics.mjs              全量 HEAD 面(命中即 exit 1)
  node scripts/check-toggle-icon-semantics.mjs --worktree   人工逃生舱:判磁盘
  node scripts/check-toggle-icon-semantics.mjs --self-test  判据自检
  node scripts/check-toggle-icon-semantics.mjs --help       显示本帮助

判据:
  带 aria-pressed(或 data-state on/off)的 <button> 内,
  图标三元的真值支不得是解除型图标(PinOff/BellOff/EyeOff/…)。

正确写法(状态式):
  {pressed ? <Pin /> : <PinOff />}           // 已开启=开启态图标
  或直接用 @/components/common/pin-toggle-icon 的 <PinToggleIcon pressed={…} />

不判(语义正确):
  一次性菜单项(role="menuitem") / 带可见文字的按钮 /
  关闭态族图标(VolumeX、MicOff、VideoOff、CameraOff、Unlock) /
  aria-expanded 的展开收起控件

豁免:行内注释 toggle-icon-exempt: <原因>

紧急跳过:${SKIP_ENV}=1 git commit ...
`

/**
 * 取 <button …> 的子内容(跳过起始标签的属性区,引号/括号感知),并剥掉
 * 标签、JSX 注释、字符串与表达式 —— 只剩"真正会渲染成文字"的部分。
 */
export function visibleTextOf(fragment) {
  const bodyStart = openingTagEnd(fragment)
  if (bodyStart < 0) return ''
  const body = fragment.slice(bodyStart + 1, fragment.lastIndexOf('</button>'))
  return stripToText(body)
}

/** 起始标签 `>` 的位置(属性值里的引号内 `>` 不算,`{…}` 里的 `>` 不算)。 */
function openingTagEnd(fragment) {
  let quote = null
  let brace = 0
  for (let i = 0; i < fragment.length; i++) {
    const ch = fragment[i]
    if (quote) {
      if (ch === quote && fragment[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') brace++
    else if (ch === '}') brace = Math.max(0, brace - 1)
    else if (ch === '>' && brace === 0) return i
  }
  return -1
}

function stripToText(input) {
  let out = ''
  let i = 0
  while (i < input.length) {
    // JSX 注释 {/* … */}
    if (input.startsWith('{/*', i)) {
      const endC = input.indexOf('*/}', i)
      i = endC < 0 ? input.length : endC + 3
      continue
    }
    // 表达式 { … }(含嵌套),整段不产生可见文字
    if (input[i] === '{') {
      let depth = 0
      let j = i
      while (j < input.length) {
        if (input[j] === '{') depth++
        else if (input[j] === '}') {
          depth--
          if (depth === 0) break
        }
        j++
      }
      i = j + 1
      continue
    }
    // 标签 < … >
    if (input[i] === '<') {
      const end = input.indexOf('>', i)
      i = end < 0 ? input.length : end + 1
      continue
    }
    out += input[i]
    i++
  }
  return out.replace(/\s+/g, '')
}

/** 起始标签片段(从 `<button` 到其 `>`),供属性级判定。 */
export function openingTagOf(fragment) {
  const bodyStart = openingTagEnd(fragment)
  return bodyStart < 0 ? fragment : fragment.slice(0, bodyStart + 1)
}

/** 从片段里取所有图标三元 `cond ? <A/> : <B/>`(兼容括号形态与无括号形态)。 */
export function iconTernariesOf(fragment) {
  const out = []
  const patterns = [
    /\?\s*\(\s*<([A-Za-z0-9_]+)\b[^()]*?\/>\s*\)\s*:\s*\(\s*<([A-Za-z0-9_]+)\b/g,
    /\?\s*<([A-Za-z0-9_]+)\b[^>]*?\/>\s*:\s*<([A-Za-z0-9_]+)\b/g,
  ]
  for (const re of patterns) {
    for (const m of fragment.matchAll(re)) {
      out.push({ trueIcon: m[1], falseIcon: m[2], index: m.index ?? 0 })
    }
  }
  return out
}

/**
 * 判据主体:给定源码文本,返回命中列表 [{ line, trueIcon, falseIcon, cond }]。
 * 纯函数、零 IO,self-test 与真扫共用同一份(§0.6 单一真相源)。
 */
export function findViolations(src) {
  const hits = []
  let idx = 0
  while (true) {
    const start = src.indexOf('<button', idx)
    if (start < 0) break
    const end = src.indexOf('</button>', start)
    if (end < 0) break
    const fragment = src.slice(start, end + 9)
    idx = end + 9
    const line = src.slice(0, start).split('\n').length

    // 豁免标记必须带原因:冒号后至少要有一个非空白、非注释终结符的字符。
    if (/toggle-icon-exempt:\s*[^\s*/]/.test(fragment)) continue
    if (/role=\{?["']menuitem["']\}?/.test(fragment)) continue

    // 常驻开关:aria-pressed 真值态;或 data-state 的 on/off 双态。
    const pressed = /aria-pressed=(\{[^}]*\}|["']?(?:true|false)["']?)/.exec(fragment)
    const stateOnOff = /data-state=\{[\s\S]*?'on'[\s\S]*?'off'[\s\S]*\}/.test(fragment)
    if (!pressed && !stateOnOff) continue

    const cond = pressed ? pressed[1].trim() : ''
    const ternaries = iconTernariesOf(fragment)
    if (ternaries.length === 0) continue

    // 有可见文字 ⇒ 文字已说明动作,图标跟文字走,不判。
    if (visibleTextOf(fragment).length > 0) continue

    for (const t of ternaries) {
      if (!ACTION_OFF_RE.test(t.trueIcon)) continue
      hits.push({ line, cond, trueIcon: t.trueIcon, falseIcon: t.falseIcon })
    }
  }
  return hits
}

function listFaceFiles(root, face) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_ROOTS]
      : ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...SCAN_ROOTS]
  return gitRaw(args, root).split('\0').filter(Boolean)
}

/** 按面批量取正文:HEAD 用 HEAD:<rel>,索引用 :<rel>(索引 blob 与工作区磁盘无关)。 */
function readFaceFiles(root, face, rels) {
  if (face === 'worktree') {
    const out = new Map()
    for (const rel of rels) out.set(rel, readWorktreeFile(root, rel))
    return out
  }
  const specs = rels.map((rel) => (face === 'head' ? `HEAD:${rel}` : `:${rel}`))
  const raw = catBatch(root, specs)
  const out = new Map()
  rels.forEach((rel, i) => out.set(rel, raw.get(specs[i]) ?? null))
  return out
}

function walkWorktree(dir, acc) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const ent of entries) {
    const p = resolve(dir, ent.name)
    if (ent.isDirectory()) {
      if (['node_modules', '__tests__', 'dist', 'build', '.next'].includes(ent.name)) continue
      walkWorktree(p, acc)
    } else if (SCAN_EXTS.some((ext) => ent.name.endsWith(ext))) {
      acc.push(p)
    }
  }
  return acc
}

function selfTest() {
  const cases = [
    {
      name: '病:括号形态 pinned ? (<PinOff />) : (<Pin />)',
      src: '<button type="button" aria-pressed={pinned} onClick={x}>{pinned ? (<PinOff />) : (<Pin />)}</button>',
      expectHits: 1,
    },
    {
      name: '病:三元形态 pinned ? <PinOff/> : <Pin/>',
      src: '<button type="button" aria-pressed={pinned}>{pinned ? <PinOff /> : <Pin />}</button>',
      expectHits: 1,
    },
    {
      name: '病:data-state on/off 双态 + 真值支画 EyeOff',
      src: `<button type="button" data-state={on ? 'on' : 'off'}>{on ? <EyeOff /> : <Eye />}</button>`,
      expectHits: 1,
    },
    {
      name: '绿:状态式 pinned ? <Pin/> : <PinOff/>',
      src: '<button type="button" aria-pressed={pinned}>{pinned ? <Pin /> : <PinOff />}</button>',
      expectHits: 0,
    },
    {
      name: '绿:菜单项 role=menuitem 动作图标',
      src: '<button role="menuitem">{pinned ? <PinOff /> : <Pin />}</button>',
      expectHits: 0,
    },
    {
      name: '绿:带可见文字的动作按钮',
      src: '<button aria-pressed={reveal}>{reveal ? <EyeOff /> : <Eye />}<span>隐藏</span></button>',
      expectHits: 0,
    },
    {
      name: '绿:静音关闭态族 VolumeX(状态式)',
      src: '<button aria-pressed={muted}>{muted ? <VolumeX /> : <Volume2 />}</button>',
      expectHits: 0,
    },
    {
      name: '绿:aria-expanded 搜索开关不在射程',
      src: '<button aria-expanded={open}>{open ? <X /> : <Search />}</button>',
      expectHits: 0,
    },
    {
      name: '绿:行内豁免',
      src: '<button aria-pressed={pinned}>{/* toggle-icon-exempt: 外部设计稿要求 */}{pinned ? <PinOff /> : <Pin />}</button>',
      expectHits: 0,
    },
  ]
  let failed = 0
  for (const c of cases) {
    const got = findViolations(c.src).length
    const ok = got === c.expectHits
    console.log(`${ok ? '✅' : '❌'} ${c.name} — 期望 ${c.expectHits}，实得 ${got}`)
    if (!ok) failed++
  }
  if (failed > 0) {
    console.error(`\n自检失败 ${failed} 例`)
    process.exit(1)
  }
  console.log(`\n自检通过 ${cases.length} 例`)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log(HELP_TEXT)
    return
  }
  if (args.includes('--self-test')) {
    selfTest()
    return
  }

  const face = args.includes('--staged') ? 'staged' : args.includes('--worktree') ? 'worktree' : 'head'

  let files
  try {
    if (face === 'worktree') {
      const acc = []
      for (const r of SCAN_ROOTS) walkWorktree(resolve(ROOT, r), acc)
      files = acc
        .map((p) => p.replace(ROOT, '').replace(/^[\\/]/, '').replace(/\\/g, '/'))
        .filter((p) => SCAN_EXTS.some((ext) => p.endsWith(ext)))
    } else {
      assertRepoRoot(ROOT, 'check-toggle-icon-semantics')
      files = listFaceFiles(ROOT, face).filter((p) => SCAN_EXTS.some((ext) => p.endsWith(ext)))
    }
  } catch (e) {
    console.error(`未判定(exit 2):取不到 ${face} 面清单 — ${e.message}`)
    process.exit(2)
  }

  let contents
  try {
    contents = readFaceFiles(ROOT, face, files)
  } catch (e) {
    console.error(`未判定(exit 2):读不到 ${face} 面内容 — ${e.message}`)
    process.exit(2)
  }

  let total = 0
  const reported = []
  for (const rel of files) {
    const src = contents.get(rel)
    if (src === null || src === undefined) {
      console.error(`未判定(exit 2):${face} 面取不到 ${rel} 的正文(不把没拿到记成没违规)`)
      process.exit(2)
    }
    const hits = findViolations(src)
    if (hits.length === 0) continue
    total += hits.length
    for (const h of hits) {
      reported.push(`  ${rel}:${h.line}  ${h.cond || 'data-state'} ? <${h.trueIcon}/> : <${h.falseIcon}/>`)
    }
  }

  if (total === 0) {
    console.log(`✅ toggle 图标语义守门通过(${files.length} 个文件,${face} 面)`)
    return
  }

  console.error(`❌ toggle 图标语义守门命中 ${total} 处(${face} 面):`)
  for (const r of reported) console.error(r)
  console.error('')
  console.error('   含义:常驻开关(aria-pressed + 高亮)的真值态画了"解除型"图标,视觉上与开启态相反。')
  console.error('   修法:真值支改用开启态图标 —— {pressed ? <Pin/> : <PinOff/>},')
  console.error('        或直接复用 @/components/common/pin-toggle-icon 的 <PinToggleIcon pressed={...}/>')
  console.error(`   紧急跳过:${SKIP_ENV}=1 git commit ...`)
  process.exit(1)
}

// §22d:本文件既可 CLI 直跑,也可被镜像测试 import 取判据;模块顶层零副作用、零 exit。
const isDirectRun =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭  toggle 图标语义守门(${SKIP_ENV}=1,跳过)`)
    process.exit(0)
  }
  main()
}

export const __test__ = { findViolations, iconTernariesOf, visibleTextOf, ACTION_OFF_ICONS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
