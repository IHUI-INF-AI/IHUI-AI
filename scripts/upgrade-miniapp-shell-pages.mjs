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
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as gate } from './check-miniapp-mirror-fidelity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { buildShellPage } from './gen-miniapp-mirror.mjs'
import { pickCarrierShell } from './lib/rn-shell-refs.mjs'
import { navTitleExpr, needsAuthGate, plan, titleOnlyLifecycle } from './plan-hand-mirror-conversion.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const MP_DIR = 'apps/miniapp-taro/src'
const SHELL_DECL = 'apps/miniapp-taro/types/rn-shells.generated.d.ts'

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
    const body = buildShellPage({
      spec: r.spec,
      base: name.replace(/Screen$/, ''),
      shellText: rnTexts.get(carrier.rel),
      shellName: carrier.name,
      navTitle: titleOnlyLifecycle(pageText) ? navTitleExpr(pageText) : null,
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

  if (apply || land) {
    for (const x of batch) {
      const abs = join(ROOT, x.pageRel)
      writeFileSync(abs, x.pageText, 'utf8')
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
      } else {
        landed.declLanded = false
      }
    }
  }

  if (json) {
    console.log(
      JSON.stringify({
        ok: true,
        applied: apply,
        land,
        landed,
        upgradable: res.upgradable.length,
        batch: batch.map((x) => ({ route: x.route, shell: x.shell, saved: x.beforeLines - x.afterLines })),
        refused: res.refused.length,
        savedLines: saved,
      }),
    )
    return apply || land || batch.length === 0 ? 0 : 1
  }

  console.log(
    `UPGRADE-SHELL state=${land ? (landed?.ok ? 'landed' : 'land-failed') : apply ? 'applied' : 'preview'} 可落地=${res.upgradable.length} 本批=${batch.length} 拒=${res.refused.length} 本批可删行=${saved}`,
  )
  for (const x of batch) console.log(`  ${x.route} | ${x.shell} | ${x.beforeLines}→${x.afterLines} 行`)
  for (const x of res.refused) console.log(`  拒 ${x.route} | ${x.why}`)
  if (land && landed)
    console.log(
      `  落地:${landed.ok ? `HEAD ${landed.headBefore}→${landed.headAfter}` : 'HEAD 未推进'}${landed.declLanded ? ' + 声明件' : ''}${landed.err ? ` | ${landed.err.split('\n').slice(-2).join(' ')}` : ''}`,
    )
  if (apply && !land && batch.length > 0)
    console.log('ℹ️ 下一步:提交页面 → node scripts/gen-rn-shell-types.mjs --write → 提交派生声明件')
  return apply || land || batch.length === 0 ? 0 : 1
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

export const __test__ = { planUpgrades, worktreeClean, landMessage }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
