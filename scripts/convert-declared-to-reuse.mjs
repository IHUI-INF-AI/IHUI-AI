// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出预演/落地清单 */
/**
 * convert-declared-to-reuse.mjs —— 把「声明了镜像却自己手写一份」的小程序页转成壳承载形制。
 * 默认只读预演;`--apply` 才改文件。**只改页文件一处**(路由/词包/登记表都不动 ⇒ 不碰他席在飞的接缝)。
 *
 * 要治的现场(2026-10-26 HEAD 面现读):176 枚在册小程序页里 38 枚顶部写着
 * `// 镜像 packages/app/src/features/x/XScreen.tsx`,但 0 处真实 import 共享层或壳。
 * 这就是"改一端、另一端不跟随"的全部来源:同一个界面有两份实现,靠门事后对账(§4 明令禁止的形态)。
 *
 * 判据(不是"看起来能换就换"):
 *  ① 配对必须真:页面 → registry 里的 spec → RN 壳路径,三者齐备且壳文件在 HEAD 面上取到。
 *  ② **能力面不得缩**:旧页用到的每个 API 路径字面量,都必须能在 RN 壳里找到同一条
 *     (壳没那条端点 ⇒ 换过去就是少功能,拒);端点取的是字符串字面量,不是函数名。
 *  ③ **平台独占能力点名**:旧页里出现微信侧独有能力(openType / Taro.requestPayment /
 *     showShareMenu / WebView / Map / Canvas / Video / LivePlayer / getUpdateManager 等)⇒ 拒,
 *     这些在共享源与 RN 壳里都不存在,换过去会把功能换没(不是降级,是缺失)。
 *  ④ 取词面:旧页用的业务 i18n 命名空间必须被壳或共享屏也用到(否则换完文案会变)。
 * 任一不过 ⇒ 逐条点名拒因,不静默跳过;取不到输入(壳文件/registry/页正文)⇒ 未判定(§0.3)。
 *
 * Usage:
 *   node scripts/convert-declared-to-reuse.mjs                # 预演:列可换 / 拒因
 *   node scripts/convert-declared-to-reuse.mjs --apply        # 落地(逐文件,失败只跳过该文件)
 *   node scripts/convert-declared-to-reuse.mjs --json
 *   node scripts/convert-declared-to-reuse.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 壳导出形态判据单源(门 251 C5 / 还原度尺 / 造页器共用这一份,§0.6)
import { shellExportShapeOf } from './lib/rn-shell-refs.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const R = (...p) => join(ROOT, ...p)
const MP_SRC = 'apps/miniapp-taro/src'
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
const MARK_RE = /^\/\/ ?镜像 (packages\/app\/src\/\S+Screen\.tsx)/m
/** spec 路径 → 壳符号名(packages/app/src/features/a/AScreen.tsx → AScreen) */
const specShellSymbol = (spec) =>
  String(spec || '')
    .split('/')
    .pop()
    .replace(/\.tsx$/, '')
const REUSE_RE = /from '@(?:ihui\/rn-app|rn-shells)[^']*'/
const PATH_RE = /['"`](\/[A-Za-z0-9_\-/:.$ {}]+)['"`]/g
/** 资源档(图片/字体/媒体)不是 API 端点:把它们计入"端点差集"会造出假"数据面会缩" */
const RESOURCE_RE = /\.(png|jpe?g|svg|webp|gif|ico|woff2?|ttf|mp4|webm|json)$/i
const WECHAT_ONLY = [
  'openType',
  'requestPayment',
  'showShareMenu',
  'getUpdateManager',
  'createSelectorQuery',
  'WebView',
  '<Map',
  '<Canvas',
  '<Video',
  '<LivePlayer',
  'scanCode',
  'chooseMessageFile',
]

const git = (args) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 端点字面量集合:去掉模板插值段,只比静态前缀(否则 `/a/${id}` 与 `/a/${b}` 会被当成两条) */
function endpointSet(text) {
  const out = new Set()
  for (const m of (text || '').matchAll(PATH_RE)) {
    const raw = m[1]
    if (raw.startsWith('//')) continue
    // 资源路径不是 API 端点:`/static/default-agent.png` 这类是打包进端的图片,
    // 拿它比"壳有没有这条"必然判出"数据面会缩"——那是尺子把资源当接口,不是页真的多一个能力。
    if (RESOURCE_RE.test(raw)) continue
    const cut = raw.split(/\$\{/)[0].replace(/\/$/, '')
    if (cut.length > 3 && !cut.startsWith('/pages/') && !cut.startsWith('/pkg-')) out.add(cut)
  }
  return out
}

function nsSet(text) {
  const out = new Set()
  for (const m of (text || '').matchAll(/\bt[t]?\(\s*['"]([A-Za-z0-9_]+)\./g)) out.add(m[1])
  return out
}

/**
 * @returns {{verdict:string, page?:string, spec?:string, shell?:string, why?:string, missing?:string[], wxOnly?:string[]}}
 */
export function judgePage({ route, pageText, registry, shellOf, specText }) {
  const mark = MARK_RE.exec(pageText)
  if (!mark) return { verdict: 'skip', why: '页面没有标记载体(不在本器射程)' }
  if (REUSE_RE.test(pageText)) return { verdict: 'skip', why: '已是真复用形制' }
  const spec = mark[1]
  const entry = registry.find((e) => e.shared === spec)
  if (!entry)
    return {
      verdict: 'undetermined',
      page: route,
      spec,
      why: 'registry 无该 spec 的配对 ⇒ 不猜壳文件',
    }
  const shellText = shellOf(entry.rn)
  if (shellText === null)
    return {
      verdict: 'undetermined',
      page: route,
      spec,
      shell: entry.rn,
      why: 'HEAD 面取不到 RN 壳正文',
    }

  const wxOnly = WECHAT_ONLY.filter((token) => pageText.includes(token))
  if (wxOnly.length > 0)
    return {
      verdict: 'blocked',
      page: route,
      spec,
      shell: entry.rn,
      wxOnly,
      why: `页内有微信侧独有能力 ${wxOnly.join('/')},共享源与壳都没有 ⇒ 换过去是丢功能`,
    }

  const pageEps = endpointSet(pageText)
  const shellEps =
    endpointSet(shellText).size > 0 ? endpointSet(shellText) : endpointSet(specText || '')
  const missing = [...pageEps].filter(
    (p) => !shellEps.has(p) && ![...shellEps].some((s) => s.startsWith(p) || p.startsWith(s)),
  )
  if (missing.length > 0)
    return {
      verdict: 'blocked',
      page: route,
      spec,
      shell: entry.rn,
      missing,
      why: `壳/共享屏没有这些端点:${missing.join(', ')} ⇒ 换过去数据面会缩`,
    }

  const pageNs = nsSet(pageText)
  const srcNs = new Set([...nsSet(shellText), ...nsSet(specText || '')])
  const lostNs = [...pageNs].filter((n) => !srcNs.has(n))
  if (lostNs.length > 0)
    return {
      verdict: 'blocked',
      page: route,
      spec,
      shell: entry.rn,
      why: `旧页用到的命名空间 ${lostNs.join('/')} 在壳与共享屏里都没取用 ⇒ 换过去文案会变`,
    }

  // ⑥ 取用形态必须与壳的真导出对得上(2026-10-27 实测血案):本器原先一律写
  //   `import Shell from '@rn-shells/X'`,而 FeedbackScreen / ExamScreen 两枚壳**只有具名导出**
  //   ⇒ webpack 只给一条 warning,页面渲染出来是 undefined(比不转换更糟:原来是能用的)。
  //   壳的导出形态判据住在 lib/rn-shell-refs.mjs(与门 251 C5、还原度尺同一份,§0.6),这里只 import。
  const shape = shellExportShapeOf(shellText)
  const shellSymbol = specShellSymbol(spec)
  if (!shape.hasDefault && !shape.names.has(shellSymbol))
    return {
      verdict: 'blocked',
      page: route,
      spec,
      shell: entry.rn,
      why: `壳 ${entry.rn} 既无 default 导出也没有具名 ${shellSymbol}(现读出口 {${[...shape.names].join(',')}})⇒ 引法无从确定,拒产`,
    }

  // ⑤ 跳转面不得缩:壳用 RN 路由名导航,而 rn-compat 的映射表只覆盖小程序端已有页
  //   ⇒ 映射不到的名字,换过去后那一跳会"点了不动"(shim 点名但不跳)。旧页原本能跳,就是功能缩。
  const navTargets = new Set()
  for (const m of shellText.matchAll(/\.navigate\(\s*['"]([A-Za-z0-9]+)['"]/g)) navTargets.add(m[1])
  if (navTargets.size > 0) {
    let routeMapText = null
    try {
      routeMapText = git(['show', 'HEAD:apps/miniapp-taro/src/rn-compat/route-map.generated.ts'])
    } catch {
      routeMapText = null
    }
    if (routeMapText === null)
      return {
        verdict: 'undetermined',
        page: route,
        spec,
        shell: entry.rn,
        why: '路由映射表取不到 ⇒ 跳转面对不上,不判可换也不判拒(§0.3)',
      }
    const mapped = new Set(
      [...routeMapText.matchAll(/^\s*(?:'([A-Za-z0-9]+)'|([A-Za-z0-9]+)):\s*'/gm)].map(
        (m) => m[1] ?? m[2],
      ),
    )
    const unmapped = [...navTargets].filter((n) => !mapped.has(n))
    if (unmapped.length > 0)
      return {
        verdict: 'blocked',
        page: route,
        spec,
        shell: entry.rn,
        why: `壳要跳的路由名 ${unmapped.join('/')} 在小程序端还没有对应页(rn-compat 映射表现读 ${mapped.size} 条)⇒ 换过去那一跳会不动`,
      }
  }

  return { verdict: 'convertible', page: route, spec, shell: entry.rn }
}

/** 页文件 → 壳承载形制正文(保留原标记载体行与页名,只换实现) */
export function renderReusePage({ pageText, route, shellText = '' }) {
  const spec = MARK_RE.exec(pageText)[1]
  // 组件名取路由末段,**先去扩展名再消毒**:page.tsx 的消毒前形态是 "exam.tsx",
  // 不先去扩展名就会拼成 ExamtsxPage(现读两枚落地页正是这一型)——名字里带着文件后缀的残骸。
  const base =
    route
      .split('/')
      .pop()
      .replace(/\.[jt]sx$/, '')
      .replace(/[^A-Za-z0-9]/g, '') || 'Mirror'
  const Component = `${base.charAt(0).toUpperCase()}${base.slice(1)}Page`
  // 引法由壳的**现读导出形态**决定(判据同 lib/rn-shell-refs,§0.6 不另写一份):
  // 只有具名导出的壳,写默认导入会让页面渲染成 undefined(比不转换更糟)。
  const shellSymbol = specShellSymbol(spec)
  const importLine = shellExportShapeOf(shellText).hasDefault
    ? `import Shell from '@rn-shells/${shellSymbol}'`
    : `import { ${shellSymbol} as Shell } from '@rn-shells/${shellSymbol}'`
  const marker = pageText.split('\n')[0].startsWith('// ©')
    ? pageText.split('\n').slice(0, 2).join('\n')
    : ''
  return `${marker ? marker + '\n' : ''}/**
 * 由 scripts/convert-declared-to-reuse.mjs 转为**壳承载形制**(端内不写布局与数据)。
 *   渲染 = ${spec}(经 apps/miniapp-taro/src/rn-compat 兼容层落地),
 *   数据与交互 = RN 壳本体(路径见下 import),
 *   取词/主题 = apps/miniapp-taro/config/rn-shell-replace-plugin.ts 按发起上下文换到端内真相源。
 * ⇒ 源头改一笔,这一页自动跟随;要改这一页的行为,请改源头,不要在这里另写一份。
 */
// 镜像 ${spec}
import ThemeRoot from '@/components/ThemeRoot'
${importLine}

export default function ${Component}() {
  return (
    <ThemeRoot>
      <Shell />
    </ThemeRoot>
  )
}
`
}

function collect(face) {
  const cfg = git([
    'show',
    `${face === 'staged' ? ':' : 'HEAD:'}apps/miniapp-taro/src/app.config.ts`,
  ])
  const routes = []
  for (const m of cfg.matchAll(/root:\s*'([^']+)',\s*pages:\s*\[([\s\S]*?)\]/g)) {
    for (const p of m[2].matchAll(/'([^']+)'/g)) routes.push(`${m[1]}/${p[1]}`)
  }
  for (const m of cfg.matchAll(/pages:\s*\[([\s\S]*?)\]/g)) {
    for (const p of m[1].matchAll(/'([^']+)'/g)) if (p[1].startsWith('pages/')) routes.push(p[1])
  }
  return [...new Set(routes)]
}

function main() {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const json = argv.includes('--json')
  if (argv.includes('--self-test')) return selfTest()
  const registry = JSON.parse(git(['show', `HEAD:${REGISTRY}`])).entries
  const routes = collect('head')
  const rels = routes.map((r) => `${MP_SRC}/${r}.tsx`)
  const shellCache = new Map()
  const shellOf = (rel) => {
    if (!shellCache.has(rel)) {
      try {
        shellCache.set(rel, git(['show', `HEAD:${rel}`]))
      } catch {
        shellCache.set(rel, null)
      }
    }
    return shellCache.get(rel)
  }
  const specCache = new Map()
  const results = {
    convertible: [],
    blocked: [],
    skip: [],
    undetermined: [],
    written: [],
    writeFailed: [],
  }
  for (const rel of rels) {
    let text
    try {
      text = git(['show', `HEAD:${rel}`])
    } catch {
      text = null
    }
    const spec = text ? MARK_RE.exec(text)?.[1] : null
    const specText = spec
      ? specCache.has(spec)
        ? specCache.get(spec)
        : safeShow(spec, specCache)
      : null
    const r = judgePage({
      route: rel.replace(`${MP_SRC}/`, ''),
      pageText: text ?? '',
      registry,
      shellOf,
      specText,
    })
    results[r.verdict === 'plan' ? 'convertible' : r.verdict].push(r)
    if (apply && r.verdict === 'convertible') {
      const disk = readFileSync(R(rel), 'utf8')
      if (!REUSE_RE.test(disk) && MARK_RE.test(disk)) {
        try {
          writeFileSync(
            R(rel) + '.tmp',
            renderReusePage({ pageText: disk, route: r.page, shellText: safeShow(r.shell) || '' }),
            'utf8',
          )
          renameSync(R(rel) + '.tmp', R(rel))
          // §5c:生成器写盘后**必须紧随**注入溯源水印。不补这一刀的后果不是"少一行注释"——
          // 重写页会掉出覆盖面(check-watermark-coverage 按被审面判),下一次提交链直接红,
          // 且红在"谁也没写过这行"的地方(2026-10-27 实测:本器落地的两枚页正是未覆盖态)。
          try {
            execFileSync(process.execPath, [R('scripts', 'watermark.mjs'), 'inject', R(rel)], {
              cwd: ROOT,
              encoding: 'utf8',
              windowsHide: true,
              timeout: 120000,
              stdio: ['ignore', 'pipe', 'pipe'],
            })
          } catch (we) {
            console.error(`⚠️ 水印注入失败(${rel}):${String(we?.message ?? we).slice(0, 120)}`)
          }
          results.written.push(rel)
        } catch (e) {
          results.writeFailed.push(`${rel}: ${String(e?.message ?? e).slice(0, 80)}`)
        }
      }
    }
  }
  const summarize = () => {
    console.log(
      `在册页 ${rels.length} 枚(HEAD 面) | 可换 ${results.convertible.length} | 拒 ${results.blocked.length} | 已真复用/无标记 ${results.skip.length} | 未判定 ${results.undetermined.length}${apply ? ` | 已写 ${results.written.length} | 写失败 ${results.writeFailed.length}` : ''}`,
    )
    for (const r of results.blocked.slice(0, 24)) console.log(`  ⛔ ${r.page} —— ${r.why}`)
    if (results.blocked.length > 24) console.log(`  ⋯ 其余 ${results.blocked.length - 24} 条同类`)
    for (const r of results.undetermined.slice(0, 10)) console.log(`  ❓ ${r.page} —— ${r.why}`)
    for (const r of results.convertible.slice(0, 24)) console.log(`  ✅ ${r.page} ← ${r.shell}`)
    if (results.convertible.length > 24)
      console.log(`  ⋯ 其余 ${results.convertible.length - 24} 枚同类`)
    if (!apply) console.log('(预演模式,未写盘;加 --apply 落地)')
  }
  if (json)
    console.log(
      JSON.stringify({
        ...results,
        counts: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.length])),
      }),
    )
  else summarize()
  return results.convertible.length > 0 && !apply ? 0 : 0
}

function safeShow(rel, cache) {
  try {
    const t = git(['show', `HEAD:${rel}`])
    cache.set(rel, t)
    return t
  } catch {
    cache.set(rel, null)
    return null
  }
}

/** 自检:判据用纯函数 + 构造面证明(不碰仓库文件),含"摘掉即翻红" */
function selfTest() {
  const registry = [
    {
      shared: 'packages/app/src/features/a/AScreen.tsx',
      rn: 'apps/mobile-rn/src/screens/AScreen.tsx',
      miniapp: 'pkg-a/a/index',
    },
  ]
  // 壳夹具必须带真导出形态:现读血案就是"壳只有具名导出而页写默认导入"⇒ 渲染 undefined。
  // 夹具不带导出的话,⑥ 那条腿会把所有用例都判成拒,反而把这条腿的存在性掩盖掉。
  const shellOk =
    "import { fetchApi } from '@ihui/api-client'\nfetchApi('/items/1')\nconst x = t('a.title')\nexport function AScreen() { return null }\n"
  const cases = [
    {
      name: '端点齐备且无微信独占 ⇒ convertible',
      want: 'convertible',
      got: () =>
        judgePage({
          route: 'pkg-a/a/index',
          pageText: `// 镜像 packages/app/src/features/a/AScreen.tsx\nfetchApi('/items/1')\nt('a.title')`,
          registry,
          shellOf: () => shellOk,
          specText: shellOk,
        }).verdict,
    },
    {
      name: '旧页多一条端点 ⇒ 拦(数据面会缩)',
      want: 'blocked',
      got: () =>
        judgePage({
          route: 'pkg-a/a/index',
          pageText: `// 镜像 packages/app/src/features/a/AScreen.tsx\nfetchApi('/items/1')\nfetchApi('/extra')`,
          registry,
          shellOf: () => shellOk,
          specText: shellOk,
        }).verdict,
    },
    {
      name: '旧页用 requestPayment ⇒ 拦(微信独占,换过去丢功能)',
      want: 'blocked',
      got: () =>
        judgePage({
          route: 'pkg-a/a/index',
          pageText: `// 镜像 packages/app/src/features/a/AScreen.tsx\nTaro.requestPayment({})\nfetchApi('/items/1')`,
          registry,
          shellOf: () => shellOk,
          specText: shellOk,
        }).verdict,
    },
    {
      name: '旧页只有资源路径多出来 ⇒ convertible(资源不是端点,不得造假"数据面会缩")',
      want: 'convertible',
      got: () =>
        judgePage({
          route: 'pkg-a/a/index',
          pageText: `// 镜像 packages/app/src/features/a/AScreen.tsx\nfetchApi('/items/1')\nconst img = '/static/default-avatar.png'\nt('a.title')`,
          registry,
          shellOf: () => shellOk,
          specText: shellOk,
        }).verdict,
    },
    {
      name: '引法随壳的真导出定:具名导出壳 ⇒ 写 `{ AScreen as Shell }`,不写默认导入',
      want: true,
      got: () => {
        const out = renderReusePage({
          pageText: `// 镜像 packages/app/src/features/a/AScreen.tsx\nt('a.title')`,
          route: 'pkg-a/a/index',
          shellText: shellOk,
        })
        return (
          out.includes(`import { AScreen as Shell } from '@rn-shells/AScreen'`) &&
          !out.includes(`import Shell from '@rn-shells/AScreen'`)
        )
      },
    },
    {
      name: '引法随壳的真导出定:有 default 导出的壳 ⇒ 仍写默认导入(两型都不许猜错)',
      want: true,
      got: () => {
        const out = renderReusePage({
          pageText: `// 镜像 packages/app/src/features/a/AScreen.tsx\nt('a.title')`,
          route: 'pkg-a/a/index',
          shellText: `${shellOk}\nexport default function AScreenDefault() { return null }`,
        })
        return out.includes(`import Shell from '@rn-shells/AScreen'`)
      },
    },
    {
      name: '壳两种引法都不成立(无 default 也无同名具名)⇒ 拒产,不能产出一张渲染 undefined 的页',
      want: 'blocked',
      got: () =>
        judgePage({
          route: 'pkg-a/a/index',
          pageText: `// 镜像 packages/app/src/features/a/AScreen.tsx\nt('a.title')`,
          registry,
          shellOf: () =>
            `import { fetchApi } from '@ihui/api-client'\nfetchApi('/items/1')\nconst x = t('a.title')\nexport function CompletelyOther() { return null }`,
          specText: shellOk,
        }).verdict,
    },
    {
      name: '组件名不得带扩展名残骸(先去 .tsx 再消毒 ⇒ ListPage,不是 ListtsxPage)',
      want: true,
      got: () => {
        const out = renderReusePage({
          pageText: `// 镜像 packages/app/src/features/exam/ExamScreen.tsx\nt('exam.title')`,
          route: 'pages/exam/list.tsx',
        })
        return out.includes('export default function ListPage(') && !/tsx?Page/.test(out)
      },
    },
    {
      name: '已是真复用 ⇒ skip(不重复动)',
      want: 'skip',
      got: () =>
        judgePage({
          route: 'pkg-a/a/index',
          pageText: `// 镜像 packages/app/src/features/a/AScreen.tsx\nimport Shell from '@rn-shells/AScreen'`,
          registry,
          shellOf: () => shellOk,
          specText: shellOk,
        }).verdict,
    },
    {
      name: 'registry 无配对 ⇒ 未判定(不猜壳)',
      want: 'undetermined',
      got: () =>
        judgePage({
          route: 'pkg-z/z/index',
          pageText: '// 镜像 packages/app/src/features/z/ZScreen.tsx',
          registry,
          shellOf: () => shellOk,
          specText: shellOk,
        }).verdict,
    },
  ]
  let pass = 0
  for (const c of cases) {
    const got = c.got()
    const ok = got === c.want
    console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${c.want},实得 ${got})`)
    if (ok) pass += 1
  }
  console.log(
    pass === cases.length ? `自检 ${pass}/${cases.length} 通过` : `❌ 自检 ${pass}/${cases.length}`,
  )
  process.exit(pass === cases.length ? 0 : 1)
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isDirectRun) {
  try {
    main()
  } catch (error) {
    console.error(`❌ 未判定:${String(error?.message ?? error).slice(0, 200)}`)
    process.exit(2)
  }
}

export const __test__ = { judgePage, renderReusePage, endpointSet, nsSet, collect }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
