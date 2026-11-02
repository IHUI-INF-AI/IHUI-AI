#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * upgrade-miniapp-shell-pages.mjs —— 「手写镜像页 → 壳承载页」的**落地腿**(2026-10-27 立)。
 *
 * 分工(§0.6 单一真相源):判据与计划全部由 `scripts/plan-hand-mirror-conversion.mjs` 出
 * (相对取差:页面用到的 Taro.X / useXxx / @/ 模块在「共享屏 ∪ 承载壳」里一个都不出现才可转)。
 * 本器**不复制**那套判据,只负责把它判定的 convertible 行落成页面:
 *   ① 只处理 kind='convertible'(带私有能力/无壳/壳不渲染的一律不动);
 *   ② 页面工作树副本必须与 HEAD 逐字节一致(他席在飞 ⇒ held,不碰别人的现场);
 *   ③ 用 buildShellPage 生成(壳名可能与共享屏不同 —— 由 lib/pickCarrierShell 选定同一枚);
 *   ④ 落地前自证:重跑 hostingFormOf 必须判 hosted;否则整页拒落;
 *   ⑤ 伴生 index.config.ts 一概不动(标题/分包是端内事实,不是重复实现)。
 *
 * 落地顺序(器物不代替提交):写工作树 → 提交页面 → `node scripts/gen-rn-shell-types.mjs --write`
 *   → 提交派生声明件。壳声明件按 **HEAD 面**派生,故必须在页面入库之后重生成(门 251 C9 兜底)。
 *
 * 退出码:0 = 无需推进或已落;1 = 预演有可落地页(--apply 缺省);2 = 未判定。
 *
 * Usage:
 *   node scripts/upgrade-miniapp-shell-pages.mjs                # 预演
 *   node scripts/upgrade-miniapp-shell-pages.mjs --apply --cap=5
 *   node scripts/upgrade-miniapp-shell-pages.mjs --land --cap=2  # 自动落地(页面 + 声明件两批;守护轮用)
 *   node scripts/upgrade-miniapp-shell-pages.mjs --json
 *
 * 写盘申报(2026-11-03 立):--land 走 object-space-land 直落 HEAD = 已闭环,不登记;
 * 只有悬挂形态(--apply 人肉档 / 落 HEAD 失败且回退失败 / 声明件未落 HEAD)批末进
 * scripts/lib/cross-end-landing-ledger.mjs 账本(leg 逐字取守护自称名 CROSS_END_LEG)。
 * 只读预演零登记;账本读不到 ⇒ 照旧全量尝试 + ledger=unjudged。
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as gate } from './check-miniapp-mirror-fidelity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { buildShellPage } from './gen-miniapp-mirror.mjs'
import { pickCarrierShell } from './lib/rn-shell-refs.mjs'
import { maskComments } from './lib/code-mask.mjs'
// 写盘申报账本(2026-11-03 立):落点判据/幂等/形状校验全在库内,本文件只调它(§0.6)。
import { appendLanding, isRowComplete, readLanding } from './lib/cross-end-landing-ledger.mjs'
// 取 oid 与 collectiblePaths 同尺:库内 worktree 面用 gitRaw(['hash-object','--',p], root),
// 这里必须问同一把尺(两侧算法不一致的后果是"永远 contested")。
import { gitRaw } from './lib/face-reader.mjs'
import {
  navTitleExpr,
  needsAuthGate,
  plan,
  staticTitleEffect,
  titleOnlyLifecycle,
} from './plan-hand-mirror-conversion.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const MP_DIR = 'apps/miniapp-taro/src'
const SHELL_DECL = 'apps/miniapp-taro/types/rn-shells.generated.d.ts'

/**
 * 本腿在 git-guardian 的自称名,逐字取用,不自立新名:守护 sweepHandMirrorUpgrades 的
 * 节流戳与 env 旋钮都以这个名字自称(tickFile 'hand-mirror-upgrade-last.json'、
 * IHUI_HAND_UPGRADE_INTERVAL_MS / IHUI_HAND_UPGRADE_TIMEOUT_MS)。
 * 对照证据由 scripts/tests/cross-end-landing-legs.test.mjs 钉(名字必须逐字出现在守护源里)。
 */
export const CROSS_END_LEG = 'hand-mirror-upgrade'

// ─── 写盘申报账本层(2026-11-03 立,四枚跨端写盘腿同形)───────────────────────
// 本器 --land 走 object-space-land 直落 HEAD,页面批落成功即**已闭环,不登记**;
// 只有三种"写了工作树而 HEAD 没推进"的悬挂形态进账本:
//   ① --apply(人肉档)写完页面等人工提交;② --land 落 HEAD 失败且工作区回退也失败;
//   ③ --land 页面落了、壳声明件再生成后落 HEAD 未推进。
// 既有续跑判据(HEAD 面 plan 判 hosted ⇒ 不再 convertible;worktreeClean held 闸)原样保留,
// 登记只是追加凭据。失效方向:账本读不到 ⇒ 照旧全量尝试 + ledger=unjudged(§0.3)。
/** 与 collectiblePaths(worktree 面)同一把尺取当前 blob oid;取不到 ⇒ null(点名不猜)。 */
export function worktreeBlobOid(rel, root = ROOT) {
  try {
    return String(gitRaw(['hash-object', '--', rel], root)).trim().toLowerCase()
  } catch {
    return null
  }
}

/** 本 leg 在册且行完整的 path→oid 映射;账本取不到 ⇒ {ok:false, reason}(不冒充空集)。 */
export function landedOidMap({ root = ROOT, leg = CROSS_END_LEG } = {}) {
  const rd = readLanding({ root })
  if (!rd.ok) return { ok: false, reason: rd.reason, map: new Map() }
  const map = new Map()
  for (const row of rd.lines) {
    if (String(row?.leg ?? '') !== leg || !isRowComplete(row)) continue
    map.set(String(row.path), String(row.blobOid).trim().toLowerCase())
  }
  return { ok: true, reason: null, map }
}

/** 「本 leg 已登记 ∧ 工作树 blob 仍等于登记 oid」的路径 ⇒ 本轮视为已完成。 */
export function landedSkips(paths, { root = ROOT, leg = CROSS_END_LEG } = {}) {
  const rd = landedOidMap({ root, leg })
  if (!rd.ok) return { skip: [], ledger: 'unjudged', reason: rd.reason }
  const skip = []
  for (const p of paths || []) {
    const oid = rd.map.get(p)
    if (oid && worktreeBlobOid(p, root) === oid) skip.push(p)
  }
  return { skip, ledger: null, reason: null }
}

/** 批末申报:写了盘的文件逐枚实测 oid 进账本。写了盘没登记上 ⇒ landingError 点名,不冒成功。 */
export function registerLandings(paths, { root = ROOT, leg = CROSS_END_LEG, at = new Date().toISOString() } = {}) {
  const list = [...new Set(paths || [])]
  if (list.length === 0) return { landing: 0, appended: 0, deduped: 0, rejected: [] }
  const entries = []
  const unhashable = []
  for (const p of list) {
    const oid = worktreeBlobOid(p, root)
    if (!oid) {
      unhashable.push(p)
      continue
    }
    entries.push({ at, leg, path: p, blobOid: oid })
  }
  try {
    const ap = appendLanding(entries, { root })
    const out = {
      landing: ap.appended + ap.deduped,
      appended: ap.appended,
      deduped: ap.deduped,
      rejected: ap.rejected,
    }
    const errs = []
    if (ap.rejected.length)
      errs.push(`账本拒收:${ap.rejected.map((r) => `${r.path}(${r.reason})`).join(' ')}`)
    if (unhashable.length) errs.push(`落点 blob 取不到:${unhashable.join(' ')}`)
    if (errs.length) out.landingError = errs.join(' | ')
    return out
  } catch (e) {
    return {
      landing: 0,
      appended: 0,
      deduped: 0,
      rejected: [],
      landingError: `账本写盘失败:${String(e?.message ?? e).split('\n')[0]}`,
    }
  }
}

const git = (args) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

/** 自动落地的提交消息(纯函数,便于测试:每条 route/shell 必须能被回读)。 */
export function landMessage(batch) {
  const lines = batch.map((x) => `· ${x.route} | ${x.shell} | ${x.beforeLines}→${x.afterLines} 行`)
  return [
    `chore(cross-end): 自动把 ${batch.length} 枚手写镜像页升级为壳承载`,
    '',
    ...lines,
    '',
    '判据腿 = scripts/plan-hand-mirror-conversion.mjs(相对取差:页面私有能力/正文不在词包/跳转未被壳覆盖一律拒);',
    '落地腿 = scripts/upgrade-miniapp-shell-pages.mjs --land,由 git-guardian 巡检轮派发。',
  ].join('\n')
}

/** 经对象空间落地(不碰工作树与共享索引;C A S 冲突即拒)。 */
function landViaObjectSpace(paths, msg) {
  return execFileSync(process.execPath, [join(ROOT, 'scripts', 'object-space-land.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    env: { ...process.env, LAND_PATHS: paths.join(';'), LAND_MSG: msg },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const worktreeClean = (rel) => {
  try {
    git(['diff', '--quiet', 'HEAD', '--', rel])
    return true
  } catch {
    return false
  }
}

/** 工作树副本相对 HEAD 是否仍脏(只读判断;文件不在盘上按不脏处理)。 */
const dirtyAgainstHead = (rel) => !worktreeClean(rel)

/** 页面级分享钩子(转壳后必须由宿主页重新注册的那三句;端内 showShareMenu() 是 Taro.showShareMenu 的单一出口) */
export const PAGE_LEVEL_SHARE_TOKENS = ['useShareAppMessage', 'useShareTimeline', 'showShareMenu']

/**
 * 旧页注册过、而新生成页没有的页面级分享钩子(§0.9「装了才算」的落地侧兜底)。
 * 规划器若因任何原因判错(屏没发布正文、生成器改了产出形态),这一层让整页**拒落**而不是
 * 落成一个丢了转发卡的壳承载页 —— 判据失效的方向必须是"多要一次定向说明",不是"多放一次"。
 */
export function missingPageLevelHooks(pageText, newPageText) {
  const old = maskComments(String(pageText ?? ''))
  const next = maskComments(String(newPageText ?? ''))
  const miss = []
  for (const tok of PAGE_LEVEL_SHARE_TOKENS) {
    const re = new RegExp(`\\b${tok}\\s*\\(`)
    if (re.test(old) && !re.test(next)) miss.push(tok)
  }
  return miss
}

/** 纯判据:由规划器的 convertible 行 + 现读面,算出可落地的批(不写盘)。 */
export function planUpgrades(face = 'head') {
  const p = plan({ face })
  if (!p || !Array.isArray(p.rows)) return { ok: false, why: '规划器未返回行 ⇒ 未判定' }
  const convertible = p.rows.filter((x) => x.kind === 'convertible')
  const rnTexts = new Map(
    cov
      .collectRn(face)
      .filter((x) => x.text)
      .map((x) => [x.file, x.text]),
  )
  const pages = new Map(cov.collectMiniapp(face).map((x) => [x.route, x.text || '']))
  // 共享屏正文按同一面批取一次:buildShellPage 的分享产出判据要看屏有没有发布正文
  const sharedTexts = gate.batchReadTexts(face, [...new Set(convertible.map((x) => x.spec))])
  const upgradable = []
  const refused = []
  for (const r of convertible) {
    const pageText = pages.get(r.route)
    if (!pageText) {
      refused.push({ route: r.route, why: '当前面取不到页面正文 ⇒ 未判定' })
      continue
    }
    const name = String(r.spec)
      .split('/')
      .pop()
      .replace(/\.[jt]sx$/, '')
    const carrier = pickCarrierShell(rnTexts, name)
    if (!carrier) {
      refused.push({ route: r.route, why: `无壳消费 ${name}(与规划器口径不一致,拒落)` })
      continue
    }
    const pageRel = `${MP_DIR}/${r.route}.tsx`
    // 标题通道与规划器同口径(判据单源 = plan-hand-mirror-conversion,这里只是调用):
    // 漏了 useEffect 那一形,落地器会把只卡静态标题的页转成**没有标题**的壳承载页。
    const titleEffect = staticTitleEffect(pageText)
    const viaLifecycle = titleOnlyLifecycle(pageText)
    const body = buildShellPage({
      spec: r.spec,
      base: name.replace(/Screen$/, ''),
      shellText: rnTexts.get(carrier.rel),
      shellName: carrier.name,
      sharedText: sharedTexts.get(r.spec) ?? '',
      navTitle: viaLifecycle ? navTitleExpr(pageText) : (titleEffect?.title ?? null),
      navTitleHook: !viaLifecycle && titleEffect ? 'useEffect' : 'useDidShow',
      navTitleDeps: !viaLifecycle && titleEffect ? (titleEffect.deps ?? null) : null,
      authGate: needsAuthGate(pageText),
    })
    if (body?.error) {
      refused.push({ route: r.route, why: body.error })
      continue
    }
    const verdict = gate.hostingFormOf({
      spec: r.spec,
      pageText: body,
      readShell: (rel) => rnTexts.get(rel) ?? null,
    })
    if (verdict.form !== 'hosted') {
      refused.push({ route: r.route, why: `新页自证非 hosted(${verdict.form}:${verdict.why})` })
      continue
    }
    const hookGap = missingPageLevelHooks(pageText, body)
    if (hookGap.length > 0) {
      refused.push({
        route: r.route,
        why: `旧页注册的页面级分享钩子在新页缺失(${hookGap.join(', ')})⇒ 转壳会静默丢转发卡,整页拒落`,
      })
      continue
    }
    if (face === 'head' && !worktreeClean(pageRel)) {
      refused.push({ route: r.route, why: '工作树副本相对 HEAD 有改动(他席在飞)⇒ held' })
      continue
    }
    upgradable.push({
      route: r.route,
      spec: r.spec,
      pageRel,
      shell: carrier.name,
      beforeLines: pageText.split('\n').length,
      afterLines: body.split('\n').length,
      pageText: body,
    })
  }
  return { ok: true, upgradable, refused }
}

function main() {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const land = argv.includes('--land')
  const json = argv.includes('--json')
  const capArg = argv.find((a) => a.startsWith('--cap='))
  const cap = capArg ? Math.max(1, Number(capArg.slice('--cap='.length)) || 0) : land ? 2 : Infinity

  const res = planUpgrades('head')
  if (!res.ok) {
    console.error(`❌ 未判定:${res.why}`)
    return 2
  }
  const batch = res.upgradable.slice(0, cap)
  const saved = batch.reduce((n, x) => n + (x.beforeLines - x.afterLines), 0)

  // 轮首读账本:本 leg 在册、工作树 blob 未动、且相对 HEAD 仍脏的路径 = 本腿自己待收编的
  // 悬挂产出(报 skipLanded 读数;续跑的正判据仍是既有的 HEAD 面 hosted/worktreeClean 闸,
  // 账本只是追加凭据,不替换它)。账本读不到 ⇒ 照常全量尝试,只补 ledger=unjudged。
  const landedRead = landedOidMap()
  let skipLanded = 0
  for (const [p, oid] of landedRead.map) {
    if (worktreeBlobOid(p) === oid && dirtyAgainstHead(p)) skipLanded++
  }
  const writtenPaths = new Set()
  let landingInfo = { landing: 0 }

  if (apply || land) {
    for (const x of batch) {
      const abs = join(ROOT, x.pageRel)
      writeFileSync(abs, x.pageText, 'utf8')
      if (apply && !land) writtenPaths.add(x.pageRel) // 人肉档:写完等工作树收编 ⇒ 申报
      try {
        execFileSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), 'inject', abs], {
          cwd: ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
      } catch {
        /* 水印注入失败不阻断:覆盖面门会在提交链上判它 */
      }
    }
  }
  // 水印在写盘后追加了字节 ⇒ 登记的 oid 必须按"最终落盘形态"实测(registerLandings 批末
  // 现算 hash-object,天然后置),这里只登记路径。

  // --land:页面 → 对象空间落地 → 按新 HEAD 重生成壳声明件 → 声明件再落一批。
  // 凭据是 **HEAD 有没有被推进**,不是落地器退出码(实测它落完还会复跑别的门而退非零)。
  let landed = null
  if (land && batch.length > 0) {
    const before = git(['rev-parse', 'HEAD']).trim()
    let err = ''
    try {
      landViaObjectSpace(
        batch.map((x) => x.pageRel),
        landMessage(batch),
      )
    } catch (e) {
      err = String(e?.stderr ?? e?.message ?? e).slice(0, 600)
    }
    const after = git(['rev-parse', 'HEAD']).trim()
    landed = { pages: batch.length, ok: after !== before, headBefore: before.slice(0, 12), headAfter: after.slice(0, 12), err }
    // 落 HEAD 失败 ⇒ 把本批工作树副本退回 HEAD。
    // 不退回就自锁:本器为了落地先把生成的正文写进工作树,land 若没推进 HEAD(超时 / CAS 冲突 /
    // 陈旧守卫),那份正文就留在盘上;下一轮 planUpgrades 看到「工作树副本相对 HEAD 有改动」⇒
    // 判「他席在飞」held,一页都落不了 —— 而改的人正是自己。实测 2026-10-28 15:53 一轮失败后,
    // 12 枚可落地页在盘上挂了两小时无人能动。写盘前已用 worktreeClean 证过干净,退回 HEAD
    // 就是把盘恢复成写之前那一份,不会盖别人的现场。
    if (!landed.ok) {
      try {
        git(['checkout', 'HEAD', '--', ...batch.map((x) => x.pageRel)])
      } catch (e) {
        landed.rollbackErr = String(e?.stderr ?? e?.message ?? e).slice(0, 300)
        // 回退也失败 ⇒ 本批工作树副本是真悬挂件(既没落 HEAD 也回不去),申报进账本交收编侧
        for (const x of batch) writtenPaths.add(x.pageRel)
      }
    }
    if (landed.ok) {
      try {
        execFileSync(process.execPath, [join(ROOT, 'scripts', 'gen-rn-shell-types.mjs'), '--head', '--write'], {
          cwd: ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
      } catch {
        /* 生成失败不阻断:声明件落后由门 251 C9 兜底 */
      }
      let declChanged = false
      try {
        git(['diff', '--quiet', 'HEAD', '--', SHELL_DECL])
      } catch {
        declChanged = true
      }
      if (declChanged) {
        const b2 = git(['rev-parse', 'HEAD']).trim()
        try {
          landViaObjectSpace(
            [SHELL_DECL],
            `chore(cross-end): 壳声明件跟随自动升级的 ${batch.length} 枚页(按 HEAD 面派生)`,
          )
        } catch (e) {
          landed.declErr = String(e?.stderr ?? e?.message ?? e).slice(0, 400)
        }
        landed.declLanded = git(['rev-parse', 'HEAD']).trim() !== b2
        // 声明件写了工作树但没落 HEAD ⇒ 悬挂件申报(页面批本身已闭环,不登记)
        if (!landed.declLanded) writtenPaths.add(SHELL_DECL)
      } else {
        landed.declLanded = false
      }
    }
  }

  // 批末申报:只登记"写了工作树而 HEAD 未推进"的悬挂路径(--land 成功批不在其中,已闭环)。
  if (writtenPaths.size > 0) landingInfo = registerLandings([...writtenPaths])

  if (json) {
    const tail = {}
    if (landingInfo.landingError) tail.landingError = landingInfo.landingError
    if (!landedRead.ok) tail.ledger = 'unjudged'
    console.log(
      JSON.stringify({
        ok: true, // 判定面成功与否(规划器出了结论);申报成败看 landingError,不借这个字段
        applied: apply,
        land,
        landed,
        upgradable: res.upgradable.length,
        batch: batch.map((x) => ({ route: x.route, shell: x.shell, saved: x.beforeLines - x.afterLines })),
        refused: res.refused.length,
        savedLines: saved,
        landing: landingInfo.landing,
        skipLanded,
        ...tail,
      }),
    )
    return apply || land || batch.length === 0 ? (landingInfo.landingError ? 1 : 0) : 1
  }

  // 0 落地 ≠ 落地失败(2026-11-01 现读:batch=0 时落地器根本没被调用,旧三目却报 land-failed,
  // 会让巡检/人读把"无可落地"当成"写盘腿坏了")。三态:land-empty / landed / land-failed。
  console.log(
    `UPGRADE-SHELL state=${
      land ? (batch.length === 0 ? 'land-empty' : landed?.ok ? 'landed' : 'land-failed') : apply ? 'applied' : 'preview'
    } 可落地=${res.upgradable.length} 本批=${batch.length} 拒=${res.refused.length} 本批可删行=${saved} landing=${landingInfo.landing} skipLanded=${skipLanded}${landingInfo.landingError ? ` landingError=${landingInfo.landingError}` : ''}${landedRead.ok ? '' : ' ledger=unjudged'}`,
  )
  for (const x of batch) console.log(`  ${x.route} | ${x.shell} | ${x.beforeLines}→${x.afterLines} 行`)
  for (const x of res.refused) console.log(`  拒 ${x.route} | ${x.why}`)
  if (land && landed)
    console.log(
      `  落地:${landed.ok ? `HEAD ${landed.headBefore}→${landed.headAfter}` : 'HEAD 未推进'}${landed.declLanded ? ' + 声明件' : ''}${landed.err ? ` | ${landed.err.split('\n').slice(-2).join(' ')}` : ''}`,
    )
  if (apply && !land && batch.length > 0)
    console.log('ℹ️ 下一步:提交页面 → node scripts/gen-rn-shell-types.mjs --write → 提交派生声明件')
  return apply || land || batch.length === 0 ? (landingInfo.landingError ? 1 : 0) : 1
}

/* §22d:直执行才跑主流程;测试 import __test__ 不得触发 CLI */
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ 未判定(异常):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  planUpgrades,
  worktreeClean,
  landMessage,
  missingPageLevelHooks,
  // 写盘申报账本层(§22c:测试 import 生产出口,不复制判据)
  registerLandings,
  landedSkips,
  landedOidMap,
  worktreeBlobOid,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
