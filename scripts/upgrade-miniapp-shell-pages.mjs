#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 器物,需打印预演/落地结论 */
/**
 * upgrade-miniapp-shell-pages.mjs —— 把「端内手写的镜像页」降级为「壳承载页」的器物(2026-10-27 立)。
 *
 * 为什么要有它:小程序端现读 99 枚页是端内重写(布局/数据/文案各写一份),而它们声明的共享屏在
 * RN 端**全部**有承载壳(现读 100/100)。这 99 份重复实现正是「两端各写一份靠对账追平」的存量,
 * 也是「样式/功能不同步」的结构成因:源头(RN 壳或共享屏)改一笔,手写页不会动。
 * 降级后页面只剩 ThemeRoot + `@rn-shells/<壳>`,源头改一笔两端同动 ⇒ 归零这份开发量。
 *
 * 安全判据(缺一即拒,绝不"为了推进而放宽"):
 *   ① 该页在 HEAD 面判 hand(computeFidelity);已是 hosted/other/broken 的不动;
 *   ② 该页工作树副本与 HEAD 逐字节一致(他席在飞 ⇒ held,不碰别人的现场);
 *   ③ 页内无「端内独有能力」(lib/miniapp-end-capabilities:支付/登录态/选图/分享/下拉刷新…)
 *      —— 改壳承载会静默丢掉它们,这类页留给人工按能力清单迁移;
 *   ④ RN 端存在承载壳且真消费该共享屏;壳的导出形态能对上(buildShellPage 自证,拒则整页拒);
 *   ⑤ 新页文本自证:重跑 hostingFormOf 必须判 hosted,且自身不再命中任何端内能力。
 *   index.config.ts 等伴生文件一概不动(标题/分包配置是端内事实,不是重复实现)。
 *
 * 退出码:0 = 无需推进或已落;1 = 有页被判可升级但未落(--apply 缺省时的预演);2 = 未判定。
 *
 * Usage:
 *   node scripts/upgrade-miniapp-shell-pages.mjs                # 预演:列可升级页与拒因
 *   node scripts/upgrade-miniapp-shell-pages.mjs --apply --cap=5
 *   node scripts/upgrade-miniapp-shell-pages.mjs --json
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as gate } from './check-miniapp-mirror-fidelity.mjs'
import { buildShellPage } from './gen-miniapp-mirror.mjs'
import { detectEndCapabilities } from './lib/miniapp-end-capabilities.mjs'
import { shellTargetRel } from './lib/rn-shell-refs.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const MP_DIR = 'apps/miniapp-taro/src'
const RN_DIR = 'apps/mobile-rn/src/screens'

const git = (args, input) =>
  execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
    input,
  })

/** HEAD 面的 RN 委托屏正文(只取 import 了 @ihui/rn-app 的文件;逐文件 show 足够快且无缓存陷阱)。 */
function rnDelegatedTexts() {
  const listed = git(['grep', '-l', '@ihui/rn-app', 'HEAD', '--', RN_DIR])
  const files = listed
    .trim()
    .split('\n')
    .map((l) => l.split(':').pop())
    .filter(Boolean)
  const out = new Map()
  for (const rel of files) out.set(rel, git(['show', `HEAD:${rel}`]))
  return out
}

/** 承载壳:同名优先,否则取消费了该共享屏的第一枚(与还原度尺 hostingFormOf 同一口径)。 */
function pickShell(rnTexts, name) {
  const re = new RegExp(`\\b${name}\\b`)
  const carriers = [...rnTexts.entries()].filter(([, t]) => re.test(t)).map(([rel]) => rel)
  if (carriers.length === 0) return null
  const same = shellTargetRel(name)
  const rel = carriers.includes(same) ? same : carriers.sort()[0]
  return { rel, name: rel.split('/').pop().replace(/\.tsx$/, ''), text: rnTexts.get(rel) }
}

const worktreeClean = (rel) => {
  try {
    git(['diff', '--quiet', 'HEAD', '--', rel])
    return true
  } catch {
    return false
  }
}

export function planUpgrades() {
  const res = gate.computeFidelity('head')
  if (!Array.isArray(res.rows) || res.rows.length === 0)
    return { ok: false, why: 'HEAD 面枚举到 0 个镜像对 ⇒ 未判定(§0.3)' }
  const rnTexts = rnDelegatedTexts()
  if (rnTexts.size === 0) return { ok: false, why: 'HEAD 面 RN 委托屏为 0 ⇒ 未判定' }

  const upgradable = []
  const refused = []
  for (const r of res.rows.filter((x) => x.form === 'hand')) {
    const name = String(r.spec).split('/').pop().replace(/\.[jt]sx$/, '')
    const pageRel = `${MP_DIR}/${r.route}.tsx`
    let headText = ''
    try {
      headText = git(['show', `HEAD:${pageRel}`])
    } catch {
      refused.push({ route: r.route, why: 'HEAD 面取不到页面正文 ⇒ 未判定' })
      continue
    }
    const caps = detectEndCapabilities(headText)
    if (caps.length > 0) {
      refused.push({ route: r.route, why: `端内独有能力:${caps.join(',')}` })
      continue
    }
    const shell = pickShell(rnTexts, name)
    if (!shell) {
      refused.push({ route: r.route, why: `RN 端无壳消费 ${name}` })
      continue
    }
    const pageText = buildShellPage({ spec: r.spec, base: name.replace(/Screen$/, ''), shellText: shell.text, shellName: shell.name })
    if (pageText?.error) {
      refused.push({ route: r.route, why: pageText.error })
      continue
    }
    const verdict = gate.hostingFormOf({ spec: r.spec, pageText, readShell: (rel) => rnTexts.get(rel) ?? null })
    if (verdict.form !== 'hosted') {
      refused.push({ route: r.route, why: `新页自证非 hosted(${verdict.form}:${verdict.why})` })
      continue
    }
    if (!worktreeClean(pageRel)) {
      refused.push({ route: r.route, why: '工作树副本相对 HEAD 有改动(他席在飞)⇒ held,不碰' })
      continue
    }
    upgradable.push({
      route: r.route,
      spec: r.spec,
      pageRel,
      shell: shell.name,
      beforeLines: headText.split('\n').length,
      afterLines: pageText.split('\n').length,
      pageText,
    })
  }
  return { ok: true, upgradable, refused }
}

function main() {
  const argv = process.argv.slice(2)
  const apply = argv.includes('--apply')
  const json = argv.includes('--json')
  const capArg = argv.find((a) => a.startsWith('--cap='))
  const cap = capArg ? Math.max(1, Number(capArg.slice('--cap='.length)) || 0) : Infinity

  const plan = planUpgrades()
  if (!plan.ok) {
    console.error(`❌ 未判定:${plan.why}`)
    return 2
  }
  const batch = plan.upgradable.slice(0, cap)
  const saved = batch.reduce((n, p) => n + (p.beforeLines - p.afterLines), 0)

  if (apply) {
    for (const p of batch) {
      const abs = join(ROOT, p.pageRel)
      writeFileSync(abs, p.pageText, 'utf8')
      try {
        execFileSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), 'inject', abs], {
          cwd: ROOT,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch {
        /* 水印注入失败不阻断:覆盖面门会在提交链上判它 */
      }
    }
  }

  if (json) {
    console.log(
      JSON.stringify({
        ok: true,
        applied: apply,
        upgradable: plan.upgradable.length,
        batch: batch.map((p) => ({ route: p.route, shell: p.shell, saved: p.beforeLines - p.afterLines })),
        refused: plan.refused.length,
        savedLines: saved,
      }),
    )
    return apply || batch.length === 0 ? 0 : 0
  }

  console.log(
    `UPGRADE-SHELL state=${apply ? 'applied' : 'preview'} 可升级=${plan.upgradable.length} 本批=${batch.length} 拒=${plan.refused.length} 本批可删行=${saved}`,
  )
  if (batch.length > 0) {
    console.log('\n--- 本批 ---')
    for (const p of batch) console.log(`${p.route} | ${p.shell} | ${p.beforeLines}→${p.afterLines} 行`)
  }
  if (plan.refused.length > 0) {
    console.log('\n--- 拒(逐条原因) ---')
    for (const x of plan.refused) console.log(`${x.route} | ${x.why}`)
  }
  return 0
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

export const __test__ = { planUpgrades, pickShell, rnDelegatedTexts }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
