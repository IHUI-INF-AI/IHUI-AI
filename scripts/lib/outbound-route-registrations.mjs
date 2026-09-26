// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * outbound-route-registrations.mjs — 「对侧到底注册了哪些路径」的唯一实现(Fastify + FastAPI 两套形态)。
 *
 * 从 outbound-route-facts 里再拆出来只为守住守门 11e 的单文件行数上限;两层的分工是:
 * facts = 词法与判据(遮噪/扫描/推导/匹配),本层 = **挂载图**(入口 → 前缀拼接 → 完整路径集合)。
 * 与 facts 一样:不读任何被审内容,输入是 `Map<relPath, text>`,由守门侧按判定面喂进来。
 */

import { dirname } from 'node:path'
import {
  countOf,
  FASTAPI_ENTRY,
  FASTIFY_ENTRY,
  INSTANCE,
  VERBS,
  escapeRe,
  joinPrefix,
  lineOf,
  maskComments,
  normSegs,
  normalizePosix,
} from './outbound-route-facts.mjs'

/* ----------------------------- 注册面:Fastify ----------------------------- */

export const TS_ROUTE_RE = new RegExp(
  `\\b(?:${INSTANCE})\\.(?:${VERBS.join('|')})\\s*(?:<[^()]{0,200}>)?\\s*\\(\\s*['"\`](/[^'"\`]*)['"\`]`,
  'g',
)
export const TS_ROUTE_OBJ_RE = /\.route\s*\(\s*\{([\s\S]{0,300}?)\}\s*\)/g
export const TS_REGISTER_RE = new RegExp(`\\b(?:${INSTANCE})\\.register\\s*\\(`, 'g')
/**
 * 只吃**一条** import 语句:子句里不得再出现 `from`,否则一条非相对 import(如 `from 'fastify'`)
 * 会把后面的相对 import 一起吞掉 —— 实测 server.ts 就是这样让整棵 Fastify 挂载图走不动的。
 */
export const TS_IMPORT_RE = /\bimport\s+((?:(?!\bfrom\b)[\s\S])*?)\s+from\s*['"](\.[^'"]*)['"]/g

/** TS 单文件解析:路由字面量 + 挂载边(register / 直调) + 相对 import 目标 */
export function analyzeTsFile(rel, srcRaw) {
  const src = maskComments(srcRaw, 'ts')
  const dir = dirname(rel)
  const routes = []
  const edges = []
  const opaque = new Set()
  const imports = new Map()
  let m
  while ((m = TS_IMPORT_RE.exec(src)) !== null) {
    const clause = m[1]
    const target = normalizePosix(`${dir}/${m[2].replace(/\.jsx?$/, '')}`)
    const named = /\{([^}]*)\}/.exec(clause)
    if (named) {
      for (const raw of named[1].split(',')) {
        const parts = raw.trim().split(/\s+as\s+/)
        const local = (parts[1] || parts[0] || '').trim().replace(/^type\s+/, '')
        if (local) imports.set(local, target)
      }
    }
    const head = clause.trim().replace(/^type\s+/, '')
    if (!head.startsWith('{') && !head.startsWith('*')) {
      const def = /^([A-Za-z_$][\w$]*)/.exec(head)
      if (def) imports.set(def[1], target)
    }
  }
  while ((m = TS_ROUTE_RE.exec(src)) !== null) routes.push({ path: m[1], line: lineOf(src, m.index) })
  while ((m = TS_ROUTE_OBJ_RE.exec(src)) !== null) {
    const u = /url\s*:\s*['"]([^'"]*)['"]/.exec(m[1])
    if (u) routes.push({ path: u[1], line: lineOf(src, m.index) })
  }
  TS_REGISTER_RE.lastIndex = 0
  while ((m = TS_REGISTER_RE.exec(src)) !== null) {
    const args = readArgs(src, m.index + m[0].length - 1)
    const pre = /prefix\s*:\s*['"`]([^'"`]*)['"`]/.exec(args)
    if (/^\s*(?:async\s*)?\(/.test(args)) {
      // 内联箭头子树:里面的路由挂在别名实例上,本层不追 ⇒ 有前缀就记不透明,不猜
      if (pre) opaque.add(pre[1])
      continue
    }
    if (/prefix\s*:\s*[`{]/.test(args)) {
      opaque.add('/__template_prefix__')
      continue
    }
    const sym = /^\s*(?:await\s+)?([A-Za-z_$][\w$]*)/.exec(args)
    if (!sym) continue
    edges.push({ symbol: sym[1], prefix: pre ? pre[1] : '' })
  }
  const direct = new RegExp(`(?:^|[;\\n])\\s*([A-Za-z_$][\\w$]*)\\s*\\(\\s*(?:${INSTANCE})\\s*\\)`, 'g')
  while ((m = direct.exec(src)) !== null) {
    if (['if', 'for', 'while', 'switch', 'catch', 'return'].includes(m[1])) continue
    edges.push({ symbol: m[1], prefix: '' })
  }
  return { routes, edges, imports, opaque, dir }
}

/** 从 `(` 的下标起做括号配平,返回实参文本 */
export function readArgs(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth += 1
    else if (src[i] === ')') {
      depth -= 1
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
  }
  return src.slice(openIdx + 1)
}

/**
 * 沿 Fastify 挂载图从入口走一遍。解析不到目标(第三方插件 / 动态符号 / 文件不在面上)
 * ⇒ 带前缀的记不透明(命中它算未判定),无前缀的进 unresolved 清单打印。
 */
export function buildFastifyRegistrations(files) {
  const paths = new Set()
  const opaque = new Set()
  const unresolved = []
  const byFile = new Map()
  for (const [rel, src] of files) if (rel.endsWith('.ts')) byFile.set(rel, analyzeTsFile(rel, src))
  const queue = [[FASTIFY_ENTRY, '']]
  const seen = new Set()
  let guard = 0
  while (queue.length && guard++ < 20000) {
    const [rel, prefix] = queue.shift()
    const key = `${rel}@@${prefix}`
    if (seen.has(key)) continue
    seen.add(key)
    const info = byFile.get(rel)
    if (!info) {
      unresolved.push(`${rel} 不在面上(挂载目标缺失)`)
      continue
    }
    for (const r of info.routes) {
      const full = joinPrefix(prefix, r.path)
      if (/\$\{[^}]*\}$/.test(r.path)) opaque.add(full.replace(/\$\{[^}]*\}.*$/, ''))
      paths.add(normSegs(full).join('/'))
    }
    for (const o of info.opaque) opaque.add(o)
    for (const edge of info.edges) {
      const target = info.imports.get(edge.symbol)
      if (target) {
        const found = pickExisting(byFile, [`${target}.ts`, `${target}/index.ts`])
        if (found) {
          queue.push([found, joinPrefix(prefix, edge.prefix)])
          continue
        }
        if (edge.prefix) opaque.add(joinPrefix(prefix, edge.prefix))
        unresolved.push(`${rel}: register(${edge.symbol}) → ${target} 不在面上`)
        continue
      }
      const localFile = pickExisting(byFile, [`${normalizePosix(`${info.dir}/${edge.symbol}`)}.ts`])
      if (localFile) {
        queue.push([localFile, joinPrefix(prefix, edge.prefix)])
        continue
      }
      if (edge.prefix) opaque.add(joinPrefix(prefix, edge.prefix))
      else unresolved.push(`${rel}: register(${edge.symbol}) 解析不到文件(第三方插件或动态符号)`)
    }
  }
  return { paths, opaque, unresolved, filesAnalyzed: byFile.size }
}

export function pickExisting(map, candidates) {
  for (const c of candidates) if (map.has(c)) return c
  return null
}

/* ----------------------------- 注册面:FastAPI ----------------------------- */

export const PY_DECO_RE = new RegExp(`@([\\w.]+)\\.(?:${VERBS.join('|')}|websocket)\\s*\\(\\s*['"]([^'"]*)['"]`, 'g')
export const PY_APIROUTER_RE = /([A-Za-z_]\w*)\s*=\s*APIRouter\(([^)]*)\)/g
export const PY_INCLUDE_RE = /\.include_router\(\s*([\w.]+)([^)]*)\)/g
export const PY_MOUNT_RE = /\.mount\(\s*([^,)]+)/g
/** 单行 `from X import …`;续行由下面的循环显式接(不在正则里跨行,否则函数体内的局部 import 会被后文吃掉) */
export const PY_FROM_RE = /^[ \t]*from\s+(\.+[\w.]*|[\w.]+)\s+import\s+(.*)$/

/** Python 单文件解析:装饰器 + APIRouter 前缀 + include_router 边 + mount + import 目标 */
export function analyzePyFile(rel, srcRaw) {
  const src = maskComments(srcRaw, 'py')
  const dir = dirname(rel)
  const decos = {}
  const routerPrefixes = {}
  const includes = []
  const mounts = []
  const imports = new Map()
  let m
  while ((m = PY_DECO_RE.exec(src)) !== null) {
    const v = m[1].split('.').pop()
    ;(decos[v] ||= []).push({ path: m[2], line: lineOf(src, m.index) })
  }
  while ((m = PY_APIROUTER_RE.exec(src)) !== null) {
    const pre = /prefix\s*=\s*['"]([^'"]*)['"]/.exec(m[2])
    routerPrefixes[m[1]] = pre ? pre[1] : ''
  }
  while ((m = PY_INCLUDE_RE.exec(src)) !== null) {
    const pre = /prefix\s*=\s*['"]([^'"]*)['"]/.exec(m[2] || '')
    const parent = /([\w.]+)\.include_router/.exec(m[0])
    includes.push({ parent: parent ? parent[1].split('.').pop() : 'app', child: m[1], prefix: pre ? pre[1] : '' })
  }
  while ((m = PY_MOUNT_RE.exec(src)) !== null) {
    const arg = m[1].trim()
    if (/^['"]/.test(arg)) mounts.push({ prefix: arg.replace(/^['"]|['"]$/g, '') })
    else {
      // app.mount(prefix, …) 的 prefix 常是**形参**,其默认值又指着一个常量名:
      // def mount_to_app(app, prefix: str = MCP_EXPORT_PREFIX) + MCP_EXPORT_PREFIX = "/api/mcp/export"
      // 只解字面量那一支会让 mcp_export 这类子应用整条隐身(F7 之前的真实缺口)。
      const lit = new RegExp(
        `${escapeRe(arg)}\\s*(?::\\s*[\\w[\\]|None]+)?\\s*=\\s*['"]([^'"]*)['"]`,
      ).exec(src)
      if (lit) {
        mounts.push({ prefix: lit[1] })
        continue
      }
      const nameRef = new RegExp(
        `${escapeRe(arg)}\\s*(?::\\s*[\\w[\\]|None]+)?\\s*=\\s*([A-Za-z_][\\w.]*)\\s*[,)]`,
      ).exec(src)
      if (nameRef) {
        const constLit = new RegExp(`\\b${escapeRe(nameRef[1])}\\s*(?::[^=]+)?=\\s*['"]([^'"]*)['"]`).exec(src)
        if (constLit) {
          mounts.push({ prefix: constLit[1] })
          continue
        }
      }
      mounts.push({ prefix: `/__unresolved_mount__:${arg}` })
    }
  }
  // from X import (a, b as c) —— 逐行取语句 + 显式续行(括号未闭合 / 反斜杠 / 尾逗号)才接下一行。
  // 用"看到下一个关键字为止"的整段正则会**越过**函数体内的局部 import(main.py 的
  // `from app.routers import news as news_router` 就在函数里,后面紧跟 app.include_router(…),
  // 于是清单被吃进后续语句、别名键带上换行 ⇒ 挂载图断在这一条上(news/goal_verification 实测解析不到)。
  const srcLines = src.split('\n')
  for (let k = 0; k < srcLines.length; k++) {
    const fm = PY_FROM_RE.exec(srcLines[k])
    if (!fm) continue
    const pkg = fm[1]
    let clause = fm[2]
    let j = k
    // 只在「括号未闭合 / 反斜杠续行 / 逗号结尾且没进括号」时接下一行 —— 其余一行就是一整条语句
    for (;;) {
      const opens = countOf(clause, /\(/g)
      const closes = countOf(clause, /\)/g)
      const cont =
        opens > closes || /\\\s*$/.test(clause) || (opens === 0 && /,\s*$/.test(clause.trim()))
      if (!cont || j + 1 >= srcLines.length) break
      j += 1
      clause = `${clause.replace(/\\\s*$/, '')} ${srcLines[j].trim()}`
    }
    const names = clause
      .replace(/[()\[\]]/g, '')
      .split(',')
      .map((s) => s.trim().split('#')[0].trim())
      .filter(Boolean)
    const pkgPath = pyPkgPath(dir, pkg)
    if (!pkgPath) continue
    for (const raw of names) {
      const parts = raw.split(/\s+as\s+/)
      const orig = (parts[0] || '').trim()
      const local = (parts[1] || parts[0] || '').trim()
      if (!orig || orig === '*' || !local || !/^[\w.]+$/.test(local)) continue
      // 「包里的子模块」与「模块里的对象」在文本上同形,只能等到有盘面时再判 ⇒ 存**候选**列表
      imports.set(local, {
        candidates: [
          { file: `${pkgPath}.py`, attr: orig === 'router' ? 'router' : orig },
          { file: normalizePosix(`${pkgPath}/${orig}.py`), attr: 'router' },
        ],
      })
    }
  }
  return { decos, routerPrefixes, includes, mounts, imports, dir }
}

/** 包/模块 ⇒ 仓内 posix 路径(不含扩展名);解不出的包名(第三方)返回 null */
export function pyPkgPath(dir, pkg) {
  if (!pkg) return null
  if (pkg.startsWith('.')) {
    const lead = (pkg.match(/^\.+/) || [''])[0].length - 1
    const parts = pkg.replace(/^\.+/, '').split('.').filter(Boolean)
    let base = normalizePosix(dir)
    for (let i = 0; i < lead; i++) base = normalizePosix(`${base}/..`)
    return parts.length ? normalizePosix(`${base}/${parts.join('/')}`) : normalizePosix(base)
  }
  const segs = pkg.split('.').filter(Boolean)
  if (segs[0] !== 'app') return null
  return normalizePosix(`apps/ai-service/${segs.join('/')}`)
}

export function resolvePyChild(info, child, byFile) {
  const parts = String(child).split('.')
  const imp = info.imports.get(parts[0])
  if (parts.length === 1) {
    if (info.decos[parts[0]] || info.routerPrefixes[parts[0]]) return { file: null, attr: parts[0] }
    if (!imp) return null
    const hit = imp.candidates.find((c) => byFile.has(c.file))
    return hit ? { file: hit.file, attr: hit.attr } : null
  }
  if (!imp) return null
  const attr = parts[parts.length - 1]
  const hit = imp.candidates.find((c) => byFile.has(c.file))
  return hit ? { file: hit.file, attr } : null
}

/**
 * FastAPI 挂载图:节点 = (文件, router 变量, 累积前缀),入口 = main.py 的 `app`。
 * 另跑一遍全文件收 `app.mount(...)` —— 子 ASGI 应用的路径结构上不可见 ⇒ 记不透明前缀,不判红(F6)。
 */
export function buildFastApiRegistrations(files) {
  const paths = new Set()
  const opaque = new Set()
  const unresolved = []
  const byFile = new Map()
  for (const [rel, src] of files) if (rel.endsWith('.py')) byFile.set(rel, analyzePyFile(rel, src))
  for (const [, info] of byFile) for (const mp of info.mounts) opaque.add(mp.prefix)
  const queue = [[FASTAPI_ENTRY, 'app', '']]
  const seen = new Set()
  let guard = 0
  while (queue.length && guard++ < 20000) {
    const [rel, varName, prefix] = queue.shift()
    const key = `${rel}@@${varName}@@${prefix}`
    if (seen.has(key)) continue
    seen.add(key)
    const info = byFile.get(rel)
    if (!info) {
      unresolved.push(`${rel} 不在面上`)
      continue
    }
    for (const v of varName === '*' ? Object.keys(info.decos) : [varName]) {
      const base = joinPrefix(prefix, info.routerPrefixes[v] || '')
      for (const d of info.decos[v] || []) {
        if (/\{[^}]*:path\}/.test(d.path)) opaque.add(joinPrefix(base, d.path.split('{')[0]))
        paths.add(normSegs(joinPrefix(base, d.path)).join('/'))
      }
    }
    for (const e of info.includes) {
      const child = resolvePyChild(info, e.child, byFile)
      if (!child) {
        if (e.prefix) opaque.add(e.prefix)
        else unresolved.push(`${rel}: include_router(${e.child}) 解析不到文件`)
        continue
      }
      queue.push([child.file || rel, child.attr || '*', joinPrefix(prefix, e.prefix || '')])
    }
  }
  return { paths, opaque, unresolved, filesAnalyzed: byFile.size }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
