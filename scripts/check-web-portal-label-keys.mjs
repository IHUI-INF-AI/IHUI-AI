#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断 */
/**
 * check-web-portal-label-keys.mjs — 门户表 titleKey ↔ 端内词包 不变量(2026-10-28 立)
 *
 * 为什么要有这道门:`packages/shared/src/constants/web-portal.ts` 是 WebView 门户唯一真相源,每个
 * `titleKey: 'webViewPortal.<k>'`(条目 + 分组标题)都必须在**两端 × 五语言**十份词包里存在。
 * 表里有键而词包没有时,端上按约定回落 `fallbackLabel`(中文)—— 界面不报错、不空白,**只是变成中文**,
 * 这是一类永远不会自己叫的失效;而现存 i18n 门只判"词包↔词包键集对齐",不知道门户表引用了哪些键,
 * 结构上判不到它。本会话成批收口 38 枚路由时靠手工逐份断言"零丢失 + 五语言齐",断言必须从"我记得做"
 * 变成"门判"。
 *
 * 判据:
 *   W1 blocking —— 表内每个 webViewPortal.* titleKey 在十份词包全部存在。存量现读为 0
 *        (落地前实测 140 键 × 10 面零缺失)⇒ 绝对零容忍而非差值棘轮(§12e:存量归零才配升 blocking)。
 *   W2 只报数 —— 词包里有、表内不引用的 webViewPortal.* 直接键(孤儿标签)。删标签属人工裁决,本门不代裁。
 *   取不到被审面 ⇒ exit 2「未判定」,既不记绿也不冒红(§0.3),不回落另一个面(§0.4)。
 *
 * 判据零复算(§0.6):面读取用 check-cross-end-screen-coverage 的 faceRead(同一条口径),
 * 键扁平化与词包清单用 add-web-portal-entries 的出口(门户唯一写入口那一份)。
 *
 * Usage:
 *   node scripts/check-web-portal-label-keys.mjs            # 全量档(HEAD blob)
 *   node scripts/check-web-portal-label-keys.mjs --staged   # 索引 blob
 *   node scripts/check-web-portal-label-keys.mjs --worktree # 人工逃生舱
 *   node scripts/check-web-portal-label-keys.mjs --self-test
 * 应急跳过:HUSKY_SKIP_PORTAL_LABEL_KEYS=1 git commit ...(提交信息写清责任归属)
 */
import { pathToFileURL } from 'node:url'

import { __test__ as X } from './add-web-portal-entries.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'

const PACKS = X.TARGETS.flatMap((t) => X.LANGS.map((l) => `packages/i18n/messages/${t}/${l}.json`))

const titleKeysOf = (portalText) =>
  [...String(portalText).matchAll(/titleKey: '([^']+)'/g)].map((m) => m[1])
const staticPathsOf = (portalText) => [
  ...new Set([...String(portalText).matchAll(/path: '(\/[^']+)'/g)].map((m) => m[1])),
]

/**
 * W3:门户静态条目的目的地是否存在 —— 纯函数,存在性由调用方按**被审面**注入。
 * 立因:门户是 WebView 入口清单,条目指向不存在的 web 路由时用户点开即 404;写入口
 * (add-web-portal-entries)只在"经它写"时断言过,手改门户表可绕过它。
 */
function phantomPortalPaths(portalText, hasPage) {
  return staticPathsOf(portalText).filter((p) => !hasPage(p))
}

/** 纯判据:喂十份文本,判 W1(缺键)与 W2(孤儿计数)。任何一份取不到/解不开 ⇒ undetermined。 */
function judge(portalText, packTexts) {
  const keys = titleKeysOf(portalText)
  if (!keys.length)
    return {
      state: 'undetermined',
      why: '门户表里取不到任何 titleKey(锚点失效)',
      missing: [],
      orphan: 0,
    }
  const missing = []
  const flatByPack = {}
  for (const rel of PACKS) {
    const t = packTexts[rel]
    if (typeof t !== 'string')
      return { state: 'undetermined', why: `词包取不到: ${rel}`, missing, orphan: 0 }
    let parsed
    try {
      parsed = JSON.parse(t)
    } catch (e) {
      return {
        state: 'undetermined',
        why: `词包解不开(${rel}): ${String(e?.message ?? e).slice(0, 60)}`,
        missing,
        orphan: 0,
      }
    }
    const set = X.flatKeys(parsed)
    flatByPack[rel] = set
    for (const k of keys) if (!set.has(k)) missing.push({ key: k, pack: rel })
  }
  const cn = flatByPack[`packages/i18n/messages/mobile-rn/zh-CN.json`]
  const ref = new Set(keys)
  // 门户页自身的 chrome(title/hint)不是条目标签,表里本就不该引用它们 ⇒ 不算孤儿(实测这俩是唯二的误报源)
  const CHROME = new Set(['webViewPortal.title', 'webViewPortal.hint'])
  const orphanKeys = [...cn].filter(
    (k) =>
      k.startsWith('webViewPortal.') && k.split('.').length === 2 && !ref.has(k) && !CHROME.has(k),
  )
  return {
    state: missing.length ? 'red' : 'green',
    keys: keys.length,
    missing,
    orphan: orphanKeys.length,
    orphanKeys,
  }
}

function faceOf(argv) {
  if (argv.includes('--worktree')) return 'worktree'
  if (argv.includes('--staged')) return 'staged'
  return 'head'
}

function run(argv) {
  const face = faceOf(argv)
  const portal = cov.faceRead(face, X.PORTAL_REL)
  if (typeof portal !== 'string') {
    console.log(`❓ 未判定:门户表取不到(${face} 面)—— 不记绿也不冒红(§0.3),不回落另一个面(§0.4)`)
    return 2
  }
  const packTexts = {}
  for (const rel of PACKS) {
    const t = cov.faceRead(face, rel)
    if (typeof t !== 'string') {
      console.log(`❓ 未判定:词包取不到(${face} 面): ${rel}`)
      return 2
    }
    packTexts[rel] = t
  }
  const r = judge(portal, packTexts)
  if (r.state === 'undetermined') {
    console.log(`❓ 未判定:${r.why}`)
    return 2
  }
  console.log(
    `[portal-label-keys] 面=${face} 表内 titleKey ${r.keys} 枚 × 词包 ${PACKS.length} 份 ⇒ W1 缺失 ${r.missing.length} 处(零容忍)`,
  )
  for (const m of r.missing.slice(0, 20)) console.log(`  · W1 缺键 ${m.key} @ ${m.pack}`)
  if (r.missing.length > 20) console.log(`  … 另有 ${r.missing.length - 20} 处`)
  console.log(
    `  · W2 孤儿标签(只报数不判红,删否归人):${r.orphan}` +
      (r.orphanKeys?.length ? ` 例:${r.orphanKeys.slice(0, 6).join(',')}` : ''),
  )
  if (r.state === 'red') {
    console.log(
      '修复出口(唯一写入口):node scripts/add-web-portal-entries.mjs --routes-file <清单> --apply\n' +
        '  它按被审面 blob 为底同批改门户表与十份词包,并断言"旧键集 ⊆ 新面 ∧ 差集恰为本票枚数";\n' +
        '  手工补词包也可以,但必须两端×五语言十份齐补(缺哪份界面就回落中文标签,不会报错)。',
    )
    return 1
  }
  // W3:门户条目指向的 web 路由必须在同一被审面上真存在(否则用户点开是 404)
  const phantom = phantomPortalPaths(
    portal,
    (p) => cov.faceRead(face, `apps/web/app/(main)${p}/page.tsx`) !== null,
  )
  if (phantom.length) {
    console.log(`❌ W3 ${phantom.length} 条门户条目指向不存在的 web 路由(被审面=${face}):`)
    for (const p of phantom.slice(0, 20)) console.log(`  · ${p}`)
    console.log('  出路:补该 web 页,或从门户表摘掉这条(摘时要同时确认十份词包里对应标签的去留)。')
    return 1
  }
  console.log('✅ 门户表每个 titleKey 在十份词包(两端×五语言)全部存在')
  return 0
}

function selfTest() {
  const cases = []
  const ok = (n, c) => cases.push({ n, c: !!c })
  const table = `titleKey: 'webViewPortal.sections.more',\n  titleKey: 'webViewPortal.demo',\n`
  const withBoth = '{"webViewPortal":{"demo":"x","sections":{"more":"y"}}}'
  const withoutDemo = '{"webViewPortal":{"sections":{"more":"y"}}}'
  const mk = (body) => Object.fromEntries(PACKS.map((p) => [p, body]))
  ok(
    'S1 阳性对照:表引而词包缺 ⇒ 判红且逐份点名',
    judge(table, mk(withoutDemo)).missing.length === PACKS.length,
  )
  ok('S2 十份齐 ⇒ 绿', judge(table, mk(withBoth)).state === 'green')
  ok('S3 分组标题键也进射程(不只条目)', titleKeysOf(table).includes('webViewPortal.sections.more'))
  ok(
    'S4 任一份取不到 ⇒ 未判定而非判绿',
    judge(table, { ...mk(withBoth), [PACKS[0]]: null }).state === 'undetermined',
  )
  ok(
    'S5 坏 JSON ⇒ 未判定,不猜',
    judge(table, { ...mk(withBoth), [PACKS[1]]: '{' }).state === 'undetermined',
  )
  ok(
    'S6 表里取不到键 ⇒ 未判定(不把空表读成零缺口)',
    judge('', mk(withBoth)).state === 'undetermined',
  )
  ok(
    'S7 孤儿标签只报数不改判',
    judge(table, mk('{"webViewPortal":{"demo":"x","orphanOne":"z","sections":{"more":"y"}}}'))
      .state === 'green' &&
      judge(table, mk('{"webViewPortal":{"demo":"x","orphanOne":"z","sections":{"more":"y"}}}'))
        .orphan === 1,
  )
  ok('S8 词包清单 = 两端×五语言且无重复', PACKS.length === 10 && new Set(PACKS).size === 10)
  ok(
    'S9 W3 阳性对照:条目指向不存在的路由 ⇒ 点名',
    phantomPortalPaths(`path: '/exists',\npath: '/gone'`, (p) => p === '/exists').join() ===
      '/gone',
  )
  ok('S10 W3 全在 ⇒ 空集', phantomPortalPaths(`path: '/exists'`, () => true).length === 0)
  for (const c of cases) console.log(`${c.c ? '✅' : '❌'} ${c.n}`)
  const bad = cases.filter((c) => !c.c).length
  console.log(
    bad ? `SELF-TEST FAIL ${bad}/${cases.length}` : `SELF-TEST OK ${cases.length}/${cases.length}`,
  )
  return bad ? 1 : 0
}

const argv = process.argv.slice(2)
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(argv.includes('--self-test') ? selfTest() : run(argv))

export const __test__ = { judge, titleKeysOf, staticPathsOf, phantomPortalPaths, PACKS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
