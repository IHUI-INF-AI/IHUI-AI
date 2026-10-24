// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子需输出读数 */
/**
 * check-rn-readout-cell.mjs —— 端侧「等分读数格」AST 判据(守门 241,blocking)。
 *
 * 为什么用 AST 不用正则:扁平 StyleSheet 正则扫出 638 处「fontSize≥16 且粗体」,
 * 绝大多数是标题不是读数;"这个 style 是否住在等分读数格里"只有 JSX 父子关系知道
 * (docs/UI_GUIDELINES.md §13.4)。真三元组:
 *   <View style={ROW}>                      ROW: flexDirection:'row'
 *     <View style={CELL}>                   CELL: flex:1
 *       <Text style={VAL}>…</Text>          VAL:  fontSize ≥ 16 且 600/700
 *
 * 判定五条,按宿主形态分档(§13.4 唯一写法):
 *   V1 等分格必须有 minWidth —— `flex:1` 的 flexBasis 是 0,永远等分压缩,读数必折行;
 *   V2 等分行必须有 flexWrap:'wrap' —— minWidth 生效后不换行,就是溢出压到邻居;
 *   V3 space-between 行内的读数必须有 flexShrink:0 —— 行内两个子项都没 flex 时,
 *      读数默认 flexShrink:1,行宽不够**先压读数**,标签反而完整(压错了那一个);
 *   V4 absolute 容器内的读数同上;
 *   V5 定宽格(width:NN% / flexBasis)必须有 minWidth —— flexShrink 是纵向主轴属性,
 *      对横向定宽无效,给它加 flexShrink 等于没加。
 * 「有 flexWrap 就免疫」是错的:没有 minWidth 时子项总宽永不超容器,wrap 一次都不触发。
 *
 * 读数与文案的分档:数值词(readout) / 标题名类词(text) / 都不像(unknown)。
 * 词表只认标识符、不认字符串字面量 —— i18n key 里的 "count"/"withdraw"/"point" 会把纯标题
 * 判成读数(实测)。unknown 只报数,不冒红也不算绿(AGENTS §0.3)。
 *
 * 用法:node scripts/check-rn-readout-cell.mjs [--staged|--worktree] [--json]
 * 退出码:0 无缺口 / 1 有缺口 / 2 未判定(取不到被审面 / 空扫 / 解析全失败)。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
// 取材一律经统一取材层(门 118 取材面纪律):全量判 HEAD blob、--staged 判索引 blob、
// --worktree 读磁盘,取不到就 exit 2 —— 不自己派生 git 命令,也不回落另一个面。
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
const GIT_TIMEOUT = 120_000

export const SCOPE_PREFIXES = ['packages/app/', 'apps/mobile-rn/', 'apps/miniapp-taro/']
const EXCLUDE = /node_modules|\/dist\/|\.test\.|\.spec\.|__tests__/

export function inScope(p) {
  const f = p.replace(/\\/g, '/')
  return /\.tsx$/.test(f) && !EXCLUDE.test(f) && SCOPE_PREFIXES.some((s) => f.startsWith(s))
}

/** 从StyleSheet.create({...}) 抽 styleName → 属性文本(简化:只取直接属性的正则级信息,靠 AST 定位)。 */
function styleNameOf(node) {
  if (!node) return null
  // JSX 里写的是 style={s.row} ⇒ 拿到的是 JsxExpression 容器,真表达式在 .expression
  const inner = node.kind === ts.SyntaxKind.JsxExpression ? node.expression : node
  if (!inner) return null
  if (inner.kind === ts.SyntaxKind.Identifier) return inner.text
  if (inner.kind === ts.SyntaxKind.PropertyAccessExpression) return inner.name?.text ?? null
  return null
}

function objProps(objLit) {
  const map = new Map()
  for (const p of objLit.properties ?? []) {
    if (p.kind !== ts.SyntaxKind.PropertyAssignment) continue
    const k = p.name?.text ?? p.name?.getName?.()
    if (!k) continue
    map.set(k, p.initializer)
  }
  return map
}

function numProp(map, key) {
  const v = map.get(key)
  if (!v) return null
  if (v.kind === ts.SyntaxKind.NumericLiteral) return Number(v.text)
  return null
}
function boolish(map, key) {
  const v = map.get(key)
  if (!v) return null
  return v.kind === ts.SyntaxKind.StringLiteral ? v.text : v.getText()
}

/** 解析一个 .tsx:返回 violations 与 stats。 */
export function analyze(src) {
  const sf = ts.createSourceFile('x.tsx', src, ts.ScriptTarget.Latest, true)
  const styles = new Map() // name -> props Map
  // `StyleSheet.create({…} satisfies Foo)` / `as Foo` / 括号包裹 都会让实参不是 ObjectLiteral。
  // 不剥这层包装,那 17 个用 `satisfies` 的样式表就整张采不到 ⇒ 里面的读数格静默算绿
  // (2026-10-24 实测:射程内 17 个)。这是"没判写成判过"的典型形态,必须剥。
  const unwrap = (n) => {
    let cur = n
    for (let i = 0; i < 8 && cur; i += 1) {
      const k = cur.kind
      if (k === ts.SyntaxKind.SatisfiesExpression || k === ts.SyntaxKind.AsExpression || k === ts.SyntaxKind.ParenthesizedExpression) {
        cur = cur.expression
        continue
      }
      break
    }
    return cur
  }
  const visit = (n) => {
    if (n.kind === ts.SyntaxKind.CallExpression) {
      const callee = n.expression
      const calleeName =
        callee.kind === ts.SyntaxKind.Identifier
          ? callee.text
          : callee.kind === ts.SyntaxKind.PropertyAccessExpression
            ? callee.name?.text
            : null
      const arg0 = unwrap(n.arguments?.[0])
      if ((calleeName === 'create' || calleeName === 'stylesheet') && arg0?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
        for (const p of arg0.properties) {
          if (p.kind !== ts.SyntaxKind.PropertyAssignment) continue
          const name = p.name?.text
          if (name && unwrap(p.initializer)?.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            styles.set(name, objProps(unwrap(p.initializer)))
          }
        }
      }
    }
    n.forEachChild(visit)
  }
  sf.forEachChild(visit)

  const violations = []
  const triples = []
  const unjudged = []
  const squeezed = [] // V3/V4/V5:非等分宿主的读数(space-between 行 / absolute 容器 / 定宽格)
  let jsxNodes = 0
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  // 「这行 Text 写的是读数还是文案」——本尺唯一的语义判据,写错就是造几百枚假红。
  // 只按「内容来自表达式」判不够:实测 `panel?.name`、`item.title`、`item.agentName` 全是表达式,
  // 它们是标题/名称。所以按**属性名与函数名词表**分三档,判不出的进 unknown 报数,绝不冒红:
  //   readout = 数值化词(金额/计数/时长/比率…)
  //   text    = 标题名类词(title/name/label/desc…)且不含数值词
  //   unknown = 两边都不像 ⇒ 未判定,只报数
  const I18N_CALL = /^(t|t[A-Z]\w*|translate|i18n\w*|formatMessage|intl\w*)\s*\(/
  const NUMERIC_LITERAL = /^[\s\d.,%¥$+\-:/~～：，、()]+$/
  const NUMERIC_LIKE =
    /(count|total|amount|sum|days?\b|streak|score|balance|value|num\b|rate|percent|ratio|duration|commission|token|price|yuan|income|earn|withdraw|point|credit|fee|cost|quota|used|remain|left\b|expire|format|fmt|toFixed|avg|max|min\b|limit|size|length|qty|quantity)/i
  const TEXT_LIKE = /(title|name|nickname|label|desc|content|text|tag|status|type|code|remark|address|phone|email|avatar|icon|hint|tip|placeholder|message|reason|category)/i
  function classify(rowName, cellName, raw) {
    // 词表只认**标识符与属性名**,不认字符串字面量里的词 —— 否则 i18n key 会污染判定:
    // 实测 `t('connectedAccounts.title')` 的 key 里有 "count"、`t('wallet.withdraw')` 里有
    // "withdraw"、`t('pointHistory.title')` 里有 "point",三个纯标题都被判成读数。
    const stripped = raw.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''")
    if (I18N_CALL.test(stripped)) return 'text'
    if (NUMERIC_LITERAL.test(raw.trim())) return 'readout' // `{1}` / `{12.3}` 这类直接写死的读数
    if (NUMERIC_LIKE.test(stripped)) return 'readout'
    if (TEXT_LIKE.test(`${rowName}/${cellName} ${stripped}`)) return 'text'
    return 'unknown'
  }
  function textKindOf(jsx, rowName, cellName) {
    const kids = jsx.children ?? []
    const lit = kids
      .filter((k) => k.kind === ts.SyntaxKind.JsxText)
      .map((k) => k.getText())
      .join('')
      .trim()
    const exprs = kids.filter((k) => k.kind === ts.SyntaxKind.JsxExpression && k.expression).map((k) => k.expression.getText())
    const raw = [lit, ...exprs].filter(Boolean).join(' + ')
    if (exprs.length > 0) return { kind: classify(rowName, cellName, raw), text: raw }
    if (!lit) return { kind: 'text', text: '' } // 自闭合 / 只有图标
    if (NUMERIC_LITERAL.test(lit)) return { kind: 'readout', text: lit }
    return { kind: 'text', text: lit }
  }
  // 遍历 JSX:找 <X style={styles.ROW}> → 子 <View style={styles.CELL}> → 子树 <Text style={styles.VAL}>
  // ancestors = 从最近父级往上的 [{tag, name, props}],用于判"读数住在什么宿主里"。
  const walkJsx = (n, ancestors = []) => {
    if (n.kind === ts.SyntaxKind.JsxElement || n.kind === ts.SyntaxKind.JsxSelfClosingElement) {
      jsxNodes += 1
      const open = n.kind === ts.SyntaxKind.JsxElement ? n.openingElement : n
      const tag = open.tagName?.getText()
      const styleArg = open.attributes?.properties?.find(
        (a) => a.kind === ts.SyntaxKind.JsxAttribute && a.name?.text === 'style',
      )
      const stName = styleArg ? styleNameOf(styleArg.initializer) : null
      const st = stName && styles.has(stName) ? styles.get(stName) : null
      const nextAnc = [{ tag, name: stName, props: st }, ...ancestors]

      const isReadoutText = (styleMap) => {
        const f = numProp(styleMap, 'fontSize')
        const fw = String(boolish(styleMap, 'fontWeight') ?? '')
        return f && f >= 16 && /600|700|800|bold/i.test(fw) ? f : null
      }
      // 子树里找第一个读数型 Text(与等分判据同一套读数/文案词表)
      const firstReadoutIn = (root, rowName, cellName) => {
        let found = null
        const chWalk = (m) => {
          if (found) return
          if (m.kind === ts.SyntaxKind.JsxSelfClosingElement || m.kind === ts.SyntaxKind.JsxElement) {
            const mo = m.kind === ts.SyntaxKind.JsxElement ? m.openingElement : m
            if (mo.tagName?.getText() === 'Text') {
              const sa = mo.attributes?.properties?.find((a) => a.kind === ts.SyntaxKind.JsxAttribute && a.name?.text === 'style')
              const sn = sa ? styleNameOf(sa.initializer) : null
              const sv = sn ? styles.get(sn) : null
              const f = sv ? isReadoutText(sv) : null
              if (f) {
                const kind = textKindOf(m, rowName, cellName)
                if (kind.kind === 'readout') found = { fs: f, text: kind.text, line: lineOf(m), textStyle: sn }
                else if (kind.kind === 'unknown') unjudged.push({ row: rowName, cell: cellName, fs: f, text: kind.text, line: lineOf(m) })
              }
            }
          }
          m.forEachChild(chWalk)
        }
        chWalk(root)
        return found
      }

      // ── V3 / V4:非等分宿主。判据覆盖不到 flex:1 格,但读数同样会被压缩 ──
      // V3 行是 `space-between`(标签左 / 读数右):两个子项都没有 flex,读数默认 flexShrink:1,
      //    行宽不够时先压读数 ⇒ 折行。免疫条件 = 读数 Text 自己带 flexShrink:0 或 minWidth。
      // V4 读数住在 position:'absolute' 的容器里(角标 / 悬浮层):容器宽度由内容决定但受父宽约束,
      //    同样靠 flexShrink:0 兜。两者判同一个属性,所以合成一条 why。
      if (tag === 'Text' && st) {
        const f = isReadoutText(st)
        if (f) {
          const kind = textKindOf(n, stName ?? '', stName ?? '')
          if (kind.kind === 'readout') {
            const parentView = ancestors.find((a) => a.tag === 'View')
            const pv = parentView?.props
            const pvRow = pv && /row/.test(String(boolish(pv, 'flexDirection') ?? ''))
            const sbRow = pvRow && boolish(pv, 'justifyContent') === 'space-between' && numProp(pv, 'flex') !== 1
            const absHost = ancestors.find((a) => a.props && boolish(a.props, 'position') === 'absolute')
            const immune = numProp(st, 'flexShrink') === 0 || st.has('minWidth')
            if ((sbRow || absHost) && !immune) {
              squeezed.push({
                host: sbRow ? 'space-between' : 'absolute',
                row: parentView?.name ?? '(无 style)',
                cell: absHost?.name ?? parentView?.name ?? '',
                textStyle: stName,
                maxFs: f,
                text: kind.text,
                line: lineOf(n),
                why: sbRow
                  ? 'space-between 行内的读数缺 flexShrink:0:行宽不够时先压读数 ⇒ 折行'
                  : 'absolute 容器内的读数缺 flexShrink:0:容器受父宽约束时读数被压 ⇒ 折行',
              })
            }
          }
        }
      }
      // ── V5:定宽格(width:NN% / flexBasis)。flexShrink 是纵向主轴属性,对横向定宽无效,
      //    所以这类只能靠格自己 minWidth 兜。父级若是 FlatList numColumns 就没有 wrap 概念,不判 V2。
      if (tag === 'View' && st) {
        const w = st.get('width')
        const pct = w && w.kind === ts.SyntaxKind.StringLiteral ? /^(\d+(?:\.\d+)?)%$/.exec(w.text) : null
        const fixedCell = (pct && Number(pct[1]) < 100) || st.has('flexBasis')
        if (fixedCell && !st.has('minWidth')) {
          const hit = firstReadoutIn(n, stName ?? '', stName ?? '')
          if (hit) {
            squeezed.push({
              host: 'fixed-width',
              row: stName ?? '',
              cell: stName ?? '',
              maxFs: hit.fs,
              text: hit.text,
              line: hit.line,
              why: '定宽格(width%/flexBasis)缺 minWidth:flexShrink 对横向定宽无效,读数会被压折',
            })
          }
        }
      }

      if (tag && /^(View|ScrollView)$/.test(tag) && stName && styles.has(stName)) {
        const rowName = stName
        const row = styles.get(rowName)
        const rowDir = boolish(row, 'flexDirection')
        const rowWrap = row.has('flexWrap')
        if (rowDir && /row/.test(String(rowDir))) {
          // 找直接子 View
          const children = n.kind === ts.SyntaxKind.JsxElement ? n.children.filter((c) => c.kind === ts.SyntaxKind.JsxElement || c.kind === ts.SyntaxKind.JsxSelfClosingElement) : []
          for (const ch of children) {
            const co = ch.kind === ts.SyntaxKind.JsxElement ? ch.openingElement : ch
            const cellStyle = co.attributes?.properties?.find(
              (a) => a.kind === ts.SyntaxKind.JsxAttribute && a.name?.text === 'style',
            )
            const cellName = cellStyle ? styleNameOf(cellStyle.initializer) : null
            if (!cellName || !styles.has(cellName)) continue
            const cell = styles.get(cellName)
            const flex = numProp(cell, 'flex')
            if (flex === null || flex !== 1) continue
            const hasMinW = cell.has('minWidth')
            // 子树里找「读数型」Text:字号 ≥16 且粗体,且内容形态是读数而非文案。
            // 只按字号判会造大量假红 —— 实测 WalletScreen 的「充值/提现」按钮、StudyRecordScreen 的
            // 「学习记录」标题都是 fontSize 16-20 + 粗体,它们住在 flex:1 的格里却不是读数。
            const hit = firstReadoutIn(ch, rowName, cellName)
            if (hit) {
              const rec = { row: rowName, cell: cellName, maxFs: hit.fs, text: hit.text, line: hit.line }
              triples.push(rec)
              // 两条缺一不可,这是 §13.4 唯一写法的两半:
              //   V1 格无 minWidth ⇒ `flex:1` 的 flexBasis 是 0,永远等分压缩,读数必折行;
              //   V2 格有 minWidth 但行无 flexWrap ⇒ minWidth 生效后不换行,改成压到邻居/出屏。
              // 「有 flexWrap 就免疫」是错的:没有 minWidth 时子项总宽永不超容器,wrap 一次都不触发。
              if (!hasMinW) violations.push({ ...rec, why: 'cell 缺 minWidth:flex:1 会被等分压缩,读数折行' })
              else if (!rowWrap) violations.push({ ...rec, why: 'row 缺 flexWrap:minWidth 生效后溢出而非换行' })
            }
          }
        }
      }
      n.forEachChild((c) => walkJsx(c, nextAnc))
      return
    }
    n.forEachChild((c) => walkJsx(c, ancestors))
  }
  sf.forEachChild(walkJsx)
  return { violations, triples, unjudged, squeezed, styles: styles.size, jsxNodes }
}

export function readFace(root, face) {
  // 清单与内容同面同轮(AGENTS §0.4)。上一版三档共用索引清单(ls-files),HEAD 面因此把
  // "已提交但已被删" 的文件也算了进来,而且 staged 档用了不是合法索引语法的 revspec(恒空)。
  // 内容读取全部经 face-reader 的批量入口,本门不自己派生 git 内容动词(门 118)。
  const argv = face === 'head' ? ['ls-tree', '-r', '--name-only', 'HEAD', '-z'] : ['ls-files', '-z']
  const paths = gitRaw(argv, root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter((f) => f && inScope(f))
  if (paths.length === 0) return []
  if (face === 'worktree') {
    return paths.map((f) => ({ file: f, src: readWorktreeFile(root, f) })).filter((x) => typeof x.src === 'string')
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  return paths.map((p, i) => ({ file: p, src: got.get(specs[i]) ?? null })).filter((x) => typeof x.src === 'string')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    const ok = `<View style={s.row}><View style={s.cell}><Text style={s.val}>{1}</Text></View></View>`
    // 完整修法 = 行有 flexWrap ∧ 格有 minWidth(§13.4 唯一写法),缺任一半都要红:
    // 只给 minWidth 是「溢出压邻居」,只给 flexWrap 是「flex:1 等分压缩、wrap 永不触发」。
    const fixed = `<View style={s.rowW}><View style={s.cellW}><Text style={s.val}>{1}</Text></View></View>`
    const halfFixed = `<View style={s.row}><View style={s.cellW}><Text style={s.val}>{1}</Text></View></View>`
    const wrapOnly = `<View style={s.rowW}><View style={s.cell}><Text style={s.val}>{1}</Text></View></View>`
    // 夹具必须在 `StyleSheet.create({…})` 后带分号:无分号时 `})` 紧跟 `<View` 会被 TS 当成
    // 比较运算(`… }) < View …`),JSX 根本不会被解析 ⇒ styles 认到、JSX 认不到。这不是判据漏洞,
    // 是夹具自身要符合真实源码形态(prettier 恒加分号);真实文件出现这种写法时由主流程的
    // 「styles>0 而 JSX 元素为 0」可疑面点名,不静默算绿。
    const sheet = `
      const s = StyleSheet.create({
        row: { flexDirection: 'row' },
        cell: { flex: 1 },
        val: { fontSize: 20, fontWeight: '700' },
        rowW: { flexDirection: 'row', flexWrap: 'wrap' },
        cellW: { flex: 1, minWidth: 112 },
      });`
    const a = analyze(sheet + ok)
    const b = analyze(sheet + fixed)
    const cases = [
      ['未保护三元组被识别(V1 缺 minWidth)', a.violations.length === 1 && a.triples.length === 1 && /minWidth/.test(a.violations[0].why)],
      ['完整修法(rowW + cellW)不报', b.violations.length === 0 && b.triples.length === 1],
      ['小字号不算读数', analyze(sheet + '<View style={s.row}><View style={s.cell}><Text style={s.small}>x</Text></View></View>').violations.length === 0],
      ['半修:有 minWidth 无 flexWrap 仍报(V2 溢出)', (() => {
        const r = analyze(sheet + halfFixed)
        return r.violations.length === 1 && /flexWrap/.test(r.violations[0].why)
      })()],
      ['只加 flexWrap 不免疫:flex:1 仍被等分压缩', analyze(sheet + wrapOnly).violations.length === 1],
      ['文案不是读数(i18n key 里的 count 不算)', analyze(sheet.replace("val: { fontSize: 20, fontWeight: '700' },", "val: { fontSize: 20, fontWeight: '700' },") + '<View style={s.row}><View style={s.cell}><Text style={s.val}>{t("connectedAccounts.title")}</Text></View></View>').violations.length === 0],
      ['标题不是读数(item.title)', analyze(sheet + '<View style={s.row}><View style={s.cell}><Text style={s.val}>{item.title}</Text></View></View>').violations.length === 0],
      ['读数照旧要报(info.totalDays)', analyze(sheet + '<View style={s.row}><View style={s.cell}><Text style={s.val}>{info.totalDays}</Text></View></View>').violations.length === 1],
    ]
    let fail = 0
    for (const [name, ok2] of cases) {
      if (!ok2) fail += 1
      console.log(`${ok2 ? '✓' : '✗'} ${name}`)
    }
    console.log(`自检 ${cases.length - fail}/${cases.length} 通过`)
    process.exit(fail === 0 ? 0 : 1)
  }
  const sel = selectFace({ staged: args.includes('--staged'), worktree: args.includes('--worktree'), def: 'head' })
  if (sel.error) {
    console.log(`⚪ [端侧读数格] 取材面自相矛盾 ⇒ 未判定:${sel.error}`)
    process.exit(2)
  }
  let files
  try {
    files = readFace(REPO_ROOT, sel.face)
  } catch (e) {
    console.log(`⚪ [端侧读数格] 取不到射程文件 ⇒ 未判定(${e?.message ?? e})`)
    process.exit(2)
  }
  if (files.length === 0) {
    console.log('⚪ [端侧读数格] 射程内 0 枚文件 ⇒ 未判定(空扫不记绿)')
    process.exit(2)
  }
  let parsed = 0
  const hits = []
  const totalTriples = []
  const suspicious = [] // styles 认到了但 JSX 一个也没解析出来 ⇒ 未判定,不许算绿
  const squeezedHits = []
  const failed = []
  for (const { file, src } of files) {
    try {
      const r = analyze(src)
      parsed += 1
      for (const v of r.violations) hits.push({ file, ...v })
      for (const t of r.triples) totalTriples.push({ file, ...t })
      for (const s of r.squeezed) squeezedHits.push({ file, ...s })
      if (r.styles > 0 && r.jsxNodes === 0) suspicious.push(file)
    } catch (e) {
      failed.push({ file, why: e?.message ?? String(e) })
    }
  }
  console.log(`端侧 AST 尺:射程 ${files.length} 枚,解析 ${parsed} 枚,解析失败 ${failed.length} 枚`)
  console.log(`识别「等分读数格」三元组 ${totalTriples.length} 处,其中缺 minWidth 保护 ${hits.length} 处`)
  console.log(`非等分宿主(space-between 行 / absolute 容器 / 定宽格)里的读数 ${squeezedHits.length} 处缺 flexShrink:0 或 minWidth`)
  if (suspicious.length) console.log(`⚪ 可疑未判定 ${suspicious.length} 枚(StyleSheet 认到但 JSX 为 0):${suspicious.slice(0, 5).join(' / ')}${suspicious.length > 5 ? ' …' : ''}`)
  if (failed.length) console.log(`⚪ 解析失败 ${failed.length} 枚:${failed.slice(0, 3).map((x) => `${x.file}(${x.why})`).join(' / ')}`)
  const per = new Map()
  for (const h of [...hits, ...squeezedHits]) per.set(h.file, (per.get(h.file) ?? 0) + 1)
  for (const [f, n] of [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20))
    console.log(`  ${String(n).padStart(3)}  ${f}`)
  if (args.includes('--json')) console.log(JSON.stringify({ triples: totalTriples, violations: hits, squeezed: squeezedHits }, null, 2))
  // 判定分档:有缺口 ⇒ 1;一枚射程文件都没解析成功 ⇒ 2(未判定,不冒绿)
  if (hits.length + squeezedHits.length > 0) process.exit(1)
  if (parsed === 0) {
    console.log('⚪ [端侧读数格] 0 枚文件解析成功 ⇒ 未判定')
    process.exit(2)
  }
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
export const __test__ = { REPO_ROOT, SCOPE_PREFIXES, inScope, analyze }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
