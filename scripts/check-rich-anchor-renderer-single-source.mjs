// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-rich-anchor-renderer-single-source.mjs
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门 249:富文本动作锚点渲染器单一源头(2026-10-25 立,D99/G-136 机制的账面兑现)。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,blocking,
 * skipEnv = HUSKY_SKIP_RICH_ANCHOR_RENDERER_SINGLE_SOURCE,stagedTriggers = apps/web/ 与 packages/shared/src/chat/)。
 *
 * —— 立因(现读为证,非假设)——
 * `apps/web/src/components/chat/rich-anchor-text.tsx` 的头注与 PROJECT_PLAN 台账都声称
 * `MISSING_ANCHOR_RENDERERS` 常量"供守门/自检在**不改类型**的场景下也能判红",但备案当刻
 * `git grep -n "MISSING_ANCHOR_RENDERERS\|RICH_ANCHOR" HEAD -- scripts` 实测 **0 个文件** ——
 * 那张账面从来没有付费人(AGENTS §0.9:"判据必须在真跑它的那一刻才成立:'造好没装车'= 没有")。
 * 同时 HEAD 面实测 1 处 `t.rich` 调用把白名单标签的渲染器**内联**在调用点
 * (`apps/web/src/components/ai/move-to-worktree-dialog.tsx` 的 `branch`),这正是"各建一套渲染器"
 * 的第一块分叉:表改了、内联副本不会跟着改,两条腿静默漂开且无从对账。本枚与那道内联由同一批落地。
 *
 * —— 三条判据(全维绝对零容忍,非棘轮)——
 * A1 表完备:同一取材轮内解析两枚载体 blob ——
 *     `packages/shared/src/chat/rich-anchors.ts` 的 `RICH_ANCHOR_TAGS` 数组字面量(白名单产地)
 *     与 `apps/web/src/components/chat/rich-anchor-text.tsx` 的 `RICH_ANCHOR_COMPONENTS` 对象字面量
 *     (渲染表产地)。判:① 标签集与键集**双向相等**——缺一个标签 ⇒ 红并点名该标签
 *     (这就是"MISSING_ANCHOR_RENDERERS 非空"的静态等价:该常量定义即 `RICH_ANCHOR_TAGS.filter(
 *     tag => typeof RICH_ANCHOR_COMPONENTS[tag] !== 'function')`,tags ⊆ keys ⇔ 运行时为空);
 *     ② 表多出白名单外键 ⇒ 红(等于在渲染面静默放宽可接受标签——整套机制防的就是这个);
 *     ③ 守卫声明本体必须在位且初始化式仍同时引用 `RICH_ANCHOR_TAGS` 与 `RICH_ANCHOR_COMPONENTS`,
 *        被改写成空数组字面量/摘除 ⇒ 红(守卫失去判红能力不允许"看起来绿")。
 *     为什么静态核而不是运行时 import:§0.4 同面同轮——运行时 import 只能读工作树(并行会话的
 *     半编辑态),且 `.tsx` 含 JSX 与 workspace 裸 specifier,node 直接求值不了;blob 才是被审面。
 * A2 同表唯一:扫 `apps/web/` 生产面(排除 `__tests__`/`*.test.*`/`*.spec.*`/`e2e/`/`.next*`)的
 *     **真 AST**(TypeScript 编译器 API,与门 241/116 同族载体,`createRequire` 取仓内 typescript,
 *     不写第二份提取器,§0.6/§22c):`<x>.rich(key, { … })` 调用第二参对象字面量里,键名落在
 *     RICH_ANCHOR_TAGS 白名单(与 A1 同一枚解析结果,单源)且值为**内联箭头/函数表达式** ⇒ 逐条点名
 *     `文件:行:标签` 判红。合法形状 = `richAnchorRenderer('<tag>')` 调用、`RICH_ANCHOR_COMPONENTS[...]`
 *     取键、或整体传表;非白名单键(branchName 这类插值参数)不管。计算键无法静态定名 ⇒ 同样判红
 *     (计算键是把"内联分叉"写成门读不懂的形状,失效方向必须是多要一次定向说明,§0.10)。
 * A3 载体在位:同轮清单里(非测试、非载体自身)必须存在至少一枚对 `rich-anchor-text` 的
 *     import / export-from 引用;枚举 0 ⇒ 红(§0.3 枚举到 0 判死不记绿;清单枚举本身为 0 枚或
 *     blob 取不到 ⇒ exit 2 未判定,绝不冒绿也不冒红)。
 *
 * 判红语义与唯一修法(§0.8:每条都实测可跑):
 *   A1 红 → 新增/删除标签必须两翼同批显式同步:先在 rich-anchors.ts 的 RICH_ANCHOR_TAGS 登记,
 *          再在 rich-anchor-text.tsx 的 RICH_ANCHOR_COMPONENTS 同表补键;守卫不许改写。
 *   A2 红 → 调用点改成 `{ <tag>: richAnchorRenderer('<tag>') }`(或整体传 RICH_ANCHOR_COMPONENTS)。
 *   A3 红 → 恢复任一生产屏面对 RichAnchorText/richAnchorRenderer 的真实挂载;**禁止为过门加假 import**。
 *
 * 取材面纪律(§0.4/守门 118):全量档判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;清单与内容同面同轮(一次 listFaceFiles +
 * 一次 catBatch 吃完,逐文件派生 = fork 风暴);取不到不回落另一个面。
 * 用法:node scripts/check-rich-anchor-renderer-single-source.mjs [--staged|--worktree] [--self-test] [--json]
 * 退出码:0 判过 / 1 判红 / 2 未判定(面取不到、枚举为 0、两面旗同给、门体自身异常)
 * 自检:node scripts/check-rich-anchor-renderer-single-source.mjs --self-test
 * 镜像测试:node --test scripts/tests/check-rich-anchor-renderer-single-source.test.mjs(判据 import 本文件 __test__,§22c)
 * 应急跳过(注册条体现值以 scripts/guardian-runner.mjs 为准):HUSKY_SKIP_RICH_ANCHOR_RENDERER_SINGLE_SOURCE=1
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  catBatch,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ts = createRequire(import.meta.url)('typescript')

/** 白名单产地(标签集唯一真相源) */
export const SHARED_MODULE = 'packages/shared/src/chat/rich-anchors.ts'
/** 渲染表产地(web 侧唯一渲染器) */
export const WEB_MODULE = 'apps/web/src/components/chat/rich-anchor-text.tsx'
/** A2/A3 的扫描根 */
export const SCAN_ROOT = 'apps/web'
/** 测试面/构建产物排除(生产码才是射程) */
const TEST_PATH_RE =
  /(^|\/)(__tests__|e2e)\/|\.test\.[cm]?[tj]sx?$|\.spec\.[cm]?[tj]sx?$|(^|\/)\.next/

const ANCHOR_NEEDLE = path.posix.basename(WEB_MODULE).replace(/\.tsx?$/, '')

/** 纯函数:该路径是否属于生产源码射程。 */
export function isProductionSource(p) {
  const f = String(p).replace(/\\/g, '/')
  return (f.endsWith('.ts') || f.endsWith('.tsx')) && !TEST_PATH_RE.test(f)
}

function loadSource(text, fileName) {
  return ts.createSourceFile(
    fileName,
    String(text),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
}

function visit(node, cb) {
  cb(node)
  ts.forEachChild(node, (n) => visit(n, cb))
}

function lineOf(src, node) {
  return src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1
}

/** 属性名节点 → {tag, computed};计算键非字面量时 tag=null(调用方按"静态不可核"处理)。 */
function propertyName(nameNode) {
  if (ts.isIdentifier(nameNode)) return { tag: nameNode.text, computed: false }
  if (ts.isStringLiteral(nameNode)) return { tag: nameNode.text, computed: false }
  if (ts.isComputedPropertyName(nameNode)) {
    const e = nameNode.expression
    return { tag: ts.isStringLiteral(e) ? e.text : null, computed: true }
  }
  return { tag: null, computed: false }
}

/** 解析 `RICH_ANCHOR_TAGS = [...] as const` 的标签数组;找不到声明 ⇒ null(产地失踪,交 A1 判红)。 */
export function parseTagWhitelist(text, fileName = SHARED_MODULE) {
  const src = loadSource(text, fileName)
  let tags = null
  visit(src, (node) => {
    if (tags || !ts.isVariableDeclaration(node)) return
    if (!ts.isIdentifier(node.name) || node.name.text !== 'RICH_ANCHOR_TAGS') return
    let init = node.initializer
    if (init && ts.isAsExpression(init)) init = init.expression
    if (init && ts.isArrayLiteralExpression(init)) {
      tags = init.elements.filter((el) => ts.isStringLiteral(el)).map((el) => el.text)
    }
  })
  return tags
}

/** 解析渲染表与运行时守卫声明;返回 {table, guard}(table=null ⇒ 表产地失踪)。 */
export function parseRendererTable(text, fileName = WEB_MODULE) {
  const src = loadSource(text, fileName)
  let table = null
  let guard = null
  visit(src, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return
    if (node.name.text === 'RICH_ANCHOR_COMPONENTS') {
      if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        const entries = []
        const nullish = []
        for (const p of node.initializer.properties) {
          if (ts.isSpreadAssignment(p)) {
            entries.push({ tag: null, spread: true })
            continue
          }
          if (!ts.isPropertyAssignment(p)) continue
          const info = propertyName(p.name)
          entries.push(info)
          if (
            p.initializer.kind === ts.SyntaxKind.NullKeyword ||
            p.initializer.kind === ts.SyntaxKind.UndefinedKeyword
          ) {
            nullish.push(info.tag ?? '(computed)')
          }
        }
        table = { entries, nullish }
      }
    } else if (node.name.text === 'MISSING_ANCHOR_RENDERERS') {
      const initText = node.initializer ? node.initializer.getText(src) : ''
      const emptyLiteral =
        !!node.initializer &&
        ts.isArrayLiteralExpression(node.initializer) &&
        node.initializer.elements.length === 0
      const refsBoth =
        initText.includes('RICH_ANCHOR_TAGS') && initText.includes('RICH_ANCHOR_COMPONENTS')
      guard = {
        found: true,
        line: lineOf(src, node),
        sane: !emptyLiteral && refsBoth,
        detail: emptyLiteral
          ? '守卫被改写成空数组字面量(自我洗白,运行时恒"无缺口")'
          : refsBoth
            ? ''
            : '守卫初始化式不再同时引用 RICH_ANCHOR_TAGS ∧ RICH_ANCHOR_COMPONENTS(守卫被摘线)',
      }
    }
  })
  return {
    table,
    guard: guard ?? {
      found: false,
      sane: false,
      line: null,
      detail: 'MISSING_ANCHOR_RENDERERS 声明不在被审面(账面声称的运行时守门钩子被整体摘除)',
    },
  }
}

/** A1 裁决(纯函数):白名单集 vs 渲染表键集 + 守卫本体完好性。 */
export function judgeA1(tags, parsed) {
  const out = []
  if (tags === null) {
    out.push({
      dim: 'A1',
      detail: `${SHARED_MODULE} 内未找到 RICH_ANCHOR_TAGS 数组字面量声明(白名单产地失踪)`,
    })
  } else if (tags.length === 0) {
    out.push({ dim: 'A1', detail: 'RICH_ANCHOR_TAGS 枚到 0 个标签 —— 枚举为 0 判死不记绿(§0.3)' })
  }
  if (!parsed.table) {
    out.push({
      dim: 'A1',
      detail: `${WEB_MODULE} 内未找到 RICH_ANCHOR_COMPONENTS 对象字面量(渲染表产地失踪)`,
    })
  }
  if (!parsed.guard.sane) {
    out.push({
      dim: 'A1',
      detail: `${WEB_MODULE}${parsed.guard.line ? `:${parsed.guard.line}` : ''} ${parsed.guard.detail}`,
    })
  }
  if (tags && parsed.table) {
    const keySet = new Set()
    for (const e of parsed.table.entries) {
      if (e.spread) {
        out.push({
          dim: 'A1',
          detail: '渲染表出现展开运算符(...):键集静态不可核,白名单漂移无从判起',
        })
        continue
      }
      if (e.computed && e.tag === null) {
        out.push({
          dim: 'A1',
          detail: '渲染表出现非字面量计算键:静态不可核(把漂移写成门读不懂的形状不放行,§0.10)',
        })
        continue
      }
      if (e.tag !== null) keySet.add(e.tag)
    }
    for (const t of tags) {
      if (!keySet.has(t)) {
        out.push({
          dim: 'A1',
          tag: t,
          detail: `白名单标签 "${t}" 在渲染表无对应键 ⇒ MISSING_ANCHOR_RENDERERS 运行时非空`,
        })
      }
    }
    for (const k of keySet) {
      if (!tags.includes(k)) {
        out.push({
          dim: 'A1',
          tag: k,
          detail: `渲染表多出白名单外键 "${k}" ⇒ 渲染面静默放宽可接受标签(白名单漂移)`,
        })
      }
    }
    for (const n of parsed.table.nullish) {
      out.push({ dim: 'A1', detail: `渲染表键 "${n}" 的值是 null/undefined(键在位但渲染器是空的)` })
    }
  }
  return out
}

/** A2 裁决(纯函数):真 AST 找 `x.rich(key, { <白名单标签>: 内联箭头/函数 } )` 的分叉渲染器。 */
export function findInlineRichRenderers(text, fileName, tagSet) {
  const src = loadSource(text, fileName)
  const hits = []
  visit(src, (node) => {
    if (!ts.isCallExpression(node)) return
    const callee = node.expression
    if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'rich') return
    const opts = node.arguments.length >= 2 ? node.arguments[1] : undefined
    if (!opts || !ts.isObjectLiteralExpression(opts)) return
    for (const p of opts.properties) {
      if (!ts.isPropertyAssignment(p)) continue
      const inline = ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer)
      if (!inline) continue
      const info = propertyName(p.name)
      const inScope = info.computed
        ? info.tag === null || tagSet.has(info.tag)
        : tagSet.has(info.tag)
      if (!inScope) continue
      hits.push({ file: fileName, line: lineOf(src, p), tag: info.tag ?? '(computed)' })
    }
  })
  return hits
}

/** A3 裁决素材(纯函数):枚举经 import/export-from 引用载体模块的生产文件(排除载体自身)。 */
export function findAnchorModuleImporters(items) {
  const importers = []
  for (const it of items) {
    if (it.p === WEB_MODULE) continue
    if (!String(it.s).includes(ANCHOR_NEEDLE)) continue
    const src = loadSource(it.s, it.p)
    let hit = false
    visit(src, (node) => {
      if (hit) return
      const specNode =
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
      if (specNode && ts.isStringLiteral(specNode) && specNode.text.includes(ANCHOR_NEEDLE))
        hit = true
    })
    if (hit) importers.push(it.p)
  }
  return importers
}

function specOf(face, p) {
  return face === 'head' ? `HEAD:${p}` : face === 'staged' ? `:${p}` : p
}

/** 清单 + 同轮批量内容;任何一枚取不到 ⇒ Undetermined 点名(绝不回落另一个面、绝不按"剩下的"记绿)。 */
function collectRound(root, face) {
  const listed = listFaceFiles(root, face, { paths: [SCAN_ROOT], timeout: 120_000 })
  const candidates = listed.filter(isProductionSource)
  if (candidates.length === 0) {
    throw new Undetermined(
      `${face} 面在 ${SCAN_ROOT}/ 下枚出的生产 ts/tsx 为 0 枚 —— 清单本身可疑,不判"没问题"`,
    )
  }
  const needed = [...new Set([...candidates, WEB_MODULE, SHARED_MODULE])]
  const texts = new Map()
  if (face === 'worktree') {
    const missing = []
    for (const p of needed) {
      const t = readWorktreeFile(root, p)
      if (t === null) missing.push(p)
      else texts.set(p, t)
    }
    if (missing.length) {
      throw new Undetermined(
        `worktree 面 ${missing.length} 枚取不到(如 ${missing[0]})——不回落另一个面`,
      )
    }
    return { candidates, texts }
  }
  const map = catBatch(
    root,
    needed.map((p) => specOf(face, p)),
    { maxBuffer: 1 << 29 },
  )
  const missing = needed.filter((p) => {
    const v = map.get(specOf(face, p))
    return v === null || v === undefined
  })
  if (missing.length) {
    throw new Undetermined(
      `${face} 面 ${missing.length}/${needed.length} 枚 blob 取不到(如 ${missing[0]})⇒ 未判定,绝不按"剩下的"记绿`,
    )
  }
  for (const p of needed) texts.set(p, map.get(specOf(face, p)))
  return { candidates, texts }
}

/** 全链执行:返回 {status:0|1|2, lines:string[]}。红优先于未判定(失效方向 = 多要一次说明,§0.10)。 */
export function runAudit({ root = ROOT, face, json = false } = {}) {
  const lines = []
  try {
    const { candidates, texts } = collectRound(root, face)
    const tags = parseTagWhitelist(texts.get(SHARED_MODULE))
    const parsed = parseRendererTable(texts.get(WEB_MODULE))
    const a1 = judgeA1(tags, parsed)
    const tagSet = new Set(tags ?? [])
    const a2 = []
    if (tags && tags.length > 0) {
      for (const p of candidates) {
        const s = texts.get(p)
        if (!s || !s.includes('.rich(')) continue
        a2.push(...findInlineRichRenderers(s, p, tagSet))
      }
    }
    const importers = findAnchorModuleImporters(candidates.map((p) => ({ p, s: texts.get(p) })))
    const a3Red = importers.length === 0
    const red = a1.length > 0 || a2.length > 0 || a3Red
    if (json) {
      return {
        status: red ? 1 : 0,
        lines: [
          JSON.stringify({
            face,
            scanned: candidates.length,
            a1,
            a2,
            a3: { importers, red: a3Red },
          }),
        ],
      }
    }
    for (const v of a1) lines.push(`  ❌ A1 表完备 — ${v.detail}`)
    for (const h of a2) {
      lines.push(
        `  ❌ A2 同表唯一 — ${h.file}:${h.line} 白名单标签 "${h.tag}" 在 t.rich 调用处内联自建渲染器(修法:richAnchorRenderer('${h.tag === '(computed)' ? '<tag>' : h.tag}'))`,
      )
    }
    if (a3Red) {
      lines.push(
        `  ❌ A3 载体在位 — apps/web 生产面(排除测试与载体自身)对 "${ANCHOR_NEEDLE}" 的 import/export-from 引用枚到 0 —— 富文本锚点整条腿没装车(§0.9)`,
      )
    }
    if (red) {
      lines.push(
        `❌ 富文本锚点渲染器单一源头(${face} 面,扫 ${candidates.length} 枚生产 ts/tsx):A1 ${a1.length} 缺口 / A2 ${a2.length} 处分叉 / A3 importer ${importers.length} 个${a3Red ? '(枚举 0 判死)' : ''} —— 判红即修法见点名行,禁止改判据消红`,
      )
      return { status: 1, lines }
    }
    lines.push(
      `✅ 富文本锚点渲染器单一源头(${face} 面):标签 ${tags.length} 枚与渲染表键集逐相等,守卫在位;t.rich 内联分叉 0 处(扫 ${candidates.length} 枚生产 ts/tsx);载体 importer ${importers.length} 个(${importers.join(' , ')})`,
    )
    return { status: 0, lines }
  } catch (e) {
    if (e instanceof Undetermined) {
      lines.push(`⚪ 未判定:${e.message}(不记绿也不冒红;取到输入后重跑本命令)`)
      return { status: 2, lines }
    }
    lines.push(`⚪ 未判定:门体自身异常(${String(e && e.message ? e.message : e)})`)
    return { status: 2, lines }
  }
}

// ───────────────────────── self-test(成对用例;失败方向 = 点名 + exit 1)─────────────────────────

function tagsFixture(tags) {
  return `export const RICH_ANCHOR_TAGS = [${tags.map((t) => `'${t}'`).join(', ')}] as const\n`
}

function webFixture(keys, guardText) {
  const body = keys.map((k) => `${k}: (chunks) => chunks,`).join('\n  ')
  const guard =
    guardText ??
    `export const MISSING_ANCHOR_RENDERERS = RICH_ANCHOR_TAGS.filter(\n  (tag) => typeof RICH_ANCHOR_COMPONENTS[tag] !== 'function',\n)\n`
  return `export const RICH_ANCHOR_COMPONENTS = {\n  ${body}\n}\n${guard}`
}

function selfTest({ mkScratch, rmScratch }) {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const ALL = [
    'a',
    'action',
    'branch',
    'code',
    'detail',
    'learnMore',
    'link',
    'status',
    'strong',
    'verb',
  ]

  t('T1 白名单解析:数组字面量 + as const 逐字取回', () => {
    const got = parseTagWhitelist(tagsFixture(ALL))
    if (!got || got.join(',') !== ALL.join(',')) throw new Error(`解析错位:${JSON.stringify(got)}`)
  })
  t('T2 A1 零判:键集==标签集且守卫健全 ⇒ 0 缺口', () => {
    const v = judgeA1(parseTagWhitelist(tagsFixture(ALL)), parseRendererTable(webFixture(ALL)))
    if (v.length !== 0) throw new Error(`本应零判,实得:${JSON.stringify(v)}`)
  })
  t('T3 A1 正控:表缺 branch ⇒ 红并点名该标签', () => {
    const v = judgeA1(
      parseTagWhitelist(tagsFixture(ALL)),
      parseRendererTable(webFixture(ALL.filter((k) => k !== 'branch'))),
    )
    if (v.length !== 1 || v[0].tag !== 'branch')
      throw new Error(`未点名 branch:${JSON.stringify(v)}`)
  })
  t('T4 A1 正控:表多 iframe(白名单外键)⇒ 红(渲染面静默放宽不放行)', () => {
    const v = judgeA1(
      parseTagWhitelist(tagsFixture(ALL)),
      parseRendererTable(webFixture([...ALL, 'iframe'])),
    )
    if (v.length !== 1 || v[0].tag !== 'iframe')
      throw new Error(`未点名 iframe:${JSON.stringify(v)}`)
  })
  t('T5 A1 正控:守卫被洗成空数组字面量 ⇒ 红(守卫失权不允许"看起来绿")', () => {
    const v = judgeA1(
      parseTagWhitelist(tagsFixture(ALL)),
      parseRendererTable(webFixture(ALL, 'export const MISSING_ANCHOR_RENDERERS = []\n')),
    )
    if (v.length !== 1 || !/空数组字面量/.test(v[0].detail))
      throw new Error(`未判出守卫洗白:${JSON.stringify(v)}`)
  })
  t('T6 A1 正控:守卫声明整体摘除 ⇒ 红', () => {
    const v = judgeA1(parseTagWhitelist(tagsFixture(ALL)), parseRendererTable(webFixture(ALL, '')))
    if (v.length !== 1 || !/不在被审面/.test(v[0].detail))
      throw new Error(`未判出守卫摘线:${JSON.stringify(v)}`)
  })
  t('T7 A1 正控:白名单产地失踪 ⇒ 红(声明不在面 = 判出的状态,不是取不到输入)', () => {
    const v = judgeA1(
      parseTagWhitelist('export const SOMETHING_ELSE = 1\n'),
      parseRendererTable(webFixture(ALL)),
    )
    if (!v.some((x) => /产地失踪/.test(x.detail)))
      throw new Error(`未判出产地失踪:${JSON.stringify(v)}`)
  })
  t('T8 A2 零判:richAnchorRenderer 调用/整体传表/非白名单键 都不咬', () => {
    const tagSet = new Set(ALL)
    const src = [
      `const x = t.rich('k', { code: richAnchorRenderer('code'), branchName: branchName ?? '' })`,
      `const y = t.rich('k2', RICH_ANCHOR_COMPONENTS)`,
    ].join('\n')
    const hits = findInlineRichRenderers(src, 'probe.tsx', tagSet)
    if (hits.length !== 0) throw new Error(`合法形状被咬:${JSON.stringify(hits)}`)
  })
  t('T9 A2 正控:白名单标签内联箭头(含 JSX 体)⇒ 点名 文件:行:标签', () => {
    const src = `export function A() {\n  return t.rich('subtitle', {\n    branchName: 'v',\n    branch: (chunks) => <code className="font-mono text-xs">{chunks}</code>,\n  })\n}\n`
    const hits = findInlineRichRenderers(src, 'apps/web/src/components/ai/probe.tsx', new Set(ALL))
    if (hits.length !== 1 || hits[0].tag !== 'branch' || hits[0].line !== 4) {
      throw new Error(`A2 判序错位:${JSON.stringify(hits)}`)
    }
  })
  t('T10 A2 正控:计算键 + 内联渲染器 ⇒ 红(把分叉写成门读不懂的形状不放行)', () => {
    const hits = findInlineRichRenderers(
      `t.rich('k', { [dyn]: (chunks) => chunks })`,
      'probe.tsx',
      new Set(ALL),
    )
    if (hits.length !== 1 || hits[0].tag !== '(computed)')
      throw new Error(`计算键未被点名:${JSON.stringify(hits)}`)
  })
  t('T11 真夹具成对翻转(mkScratch 落盘夹具:带违规⇒红,改为叫表⇒绿;夹具不落仓库树)', () => {
    const dir = mkScratch('rich-anchor-gate')
    try {
      const bad = [
        `import type { ReactNode } from 'react'`,
        `export function D({ branchName }: { branchName?: string }) {`,
        `  return t.rich('subtitle', {`,
        `    branchName: branchName ?? '',`,
        `    branch: (chunks: ReactNode) => <code>{chunks}</code>,`,
        `  })`,
        `}`,
        '',
      ].join('\n')
      const p = path.join(dir, 'move-dialog-probe.tsx')
      readFileSyncFix(p, bad)
      const hits1 = findInlineRichRenderers(readFileSync(p, 'utf8'), p, new Set(ALL))
      if (hits1.length !== 1) throw new Error(`夹具违规应 1 处,实得 ${hits1.length}`)
      const good = bad.replace(
        'branch: (chunks: ReactNode) => <code>{chunks}</code>,',
        "branch: richAnchorRenderer('branch'),",
      )
      readFileSyncFix(p, good)
      const hits2 = findInlineRichRenderers(readFileSync(p, 'utf8'), p, new Set(ALL))
      if (hits2.length !== 0) throw new Error(`移除违规后应翻绿,实得:${JSON.stringify(hits2)}`)
    } finally {
      rmScratch(dir)
    }
  })
  t('T12 A3 成对:importer 枚到 0 ⇒ 红;载体自身不得自荐;相对 specifier 引用算 importer', () => {
    const self = { p: WEB_MODULE, s: `export const RichAnchorText = 1` }
    const none = findAnchorModuleImporters([self])
    if (none.length !== 0) throw new Error('载体自身被算成 importer')
    const withImporter = findAnchorModuleImporters([
      self,
      {
        p: 'apps/web/src/components/chat/message-list/MessageItem.tsx',
        s: `import { RichAnchorText } from '../rich-anchor-text'\n`,
      },
    ])
    if (withImporter.length !== 1)
      throw new Error(`importer 判序错位:${JSON.stringify(withImporter)}`)
  })
  t('T13 两面旗同给 ⇒ 未判定(不回落任一面)', () => {
    const sel = selectFace({ staged: true, worktree: true })
    if (!sel.error) throw new Error('selectFace 未拦两面同给')
  })
  t('T14 非仓库面实派生 ⇒ 未判定(取不到输入不冒红)', () => {
    const dir = mkScratch('rich-anchor-gate-nogit')
    try {
      let threw = false
      try {
        collectRound(dir, 'head')
      } catch (e) {
        threw = e instanceof Undetermined
      }
      if (!threw) throw new Error('非仓库面未被判成未判定')
    } finally {
      rmScratch(dir)
    }
  })

  function readFileSyncFix(p, content) {
    // 夹具写入(fs 只在 self-test 用,生产判据路径不落任何盘)
    fsMod.writeFileSync(p, content, 'utf8')
  }

  let pass = 0
  const fails = []
  for (const c of cases) {
    try {
      c.fn()
      pass++
      console.log(`  ✅ ${c.name}`)
    } catch (e) {
      fails.push(c.name)
      console.log(`  ❌ ${c.name}:${e && e.message ? e.message : e}`)
    }
  }
  const tail = fails.length
    ? `❌ 自检 ${pass}/${cases.length} 过,${fails.length} 败:${fails.join(' | ')}`
    : `✅ 自检 ${pass}/${cases.length} 例全过(含 A1/A2/A3 成对正反控与真夹具翻转)`
  console.log(tail)
  return fails.length ? 1 : 0
}

let fsMod = null

async function main() {
  const argv = process.argv.slice(2)
  if (argv.some((a) => a === '--help' || a === '-h')) {
    console.log(
      '用法: node scripts/check-rich-anchor-renderer-single-source.mjs [--staged|--worktree|--self-test|--json]',
    )
    return 0
  }
  if (argv.includes('--self-test')) {
    fsMod = await import('node:fs')
    const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
    return selfTest({ mkScratch, rmScratch })
  }
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.log(`⚪ 未判定:${sel.error}`)
    return 2
  }
  const r = runAudit({ face: sel.face, json: argv.includes('--json') })
  for (const l of r.lines) console.log(l)
  return r.status
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  SHARED_MODULE,
  WEB_MODULE,
  SCAN_ROOT,
  ANCHOR_NEEDLE,
  isProductionSource,
  parseTagWhitelist,
  parseRendererTable,
  judgeA1,
  findInlineRichRenderers,
  findAnchorModuleImporters,
  collectRound,
  runAudit,
  tagsFixture,
  webFixture,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
