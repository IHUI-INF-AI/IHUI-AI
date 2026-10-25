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
import { shellExportShapeOf } from './lib/rn-shell-refs.mjs'
import { walkClosure, aliasKeysOf, uncoveredNativePackages } from './lib/rn-shell-closure.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'

const LANGS = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW']
const SHARED_DIR = 'packages/app/src/features'
const MP_SRC = 'apps/miniapp-taro/src'
const MP_CONFIG = `${MP_SRC}/app.config.ts`
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
const RN_SCREENS = 'apps/mobile-rn/src/screens'
const APP_INDEX = 'packages/app/src/index.ts'
/** weapp 侧 RN 别名表所在地(两处块:顶层 + mini 平台段,平台段是整体替换而非合并)。 */
const TARO_CONFIG_REL = 'apps/miniapp-taro/config/index.ts'
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

/**
 * 命名空间成员的按行形态:**一律多行**(2 空格开块 / 4 空格键)。
 * 返回行数组,**不带**尾逗号 —— 逗号由 insertJsonMembers 在成员组之间补。
 *
 * ⚠ 为什么不再用"扁平 ≤2 键 → 单行内联"(2026-10-25 改,治本器物自己造的非 canonical 行):
 *   原实现对 ≤2 键的扁平命名空间写单行内联(首例 aa4c418bff1a 里的
 *   `"agreement": {"subtitle":"…","title":"…"}` 就是这个形态)。但实测(2026-10-25 现读):
 *   **五份 miniapp 词包共 204 个顶层命名空间,单行内联形态 0 个、多行形态 204 个**
 *   —— 首例那两行后来被 prettier 规整成了多行。即"内联"是**本器物自造的形态**,
 *   不是本仓约定。
 *   危害有三:
 *   ① 插出来的行**破坏 canonical 恒等式**(JSON.stringify(obj,null,2)+'\n' ≠ 原文)
 *      ⇒ 并键档的 canonical 自检会当场拒 ⇒ **批量档里"先插的屏"会让"后并键的屏"全被拒**
 *      (档间互锁,实测复现);
 *   ② 与仓内 204/204 的实际形态不一致 ⇒ 每次插入都留下一枚"要等人手规整"的行;
 *   ③ prettier 会把它改写 ⇒ 提交时多一轮无谓 diff。
 *   ⇒ 一律多行:既 canonical,又与全仓形态一致。
 */
export function memberLinesFor(ns, obj) {
  const inner = JSON.stringify(obj, null, 2)
    .split('\n')
    .slice(1, -1)
    .map((l) => `  ${l}`)
  return [`  "${ns}": {`, ...inner, '  }']
}

/**
 * 词包顶层已存在的命名空间名集合(字符级扫,不依赖 JSON.parse 语义 ——
 * 重复键会被 JSON.parse 静默去重,解析结果看不出"这个 ns 出现过两次")。
 * 顶层判据 = 该键前的缩进恰为 2 空格且后面是 `":` —— 与 memberLinesFor 的输出缩进同形。
 */
export function topLevelNamespaces(text) {
  const out = new Set()
  const lines = String(text || '').split('\n')
  for (const line of lines) {
    // 深度判据 = 行首缩进(本仓词包是 prettier 格式化产物,缩进即层级;顶层成员恒为 2 空格)
    const indent = line.length - line.trimStart().length
    if (indent !== 2) continue
    const m = /^"([^"]+)"\s*:/.exec(line.trim())
    if (m) out.add(m[1])
  }
  return out
}

/**
 * 词包**并键**(命名空间已存在时,把缺键并进去,而不是拒写)。
 *
 * 为什么需要这一档(治"11/101 枚屏因命名空间已存在就整屏落不了"):
 *   目标词包已存在同名顶层命名空间时,insertJsonMembers 会拒(造重复键 ⇒ JSON.parse 静默
 *   last-wins ⇒ 原键被遮蔽)。但那 11 枚屏要的键**大多不在既有块里**(实测:9 枚全是扁平缺键,
 *   2 枚含嵌套缺键)⇒ 整屏拒 = 白丢 11 枚屏的进度,而正确动作是"把缺的键并进既有块"。
 *
 * 并键的两条硬约束:
 *   ① **既有键的值一律不覆盖**(实测 miniapp 与 mobile-rn 同名键有 83 处值不同 ——
 *      miniapp 侧的值是本端已定的文案,RN 侧的是另一端的;覆盖等于拿别人的文案改本端)。
 *      只补**目标包里没有的键**,新键的值取自 mobile-rn 词包(零新译)。
 *   ② **只动顶层命名空间的直接子键**;缺键若落在既有块的**嵌套子对象**里(实测 2 枚屏),
 *      逐层并键会改到既有嵌套块的内部结构 ⇒ 那 2 枚屏**本档不并,整屏拒**(点名),
 *      交给人工。失效方向恒为"少并一个键",绝不"改坏既有嵌套结构"。
 *
 * 整文件重渲染为什么安全(实测证据,不是推测):
 *   五份 miniapp 词包**全部**满足 `JSON.stringify(JSON.parse(text), null, 2) + '\n' === text`
 *   (逐字节相同,2026-10-25 现读)⇒ 重渲染只改"新增键"那几行,其余字节原样保留。
 *   若某天该恒等式不成立(有人手改了格式),本函数**拒写并点名**(不重排他人文件)。
 */
export function mergeJsonMembers(text, members) {
  if (!members.length) return { ok: false, why: '没有可插入的成员组' }
  let obj
  try {
    obj = JSON.parse(text)
  } catch (e) {
    return { ok: false, why: `目标词包 JSON 解析不过,拒写:${e.message}` }
  }
  // 恒等式自检:不成立 ⇒ 本档的整文件重渲染会重排他人文件 ⇒ 拒
  const canonical = JSON.stringify(obj, null, 2) + '\n'
  if (canonical !== text) {
    return { ok: false, why: '目标词包不是 canonical 形态(JSON.stringify(obj,null,2)+换行 与原文不逐字节相同)⇒ 整文件重渲染会重排他人文件,拒写' }
  }
  const added = []
  const skipped = []
  const refusedNested = []
  for (const m of members) {
    const ns = m.ns
    const payload = m.obj
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { skipped.push(`${ns}(非对象成员,略)`); continue }
    const cur = obj[ns]
    if (cur === undefined) {
      obj[ns] = payload
      added.push(`${ns}(新建 ${Object.keys(payload).length} 键)`)
      continue
    }
    if (typeof cur !== 'object' || Array.isArray(cur)) {
      refusedNested.push(`${ns}(既有同名键不是对象,无法并键)`)
      continue
    }
    // 只并"既有块里没有的键";不覆盖任何既有值
    let merged = 0
    let nested = 0
    for (const [k, v] of Object.entries(payload)) {
      if (k in cur) continue // 既有键:一律不覆盖
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        // 新键的值是嵌套对象 ⇒ 它在既有块里不存在,但本档只并顶层直接子键 ⇒ 不并
        nested++
        continue
      }
      cur[k] = v
      merged++
    }
    if (nested > 0) refusedNested.push(`${ns}(缺键落在嵌套子对象里 ${nested} 处,本档不并)`)
    if (merged > 0) added.push(`${ns}(并入 ${merged} 键)`)
    else if (nested === 0) skipped.push(`${ns}(键已全在册,幂等跳过)`)
  }
  if (refusedNested.length) {
    return {
      ok: false,
      why: `并键档不能处理这些命名空间(须人工):${refusedNested.join(' / ')}`,
      added,
      skipped,
    }
  }
  const next = JSON.stringify(obj, null, 2) + '\n'
  try {
    JSON.parse(next)
  } catch (e) {
    return { ok: false, why: `并键后词包 JSON 解析不过(不落盘):${e.message}` }
  }
  return { ok: true, text: next, added, skipped }
}

/**
 * 词包按行插入:groups = 每命名空间一个行组。找到最后一个非空行(必须是 `}`),
 * 给前一个成员闭行补逗号(若它没以 `,`/`{`/`:` 收尾),把各组依次插到末行之前,组间补 `,`。
 * 全文件其余字节原样保留(split/join 保尾换行)。
 *
 * ⚠ 重复命名空间守卫(2026-10-25 立,治本器物自己会造的病):
 *   目标词包**已存在同名顶层命名空间**时,再插一份 ⇒ 同一 JSON 里出现两个 "chat": 键
 *   ⇒ JSON.parse 静默 last-wins ⇒ 原有那一份的键被整体遮蔽(本仓 2026-09-08 已发生过同型事故:
 *   automations 命名空间重复 ⇒ 块独占的 delete 键全部丢失)。
 *   本仓守门 scripts/check-i18n-duplicate-namespaces.mjs 是字符级扫,能判出来,
 *   但那是**写盘之后、提交时**才红 —— 器物自己应当先拒(§0.3「没判不写成判过」的同源纪律:
 *   知道自己会造出重复键还照写,是不该有的明知故犯)。
 *   守卫方向 = **拒写并点名**(失效方向恒为"少写一个命名空间",绝不"写了再说");
 *   需要"既有命名空间里补缺键"的情形走 mergeJsonMembers(并键档)。
 */
export function insertJsonMembers(text, groups) {
  if (!groups.length) return { ok: false, why: '没有可插入的成员组' }
  const existing = topLevelNamespaces(text)
  const dup = groups
    .map((g) => {
      const m = /^\s*"([^"]+)"\s*:/.exec(g[0] || '')
      return m ? m[1] : null
    })
    .filter((n) => n && existing.has(n))
  if (dup.length) {
    return {
      ok: false,
      why: `目标词包已存在顶层命名空间 ${[...new Set(dup)].join(' / ')};再插一份会让 JSON.parse 静默 last-wins 遮蔽原键(守门 check-i18n-duplicate-namespaces 会判红)⇒ 拒写,须人工把键并进既有命名空间`,
    }
  }
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

/**
 * 壳承载形制(2026-10-26 立)—— 端内不写布局、不写数据,只承载 RN 壳。
 *
 * 为什么要有这一档:`scripts/lib/cross-end-screen-props.mjs` 用 TypeScript 编译器现读量出
 * 98 枚跨端缺口里只有 2 枚的必填 props 落在"平台可注入"集内,其余 96 枚要 error/item/loading
 * 这类数据与状态 —— 那段请求+状态机胶水 RN 壳里已经写好。若仍按旧档产出"文案骨架页",
 * 就是把 96 枚屏的用户可见功能写成空壳(声明链全绿、体验全无,正是 check-miniapp-mirror-fidelity
 * 头注自证的那一型)。壳承载 = 渲染走 packages/app 共享屏(经 src/rn-compat)、数据走壳本体。
 *
 * 注入腿(端内不重复实现取词/主题):壳里的相对请求 ../i18n 与 ../context/ThemeContext
 * 由 apps/miniapp-taro/config/rn-shell-replace-plugin.ts 按"发起上下文在 apps/mobile-rn/src/ 内"
 * 换到端内真相源(src/i18n、src/rn-compat/theme.tsx)。
 */
export function buildShellPage({ spec, base, shellText = '' }) {
  const shellSymbol = `${base}Screen`
  const shape = shellExportShapeOf(shellText)
  // 取用形态由**壳的现读导出**决定:实测 5 枚壳承载页里 4 枚写的是默认导入,而壳只有具名导出
  // (webpack 只给一条 "export 'default' was not found" 警告,页面渲染成 undefined 而不是报错)。
  const binding = shape.hasDefault
    ? `import ${shellSymbol}Shell from '@rn-shells/${shellSymbol}'`
    : shape.names.has(shellSymbol)
      ? `import { ${shellSymbol} as ${shellSymbol}Shell } from '@rn-shells/${shellSymbol}'`
      : null
  if (!binding) {
    return {
      error: `壳文件既无 default 导出也没有具名 ${shellSymbol}(现读出口 {${[...shape.names].join(',')}})⇒ 不知该怎么引,拒绝产出`,
    }
  }
  const jsxTag = `${shellSymbol}Shell`
  const L = []
  L.push(`// 镜像 ${spec}`, '')
  L.push('/**')
  L.push(' * 由 scripts/gen-miniapp-mirror.mjs 以「壳承载形制」生成:端内不写布局、不写数据。')
  L.push(` *   渲染 = ${spec}(经 apps/miniapp-taro/src/rn-compat 兼容层落地),`)
  L.push(` *   数据与交互 = RN 壳 apps/mobile-rn/src/screens/${shellSymbol}.tsx 本体,`)
  L.push(' *   取词/主题 = config/rn-shell-replace-plugin.ts 按发起上下文换到端内真相源。')
  L.push(' * ⇒ 源头(RN 屏或壳)改一笔,这一页自动跟随;要改这一页的行为,应去改源头。')
  L.push(' */')
  L.push("import ThemeRoot from '@/components/ThemeRoot'")
  L.push(binding)
  L.push('')
  L.push(`export default function ${base}Page() {`)
  L.push('  return (')
  L.push('    <ThemeRoot>')
  L.push(`      <${jsxTag} />`)
  L.push('    </ThemeRoot>')
  L.push('  )')
  L.push('}')
  return `${L.join('\n')}\n`
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
  // 键表必须显式给元素类型:`[] as const` 推成 readonly [],解构元素为 never ⇒ TS2488。
  if (pairs.length === 0) L.push('const PAIR_KEYS: readonly (readonly [string, string])[] = []')
  else {
    L.push('const PAIR_KEYS: readonly (readonly [string, string])[] = [')
    for (const [a, b] of pairs) L.push(`  ['${a}', '${b}'],`)
    L.push(']')
  }
  if (singles.length === 0) L.push('const SINGLE_KEYS: readonly string[] = []')
  else {
    L.push('const SINGLE_KEYS: readonly string[] = [')
    for (const k of singles) L.push(`  '${k}',`)
    L.push(']')
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

/**
 * 共享读取上下文(批量档用)。
 *
 * 为什么要有它:planGeneration 逐屏调时,每屏都要重读
 *   ① 全部小程序页(判定"已被镜像") ② registry ③ 全部 RN 屏(找 RN 腿)
 *   ④ packages/app/src/index.ts ⑤ 五份 mobile-rn 词包
 * 共约 460 份文件 ⇒ 218 屏就是 10 万次文件读,批量档跑不动(实测预演档跑了几分钟没出结论)。
 * 本上下文把上述五组读**一次性**取好,批量档复用 ⇒ 判据逐字不变(仍走同一段 planGeneration),
 * 只是"取输入"这一步由每屏一次变成全批一次(§0.4 取材面纪律不受影响:仍是 HEAD blob)。
 *
 * 缓存键 = rootDir;同一次批量内共用一份(面不变 ⇒ 内容不变,§0.4 同面同轮)。
 */
function makeContext(rootDir) {  const miniapp = listMiniappPages(rootDir)
  const regText = faceReadMap(rootDir, [REGISTRY]).get(REGISTRY)
  const rnRels = listFaceFiles(rootDir, 'head', { paths: [RN_SCREENS] }).filter((r) => r.endsWith('.tsx'))
  const rnMap = faceReadMap(rootDir, rnRels)
  const indexText = faceReadMap(rootDir, [APP_INDEX]).get(APP_INDEX)
  const rnPacks = faceReadMap(rootDir, LANGS.map((l) => `${RN_PACK_DIR}/${l}.json`))
  const packObjs = {}
  let packError = null
  for (const l of LANGS) {
    const t = rnPacks.get(`${RN_PACK_DIR}/${l}.json`)
    if (t === null) { packError = `未判定:HEAD 面取不到 ${RN_PACK_DIR}/${l}.json(mobile-rn 词包是取值唯一源)`; break }
    try { packObjs[l] = JSON.parse(t) } catch (e) { packError = `未判定:${l} 词包 JSON 解析不过:${e.message}`; break }
  }
  return { rootDir, miniapp, regText, rnRels, rnMap, indexText, packObjs, packError }
}

/**
 * 壳承载前置③(2026-10-26 立)—— 闭包里的 RN 原生族包必须**都**已被端内别名承载。
 *
 * 立因(实测一天构建停摆):`react-native-svg` / `react-native-webview` / `react-native-wechat-lib` /
 * `expo-secure-store` 这四枚都不在别名表里,而它们的入口就是**未编译的 TS**(package.json 的 main /
 * react-native 指向 src/index.ts)。weapp 侧 webpack 不转译 node_modules 的 .ts ⇒
 * `ModuleParseError: Unexpected token`,整轮产物出不来 —— 而当时门全绿、账面一切正常。
 * 也就是说"这一页能不能编"取决于它**间接**拖进哪些包,这一格必须事先算得出,而不是等构建炸。
 *
 * 射程与如实边界:遍历壳本体 + 其相对导入 + `@rn-shells/*`;`@ihui/*` 与本包 workspace 包按"外部停点"
 * 处理(它们自己发 JS,不经 RN 别名)。这一档够用是因为炸构建的包都由 RN 侧源码直接引;
 * 若哪天共享屏自己直引 RN 原生包,把 workspace 展开加进 barrelOf 即可(判据同一条,不另写)。
 */
function shellClosureGaps(rootDir, shellRel, shellText, taroCfgText) {
  const aliasKeys = aliasKeysOf(taroCfgText)
  const relCache = new Map()
  const read = (rel) => {
    if (relCache.has(rel)) return relCache.get(rel)
    const t = faceReadMap(rootDir, [rel]).get(rel) ?? null
    relCache.set(rel, t)
    return t
  }
  const toRel = (fromFile, spec) => {
    if (spec.startsWith('@rn-shells/')) return `${RN_SCREENS}/${spec.slice('@rn-shells/'.length)}.tsx`
    const base = spec.startsWith('.') ? new URL(spec, `file:///${fromFile}`).pathname.replace(/^\/+/, '') : null
    if (base == null) return null
    for (const e of ['.tsx', '.ts', '.jsx', '.js', '.json']) if (read(`${base}${e}`) !== null) return `${base}${e}`
    for (const e of ['.tsx', '.ts', '.jsx', '.js']) if (read(`${base}/index${e}`) !== null) return `${base}/index${e}`
    return null
  }
  const walk = walkClosure({
    roots: [{ file: shellRel, text: shellText }],
    readFile: read,
    toRel,
    isBare: (s) => !s.startsWith('.') && !s.startsWith('@/') && !s.startsWith('@rn-shells/'),
  })
  void INTERNAL_STOP
  return { gaps: uncoveredNativePackages(walk.externals, aliasKeys), files: walk.files.size, unresolved: walk.unresolved }
}

export function planGeneration(rootDir, opts, ctx = null) {
  const { screenRel, subpackage, page } = opts
  const shape = screenShapeOf(screenRel)
  if (!shape) return { kind: 'undetermined', why: `--screen 不是尺子认得的共享屏形制(${SHARED_DIR}/<domain>/<Name>Screen.tsx)` }
  const c = ctx || makeContext(rootDir)
  const screenText = faceReadMap(rootDir, [shape.spec]).get(shape.spec)
  if (screenText === null) return { kind: 'undetermined', why: `未判定:HEAD 面取不到 ${shape.spec}` }

  // 已被镜像?(判据 import cov.mirroredSpecs —— 生成完读数必须涨,这里用同一把尺子闭环)
  const { pages, cfgText } = c.miniapp
  for (const p of pages) if (cov.mirroredSpecs(p).has(shape.spec)) {
    return { kind: 'skip', why: `该屏已被小程序页镜像:${p.route}(${p.file}),依据=标记行命中 cov.mirroredSpecs;不重复造页` }
  }

  // registry 在册配对?
  const regText = c.regText
  if (regText === null) return { kind: 'undetermined', why: `未判定:HEAD 面取不到 ${REGISTRY}` }
  let reg
  try { reg = JSON.parse(regText) } catch (e) { return { kind: 'undetermined', why: `未判定:registry JSON 解析不过:${e.message}` } }
  if ((reg.entries || []).some((e) => e.shared === shape.spec)) {
    return { kind: 'refuse', why: `registry 已登记该屏(${(reg.entries || []).find((e) => e.shared === shape.spec).miniapp})而页面缺标记载体 —— 那是 auto-register-cross-end 的射程(页已存在只缺声明),本器物不越界` }
  }

  // RN 腿:cov.rnConsumes(尺子 import);导出登记 packages/app/src/index.ts
  const rnRels = c.rnRels
  if (rnRels.length === 0) return { kind: 'undetermined', why: `未判定:HEAD 面枚举到 0 枚 RN 屏(${RN_SCREENS})` }
  const rnMap = c.rnMap
  // cov.collectShared 的 name 形制 = `<Base>Screen`(共享符号同名),rnConsumes 判的也是这个符号
  const rnHits = rnRels.filter((r) => cov.rnConsumes({ text: rnMap.get(r) }, `${shape.base}Screen`)).sort()
  if (rnHits.length === 0) return { kind: 'refuse', why: `HEAD 面无任何 RN 屏 import @ihui/rn-app 使用 ${shape.base}(registry 头注要求 RN 腿),三腿不齐不登记` }
  // 壳承载形制的硬前置:**同名** RN 壳文件必须存在。`@rn-shells/<Base>Screen` 这条别名是按名字指过去的,
  // 而 rnHits 判的是"谁 import 了这张共享屏"——两者不是一回事:现读 console-table / switch-prefs 两枚
  // 是被 DeveloperConversationsScreen 这类"使用者"命中的,于是产出了指向不存在模块的页面,
  // weapp 构建当场编不过(Taro 解析 @rn-shells/ConsoleTableScreen ⇒ "…ConsoleTableScreen.vue doesn't exist")。
  const shellRel = `${RN_SCREENS}/${shape.base}Screen.tsx`
  if (opts.form === 'shell' && !rnRels.includes(shellRel)) {
    return {
      kind: 'refuse',
      why: `壳承载需同名 RN 壳 ${shellRel}(现读消费方 ${rnHits[0]} 只是使用者)⇒ 数据腿无从继承,不产 dangling 页`,
    }
  }
  // 壳承载前置③:闭包里的 RN 原生族包必须都已被端内别名承载(缺一枚 = weapp 构建当场停摆)
  if (opts.form === 'shell') {
    const cfgMap = faceReadMap(rootDir, [TARO_CONFIG_REL])
    const taroCfg = cfgMap.get(TARO_CONFIG_REL)
    if (taroCfg === null) return { kind: 'undetermined', why: `未判定:HEAD 面取不到 ${TARO_CONFIG_REL}(别名表读不到就不判)` }
    const g = shellClosureGaps(rootDir, shellRel, rnMap.get(shellRel) ?? '', taroCfg)
    if (g.gaps.length > 0) {
      return {
        kind: 'refuse',
        why: `壳承载闭包里有未承载的 RN 原生包:${g.gaps.map((x) => `${x.pkg}(取用者 ${x.importers[0]})`).join(' / ')} —— 这些包入口是未编译 TS,weapp 侧没有 loader 处理 ⇒ 先在 ${TARO_CONFIG_REL} 两处 alias 块补端内承载,再来落页`,
      }
    }
  }
  const indexText = c.indexText
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
  if (c.packError) return { kind: 'undetermined', why: c.packError }
  const packObjs = c.packObjs
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
    // 并键档用的**对象**形态(键 ns → 成员对象):不从渲染行反解(反解要重解析 JSON,
    // 扁平 ≤2 键的单行内联形态与多行形态解析路径不同,反解是多余的脆弱面)。
    members: nsKeys.map((g) => ({ ns: g.ns, obj: subsetOf(packObjs[l][g.ns], g.keys.map((k) => k.slice(g.ns.length + 1))) })),
    paths: nsKeys.flatMap((g) => g.keys),
  }))

  const shellPage =
    opts.form === 'shell'
      ? buildShellPage({ spec: shape.spec, base: shape.base, shellText: rnMap.get(shellRel) ?? '' })
      : null
  if (shellPage?.error) return { kind: 'refuse', why: `${shape.spec}:${shellPage.error}` }

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
    pageText: shellPage ?? buildPage({ spec: shape.spec, fnName: shape.base, titleKey, subtitleKey, pairs, singles }),
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

/**
 * 词包接缝写入:先试"按行插"(新命名空间,原样保留他人字节),若因命名空间已存在被拒
 * ⇒ 转"并键档"(mergeJsonMembers:只补既有块里没有的键,既有值一律不覆盖)。
 *
 * 为什么要有这一层:命名空间已存在不是错误,是"要往既有块里补键" ——
 * 直接拒 ⇒ 整屏落不了(实测 11/101 枚);直接并 ⇒ 对新命名空间会重排整文件。
 * 两档分工:insertJsonMembers 管"全新的命名空间",mergeJsonMembers 管"既有命名空间补键"。
 *
 * lb 需带 groups(渲染行,给按行插)与 members(对象,给并键档)两套形态。
 */
function writeLangPack(headText, lb) {
  const r1 = insertJsonMembers(headText, lb.groups)
  if (r1.ok) return r1
  if (!/已存在顶层命名空间/.test(r1.why || '')) return r1
  const r2 = mergeJsonMembers(headText, lb.members)
  if (r2.ok) return r2
  return { ok: false, why: `${r1.why};并键档亦未成:${r2.why}` }
}

/**
 * 词包接缝落地(单屏档):按行插优先,命名空间已存在时转并键档。
 */
function applyLangPack(rootDir, lb) {
  return applySeamExisting(rootDir, lb.packRel, (headText, workText) => {
    const headObj = JSON.parse(headText)
    if (lb.paths.every((p) => pathExists(headObj, p))) return { ok: false, skipped: true, why: `命名空间在册键已齐(${lb.paths.length} 键),幂等跳过` }
    if (workText !== null) {
      try {
        const w = JSON.parse(workText)
        if (lb.paths.every((p) => pathExists(w, p))) return { ok: false, skipped: true, why: '工作树副本已含(上轮落地未提交)' }
      } catch { /* 坏 JSON 交给下游他席守卫/写后自证处理 */ }
    }
    return writeLangPack(headText, lb)
  })
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
  // ③ 五份 miniapp 词包(按行插优先,命名空间已存在时转并键档;先查在册再查他席)
  for (const lb of plan.langBlocks) {
    results.push({ seam: lb.packRel, ...applyLangPack(rootDir, lb) })
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

/**
 * 批量档 CLI:枚举全部共享屏 → 逐屏计划 → 汇总 → (--apply)合批落地。
 * 退出码:0 = 无失败(有成功/幂等跳过都算绿);1 = 有屏被拒;2 = 未判定(取不到输入)。
 */
async function runBatch(rootDir, { applyMode, subpackage, page }) {
  console.log(`判定面 HEAD blob | 仓库根 ${rootDir} | 档位 ${applyMode ? '落地(--apply)' : '预演'}`)
  let batch
  try {
    batch = planBatch(rootDir, { subpackage, page })
  } catch (e) {
    console.error(`❓ 未判定:${e?.message ?? e}`)
    return 2
  }
  const { planned, skipped, refused, undetermined } = batch
  console.log(
    `共享屏判定汇总:可生成 ${planned.length} / 已存在跳过 ${skipped.length} / 拒绝 ${refused.length} / 未判定 ${undetermined.length}`,
  )
  for (const s of skipped.slice(0, 20)) console.log(`⏭ 跳过 ${s.spec}  ${s.why}`)
  if (skipped.length > 20) console.log(`⏭ 跳过(其余 ${skipped.length - 20} 条略)`)
  for (const r of refused) console.log(`⛔ 拒绝 ${r.spec}  ${r.why}`)
  for (const u of undetermined) console.log(`❓ 未判定 ${u.spec}  ${u.why}`)

  if (planned.length === 0) {
    console.log('GEN-MIRROR-BATCH-RESULT planned=0 applied=0 refused=0 undetermined=' + undetermined.length)
    return refused.length > 0 || undetermined.length > 0 ? 1 : 0
  }
  console.log(`\n=== 将新建 ${planned.length} 个页面 ===`)
  for (const p of planned) {
    console.log(`  ${p.spec} → ${p.route}(分包 ${p.subRoot})  命名空间 ${p.nsKeys.map((g) => `${g.ns}(${g.keys.length})`).join('/')}${p.droppedKeys.length ? `  弃用键 ${p.droppedKeys.length}` : ''}`)
  }

  if (!applyMode) {
    console.log('\n(预演模式,未写盘;加 --apply 落地)')
    console.log(`GEN-MIRROR-BATCH-RESULT planned=${planned.length} applied=0 refused=${refused.length} undetermined=${undetermined.length}`)
    return refused.length > 0 || undetermined.length > 0 ? 1 : 0
  }

  const results = applyBatch(rootDir, planned)
  const applied = results.filter((r) => r.state === 'applied').length
  const skippedN = results.filter((r) => r.state === 'skipped').length
  const refusedN = results.filter((r) => r.state === 'refused').length
  console.log('\n=== 落地结果(按屏汇总)===')
  const byScreen = new Map()
  for (const r of results) {
    const k = r.screen
    if (!byScreen.has(k)) byScreen.set(k, [])
    byScreen.get(k).push(r)
  }
  for (const [screen, rs] of byScreen) {
    const bad = rs.filter((r) => r.state === 'refused')
    if (bad.length) {
      console.log(`[refused] ${screen}`)
      for (const b of bad) console.log(`    ${b.seam}  ${b.why}`)
    } else {
      console.log(`[ok] ${screen}  ${rs.filter((r) => r.state === 'applied').length} 接缝落地`)
    }
  }
  console.log(`GEN-MIRROR-BATCH-RESULT planned=${planned.length} applied=${applied} skipped=${skippedN} refused=${refusedN} undetermined=${undetermined.length}`)
  return refusedN > 0 || undetermined.length > 0 ? 1 : 0
}

async function main() {
  const argv = process.argv.slice(2)
  const screenArg = argv.find((a) => a.startsWith('--screen='))
  const repoArg = argv.find((a) => a.startsWith('--repo=') || a.startsWith('--root='))
  const subArg = argv.find((a) => a.startsWith('--subpackage='))
  const pageArg = argv.find((a) => a.startsWith('--page='))
  // 形制档:skeleton(文案骨架,旧默认) / shell(承载 RN 壳,数据与交互随源头同动)
  const formArg = argv.find((a) => a.startsWith('--form='))
  const applyMode = argv.includes('--apply')
  const allMode = argv.includes('--all')
  const rootDir = repoArg ? resolve(repoArg.slice(repoArg.indexOf('=') + 1)) : resolve(fileURLToPath(new URL('..', import.meta.url)))

  if (allMode)
    return runBatch(rootDir, {
      applyMode,
      subpackage: subArg ? subArg.slice('--subpackage='.length) : null,
      page: pageArg ? pageArg.slice('--page='.length) : null,
      form: formArg ? formArg.slice('--form='.length) : 'skeleton',
    })

  if (!screenArg) {
    console.error('用法:node scripts/gen-miniapp-mirror.mjs --screen=packages/app/src/features/<domain>/<Name>Screen.tsx [--apply] [--subpackage=…] [--page=…] [--form=shell]')
    console.error('  或:node scripts/gen-miniapp-mirror.mjs --all [--apply] [--form=shell]   # 批量:枚举全部共享屏逐屏判定')
    console.error('  --form=shell = 壳承载形制(端内不写布局与数据);缺省 = 旧文案骨架形制(只作对照,不是收口)')
    console.error('❌ 未判定:缺 --screen 输入')
    return 2
  }
  const plan = planGeneration(rootDir, {
    screenRel: screenArg.slice('--screen='.length),
    subpackage: subArg ? subArg.slice('--subpackage='.length) : null,
    page: pageArg ? pageArg.slice('--page='.length) : null,
    form: formArg ? formArg.slice('--form='.length) : 'skeleton',
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

// ---------- 批量(多屏一趟) ----------

/**
 * 批量计划:枚举全部共享屏,逐屏走同一条 planGeneration(单屏判据零复算),
 * 把结果按 kind 分桶。**批量不是新判据** —— 每屏的判定与单屏 --screen 档逐字同源。
 *
 * 为什么需要批量档(治"人工逐屏跑 111 次"不可持续):
 *   缺口账本现读 111 条共享屏未被小程序显式镜像;人工逐屏跑本器物 = 111 次
 *   重复的"选屏 → 预演 → 落地",每屏 4 个接缝,一次跑错就前功尽弃。
 *   批量档把"枚举 + 逐屏计划 + 汇总"变成一条命令,落地仍走同一套接缝落地器。
 *
 * 返回:{planned, skipped, refused, undetermined}
 *   planned[]      = kind==='plan' 的 plan 对象
 *   skipped[]      = kind==='skip'(已镜像/页面已存在)
 *   refused[]      = kind==='refuse'(判定成立但不该造)
 *   undetermined[] = kind==='undetermined'(取不到输入/形态不符 ⇒ 一次定向说明)
 */
export function planBatch(rootDir, opts = {}) {
  const screens = opts.screens || listSharedScreens(rootDir)
  // 全批共用一份读取上下文(见 makeContext 头注:批量档不逐屏重读整树)
  const ctx = makeContext(rootDir)
  const planned = []
  const skipped = []
  const refused = []
  const undetermined = []
  for (const spec of screens) {
    const plan = planGeneration(
      rootDir,
      { screenRel: spec, subpackage: opts.subpackage ?? null, page: opts.page ?? null, form: opts.form ?? 'skeleton' },
      ctx,
    )
    if (plan.kind === 'plan') planned.push(plan)
    else if (plan.kind === 'skip') skipped.push({ spec, why: plan.why })
    else if (plan.kind === 'refuse') refused.push({ spec, why: plan.why })
    else undetermined.push({ spec, why: plan.why })
  }
  return { planned, skipped, refused, undetermined }
}

/** 枚举全部共享屏 spec(HEAD 面)。取不到 ⇒ 抛错(上层判未判定,不回落别的面)。 */
function listSharedScreens(rootDir) {
  const rels = listFaceFiles(rootDir, 'head', { paths: [SHARED_DIR] }).filter((r) => MP_SHARED_SCREEN_RE.test(r))
  if (rels.length === 0) throw new Error(`未判定:HEAD 面枚举到 0 枚共享屏(${SHARED_DIR})`)
  return rels.sort()
}

/**
 * 批量落地:逐屏套用单屏接缝落地器(applyGeneration),但**共享接缝的写盘要合批**。
 *
 * 为什么必须合批(这是批量档最容易踩的坑):
 *   接缝②app.config.ts、接缝③五份词包、接缝④registry 是**多屏共享**的。
 *   逐屏各写一次 ⇒ 第 2 屏写 app.config.ts 时读到的底稿是"第 1 屏写完的工作树",
 *   而 applySeamExisting 的基底判定是"工作树副本有行不在 HEAD ⇒ 他席在飞 ⇒ 拒" ——
 *   于是**第 2 屏起全部被自己人挡住**(自己写的那行被当成他席在飞)。
 *   ⇒ 合批:先把该接缝在本批内的所有插入**在内存里依次应用**(每步都以上一步的结果为底),
 *   全部成功后写一次盘。落盘前仍做一次"他席在飞"判定(工作树 vs HEAD)。
 *
 * 失败方向:某一屏的接缝失败 ⇒ 该屏记 refused,**不阻断其余屏**(屏与屏之间无依赖);
 * 共享接缝的写盘只在该接缝**本批全部屏都成功**时才发生 ⇒ 不会出现"半截词包"。
 */
export function applyBatch(rootDir, plans) {
  const results = []
  // ① 页面文件:每屏一份,互不共享 ⇒ 逐屏写
  for (const plan of plans) {
    const headHas = faceReadMap(rootDir, [plan.pageRel]).get(plan.pageRel)
    const onDisk = existsSync(join(rootDir, plan.pageRel))
    if (headHas !== null || onDisk) {
      results.push({ screen: plan.spec, seam: plan.pageRel, state: 'skipped', why: '页面文件已存在' })
      continue
    }
    try {
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
      results.push({ screen: plan.spec, seam: plan.pageRel, state: 'applied', why: `新建页面;水印 ${wm}` })
    } catch (e) {
      results.push({ screen: plan.spec, seam: plan.pageRel, state: 'refused', why: `写盘失败:${e.message}` })
    }
  }

  // ②③④ 共享接缝:内存里逐屏依次应用,末了统一写一次
  const sharedSeams = []
  // ② app.config.ts
  {
    const headText = faceReadMap(rootDir, [MP_CONFIG]).get(MP_CONFIG)
    if (headText === null) {
      for (const p of plans) results.push({ screen: p.spec, seam: MP_CONFIG, state: 'refused', why: 'HEAD 面取不到底稿,拒绝落地' })
    } else {
      let text = headText
      let ok = true
      const inserts = []
      for (const p of plans) {
        const r = insertConfigPage(text, p.subRoot, p.page)
        if (r.ok) { text = r.text; inserts.push(r.insertedLine.trim()) }
        else if (r.skipped) { /* 已在册:幂等跳过,不算失败 */ }
        else { ok = false; results.push({ screen: p.spec, seam: MP_CONFIG, state: 'refused', why: r.why }) }
      }
      sharedSeams.push({ rel: MP_CONFIG, text, ok, applied: inserts })
    }
  }
  // ③ 五份 miniapp 词包
  for (const lang of LANGS) {
    const packRel = `${MP_PACK_DIR}/${lang}.json`
    const headText = faceReadMap(rootDir, [packRel]).get(packRel)
    if (headText === null) {
      for (const p of plans) results.push({ screen: p.spec, seam: packRel, state: 'refused', why: 'HEAD 面取不到底稿,拒绝落地' })
      continue
    }
    let text = headText
    let ok = true
    for (const p of plans) {
      const lb = p.langBlocks.find((x) => x.lang === lang)
      if (!lb) continue
      if (lb.paths.every((q) => pathExists(JSON.parse(text), q))) continue
      const r = writeLangPack(text, lb)
      if (r.ok) text = r.text
      else { ok = false; results.push({ screen: p.spec, seam: packRel, state: 'refused', why: r.why }) }
    }
    sharedSeams.push({ rel: packRel, text, ok })
  }
  // ④ registry
  {
    const headText = faceReadMap(rootDir, [REGISTRY]).get(REGISTRY)
    if (headText === null) {
      for (const p of plans) results.push({ screen: p.spec, seam: REGISTRY, state: 'refused', why: 'HEAD 面取不到底稿,拒绝落地' })
    } else {
      let text = headText
      let ok = true
      for (const p of plans) {
        const cur = JSON.parse(text)
        if ((cur.entries || []).some((e) => e.shared === p.spec)) continue
        const r = insertRegistryEntry(text, p.registryEntry)
        if (r.ok) text = r.text
        else { ok = false; results.push({ screen: p.spec, seam: REGISTRY, state: 'refused', why: r.why }) }
      }
      sharedSeams.push({ rel: REGISTRY, text, ok })
    }
  }

  // 共享接缝统一写盘:写前判"他席在飞"(工作树相对 HEAD 有新行 ⇒ 拒,不覆盖)
  for (const s of sharedSeams) {
    if (!s.ok) continue
    if (s.text === undefined) continue
    const headText = faceReadMap(rootDir, [s.rel]).get(s.rel)
    if (headText === null) continue
    if (headText === s.text) continue // 无变化
    let workText = null
    try { workText = readWorktreeFile(rootDir, s.rel) } catch { workText = null }
    if (workText !== null && workText !== s.text) {
      const div = workDiverges(headText, workText)
      if (div > 0) {
        for (const p of plans) results.push({ screen: p.spec, seam: s.rel, state: 'refused', why: `工作树副本有 ${div} 行不在 HEAD(他席在飞),本接缝不动,留待下轮` })
        continue
      }
    }
    try {
      writeFileSync(join(rootDir, s.rel), s.text)
      for (const p of plans) results.push({ screen: p.spec, seam: s.rel, state: 'applied', why: '合批写入' })
    } catch (e) {
      for (const p of plans) results.push({ screen: p.spec, seam: s.rel, state: 'refused', why: `写盘失败:${e.message}` })
    }
  }
  return results
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
  mergeJsonMembers,
  parseMiniappRoutes,
  insertConfigPage,
  insertRegistryEntry,
  buildPage,
  buildShellPage,
  workDiverges,
  planGeneration,
  applyGeneration,
  topLevelNamespaces,
  planBatch,
  applyBatch,
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
