// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ESLint 本地插件:(main) 路由组页面留白防回归(2026-09-04 立)
//
// 规则 main-page-root-padding:
//   MainShell 的 main 元素无 padding(2026-08-01 用户要求),约定页面必须自带水平留白。
//   检查 app/(main) 路由组下的 page.tsx 中"函数默认导出的页面组件"顶层 return JSX 根元素:
//     合规(任一): 根是 PageContainer/Container;className 含 px/p 内边距类;className 含 mx-auto+max-w。
//     其余(裸 div space-y 等)→ 报错,提示套用 PageContainer。
//   Fragment/非 JSX/非常规导出无法静态判定 → 放行(委托给 PageClient 的页面由 review 把控)。
//   豁免:若 page 所在目录至 app/(main) 之间任一祖先目录有 layout.tsx 且其顶层 return JSX
//   含 px/p/mx-auto,视为容器兜底,整页放行。

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Linter } from 'eslint'

const linter = new Linter()
const layoutCache = new Map()

const HORIZ_PAD_RE = /(?:^|[\s`'"])(?:px|p)-[a-z0-9[\]/-]+/

// 沿 (main) 目录链向上找最近一个有 layout.tsx 的祖先,判断其是否自带留白;找不到 → false
function ancestorLayoutPadding(filename) {
  let dir = path.dirname(path.resolve(process.cwd(), filename))
  while (true) {
    const cached = layoutCache.get(dir)
    if (cached !== undefined) return cached
    const layoutPath = path.join(dir, 'layout.tsx')
    let verdict
    if (fs.existsSync(layoutPath)) {
      verdict = layoutHasPadding(layoutPath)
    } else {
      const parent = path.dirname(dir)
      // 仍在 (main) 路由组内 → 继续向上;到达/越过 (main) 边界 → 无兜底
      if (/[/\\]\(main\)[\\/]+$/.test(parent + path.sep)) {
        dir = parent
        continue
      }
      verdict = false
    }
    layoutCache.set(dir, verdict)
    return verdict
  }
}

function layoutHasPadding(layoutPath) {
  const cached = layoutCache.get('src:' + layoutPath)
  if (cached !== undefined) return cached
  let result = false
  try {
    const code = fs.readFileSync(layoutPath, 'utf8')
    const msgs = linter.verify(code, {
      files: ['**'],
      languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: {
        'ihui-probe': {
          rules: {
            'has-pad': {
              meta: { schema: [], messages: { found: 'pad' } },
              create(ctx) {
                const s2 = ctx.sourceCode ?? ctx.getSourceCode()
                const scan = (n) => {
                  if (result) return
                  if (n.type === 'JSXAttribute' && n.name && (n.name.name === 'className' || n.name.name === 'class')) {
                    const txt = s2.getText(n.value ?? n)
                    if (HORIZ_PAD_RE.test(txt) || /mx-auto/.test(txt)) {
                      result = true
                      return
                    }
                  }
                  for (const k in n) {
                    if (k === 'parent') continue
                    const v = n[k]
                    if (v && typeof v === 'object') {
                      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && scan(c))
                      else if (typeof v.type === 'string') scan(v)
                    }
                  }
                }
                scan(s2.ast)
                return {}
              },
            },
          },
        },
      },
      rules: { 'ihui-probe/has-pad': 'error' },
    }, layoutPath)
    void msgs
  } catch {
    result = false
  }
  layoutCache.set('src:' + layoutPath, result)
  return result
}

function makeRule(context) {
  const src = context.sourceCode ?? context.getSourceCode()

  const classTextOf = (opening) => {
    const attr = opening.attributes.find(
      (a) => a.type === 'JSXAttribute' && a.name && (a.name.name === 'className' || a.name.name === 'class'),
    )
    if (!attr) return null
    return src.getText(attr.value ?? attr)
  }

  const checkRoot = (jsxEl) => {
    if (!jsxEl || jsxEl.type !== 'JSXElement') return
    const name = jsxEl.openingElement.name
    const elemName = name && name.type === 'JSXIdentifier' ? name.name : ''
    if (elemName === 'PageContainer' || elemName === 'Container') return
    if (elemName === 'Fragment' || elemName === '') return
    const cls = classTextOf(jsxEl.openingElement)
    if (cls === null) return // 无 className 的自定义组件根:放行(组件内部自证)
    if (HORIZ_PAD_RE.test(cls)) return
    if (/mx-auto/.test(cls) && /max-w/.test(cls)) return
    context.report({ node: jsxEl, messageId: 'missingPadding' })
  }

  const unwrap = (arg) => {
    let a = arg
    while (a && (a.type === 'TSAsExpression' || a.type === 'AsExpression' || a.type === 'ChainExpression')) a = a.expression
    // A && <div/> 模式:检查右侧 JSX
    if (a && a.type === 'LogicalExpression' && a.operator === '&&') return unwrap(a.right)
    return a
  }

  const walkBody = (body) => {
    for (const stmt of body ?? []) {
      if (stmt == null) continue
      if (stmt.type === 'ReturnStatement' && stmt.argument) {
        const arg = unwrap(stmt.argument)
        if (arg && arg.type === 'JSXElement') checkRoot(arg)
        else if (arg && arg.type === 'ConditionalExpression') {
          const c = unwrap(arg.consequent)
          const alt = unwrap(arg.alternate)
          if (c && c.type === 'JSXElement') checkRoot(c)
          if (alt && alt.type === 'JSXElement') checkRoot(alt)
        }
      } else if (stmt.type === 'IfStatement') {
        if (stmt.consequent?.type === 'BlockStatement') walkBody(stmt.consequent.body)
        else if (stmt.consequent) walkBody([stmt.consequent])
        if (stmt.alternate?.type === 'BlockStatement') walkBody(stmt.alternate.body)
        else if (stmt.alternate) walkBody([stmt.alternate])
      } else if (stmt.type === 'TryStatement') {
        walkBody(stmt.block?.body)
      }
    }
  }

  const resolveFunction = (node) => {
    if (!node) return null
    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') return node
    if (node.type === 'CallExpression') return node.arguments.map(resolveFunction).find(Boolean) ?? null
    if (node.type === 'Identifier') {
      let scope = src.getScope ? src.getScope(node) : context.getScope()
      while (scope) {
        const v = scope.set.get(node.name)
        if (v) {
          const init = v.defs[0]?.node?.init ?? null
          const fn = resolveFunction(init)
          if (fn) return fn
        }
        scope = scope.upper
      }
      return null
    }
    return null
  }

  return {
    ExportDefaultDeclaration(node) {
      const filename = context.filename ?? context.getFilename()
      if (ancestorLayoutPadding(filename)) return // 目录 layout 兜底豁免
      const fn = resolveFunction(node.declaration)
      if (!fn || !fn.body || fn.body.type !== 'BlockStatement') return
      walkBody(fn.body.body)
    },
  }
}

export default {
  rules: {
    'main-page-root-padding': {
      meta: {
        type: 'problem',
        docs: { description: '(main) 页面根元素必须带水平留白(PageContainer/px-*/mx-auto+max-w)' },
        schema: [],
        messages: {
          missingPadding:
            '(main) 页面根元素缺少水平留白:请用 <PageContainer> 包裹或补 px-4(MainShell <main> 无 padding)。见 src/components/common/PageContainer.tsx',
        },
      },
      create: makeRule,
    },
  },
}
