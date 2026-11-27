#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ITCP 一致性运行器(v0.1)。
 *
 * 读什么:调用同一仓库的守门 `scripts/check-tool-contract-declared.mjs`(全量 + --self-test),
 * 解析它的结论行,输出五项读数。**不重算判据**(守门是唯一判据源,这里只做读数聚合)。
 *
 * 用法:
 *   node scripts/tool-contract-conformance.mjs           # 人读
 *   node scripts/tool-contract-conformance.mjs --json    # 机器读(CI)
 *
 * 退出码:ok=0;任一项不达标或守门自身非 0 ⇒ 1(未判定 ⇒ 2)。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const GATE = 'scripts/check-tool-contract-declared.mjs'
const args = process.argv.slice(2)
const wantJson = args.includes('--json')
// 守门自带"门体与被判修订不同代 ⇒ 未判定"保护(rc=2)。仓库里有未提交的守门改动时,
// 默认严格模式恒 unknown —— 此时可显式按工作树门体判(与守门自己的出路②同一开关)。
const worktreeBody = args.includes('--worktree-body')
const root = process.cwd()

if (!existsSync(path.join(root, GATE))) {
  console.error(`[itcp] 找不到守门 ${GATE}(在 ${root} 下)。请在仓库根运行。`)
  process.exit(2)
}

function runGate(extraArgs) {
  const r = spawnSync(process.execPath, [GATE, ...extraArgs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: worktreeBody ? { ...process.env, IHUI_GATE_BODY_SOURCE: 'worktree' } : process.env,
  })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const gate = runGate([])
// 守门结论行:注册工具数 X / 无契约数 Y / 棘轮余量 Z / 契约摘除 A / flip-audit B
const m = gate.out.match(
  /注册工具数 (\d+) \/ 无契约数 (\d+) \/ 棘轮余量 (\d+) \/ 契约摘除 (\d+) \/ flip-audit (\d+)/,
)

const selfTest = runGate(['--self-test'])
const st = selfTest.out.match(/--self-test:(\d+) 通过 \/ (\d+) 失败/)

const report = {
  schema: 'itcp-conformance/v0.1',
  readings: {
    tools: m ? Number(m[1]) : null,
    missingContract: m ? Number(m[2]) : null,
    ratchetMargin: m ? Number(m[3]) : null,
    removedContracts: m ? Number(m[4]) : null,
    flipAudit: m ? Number(m[5]) : null,
  },
  gateExit: gate.status,
  selfTest: {
    pass: st ? Number(st[1]) : null,
    fail: st ? Number(st[2]) : null,
    exit: selfTest.status,
  },
}

const readings = report.readings
const verdict =
  m === null || st === null
    ? 'unknown' // 守门输出格式变了/跑不起来 ⇒ 未判定,不得读成通过
    : gate.status === 0 &&
        selfTest.status === 0 &&
        readings.missingContract === 0 &&
        readings.ratchetMargin === 0 &&
        readings.removedContracts === 0 &&
        readings.flipAudit === 0 &&
        report.selfTest.fail === 0
      ? 'ok'
      : 'not-ok'

report.verdict = verdict

if (wantJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const line = (k, v) => `  ${k.padEnd(20)} ${v === null ? '(未判定)' : v}`
  console.log('[itcp] 工具契约一致性读数')
  console.log(line('注册工具数', readings.tools))
  console.log(line('无契约工具数', readings.missingContract))
  console.log(line('棘轮余量', readings.ratchetMargin))
  console.log(line('契约摘除数', readings.removedContracts))
  console.log(line('翻缺省审计', readings.flipAudit))
  console.log(line('自检通过/失败', `${report.selfTest.pass ?? '?'} / ${report.selfTest.fail ?? '?'}`))
  console.log(`[itcp] 判定: ${verdict}`)
  if (worktreeBody) {
    // 跨代判据的读数不可当发布结论:本地门体判 HEAD 树,两代不一致时"无契约数"会虚高(实测 114)。
    console.log('[itcp] 注意:本次按工作树门体判 HEAD 树(两代不一致时读数会失真,仅供排障,不得当发布结论)')
  }
  if (verdict === 'unknown') {
    // 未判定不得读成通过:把守门自己的"人话 + 出路"原样转述,省得人去猜格式为什么变。
    const tail = gate.out.trim().split('\n').slice(-6)
    console.log('[itcp] 守门未判定,原文末几行:')
    for (const l of tail) console.log(`    ${l}`)
    console.log('[itcp] 若确知要按工作树门体判:node scripts/tool-contract-conformance.mjs --worktree-body')
  }
}

process.exit(verdict === 'ok' ? 0 : verdict === 'unknown' ? 2 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
