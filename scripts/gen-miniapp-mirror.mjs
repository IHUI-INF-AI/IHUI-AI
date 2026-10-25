#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具:必须打印预演页面全文/四处接缝补丁与落地结论行 */
/**
 * gen-miniapp-mirror.mjs — 共享 RN 屏 → 小程序镜像页 生成器(治"页不存在")。
 *
 * 为什么要有这件器物:判据尺 scripts/check-cross-end-screen-coverage.mjs 现读
 * (2026-10-25:共享屏 218 / 被小程序显式镜像 92 / 未判定 126),缺口账本
 * scripts/report-rn-miniapp-gaps.mjs 只点名不造页;auto-register-cross-end.mjs 只管
 * "页已存在、只缺声明"(给在册页补标记+registry)。**页不存在时要造页+四处接缝**这一格
 * 全仓无器物,人工照首例逐屏做 126 遍不可持续 —— 本器物把首例做成可复放的机械动作。
 *
 * spec 唯一来源 = 枚 aa4c418bff1a(首例真实镜像页 pkg-about/about/agreement),从中提炼的形制:
 *   ① 页面标记行字面 `// 镜像 packages/app/src/features/<domain>/<Name>Screen.tsx`(尺子 MARK_RE 认这个形);
 *   ② 页面骨架:ThemeRoot 包裹 + ScrollView(h-screen bg-background)+ 卡片
 *      `bg-card rounded-lg border border-border p-[28rpx]`,字号 `text-[length:36rpx]` 形态(v3 端裸 rpx 必须带 length:);
 *      导航标题 `useDidShow(() => Taro.setNavigationBarTitle({ title: t('<ns>.title') }))`;
 *   ③ i18n:按行插到词包末尾闭括号前,前一行补逗号;≤2 键的扁平命名空间写单行内联
 *      `"ns": {"a":"…","b":"…"}`(键序随词包遍历序),多键/带嵌套写多行(顶格 2 空格、键 4 空格);
 *      **禁止 JSON.stringify 整文件重写**(会重排全文件、吃掉他席未提交行);
 *   ④ 路由:app.config.ts 对应 subPackages 块 pages 数组**末尾**插一行 `'<page>',`(缩进=闭括号缩进+2);
 *   ⑤ registry:三元组 {shared, rn, miniapp}(miniapp = root+'/'+page 全路由),按行插到
 *      entries 数组闭括号前,前一条目闭括号 `    }` 补逗号;
 *   ⑥ 值零新译:每个键的值**逐语取自 packages/i18n/messages/mobile-rn/<lang>.json 同键原文**;
 *      缺任一语言该键 ⇒ 该键整体弃用(不造译、不中文兜底),并在结论行点名。
 *
 * 判据分工(§0.6):镜像标记识别、RN 消费判定 import check-cross-end-screen-coverage 的 __test__
 * (cov.mirroredSpecs / cov.rnConsumes),本文件不复制这两把尺子;路由枚举/页面候选解析与
 * KEY_RE/GENERIC_NS 是**本地实现**,因为 cov 把 ROOT 硬绑在自己文件所在仓、而本器物必须支持
 * `--repo=` 指到夹具仓跑端到端(§22c 的 import 通道对"ROOT 硬绑"与"顶层直跑不可 import"
 * (auto-register-cross-end.mjs 无 __test__ 且 import 即触发主流程)两种源结构性关闭);
 * 接缝归并纪律与 auto-register 的 insertMarker 同源(底稿取 HEAD blob、工作树有他席在飞行即拒)。
 *
 * 落盘四动作(默认只读预演,`--apply` 才写):新页文件 / app.config 路由行 / 5 份 miniapp 词包 /
 * registry 三元组。每个动作幂等(已存在即跳过并点名),写前自证该共享屏在 HEAD blob 存在
 * (§0.4 同面取材;写动作的基底一律取 HEAD blob,工作树滞后副本顺带治好)。
 * 新页文件写完后立即调 scripts/watermark.mjs inject + verify(process.execPath + 绝对路径;
 * 夹具仓里没有 watermark.mjs 时点名跳过)。
 *
 * 退出码:0 = 成功生成 / 合法跳过(点名依据);1 = 判定成立但拒绝落地(撞面/缺腿/冲突);
 * 2 = 未判定(取不到被审面、--screen 缺失、屏形制不符、分包归属推断不出 ⇒ 要一次定向说明)。
 *
 * Usage:
 *   node scripts/gen-miniapp-mirror.mjs --screen=packages/app/src/features/<domain>/<Name>Screen.tsx
 *   node scripts/gen-miniapp-mirror.mjs --screen=… --apply [--subpackage=pkg-user] [--page=user/demo/index]
 *   (--repo= 仅供夹具仓端到端取证;--root=<别名可选>)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

import { catBatch, listFaceFiles, readWorktreeFile } from './lib/face-reader.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'

const LANGS = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW']
const SHARED_DIR = 'packages/app/src/features'
const MP_SRC = 'apps/miniapp-taro/src'
const MP_CONFIG = `${MP_SRC}/app.config.ts`
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
const RN_SCREENS = 'apps/mobile-rn/src/screens'
const APP_INDEX = 'packages/app/src/index.ts'
const RN_PACK_DIR = 'packages/i18n/messages/mobile-rn'
const MP_PACK_DIR = 'packages/i18n/messages/miniapp-taro'
const MP_SHARED_SCREEN_RE = new RegExp(`^${SHARED_DIR}/([^/]+)/([A-Z][A-Za-z0-9_]*)Screen\\.tsx$`)

/** 与 auto-register-cross-end.mjs 同族清单(那份无 __test__ 不可 import,归并前两份同改)。 */
const GENERIC_NS = new Set(['common', 'app', 'nav', 'button', 'action', 'state', 'error', 'tip', 'toast'])
/** 与 auto-register-cross-end.mjs 的 KEY_RE 同形(同上,不可 import 只能登记同源)。 */
const KEY_RE = /\b(?:t|tt)\(\s*'([A-Za-z0-9_.-]+)'/g

// ---------- 纯判据/纯变换(全部可单测,零 IO) ----------

export function kebab(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

export function screenShapeOf(rel) {
  const m = MP_SHARED_SCREEN_RE.exec(String(rel || '').replace(/\\/g, '/'))
  if (!m) return null
  return { domain: m[1], base: m[2].replace(/Screen$/, ''), spec: rel.replace(/\\/g, '/') }
}

export function extractUsedKeys(text) {
  const out = []
  const seen = new Set()
  if (!text) return out
  for (const m of text.matchAll(KEY_RE)) if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]) }
  return out
}

export function pathExists(obj, dotted) {
  let cur = obj
  for (const seg of dotted.split('.')) {
    if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, seg)) return false
    cur = cur[seg]
  }
  return true
}

export function leafAt(obj, dotted) {
  let cur = obj
  for (const seg of dotted.split('.')) {
    if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, seg)) return null
    cur = cur[seg]
  }
  return typeof cur === 'string' ? cur : null
}

/** 词包 obj 里命名空间 ns 的全部字符串叶路径(遍历序 = 键序)。 */
export function orderedLeavesOfNs(obj, ns) {
  const out = []
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string') out.push(`${prefix}.${k}`)
      else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, `${prefix}.${k}`)
    }
  }
  const root = obj && typeof obj === 'object' ? obj[ns] : undefined
  if (root && typeof root === 'object' && !Array.isArray(root)) walk(root, ns)
  return out
}

/** 从词包按路径集取子集(键序 = 传入序;非字符串叶跳过)。 */
export function subsetOf(pack, dottedKeys) {
  const out = {}
  for (const k of dottedKeys) {
    let cur = pack
    let ok = true
    for (const seg of k.split('.')) {
      if (!cur || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, seg)) { ok = false; break }
      cur = cur[seg]
    }
    if (!ok || typeof cur !== 'string') continue
    const segs = k.split('.')
    let dst = out
    for (const s of segs.slice(0, -1)) {
      if (!dst[s] || typeof dst[s] !== 'object') dst[s] = {}
      dst = dst[s]
    }
    dst[segs.at(-1)] = cur
  }
  return out
}

function countLeaves(obj) {
  let n = 0
  const walk = (node) => {
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v)
      else n++
    }
  }
  walk(obj)
  return n
}

/**
 * 命名空间成员的按行形态(首例形制③):扁平 ≤2 键 → 单行内联;否则多行(2/4 空格缩进)。
 * 返回行数组,**不带**尾逗号 —— 逗号由 insertJsonMembers 在成员组之间补。
 */
export function memberLinesFor(ns, obj) {
  const flat = Object.values(obj).every((v) => typeof v === 'string')
  if (flat && countLeaves(obj) <= 2) return [`  "${ns}": ${JSON.stringify(obj)}`]
  const inner = JSON.stringify(obj, null, 2)
    .split('\n')
    .slice(1, -1)
    .map((l) => `  ${l}`)
  return [`  "${ns}": {`, ...inner, '  }']
}

/**
 * 词包按行插入:groups = 每命名空间一个行组。找到最后一个非空行(必须是 `}`),
 * 给前一个成员闭行补逗号(若它没以 `,`/`{`/`:` 收尾),把各组依次插到末行之前,组间补 `,`。
 * 全文件其余字节原样保留(split/join 保尾换行)。
 */
export function insertJsonMembers(text, groups) {
  if (!groups.length) return { ok: false, why: '没有可插入的成员组' }
  const lines = text.split('\n')
  const real = (i) => lines[i].trim() !== ''
  let endIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) if (real(i)) { endIdx = i; break }
  if (endIdx < 0 || lines[endIdx].trim() !== '}') return { ok: false, why: '词包末行不是闭括号,形态异常' }
  let prev = -1
  for (let i = endIdx - 1; i >= 0; i--) if (real(i)) { prev = i; break }
  if (prev < 0) return { ok: false, why: '词包是空对象,按行插入形态不适用(人工落一次基础结构再来)' }
  const head = lines[prev].trimEnd()
  if (!/[,{:]$/.test(head)) lines[prev] = `${head},`
  const out = []
  groups.forEach((g, i) => {
    const gg = [...g]
    if (i < groups.length - 1) gg[gg.length - 1] += ','
    out.push(...gg)
  })
  lines.splice(endIdx, 0, ...out)
  const next = lines.join('\n')
  try {
    JSON.parse(next)
  } catch (e) {
    return { ok: false, why: `插入后词包 JSON 解析不过(不落盘):${e.message}` }
  }
  return { ok: true, text: next, addedLines: out.length }
}

/** 与 cov.collectMiniapp 同形但 root 参数化(cov 硬绑自己仓,夹具取证需要;标记识别仍用 cov 的尺)。 */
export function parseMiniappRoutes(cfgText) {
  const pages = []
  const headStart = cfgText.indexOf('pages: [')
  const subStart = cfgText.indexOf('subPackages')
  if (headStart >= 0 && subStart > headStart) {
    for (const m of cfgText.slice(headStart, subStart).matchAll(/'([^']+)'/g)) {
      if (m[1].startsWith('pages/')) pages.push(m[1])
    }
  }
  const blocks = []
  for (const m of cfgText.matchAll(/root:\s*'([^']+)',\s*pages:\s*\[([\s\S]*?)\]/g)) {
    blocks.push(m)
    for (const p of m[2].matchAll(/'([^']+)'/g)) pages.push(`${m[1]}/${p[1]}`)
  }
  return { routes: [...new Set(pages)], blocks }
}

/** 接缝④:往 subPackages 指定 root 的 pages 数组末尾插一行(缩进=闭括号行缩进+2)。 */
export function insertConfigPage(text, root, page) {
  const { blocks } = parseMiniappRoutes(text)
  const blk = blocks.find((m) => m[1] === root)
  if (!blk) return { ok: false, why: `app.config.ts 里找不到 subPackages root '${root}'(可用 --subpackage 指定现成 root)` }
  if (blk[2].includes(`'${page}'`)) return { ok: false, skipped: true, why: `路由 ${root}/${page} 已在册` }
  const closeIdx = blk.index + blk[0].length - 1
  let lineStart = closeIdx
  while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--
  const gap = text.slice(lineStart, closeIdx)
  if (gap.trim() !== '') return { ok: false, why: 'pages 数组闭括号行形态异常(同行有别的内容)' }
  const indent = `${gap}  `
  const inserted = `${indent}'${page}',\n`
  return { ok: true, text: text.slice(0, lineStart) + inserted + text.slice(lineStart), insertedLine: `${indent}'${page}',` }
}

/** 接缝⑤:registry entries 数组末尾按行插三元组(前一条目闭行补逗号)。 */
export function insertRegistryEntry(text, entry) {
  const lines = text.split('\n')
  let closeIdx = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === ']') { closeIdx = i; break }
  }
  if (closeIdx < 0) return { ok: false, why: 'registry 里找不到 entries 数组闭括号行' }
  let prev = -1
  for (let i = closeIdx - 1; i >= 0; i--) if (lines[i].trim() !== '') { prev = i; break }
  if (prev < 0 || lines[prev].trim() !== '}') return { ok: false, why: 'registry 末条目闭行形态异常(非 4 空格 `}`)' }
  lines[prev] = `${lines[prev].trimEnd()},`
  lines.splice(closeIdx, 0, '    {', `      "shared": ${JSON.stringify(entry.shared)},`, `      "rn": ${JSON.stringify(entry.rn)},`, `      "miniapp": ${JSON.stringify(entry.miniapp)}`, '    }')
  const next = lines.join('\n')
  let parsed
  try {
    parsed = JSON.parse(next)
  } catch (e) {
    return { ok: false, why: `插入后 registry JSON 解析不过(不落盘):${e.message}` }
  }
  const last = parsed.entries.at(-1)
  if (!last || last.shared !== entry.shared || last.rn !== entry.rn || last.miniapp !== entry.miniapp) {
    return { ok: false, why: '插入后末条目与预期三元组逐字节不符(不落盘)' }
  }
  return { ok: true, text: next }
}

/** 页面骨架(首例形制①②):镜像标记行 + token 化卡片,内容全走 t() 键。 */
export function buildPage({ spec, fnName, titleKey, subtitleKey, pairs, singles }) {
  const L = []
  L.push(`// 镜像 ${spec}`, '')
  L.push("import { useI18n } from '@/i18n'")
  L.push("import { View, Text, ScrollView } from '@tarojs/components'")
  if (titleKey) L.push("import Taro, { useDidShow } from '@tarojs/taro'")
  L.push("import ThemeRoot from '@/components/ThemeRoot'")
  L.push('')
  L.push('// 由 scripts/gen-miniapp-mirror.mjs 依首例 aa4c418bff1a 形制生成:文案骨架镜像自共享屏的 i18n 键,')
  L.push('// 值逐语取自 mobile-rn 词包(零新译)。交互与数据钩子(列表/请求/跳转)需按共享屏人工补齐 ——')
  L.push('// 本稿先钉死「镜像声明 + 路由在册 + 词包同键」的声明链,页面级还原度由后续人工轮提升。')
  if (pairs.length === 0) L.push('const PAIR_KEYS = [] as const')
  else {
    L.push('const PAIR_KEYS = [')
    for (const [a, b] of pairs) L.push(`  ['${a}', '${b}'],`)
    L.push('] as const')
  }
  if (singles.length === 0) L.push('const SINGLE_KEYS = [] as const')
  else {
    L.push('const SINGLE_KEYS = [')
    for (const k of singles) L.push(`  '${k}',`)
    L.push('] as const')
  }
  L.push('')
  L.push(`export default function ${fnName}() {`)
  L.push('  const { t } = useI18n()')
  if (titleKey) {
    L.push('  useDidShow(() => {')
    L.push(`    Taro.setNavigationBarTitle({ title: t('${titleKey}') })`)
    L.push('  })')
  }
  L.push('')
  L.push('  return (')
  L.push('    <ThemeRoot>')
  L.push('      <ScrollView className="h-screen bg-background" scrollY>')
  L.push('        <View className="px-[28rpx] pt-[28rpx] pb-[64rpx] flex flex-col gap-[24rpx]">')
  if (titleKey || subtitleKey) {
    L.push('          <View className="bg-card rounded-lg border border-border p-[28rpx]">')
    if (titleKey) {
      L.push('            <Text className="block text-[length:36rpx] font-semibold text-foreground leading-[44rpx] mb-[12rpx]">')
      L.push(`              {t('${titleKey}')}`)
      L.push('            </Text>')
    }
    if (subtitleKey) {
      L.push('            <Text className="block text-[length:28rpx] text-muted-foreground leading-[40rpx]">')
      L.push(`              {t('${subtitleKey}')}`)
      L.push('            </Text>')
    }
    L.push('          </View>')
    L.push('')
  }
  L.push('          {PAIR_KEYS.map(([titleKey, bodyKey]) => (')
  L.push('            <View key={titleKey} className="bg-card rounded-lg border border-border p-[28rpx]">')
  L.push('              <Text className="block text-[length:36rpx] font-semibold text-foreground leading-[44rpx] mb-[24rpx]">')
  L.push('                {t(titleKey)}')
  L.push('              </Text>')
  L.push('              <Text className="block text-[length:28rpx] text-muted-foreground leading-[44rpx] text-justify">')
  L.push('                {t(bodyKey)}')
  L.push('              </Text>')
  L.push('            </View>')
  L.push('          ))}')
  L.push('          {SINGLE_KEYS.map((bodyKey) => (')
  L.push('            <View key={bodyKey} className="bg-card rounded-lg border border-border p-[28rpx]">')
  L.push('              <Text className="block text-[length:28rpx] text-muted-foreground leading-[44rpx] text-justify">')
  L.push('                {t(bodyKey)}')
  L.push('              </Text>')
  L.push('            </View>')
  L.push('          ))}')
  L.push('        </View>')
  L.push('      </ScrollView>')
  L.push('    </ThemeRoot>')
  L.push('  )')
  L.push('}')
  return `${L.join('\n')}\n`
}

// ---------- 取材(全部按面,默认 HEAD blob;§0.4) ----------

function faceReadMap(rootDir, rels) {
  const map = new Map()
  const specs = rels.map((r) => `HEAD:${r}`)
  let got
  try {
    got = catBatch(rootDir, specs)
  } catch (e) {
    throw new Error(`取不到 HEAD 面(${e?.message ?? e})`)
  }
  for (const r of rels) map.set(r, got.get(`HEAD:${r}`) ?? null)
  return map
}

/** 工作树副本相对 HEAD blob 是否有"他席在飞"的行(非空行且不在 HEAD 行集)。 */
export function workDiverges(headText, workText) {
  if (workText === null) return 0
  const headLines = new Set((headText || '').split('\n'))
  return workText.split('\n').filter((l) => l.trim() !== '' && !headLines.has(l)).length
}

function listMiniappPages(rootDir) {
  const cfgMap = faceReadMap(rootDir, [MP_CONFIG])
  const cfg = cfgMap.get(MP_CONFIG)
  if (cfg === null) throw new Error(`未判定:HEAD 面取不到 ${MP_CONFIG}`)
  const { routes } = parseMiniappRoutes(cfg)
  const cands = routes.flatMap((p) => [`${MP_SRC}/${p}.tsx`, `${MP_SRC}/${p}/index.tsx`, `${MP_SRC}/${p}/index.jsx`])
  const withCss = [...cands, ...cands.flatMap((c) => [c.replace(/\.tsx$/, '.css'), c.replace(/[^/]*$/, 'index.css')])]
  const m = faceReadMap(rootDir, [...new Set(withCss)])
  const out = []
  for (const p of routes) {
    const hit = [`${MP_SRC}/${p}.tsx`, `${MP_SRC}/${p}/index.tsx`, `${MP_SRC}/${p}/index.jsx`].find((c) => m.get(c) !== null && m.get(c) !== undefined)
    out.push({
      route: p,
      file: hit || null,
      text: hit ? m.get(hit) : null,
      cssText: hit ? `${m.get(hit.replace(/\.tsx$/, '.css')) || ''}${m.get(hit.replace(/[^/]*$/, 'index.css')) || ''}` : '',
    })
  }
  return { pages: out, cfgText: cfg }
}

// ---------- 计划(预演与落地共用同一条构造,杜绝"预演绿落地红") ----------

function inferSubpackage(blocks, domain) {
  const kb = kebab(domain)
  const roots = blocks.map((m) => m[1])
  const exact = roots.find((r) => r === `pkg-${kb}`) || roots.find((r) => r === `pages/${kb}`)
  if (exact) return { root: exact, note: null }
  const seg = blocks.find((m) => [...m[2].matchAll(/'([^']+)'/g)].some((p) => p[1].split('/')[0] === kb))
  if (seg) return { root: seg[1], note: `按页段 '${kb}/' 命中分包 ${seg[1]}` }
  if (roots.includes('pkg-user')) return { root: 'pkg-user', note: `域 '${domain}' 无匹配分包,兜底默认 pkg-user(要换用 --subpackage/--page)` }
  return { root: null, note: `域 '${domain}' 推不出归属分包,可用 --subpackage 点名(现成: ${roots.join(' / ')})` }
}

export function planGeneration(rootDir, opts) {
  const { screenRel, subpackage, page } = opts
  const shape = screenShapeOf(screenRel)
  if (!shape) return { kind: 'undetermined', why: `--screen 不是尺子认得的共享屏形制(${SHARED_DIR}/<domain>/<Name>Screen.tsx)` }
  const screenText = faceReadMap(rootDir, [shape.spec]).get(shape.spec)
  if (screenText === null) return { kind: 'undetermined', why: `未判定:HEAD 面取不到 ${shape.spec}` }

  // 已被镜像?(判据 import cov.mirroredSpecs —— 生成完读数必须涨,这里用同一把尺子闭环)
  const { pages, cfgText } = listMiniappPages(rootDir)
  for (const p of pages) if (cov.mirroredSpecs(p).has(shape.spec)) {
    return { kind: 'skip', why: `该屏已被小程序页镜像:${p.route}(${p.file}),依据=标记行命中 cov.mirroredSpecs;不重复造页` }
  }

  // registry 在册配对?
  const regText = faceReadMap(rootDir, [REGISTRY]).get(REGISTRY)
  if (regText === null) return { kind: 'undetermined', why: `未判定:HEAD 面取不到 ${REGISTRY}` }
  let reg
  try { reg = JSON.parse(regText) } catch (e) { return { kind: 'undetermined', why: `未判定:registry JSON 解析不过:${e.message}` } }
  if ((reg.entries || []).some((e) => e.shared === shape.spec)) {
    return { kind: 'refuse', why: `registry 已登记该屏(${(reg.entries || []).find((e) => e.shared === shape.spec).miniapp})而页面缺标记载体 —— 那是 auto-register-cross-end 的射程(页已存在只缺声明),本器物不越界` }
  }

  // RN 腿:cov.rnConsumes(尺子 import);导出登记 packages/app/src/index.ts
  let rnRels
  try {
    rnRels = listFaceFiles(rootDir, 'head', { paths: [RN_SCREENS] }).filter((r) => r.endsWith('.tsx'))
  } catch (e) {
    return { kind: 'undetermined', why: `未判定:RN 屏清单取不到(${e?.message ?? e})` }
  }
  if (rnRels.length === 0) return { kind: 'undetermined', why: `未判定:HEAD 面枚举到 0 枚 RN 屏(${RN_SCREENS})` }
  const rnMap = faceReadMap(rootDir, rnRels)
  // cov.collectShared 的 name 形制 = `<Base>Screen`(共享符号同名),rnConsumes 判的也是这个符号
  const rnHits = rnRels.filter((r) => cov.rnConsumes({ text: rnMap.get(r) }, `${shape.base}Screen`)).sort()
  if (rnHits.length === 0) return { kind: 'refuse', why: `HEAD 面无任何 RN 屏 import @ihui/rn-app 使用 ${shape.base}(registry 头注要求 RN 腿),三腿不齐不登记` }
  const indexText = faceReadMap(rootDir, [APP_INDEX]).get(APP_INDEX)
  if (indexText === null) return { kind: 'undetermined', why: `未判定:HEAD 面取不到 ${APP_INDEX}` }
  if (!new RegExp(`export\\s*(?:\\{[^}]*\\b${shape.base}Screen\\b|\\*\\s*from)`).test(indexText)) {
    return { kind: 'refuse', why: `符号 ${shape.base}Screen 未在 ${APP_INDEX} 导出(登记口径要求同名导出)` }
  }

  // 分包/路由
  const { blocks } = parseMiniappRoutes(cfgText)
  const inf = subpackage ? { root: subpackage, note: null } : inferSubpackage(blocks, shape.domain)
  if (!inf.root) return { kind: 'undetermined', why: inf.note }
  if (subpackage && !blocks.some((m) => m[1] === subpackage)) {
    return { kind: 'refuse', why: `--subpackage='${subpackage}' 不是 app.config.ts 里的现成 root(可用: ${blocks.map((m) => m[1]).join(' / ')})` }
  }
  const pagePath = page || `${kebab(shape.base)}/index`
  const route = `${inf.root}/${pagePath}`
  const pageRel = `${MP_SRC}/${route}.tsx`
  const alreadyOnDisk = existsSync(join(rootDir, pageRel)) || pages.some((p) => p.file === pageRel)
  if (alreadyOnDisk) return { kind: 'skip', why: `页面文件已存在(上轮已落或人工先落):${pageRel} —— 造页动作跳过,其余接缝按幂等各自点名` }

  // i18n 键集:共享屏 + RN 壳的 t() 字面量;非通用命名空间;五语逐语可解析
  const rnShellKeys = extractUsedKeys(rnMap.get(rnHits[0]))
  const usedAll = [...new Set([...extractUsedKeys(screenText), ...rnShellKeys])]
  const kept = []
  const dropped = []
  const rnPacks = faceReadMap(rootDir, LANGS.map((l) => `${RN_PACK_DIR}/${l}.json`))
  const packObjs = {}
  for (const l of LANGS) {
    const t = rnPacks.get(`${RN_PACK_DIR}/${l}.json`)
    if (t === null) return { kind: 'undetermined', why: `未判定:HEAD 面取不到 ${RN_PACK_DIR}/${l}.json(mobile-rn 词包是取值唯一源)` }
    try { packObjs[l] = JSON.parse(t) } catch (e) { return { kind: 'undetermined', why: `未判定:${l} 词包 JSON 解析不过:${e.message}` } }
  }
  for (const k of usedAll) {
    const ns = k.split('.')[0]
    if (GENERIC_NS.has(ns)) continue
    if (LANGS.every((l) => leafAt(packObjs[l], k) !== null)) kept.push(k)
    else dropped.push(k)
  }
  if (kept.length === 0) {
    return { kind: 'refuse', why: `该屏 t() 命中的键在五语 mobile-rn 词包里无一可整组解析(弃用键:${dropped.join(', ') || '无'}),零新译前提下无内容可镜像` }
  }

  // 命名空间分组(键序 = en 词包遍历序;词包没有的键已被剔除)
  const nsOrder = []
  const byNs = new Map()
  for (const k of kept) {
    const ns = k.split('.')[0]
    if (!byNs.has(ns)) { byNs.set(ns, []); nsOrder.push(ns) }
    byNs.get(ns).push(k)
  }
  const nsKeys = nsOrder.map((ns) => {
    const inPack = orderedLeavesOfNs(packObjs.en, ns)
    const use = new Set(byNs.get(ns))
    const sorted = [...inPack.filter((p) => use.has(p)), ...byNs.get(ns).filter((p) => !inPack.includes(p))]
    return { ns, keys: sorted }
  })

  const titleKey = nsKeys.flatMap((g) => g.keys).find((k) => k.endsWith('.title')) || null
  const subtitleKey = nsKeys.flatMap((g) => g.keys).find((k) => k.endsWith('.subtitle')) || null
  const keySet = new Set(nsKeys.flatMap((g) => g.keys))
  const pairs = []
  const usedInPairs = new Set()
  for (const g of nsKeys) {
    for (const k of g.keys) {
      if (k === titleKey || k === subtitleKey || k.endsWith('Body')) continue
      if (keySet.has(`${k}Body`)) { pairs.push([k, `${k}Body`]); usedInPairs.add(k); usedInPairs.add(`${k}Body`) }
    }
  }
  const singles = nsKeys
    .flatMap((g) => g.keys)
    .filter((k) => k.split('.').length === 2 && k !== titleKey && k !== subtitleKey && !usedInPairs.has(k))
    .filter((k) => typeof leafAt(packObjs.en, k) === 'string')

  const langBlocks = LANGS.map((l) => ({
    lang: l,
    packRel: `${MP_PACK_DIR}/${l}.json`,
    // subsetOf 从词包该命名空间节点取(键剥掉 ns 前缀),成员行首键即 ns 名本身,不得二次套叠
    groups: nsKeys.map((g) => memberLinesFor(g.ns, subsetOf(packObjs[l][g.ns], g.keys.map((k) => k.slice(g.ns.length + 1))))),
    paths: nsKeys.flatMap((g) => g.keys),
  }))

  return {
    kind: 'plan',
    spec: shape.spec,
    fnName: shape.base,
    domain: shape.domain,
    subRoot: inf.root,
    subNote: inf.note,
    page: pagePath,
    route,
    pageRel,
    rnLeg: rnHits[0],
    titleKey,
    subtitleKey,
    pairs,
    singles,
    nsKeys,
    droppedKeys: dropped,
    pageText: buildPage({ spec: shape.spec, fnName: shape.base, titleKey, subtitleKey, pairs, singles }),
    langBlocks,
    registryEntry: { shared: shape.spec, rn: rnHits[0], miniapp: route },
  }
}

// ---------- 落地(每接缝幂等 + 他席在飞拒 + 基底取 HEAD blob) ----------

/**
 * 单接缝落地器。transform(headText, workText) 三态:
 *   {ok:false, skipped:true, why}  已存在(HEAD 或上轮未提交的工作树副本)⇒ 跳过并点名
 *   {ok:false, why}                判定成立但不可用 ⇒ 拒绝(不写)
 *   {ok:true, text}                可写 —— 写前再验工作树分歧(他席在飞拒,§12b)
 */
function applySeamExisting(rootDir, rel, transform) {
  const headText = faceReadMap(rootDir, [rel]).get(rel)
  if (headText === null) return { state: 'refused', why: `${rel}:HEAD 面取不到底稿,拒绝落地(§0.3 不回落另一个面)` }
  let workText = null
  try {
    workText = readWorktreeFile(rootDir, rel)
  } catch (e) {
    return { state: 'refused', why: `${rel}:工作树副本读不到(${e?.message ?? e}),未判定不动` }
  }
  const r = transform(headText, workText)
  if (r.skipped) return { state: 'skipped', why: `${rel}:${r.why}` }
  if (!r.ok) return { state: 'refused', why: `${rel}:${r.why}` }
  if (workText !== null) {
    const div = workDiverges(headText, workText)
    if (div > 0) return { state: 'refused', why: `${rel}:工作树副本有 ${div} 行不在 HEAD(他席在飞),本接缝不动,留待下轮` }
  }
  try {
    writeFileSync(join(rootDir, rel), r.text)
  } catch (e) {
    return { state: 'refused', why: `${rel}:写盘失败:${e.message}` }
  }
  return { state: 'applied', why: r.insertedLine ? `插行 ${r.insertedLine.trim()}` : '已写' }
}

export function applyGeneration(rootDir, plan) {
  const results = []
  // ① 新页文件(不存在才写;写后紧随水印)
  {
    const headHas = faceReadMap(rootDir, [plan.pageRel]).get(plan.pageRel)
    const onDisk = existsSync(join(rootDir, plan.pageRel))
    if (headHas !== null || onDisk) results.push({ seam: plan.pageRel, state: 'skipped', why: '页面文件已存在' })
    else {
      mkdirSync(dirname(join(rootDir, plan.pageRel)), { recursive: true })
      writeFileSync(join(rootDir, plan.pageRel), plan.pageText)
      let wm = '跳过(夹具仓无 watermark.mjs)'
      const wmScript = join(rootDir, 'scripts', 'watermark.mjs')
      if (existsSync(wmScript)) {
        try {
          execFileSync(process.execPath, [wmScript, 'inject', join(rootDir, plan.pageRel)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
          execFileSync(process.execPath, [wmScript, 'verify', join(rootDir, plan.pageRel)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
          wm = 'inject+verify 已跑'
        } catch (e) {
          wm = `水印步骤失败(页面已写,水印需人工补):${e?.message ?? e}`
        }
      }
      results.push({ seam: plan.pageRel, state: 'applied', why: `新建页面;水印 ${wm}` })
    }
  }
  // ② app.config.ts 路由行
  results.push({
    seam: MP_CONFIG,
    ...applySeamExisting(rootDir, MP_CONFIG, (headText, workText) => {
      if (workText !== null) {
        const wblk = parseMiniappRoutes(workText).blocks.find((m) => m[1] === plan.subRoot)
        if (wblk && wblk[2].includes(`'${plan.page}'`)) return { ok: false, skipped: true, why: '副本已在册(上轮落地未提交)' }
      }
      return insertConfigPage(headText, plan.subRoot, plan.page)
    }),
  })
  // ③ 五份 miniapp 词包(按行插,禁整文件 stringify;先查在册再查他席)
  for (const lb of plan.langBlocks) {
    const res = applySeamExisting(rootDir, lb.packRel, (headText, workText) => {
      const headObj = JSON.parse(headText)
      if (lb.paths.every((p) => pathExists(headObj, p))) return { ok: false, skipped: true, why: `命名空间在册键已齐(${lb.paths.length} 键),幂等跳过` }
      if (workText !== null) {
        try {
          const w = JSON.parse(workText)
          if (lb.paths.every((p) => pathExists(w, p))) return { ok: false, skipped: true, why: '工作树副本已含(上轮落地未提交)' }
        } catch { /* 坏 JSON 交给下游他席守卫/写后自证处理 */ }
      }
      return insertJsonMembers(headText, lb.groups)
    })
    results.push({ seam: lb.packRel, ...res })
  }
  // ④ registry 三元组
  results.push({
    seam: REGISTRY,
    ...applySeamExisting(rootDir, REGISTRY, (headText, workText) => {
      if (JSON.parse(headText).entries.some((e) => e.shared === plan.spec)) return { ok: false, skipped: true, why: 'registry 已有该屏配对' }
      if (workText !== null) {
        try {
          if (JSON.parse(workText).entries.some((e) => e.shared === plan.spec)) return { ok: false, skipped: true, why: '工作树副本已含(上轮落地未提交)' }
        } catch { /* 同上 */ }
      }
      return insertRegistryEntry(headText, plan.registryEntry)
    }),
  })
  return results
}

// ---------- CLI ----------

async function main() {
  const argv = process.argv.slice(2)
  const screenArg = argv.find((a) => a.startsWith('--screen='))
  const repoArg = argv.find((a) => a.startsWith('--repo=') || a.startsWith('--root='))
  const subArg = argv.find((a) => a.startsWith('--subpackage='))
  const pageArg = argv.find((a) => a.startsWith('--page='))
  const applyMode = argv.includes('--apply')
  if (!screenArg) {
    console.error('用法:node scripts/gen-miniapp-mirror.mjs --screen=packages/app/src/features/<domain>/<Name>Screen.tsx [--apply] [--subpackage=…] [--page=…]')
    console.error('❌ 未判定:缺 --screen 输入')
    return 2
  }
  const rootDir = repoArg ? resolve(repoArg.slice(repoArg.indexOf('=') + 1)) : resolve(fileURLToPath(new URL('..', import.meta.url)))
  const plan = planGeneration(rootDir, {
    screenRel: screenArg.slice('--screen='.length),
    subpackage: subArg ? subArg.slice('--subpackage='.length) : null,
    page: pageArg ? pageArg.slice('--page='.length) : null,
  })

  if (plan.kind === 'skip') {
    console.log(`⏭ 点名跳过:${plan.why}`)
    return 0
  }
  if (plan.kind === 'undetermined') {
    console.error(`❓ 未判定(既不记绿也不冒红):${plan.why}`)
    return 2
  }
  if (plan.kind === 'refuse') {
    console.error(`⛔ 拒绝生成:${plan.why}`)
    return 1
  }

  console.log(`判定面 HEAD blob | 仓库根 ${rootDir}`)
  console.log(`共享屏 ${plan.spec}(域 ${plan.domain}) → 小程序路由 ${plan.route}`)
  console.log(`RN 腿 ${plan.rnLeg}${plan.subNote ? `\n备注:${plan.subNote}` : ''}`)
  console.log(`镜像命名空间:${plan.nsKeys.map((g) => `${g.ns}(${g.keys.length} 键)`).join(' / ')}`)
  if (plan.droppedKeys.length) console.log(`⚠ 五语词包不齐而弃用的键(零新译前提):${plan.droppedKeys.join(', ')}`)
  console.log(`\n=== 将新建页面 ${plan.pageRel}(全文)===\n${plan.pageText}`)
  console.log(`=== 接缝② ${MP_CONFIG}(root '${plan.subRoot}' pages 末尾插行)===`)
  {
    const head = faceReadMap(rootDir, [MP_CONFIG]).get(MP_CONFIG)
    const r = insertConfigPage(head, plan.subRoot, plan.page)
    console.log(r.ok ? `+ ${r.insertedLine.trim()}` : `(${r.skipped ? '已在册,跳过' : '补丁不可用'}:${r.why || ''})`)
  }
  for (const lb of plan.langBlocks) {
    console.log(`=== 接缝③ ${lb.packRel}(+${lb.groups.flat().length} 行,基底 HEAD blob)===`)
    console.log(lb.groups.flat().join('\n'))
  }
  console.log(`=== 接缝④ ${REGISTRY}(+5 行)===`)
  console.log(['    {', `      "shared": ${JSON.stringify(plan.registryEntry.shared)},`, `      "rn": ${JSON.stringify(plan.registryEntry.rn)},`, `      "miniapp": ${JSON.stringify(plan.registryEntry.miniapp)}`, '    }'].join('\n'))

  if (!applyMode) {
    console.log('\n(预演模式,未写盘;加 --apply 落地)')
    return 0
  }
  // 写前再自证一次"该屏在 HEAD 存在"(§0.4 同面同轮)
  if (faceReadMap(rootDir, [plan.spec]).get(plan.spec) === null) {
    console.error('❓ 未判定:落地前自证失败 —— HEAD 面已取不到该屏,不落')
    return 2
  }
  const results = applyGeneration(rootDir, plan)
  console.log('\n=== 落地结果 ===')
  for (const r of results) console.log(`[${r.state}] ${r.seam}${r.why ? `  ${r.why}` : ''}`)
  const applied = results.filter((r) => r.state === 'applied').length
  const skipped = results.filter((r) => r.state === 'skipped').length
  const refused = results.filter((r) => r.state === 'refused').length
  console.log(`GEN-MIRROR-RESULT screen=${plan.spec} applied=${applied} skipped=${skipped} refused=${refused}`)
  return refused > 0 ? 1 : 0
}

/* §22d:直执行才跑主流程;测试 import __test__ 不得触发 CLI */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

export const __test__ = {
  kebab,
  screenShapeOf,
  extractUsedKeys,
  pathExists,
  leafAt,
  orderedLeavesOfNs,
  subsetOf,
  memberLinesFor,
  insertJsonMembers,
  parseMiniappRoutes,
  insertConfigPage,
  insertRegistryEntry,
  buildPage,
  workDiverges,
  planGeneration,
  applyGeneration,
  constants: { LANGS, MP_CONFIG, REGISTRY, MP_PACK_DIR, RN_PACK_DIR, MP_SRC, GENERIC_NS },
}

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ 未判定(异常):${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
