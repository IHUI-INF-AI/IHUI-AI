#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-ui-routes.mjs —— 四端 ui-routes + RN→小程序 route-map 的唯一入口。
 *
 * 为什么要有这个入口:
 *   现状是五个产物各有各的生成器、各有各的调用方式(四个缺 --check 出口,route-map 默认预演),
 *   「新增一个页面后三端是否都跟上了」没有任何一条命令能回答。本器把五种产物收在一张表下,
 *   让 --check / --write 对整组生效,并在同一次运行里给出跨端差集报告。
 *
 * 用法:
 *   node scripts/gen-ui-routes.mjs --check                 # 默认:整组验新鲜 + 跨端差集棘轮
 *   node scripts/gen-ui-routes.mjs --write                 # 整组重生成(落盘)
 *   node scripts/gen-ui-routes.mjs --check --only=rn,taro   # 单页/单端模式:只跑指定产物
 *   node scripts/gen-ui-routes.mjs --report                # 只出跨端差集报告,不跑生成器
 *   node scripts/gen-ui-routes.mjs --update-baseline --reason="…"  # 人工裁决后抬高存量基线
 *
 * 退出码:0 = 全部新鲜且无新增缺口;1 = 产物陈旧 / 差集回退;2 = 用法错误。
 *
 * 边界(不假装统一的部分,详见 --report 输出):
 *   - 三端路由标识不同构(web URL / RN Screen name / 小程序 path),不可能由「一张表」直接导出;
 *     「跟随」= 每端从本端真相重新生成 + 跨端映射由 registry 声明式生成。
 *   - apps/web 的 app 目录是 Next 的文件系统约定,路由真相是 page.tsx 的目录结构,不是一张清单,
 *     所以 web 的「手工补位」= 新增页面时落 page.tsx;生成器只读它,不做反向生成。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ARTIFACTS,
  compareBaseline,
  computeFollow,
  formatFollowReport,
} from './lib/ui-routes-follow.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_REL = 'scripts/data/ui-routes-follow-baseline.json'

const ARGV = process.argv.slice(2)
const ALLOWED_FLAGS = new Set(['--check', '--write', '--report', '--update-baseline'])
const flagWithValue = (name) => {
  const hit = ARGV.find((arg) => arg.startsWith(`${name}=`))
  return hit ? hit.slice(name.length + 1) : null
}

const unknown = ARGV.filter((arg) => {
  if (arg.startsWith('--only=') || arg.startsWith('--reason=') || arg.startsWith('--face=')) return false
  return !ALLOWED_FLAGS.has(arg)
})
if (unknown.length > 0) {
  console.error(`未知参数:${unknown.join(' ')}`)
  console.error('用法:node scripts/gen-ui-routes.mjs [--check|--write|--report] [--only=web,rn,taro,ext,rn-route-map] [--face=head|worktree] [--update-baseline --reason=…]')
  process.exit(2)
}

const wantWrite = ARGV.includes('--write')
const wantCheck = ARGV.includes('--check') || (!wantWrite && !ARGV.includes('--report'))
const wantReport = ARGV.includes('--report') || wantCheck || wantWrite
const wantUpdateBaseline = ARGV.includes('--update-baseline')

const faceArg = flagWithValue('--face')
if (faceArg && faceArg !== 'head' && faceArg !== 'worktree') {
  console.error(`--face 只能是 head / worktree,收到 ${faceArg}`)
  process.exit(2)
}
// 基线必须记在 HEAD 面(否则会把别人暂存/未提交的脏面记进账);报告默认看工作树现状。
const reportFace = faceArg || (wantUpdateBaseline ? 'head' : 'worktree')
if (wantWrite && reportFace === 'head') {
  console.error('--write 只能作用于工作树面;HEAD 面不可写(要改 HEAD 请走提交链路)')
  process.exit(2)
}

const onlyRaw = flagWithValue('--only')
const onlyIds = onlyRaw ? onlyRaw.split(',').map((s) => s.trim()).filter(Boolean) : null
if (onlyIds) {
  const bad = onlyIds.filter((id) => !ARTIFACTS.some((a) => a.id === id))
  if (bad.length > 0) {
    console.error(`未知产物:${bad.join(', ')}(可选:${ARTIFACTS.map((a) => a.id).join(', ')})`)
    process.exit(2)
  }
}

const selected = onlyIds ? ARTIFACTS.filter((a) => onlyIds.includes(a.id)) : ARTIFACTS

/** 跑单个产物的生成器;返回 {id, rel, code} */
function runGenerator(art, mode) {
  const args = []
  if (mode === 'write') {
    args.push('--write')
  } else if (mode === 'check') {
    args.push('--check')
  }
  if (art.id === 'rn-route-map' && mode === 'check') {
    // gen-rn-compat 默认是预演;--check 才是对账出口
    args.length = 0
    args.push('--check')
  }
  const script = resolve(repoRoot, art.generatorRel)
  try {
    execFileSync(process.execPath, [script, ...args], {
      cwd: repoRoot,
      stdio: 'inherit',
      windowsHide: true,
    })
    return { id: art.id, rel: art.rel, code: 0 }
  } catch (err) {
    const code = typeof err?.status === 'number' ? err.status : 1
    return { id: art.id, rel: art.rel, code }
  }
}

let failed = false
if ((wantWrite || wantCheck) && reportFace === 'head') {
  // HEAD 面不重写产物:交给守门 105 的 ui-routes 组(它按 HEAD blob 自述钉对账),
  // 避免本器自造第二套 HEAD 面判据。route-map 的 --check 本身就是 HEAD 优先。
  console.log('\n[gen-ui-routes] 模式=check 判定面=head(委托守门 105,不落盘)')
  const delegate = [
    ['scripts/check-miniapp-generated.mjs', ['--group', 'ui-routes']],
    ['scripts/gen-rn-compat.mjs', ['--check']],
  ]
  for (const [rel, args] of delegate) {
    console.log(`\n▶ ${rel} ${args.join(' ')}`)
    try {
      execFileSync(process.execPath, [resolve(repoRoot, rel), ...args], { cwd: repoRoot, stdio: 'inherit', windowsHide: true })
    } catch (err) {
      failed = true
      console.error(`✖ ${rel} 退出码 ${typeof err?.status === 'number' ? err.status : 1}`)
    }
  }
} else if (wantWrite || wantCheck) {
  const mode = wantWrite ? 'write' : 'check'
  console.log(`\n[gen-ui-routes] 模式=${mode} 判定面=worktree 目标=${selected.map((a) => a.id).join(',')}`)
  for (const art of selected) {
    console.log(`\n▶ ${art.id} ← ${art.truth}`)
    const result = runGenerator(art, mode)
    if (result.code !== 0) {
      failed = true
      console.error(`✖ ${art.id} 退出码 ${result.code}`)
    }
  }
}

if (wantReport) {
  const current = computeFollow({ face: reportFace })
  console.log('\n' + formatFollowReport(current))

  const baselineAbs = resolve(repoRoot, BASELINE_REL)
  if (wantUpdateBaseline) {
    const reason = flagWithValue('--reason')
    if (!reason || reason.trim().length === 0) {
      console.error('--update-baseline 必须带 --reason="人工裁决理由"')
      process.exit(2)
    }
    const payload = {
      comment: '三端路由跟随差集基线:棘轮只允许差集变小;任何一项变大 = 新增路由未回填,必须人工裁决后再更新本文件。',
      reason,
      face: reportFace,
      updatedAt: new Date().toISOString(),
      entries: current.entries,
      gaps: current.gaps,
    }
    writeFileSync(baselineAbs, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    console.log(`\n[gen-ui-routes] 已更新基线 ${BASELINE_REL}(${reason})`)
  } else if (existsSync(baselineAbs)) {
    const baseline = JSON.parse(readFileSync(baselineAbs, 'utf8'))
    const verdict = compareBaseline(current, baseline)
    if (!verdict.ok) {
      failed = true
      console.error('\n❌ 差集回退(新增路由未回填对应关系):')
      for (const r of verdict.regressions) {
        console.error(`   ${r.key}: baseline ${r.baseline} → current ${r.current}`)
      }
      console.error('   处置:补 mapping,或经人工裁决后执行 --update-baseline --reason="…"')
    } else {
      console.log('\n✅ 差集未回退(baseline 棘轮通过)')
    }
  } else {
    console.warn(`\n⚠ 缺少基线 ${BASELINE_REL}(判不了不算通过;用 --update-baseline --reason=… 建档)`)
  }
}

process.exit(failed ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
