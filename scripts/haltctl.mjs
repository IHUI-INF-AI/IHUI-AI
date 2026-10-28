#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * haltctl — 运行期安全停机的命令行出口(2026-10-26 立)。
 *
 * 状态机与落盘判据全在 scripts/lib/halt-state.mjs(§0.6 单一真相源),本文件只做三件事:
 *   1) 参数解析与退出码分档(0 成功 / 1 拒绝 / 2 未判定);
 *   2) 人读/机读输出(--status / --json);
 *   3) 停机态的**通知模板打印** —— 只打印"该发给谁 + 内容",**绝不真发信**。
 *      发信唯一通道 = apps/api/scripts/notify-deploy-failure.ts(§5e,属他席射程)。
 *
 * 用法:
 *   node scripts/haltctl.mjs --status                  # 当前态(默认动作)
 *   node scripts/haltctl.mjs --enter "<原因>" [--evidence "<现场>"]
 *   node scripts/haltctl.mjs --resume "<原因>" --evidence "<异常已消除的验证依据>"
 *   node scripts/haltctl.mjs --abort  "<原因>" --evidence "<恢复失败依据>"   # resuming -> halted
 *   node scripts/haltctl.mjs --json                    # 与 --status 同源,机器可读
 *   node scripts/haltctl.mjs --self-test               # 用临时状态文件跑全流程(不碰真实 halt.json)
 *
 * 退出码:
 *   0 = 判定完成(status 读数 / 转移成功 / 自检全过)
 *   1 = 调用被拒(非法转移、reason <10 字、resume 缺 evidence、参数冲突)
 *   2 = 未判定(状态文件读不到 / 形状坏 / 脚本自身异常) —— 绝不记成 running
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  DEFAULT_HALT_FILE,
  HALT_EVENTS,
  HALT_STATES,
  HALT_TRANSITIONS,
  REPO_ROOT,
  HaltStateUnjudgedError,
  HaltTransitionError,
  abortResume,
  enterHalt,
  humanNoticeFor,
  legalEventsFrom,
  readHaltState,
  resumeHalt,
} from './lib/halt-state.mjs'

const USAGE = `用法:
  node scripts/haltctl.mjs --status
  node scripts/haltctl.mjs --enter "<原因>" [--evidence "<现场>"]
  node scripts/haltctl.mjs --resume "<原因>" --evidence "<异常已消除的验证依据>"
  node scripts/haltctl.mjs --abort "<原因>" --evidence "<恢复失败依据>"
  node scripts/haltctl.mjs --json
  node scripts/haltctl.mjs --self-test

可选: --by <谁>  --file <状态文件路径(演练/自检用)>
退出码: 0 判定完成 / 1 调用被拒 / 2 未判定`

/** 手写解析:不引入依赖,且"值被下一个旗标顶掉"必须显式拒(不静默当空串)。 */
export function parseArgv(argv) {
  const out = {
    action: null,
    reason: '',
    evidence: undefined,
    by: undefined,
    file: undefined,
    json: false,
  }
  const setAction = (name) => {
    if (out.action && out.action !== name) {
      throw new HaltTransitionError(`参数冲突:同时给了 --${out.action} 与 --${name},只能选一个`)
    }
    out.action = name
  }
  const takeValue = (flag, index) => {
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new HaltTransitionError(`${flag} 缺少取值`)
    }
    return value
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--status':
        setAction('status')
        break
      case '--enter':
        setAction('enter')
        out.reason = takeValue('--enter', i)
        i += 1
        break
      case '--resume':
        setAction('resume')
        out.reason = takeValue('--resume', i)
        i += 1
        break
      case '--abort':
        setAction('abort')
        out.reason = takeValue('--abort', i)
        i += 1
        break
      case '--evidence':
        out.evidence = takeValue('--evidence', i)
        i += 1
        break
      case '--by':
        out.by = takeValue('--by', i)
        i += 1
        break
      case '--file':
        out.file = takeValue('--file', i)
        i += 1
        break
      case '--json':
        out.json = true
        break
      case '--self-test':
        setAction('self-test')
        break
      case '--help':
      case '-h':
        setAction('status')
        out.help = true
        break
      default:
        throw new HaltTransitionError(`无法识别的参数「${arg}」\n${USAGE}`)
    }
  }
  if (!out.action) out.action = 'status'
  return out
}

function statusPayload(doc) {
  const payload = {
    ok: true,
    state: doc.state,
    persisted: doc.persisted,
    updatedAt: doc.updatedAt,
    transitions: doc.transitions,
    attempts: doc.attempts,
    legalEvents: legalEventsFrom(doc.state),
  }
  if (doc.state !== 'running') payload.notice = humanNoticeFor(doc)
  return payload
}

function printStatus(doc, { json }) {
  if (json) {
    console.log(JSON.stringify(statusPayload(doc), null, 2))
    return
  }
  const last = doc.transitions[doc.transitions.length - 1] ?? null
  console.log(
    `停机态: ${doc.state}${doc.persisted ? '' : '(尚未落盘:无停机记录,按初始态 running 计)'}`,
  )
  console.log(`状态文件: ${doc.file}`)
  console.log(`转移记录: ${doc.transitions.length} 条, 重复进入 attempt: ${doc.attempts.length} 条`)
  if (last) {
    console.log(`  最近一次: ${last.from} -> ${last.to} @ ${last.at}`)
    console.log(`  原因: ${last.reason}`)
    console.log(`  操作者: ${last.by}`)
    if (last.evidence) console.log(`  证据: ${last.evidence}`)
  }
  if (doc.state !== 'running') {
    console.log('')
    console.log('需要通知人工(本工具只打印模板,不发信):')
    console.log(humanNoticeFor(doc))
  }
}

/**
 * 自检:全部落在 .ihui-agent/tmp/halt/(§15),用后即删,不碰真实状态文件。
 * 断言复用 lib 的判据本体 —— 不复制一份状态机。
 */
export function runSelfTest() {
  const tmpRoot = join(REPO_ROOT, '.ihui-agent', 'tmp', 'halt')
  const dir = join(tmpRoot, `selftest-${process.pid}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'halt.json')
  const other = join(dir, 'halt-bad.json')
  let passed = 0
  const cases = []
  const expect = (cond, label) => {
    if (!cond) throw new Error(`自检失败:${label}`)
    passed += 1
    cases.push(label)
  }
  const expectThrows = (fn, ctor, label) => {
    try {
      fn()
    } catch (e) {
      expect(e instanceof ctor, `${label}(抛出的类型是 ${e?.name},期望 ${ctor.name})`)
      return e
    }
    throw new Error(`自检失败:${label}(期望抛错但没有)`)
  }
  const writeBad = (text) => {
    rmSync(other, { force: true })
    writeFileSync(other, text, 'utf8')
  }
  try {
    // 1. 初始态
    expect(readHaltState({ file }).state === 'running', '文件不存在 ⇒ 初始态 running')
    // 2-3. 进入 + 落盘
    const entered = enterHalt('自检:演练停机,模拟上游连续失败', '自检夹具', {
      file,
      by: 'self-test',
    })
    expect(entered.changed === true && entered.state === 'halted', 'running -> halted 写入成功')
    expect(readHaltState({ file }).transitions.length === 1, '转移记录落盘 1 条')
    // 4. 幂等
    const again = enterHalt('自检:再次进入应幂等,状态不变', '', { file, by: 'self-test' })
    const afterAgain = readHaltState({ file })
    expect(again.changed === false && afterAgain.state === 'halted', '已 halted 再进不改状态')
    expect(afterAgain.attempts.length === 1, '已 halted 再进只追加 1 条 attempt')
    expect(afterAgain.transitions.length === 1, '幂等进入不新增转移记录')
    // 5-7. 拒绝面
    expectThrows(
      () => resumeHalt('自检:缺证据的恢复必须拒', '', { file }),
      HaltTransitionError,
      'resume 空 evidence 拒',
    )
    expectThrows(
      () => resumeHalt('自检:证据过短的恢复必须拒', '已修', { file }),
      HaltTransitionError,
      'resume 过短 evidence 拒',
    )
    expectThrows(() => enterHalt('太短', '', { file }), HaltTransitionError, 'reason <10 字拒')
    expect(readHaltState({ file }).state === 'halted', '被拒后状态未被改动')
    // 8. 恢复两跳
    const resumed = resumeHalt('自检:异常已消除,恢复运行', '自检夹具:重跑三遍均通过', {
      file,
      by: 'self-test',
    })
    expect(
      resumed.state === 'running' && resumed.transitions.length === 2,
      'halted -> resuming -> running 两跳',
    )
    const afterResume = readHaltState({ file })
    expect(afterResume.transitions.length === 3, '恢复后累计 3 条转移')
    expect(afterResume.state === 'running', '两次读状态不回退')
    // 9. running 上 resume 非法
    expectThrows(
      () => resumeHalt('自检:running 上恢复属非法转移', '自检夹具:这条不该被接受', { file }),
      HaltTransitionError,
      'running 上 resume 拒',
    )
    // 10. resuming 上 enter 非法,abort 合法
    enterHalt('自检:再次停机做 resuming 分支', '', { file, by: 'self-test' })
    resumeHalt('自检:分步恢复停在 resuming', '自检夹具:外部验证未完成', { file, settle: false })
    expect(readHaltState({ file }).state === 'resuming', 'settle=false 停在 resuming')
    expectThrows(
      () => enterHalt('自检:resuming 上重复进入应拒', '', { file }),
      HaltTransitionError,
      'resuming 上 enter 拒',
    )
    const aborted = abortResume('自检:外部验证失败,回停', '自检夹具:健康探针仍红', { file })
    expect(aborted.state === 'halted', 'resuming -> halted 由 abort 收口')
    // 11-13. 坏文件三型
    writeBad('{ not json')
    expectThrows(() => readHaltState({ file: other }), HaltStateUnjudgedError, '坏 JSON ⇒ 未判定')
    writeBad(
      JSON.stringify({ schema: 1, state: 'paused', updatedAt: '', transitions: [], attempts: [] }),
    )
    expectThrows(
      () => readHaltState({ file: other }),
      HaltStateUnjudgedError,
      '未知状态值 ⇒ 未判定',
    )
    writeBad(
      JSON.stringify({
        schema: 1,
        state: 'running',
        updatedAt: '',
        transitions: [
          {
            at: new Date().toISOString(),
            from: 'halted',
            to: 'running',
            reason: '手改的非法边',
            by: 'x',
            evidence: '',
          },
        ],
        attempts: [],
      }),
    )
    expectThrows(() => readHaltState({ file: other }), HaltStateUnjudgedError, '未登记边 ⇒ 未判定')
    // 14. 目录当文件
    expectThrows(() => readHaltState({ file: dir }), HaltStateUnjudgedError, '路径是目录 ⇒ 未判定')
    // 15. 通知模板不发信
    const notice = humanNoticeFor(readHaltState({ file }))
    expect(
      notice.includes('notify-deploy-failure.ts') && notice.includes('subject:'),
      '通知模板给出收件入口与主题',
    )
    expect(notice.includes('安全停机不是硬失败'), '通知模板写明停机语义')
    // 16. 转移表封闭
    expect(HALT_STATES.length === 3 && Object.keys(HALT_TRANSITIONS).length === 4, '三态四边')
    return { ok: true, passed, total: passed, cases }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgv(argv)
  if (args.help) {
    console.log(USAGE)
    return 0
  }
  if (args.action === 'self-test') {
    const result = runSelfTest()
    console.log(`SELFTEST passed=${result.passed} fail=0`)
    return result.ok ? 0 : 1
  }
  const file = args.file ?? DEFAULT_HALT_FILE
  if (args.action === 'status') {
    printStatus(readHaltState({ file }), { json: args.json })
    return 0
  }
  const opts = { file, by: args.by }
  if (args.action === 'enter') {
    const result = enterHalt(args.reason, args.evidence, opts)
    const doc = readHaltState({ file })
    if (args.json) {
      console.log(JSON.stringify({ ...statusPayload(doc), changed: result.changed }, null, 2))
    } else {
      console.log(
        result.changed
          ? `已进入安全停机态:running -> halted(原因:${result.transition.reason})`
          : `已是停机态:本次只追加 1 条 attempt,状态不变(原因:${result.attempt.reason})`,
      )
      console.log('')
      console.log('需要通知人工(本工具只打印模板,不发信):')
      console.log(humanNoticeFor(doc))
    }
    return 0
  }
  if (args.action === 'resume') {
    const result = resumeHalt(args.reason, args.evidence, opts)
    const doc = readHaltState({ file })
    if (args.json) {
      console.log(
        JSON.stringify(
          { ...statusPayload(doc), transitionsAdded: result.transitions.length },
          null,
          2,
        ),
      )
    } else {
      console.log(`已恢复:halted -> resuming -> running(证据:${args.evidence.trim()})`)
      console.log(`转移记录累计 ${doc.transitions.length} 条`)
    }
    return 0
  }
  if (args.action === 'abort') {
    const result = abortResume(args.reason, args.evidence, opts)
    const doc = readHaltState({ file })
    if (args.json) {
      console.log(JSON.stringify(statusPayload(doc), null, 2))
    } else {
      console.log(`恢复已中止:resuming -> halted(原因:${result.transition.reason})`)
      console.log('')
      console.log('需要通知人工(本工具只打印模板,不发信):')
      console.log(humanNoticeFor(doc))
    }
    return 0
  }
  throw new HaltTransitionError(`未知动作「${args.action}」\n${USAGE}`)
}

// §22d:ESM 脚本双形态入口。手拼 'file:///' 在 Windows 反斜杠下永不匹配,必须 pathToFileURL。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      // 未判定与拒绝必须分开:混成一个码,调用方会把"读不到"当成"规则说不行"。
      if (e instanceof HaltStateUnjudgedError) {
        console.error(`[haltctl] 未判定(exit 2):${e.message}`)
        process.exit(2)
      }
      if (e instanceof HaltTransitionError) {
        console.error(`[haltctl] 拒绝执行(exit 1):${e.message}`)
        process.exit(1)
      }
      console.error(`[haltctl] 脚本自身异常(exit 2):${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  parseArgv,
  printStatus,
  runSelfTest,
  main,
  HALT_STATES,
  HALT_TRANSITIONS,
  HALT_EVENTS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
