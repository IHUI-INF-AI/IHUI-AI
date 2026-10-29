#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 工具脚本需输出结论与诊断 */
/**
 * add-web-portal-entries.mjs — 把「web 有而移动端零承载」的静态功能页成批登记进 WebView 门户唯一源
 *
 * 为什么要器物化(2026-10-27 立):本会话手工收了三批(6 + 12 + 19 枚),每一批都要重复同一串
 * 高风险动作 —— 改 packages/shared/src/constants/web-portal.ts + 补十份词包(mobile-rn / miniapp-taro
 * × 五语言)+ 断言零丢失。手工的失败形态已经付过代价:一次按**滞后工作树副本**整文件重写词包,
 * 静默删掉他人已入库的 586/1336 枚键(JSON 仍 parse 得通、格式仍干净、类型仍绿)。本器把三条
 * 防线钉进代码:① 一律以 `git show <face>:<file>` 的 blob 为底,绝不读盘上副本;
 * ② 逐份断言「旧键集/路径集 ⊆ 新面 ∧ 差集恰为本票枚数 ∧ entry key 全表无重」,任一不成立不落盘;
 * ③ 每条 path 必须真存在 `apps/web/app/(main)/<path>/page.tsx`(防把门户清单写成幻影链接)。
 *
 * 判据住在门户表与门户页那两份实现里,本器只登记清单,不复算"该不该进门户"——那是人/票的判断。
 *
 * Usage:
 *   node scripts/add-web-portal-entries.mjs --routes-file <jsonl> [--apply] [--json]
 *   node scripts/add-web-portal-entries.mjs --self-test
 * 清单每行:`{"path":"/rules","key":"agentRules","section":"more","labels":{"zh-CN":"运行规则","zh-TW":"運行規則","en":"Agent Rules","ja":"実行ルール","ko":"실행 규칙"}}`
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = join(import.meta.dirname, '..')
const PORTAL_REL = 'packages/shared/src/constants/web-portal.ts'
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
const TARGETS = ['mobile-rn', 'miniapp-taro']
const packRel = (t, l) => `packages/i18n/messages/${t}/${l}.json`

const git = (args) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 被审面取 blob(不读工作树);取不到 ⇒ null(调用方落未判定,不回落另一个面) */
function faceBlob(face, rel) {
  if (face === 'worktree') {
    const p = join(ROOT, rel)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  }
  try {
    return git(['show', `${face}:${rel}`])
  } catch {
    return null
  }
}

function flatKeys(o, pre = '', out = new Set()) {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) flatKeys(v, pre ? `${pre}.${k}` : k, out)
  } else out.add(pre)
  return out
}

const portalPaths = (txt) => new Set([...txt.matchAll(/path: '([^']+)'/g)].map((m) => m[1]))
const portalKeys = (txt) => [...txt.matchAll(/^\s{8}key: '([^']+)'/gm)].map((m) => m[1])

/** 路由存在性也按**被审面**判(工作树有而 HEAD 无的页面,挂进门户同样是幻影链接) */
function routeExists(face, path) {
  const rel = `apps/web/app/(main)${path}/page.tsx`
  if (face === 'worktree') return existsSync(join(ROOT, rel))
  try {
    return git(['ls-tree', '--name-only', face, rel]).trim() !== ''
  } catch {
    return false
  }
}

/** 纯判据:页面真存在 + 与门户表/词包的承接断言。返回 null = 可落,否则是不落的原因。 */
function checkEntries(entries, portalTxt, face = 'HEAD') {
  const have = portalPaths(portalTxt)
  for (const e of entries) {
    if (!e.path?.startsWith('/')) return `path 形态非法: ${JSON.stringify(e.path)}`
    if (!e.key?.trim()) return `缺 key: ${e.path}`
    if (!/^[a-z][a-zA-Z0-9]*$/.test(e.key))
      return `key 必须是 camelCase 且不以 - 开头(键路径用): ${e.key}`
    if (have.has(e.path)) return `门户表已有此 path(应改判而非重加): ${e.path}`
    if (portalKeys(portalTxt).includes(e.key)) return `entry key 全表重复: ${e.key}`
    const missing = LANGS.filter((l) => typeof e.labels?.[l] !== 'string' || !e.labels[l].trim())
    if (missing.length) return `${e.path} 缺 ${missing.length} 种语言文案(${missing.join(',')})`
    if (!routeExists(face, e.path))
      return `web 路由不存在(防幻影门户链接,按 ${face} 面判): ${e.path}`
  }
  return null
}

/** 纯函数:把清单插进门户表指定段(entries 数组闭合 `],` 之前)。返回新文本或错误原因。 */
function buildPortalText(baseTxt, entries, section) {
  const eol = baseTxt.includes('\r\n') ? '\r\n' : '\n'
  const lines = baseTxt.split(/\r?\n/)
  const headerIdx = lines.findIndex((l) =>
    l.includes(`titleKey: 'webViewPortal.sections.${section}'`),
  )
  if (headerIdx < 0) return { error: `段落锚点缺失: sections.${section}` }
  const close = lines.findIndex((l, i) => i > headerIdx && /^\s{4}\],\s*$/.test(l))
  if (close < 0) return { error: `段落闭合锚点缺失: ${section}` }
  const blocks = entries
    .map(
      (e) =>
        `      {\n        key: '${e.key}',\n        titleKey: 'webViewPortal.${e.key}',\n        path: '${e.path}',\n        domain: '${e.path.split('/')[1]}',\n        fallbackLabel: '${e.labels['zh-CN']}',\n      },`,
    )
    .join('\n')
    .split('\n')
  lines.splice(close, 0, ...blocks)
  const out = lines.join(eol)
  const before = portalPaths(baseTxt)
  const after = new Set(portalPaths(out))
  const lost = [...before].filter((p) => !after.has(p))
  const dupKeys = portalKeys(out).filter((k, i, a) => a.indexOf(k) !== i)
  if (lost.length || after.size !== before.size + entries.length)
    return {
      error: `门户表承接不干净: 丢 ${lost.length} 计数 ${before.size}→${after.size}(应 +${entries.length})`,
    }
  if (dupKeys.length) return { error: `插入后 entry key 重复: ${dupKeys.join(',')}` }
  return { text: out }
}

/** 纯函数:往一份词包的 webViewPortal 块里插本票键,断言"旧键集 ⊆ 新键集 ∧ 差集恰为本票枚数" */
function buildPackText(baseTxt, entries, lang) {
  const eol = baseTxt.includes('\r\n') ? '\r\n' : '\n'
  const lines = baseTxt.split(/\r?\n/)
  const at = lines.findIndex((l) => l.trim() === '"webViewPortal": {')
  if (at < 0) return { error: '词包缺 webViewPortal 块(锚点失效)' }
  const pad = ' '.repeat((lines[at].match(/^\s*/)?.[0] ?? '').length + 2)
  const ins = entries.map(
    (e) => `${pad}${JSON.stringify(e.key)}: ${JSON.stringify(e.labels[lang])},`,
  )
  lines.splice(at + 1, 0, ...ins)
  const out = lines.join(eol)
  let parsed
  try {
    parsed = JSON.parse(out)
  } catch (e) {
    return { error: `插入后 JSON 破: ${String(e.message).slice(0, 80)}` }
  }
  const kb = flatKeys(JSON.parse(baseTxt))
  const ka = flatKeys(parsed)
  const lost = [...kb].filter((k) => !ka.has(k))
  const added = [...ka].filter((k) => !kb.has(k))
  const want = new Set(entries.map((e) => `webViewPortal.${e.key}`))
  if (lost.length || added.length !== entries.length || added.some((k) => !want.has(k)))
    return {
      error: `词包承接不干净: 丢 ${lost.length} 增 ${added.length}(应恰为 ${entries.length} 枚本票键)`,
    }
  return { text: out }
}

function run({ face = 'HEAD', file, apply = false, json = false }) {
  const say = (s) => !json && console.log(s)
  if (!file) return { state: 'undetermined', why: '缺 --routes-file' }
  let entries
  try {
    entries = readFileSync(join(ROOT, file), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
  } catch (e) {
    return { state: 'undetermined', why: `清单读不出: ${String(e.message).slice(0, 90)}` }
  }
  if (!entries.length) return { state: 'undetermined', why: '清单空集(枚举到 0 个候选判死)' }
  const portalTxt = faceBlob(face, PORTAL_REL)
  if (portalTxt === null) return { state: 'undetermined', why: `门户表取不到(${face} 面)` }

  const bad = checkEntries(entries, portalTxt, face)
  if (bad) return { state: 'refused', why: bad, count: 0 }

  // 一段一批:按 section 分组,段内一起插(段锚点唯一)
  const bySection = new Map()
  for (const e of entries)
    bySection.set(e.section ?? 'more', [...(bySection.get(e.section ?? 'more') || []), e])
  let nextPortal = portalTxt
  for (const [section, list] of bySection) {
    const r = buildPortalText(nextPortal, list, section)
    if (r.error) return { state: 'refused', why: r.error, count: 0 }
    nextPortal = r.text
  }

  const writes = [{ path: PORTAL_REL, text: nextPortal }]
  for (const t of TARGETS) {
    for (const lang of LANGS) {
      const rel = packRel(t, lang)
      const base = faceBlob(face, rel)
      if (base === null) return { state: 'undetermined', why: `词包取不到(${face} 面): ${rel}` }
      const r = buildPackText(base, entries, lang)
      if (r.error) return { state: 'refused', why: `${rel}: ${r.error}`, count: 0 }
      writes.push({ path: rel, text: r.text })
    }
  }

  if (!apply) {
    say(
      `PORTAL-BATCH face=${face} state=pending 条目=${entries.length} 待写文件=${writes.length}(未落盘)`,
    )
    return { state: 'pending', count: entries.length, files: writes.length }
  }
  for (const w of writes) writeFileSync(join(ROOT, w.path), w.text, 'utf8')
  say(
    `PORTAL-BATCH face=${face} state=applied 条目=${entries.length} 落盘文件=${writes.length} 零丢失断言=过`,
  )
  return { state: 'applied', count: entries.length, files: writes.length }
}

function selfTest() {
  const cases = []
  const ok = (name, cond, why = '') => cases.push({ name, pass: !!cond, why })
  const fakePortal = `export const WEB_PORTAL_SECTIONS = [
  {
    titleKey: 'webViewPortal.sections.more',
    fallbackLabel: '更多',
    entries: [
      {
        key: 'existing-one',
        titleKey: 'webViewPortal.existingOne',
        path: '/feature-center',
        domain: 'feature-center',
        fallbackLabel: '能力中心',
      },
    ],
  },
]
`
  const E = (over = {}) => ({
    path: '/feature-center',
    key: 'dupFeature',
    section: 'more',
    labels: { 'zh-CN': 'x', 'zh-TW': 'x', en: 'x', ja: 'x', ko: 'x' },
    ...over,
  })
  // T1 阳性对照:同 path 必须被拒(否则表里会长两份)
  ok('T1 同 path 重加被拒', checkEntries([E()], fakePortal)?.includes('已有此 path'))
  // T2 语言缺档被拒
  const noJa = E({ path: '/zzz', labels: { 'zh-CN': 'a', 'zh-TW': 'b', en: 'c', ko: 'd' } })
  ok('T2 缺语种被拒', checkEntries([noJa], fakePortal)?.includes('缺 1 种语言'))
  // T3 幻影路由被拒(page.tsx 不在位)
  ok(
    'T3 幻影路由被拒',
    checkEntries([E({ path: '/no-such-page-zzz' })], fakePortal)?.includes('web 路由不存在'),
  )
  // T4 段锚点缺失 ⇒ 拒,不猜位置
  ok('T4 段锚点缺失即拒', !!buildPortalText(fakePortal, [E({ path: '/q' })], 'nonexistent')?.error)
  // T5 正常插入:计数 +1、旧 path 全在
  const t5 = buildPortalText(fakePortal, [E({ path: '/brand-new-zzz' })], 'more')
  ok(
    'T5 插入后零丢且 +1',
    !t5.error && portalPaths(t5.text).has('/feature-center') && portalPaths(t5.text).size === 2,
  )
  // T6 key 重复被拒(表内 entry key 全表唯一)
  const t6 = buildPortalText(fakePortal, [E({ key: 'existing-one', path: '/another-zzz' })], 'more')
  ok('T6 entry key 重复即拒', !!t6.error?.includes('重复'))
  // T7 词包:正常插 1 键
  const fakePack = `{\n  "webViewPortal": {\n    "title": "Portal"\n  }\n}\n`
  const t7 = buildPackText(fakePack, [E({ path: '/x' })], 'en')
  ok('T7 词包 +1 键零丢', !t7.error && JSON.parse(t7.text).webViewPortal.dupFeature === 'x')
  // T8 词包:已存在同名键 ⇒ 差集不等于枚数 ⇒ 拒(不产重复键)
  const dupPack = `{\n  "webViewPortal": {\n    "dupFeature": "x"\n  }\n}\n`
  ok('T8 已在位键不重加', !!buildPackText(dupPack, [E({ path: '/x' })], 'en').error)
  // T9 词包:破 JSON 的插入不落
  ok('T9 锚点缺失即拒', !!buildPackText('{}\n', [E({ path: '/x' })], 'en').error)
  // T10 空清单判未判定(不冒充绿)
  ok('T10 空清单不判绿', run({ face: 'nope', file: '' }).state === 'undetermined')
  for (const c of cases)
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.why ? ` — ${c.why}` : ''}`)
  const bad = cases.filter((c) => !c.pass)
  console.log(
    bad.length
      ? `SELF-TEST FAIL ${bad.length}/${cases.length}`
      : `SELF-TEST OK ${cases.length}/${cases.length}`,
  )
  return bad.length ? 1 : 0
}

const argv = process.argv.slice(2)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (argv.includes('--self-test')) process.exit(selfTest())
  const rf = argv.find((a) => a.startsWith('--routes-file='))
  const r = run({
    face: argv.includes('--worktree') ? 'worktree' : 'HEAD',
    file: rf ? rf.split('=')[1] : '',
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
  })
  if (argv.includes('--json')) console.log(JSON.stringify(r))
  process.exit(r.state === 'applied' || r.state === 'pending' ? 0 : r.state === 'refused' ? 1 : 2)
}

export const __test__ = {
  faceBlob,
  checkEntries,
  buildPortalText,
  buildPackText,
  portalPaths,
  portalKeys,
  flatKeys,
  run,
  PORTAL_REL,
  LANGS,
  TARGETS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
