// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-human-valve — 人工阀判定入口(自进化 P0,2026-10-25 立)。
 *
 * 票面:明确 AI 可自决范围与必须停机等人的清单,设计为「安全停机等人工」而非硬失败。
 *
 * 三档退出码(注意:RC 表达的是「判定有没有跑完」,不是「判定结果」):
 *   0 = 判定完成(结果可能是 self-serve 也可能是 stop-for-human,看 payload)
 *   1 = 用法错 / 自检不通过
 *   2 = 取不到或读不懂输入 ⇒ 显式「未判定」,不记绿也不冒红(§0.3)
 *
 * 为什么 RC 不表达判定结果:一旦 stop 用非 0,调用脚本会把它当失败去重试/换参/绕行 ——
 * 那正是票面要消灭的「硬失败扩散」。停机语义由 `bucket` 承载,调用方必须读 payload。
 *
 * 用法:
 *   node scripts/check-human-valve.mjs --action "把生产机的 API key 换掉"
 *   node scripts/check-human-valve.mjs --action "跑守门并补一条测试" --json
 *   node scripts/check-human-valve.mjs --list [--json]
 *   node scripts/check-human-valve.mjs --self-test
 *   node scripts/check-human-valve.mjs --help
 *
 * 数据面可通过 IHUI_HUMAN_VALVE_DATA 覆盖(仅供测试注入坏数据,判据本身不变)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  BUCKETS,
  UNKNOWN_RULE_ID,
  parseValveList,
  classifyAction,
  auditValveList,
} from './lib/human-valve.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const DATA_PATH = join(HERE, 'data', 'human-valve-list.json')

const HELP_TEXT = `check-human-valve — 人工阀判定(自决 / 安全停机)

用法:
  node scripts/check-human-valve.mjs --action "<动作描述>" [--json]
  node scripts/check-human-valve.mjs --list [--json]
  node scripts/check-human-valve.mjs --self-test
  node scripts/check-human-valve.mjs --help

判定口径(唯一实现 scripts/lib/human-valve.mjs,清单 scripts/data/human-valve-list.json):
  - 命中人工阀 ⇒ bucket=stop-for-human,安全停机等人工:不重试、不绕行、不冒充失败;
  - 未知动作、清单缺失/形状坏、自决类 reviewBy 到期 ⇒ 一律 stop-for-human(fail-closed)。

退出码:0 判定完成 / 1 用法错或自检不通过 / 2 取不到输入(未判定)`

export const SELF_TEST_CASES = Object.freeze([
  {
    name: 'stop:换 API key',
    text: '把 DEEPSEEK_API_KEY 换成新的密钥',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'api-key-change',
  },
  {
    name: 'stop:控制台操作',
    text: '在 Cloudflare 控制台改 DNS 记录',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'console-operation',
  },
  {
    name: 'stop:真机扫码',
    text: '用真机扫码完成小程序登录',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'device-scan',
  },
  {
    name: 'stop:对外发布口径',
    text: '定这次故障的对外发布口径并发布公告',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'public-release-wording',
  },
  {
    name: 'stop:生产机部署',
    text: '把新构建部署到生产机',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'production-deploy',
  },
  {
    name: 'stop:凭据轮换',
    text: '轮换 PostgreSQL 的数据库口令',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'credential-rotation',
  },
  {
    name: 'stop:删分支',
    text: '删掉已合并的 feature 分支',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'destructive-git-or-data',
  },
  {
    name: 'stop:删数据',
    text: '删除生产库里的历史订单数据',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'destructive-git-or-data',
  },
  {
    name: 'stop:向外部系统写入',
    text: '往第三方工单系统写入一条缺陷单',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'external-system-write',
  },
  {
    name: 'stop:未知动作',
    text: '把服务器搬到火星',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: UNKNOWN_RULE_ID,
  },
  { name: 'stop:空描述', text: '   ', bucket: BUCKETS.STOP_FOR_HUMAN, ruleId: UNKNOWN_RULE_ID },
  {
    name: 'stop 优先于 self-serve',
    text: '改完代码顺手把 API key 换掉',
    bucket: BUCKETS.STOP_FOR_HUMAN,
    ruleId: 'api-key-change',
  },
  {
    name: 'self-serve:改代码/补测试',
    text: '给脚本补一个纯函数并补单元测试',
    bucket: BUCKETS.SELF_SERVE,
    ruleId: 'code-and-docs',
  },
  {
    name: 'self-serve:跑守门',
    text: '跑一遍守门看末行读数',
    bucket: BUCKETS.SELF_SERVE,
    ruleId: 'local-verification',
  },
  {
    name: 'self-serve:只读取证',
    text: '只读查询 git log 与守护日志',
    bucket: BUCKETS.SELF_SERVE,
    ruleId: 'read-only-probe',
  },
])

function readValveData() {
  const path = process.env.IHUI_HUMAN_VALVE_DATA
    ? resolve(process.env.IHUI_HUMAN_VALVE_DATA)
    : DATA_PATH
  const raw = readFileSync(path, 'utf8')
  return { path, data: parseValveList(raw) }
}

function emit(payload, json) {
  if (json) {
    console.log(JSON.stringify(payload, null, 2))
    return
  }
  if (payload.action !== undefined) {
    console.log(`[human-valve] 动作:${payload.action}`)
    console.log(`[human-valve] bucket=${payload.bucket} rule=${payload.ruleId}`)
    console.log(`[human-valve] ${payload.reason}`)
    console.log(
      payload.bucket === BUCKETS.STOP_FOR_HUMAN
        ? '[human-valve] 处置:进入受控停机态并通知人工;不重试、不换参、不绕行(停机 ≠ 失败)'
        : '[human-valve] 处置:落在自决面,可继续推进并留下证据',
    )
    return
  }
  console.log(JSON.stringify(payload, null, 2))
}

function parseArgs(argv) {
  const opts = { action: null, json: false, list: false, selfTest: false, help: false, errors: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--json') opts.json = true
    else if (arg === '--list') opts.list = true
    else if (arg === '--self-test') opts.selfTest = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--action') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) opts.errors.push('--action 需要一个值')
      else {
        opts.action = value
        i++
      }
    } else if (arg.startsWith('--action=')) opts.action = arg.slice('--action='.length)
    else opts.errors.push(`未知参数:${arg}`)
  }
  return opts
}

/** 自检把「判据 + 数据 + 到期 + 反向牙」一起量一遍;任一不过都返回非空 failures。 */
export function runSelfTest({ data, now = new Date() } = {}) {
  const failures = []
  const results = []
  let rules
  try {
    rules = data ? data.rules : readValveData().data.rules
  } catch (e) {
    return { failures: [`自检取不到清单(未判定):${e?.message ?? e}`], results }
  }
  for (const testCase of SELF_TEST_CASES) {
    const verdict = classifyAction(testCase.text, { rules, now })
    const ok = verdict.bucket === testCase.bucket && verdict.ruleId === testCase.ruleId
    results.push({ ...testCase, verdict, ok })
    if (!ok) {
      failures.push(
        `用例「${testCase.name}」期望 ${testCase.bucket}/${testCase.ruleId},实际 ${verdict.bucket}/${verdict.ruleId}`,
      )
    }
  }
  // 到期牙:自决类 reviewBy 过期后必须降级停机,而不是继续放行。
  const expiredRules = rules.map((rule) =>
    rule.bucket === BUCKETS.SELF_SERVE ? { ...rule, reviewBy: '2000-01-01' } : rule,
  )
  const expiredVerdict = classifyAction('给脚本补一个纯函数并补单元测试', {
    rules: expiredRules,
    now,
  })
  const expiredOk = expiredVerdict.bucket === BUCKETS.STOP_FOR_HUMAN
  results.push({
    name: '自决类到期 ⇒ 停机',
    text: '(reviewBy=2000-01-01)',
    ok: expiredOk,
    verdict: expiredVerdict,
  })
  if (!expiredOk)
    failures.push(
      `自决类 reviewBy 过期后仍未停机(实际 ${expiredVerdict.bucket}/${expiredVerdict.ruleId})`,
    )

  // 反向牙:数据新增一类而 lib 未认出来 ⇒ 该类必须落 stop,绝不能凭数据自称 self-serve 就放行。
  const augmented = [
    ...rules,
    {
      id: 'brand-new-self-serve-class',
      title: '自检注入的新自决类',
      bucket: BUCKETS.SELF_SERVE,
      examples: ['执行 qzx 专有动作'],
      why: '自检夹具',
      reviewBy: '2099-12-31',
    },
  ]
  const newClassVerdict = classifyAction('执行 qzx 专有动作', { rules: augmented, now })
  const newClassOk =
    newClassVerdict.bucket === BUCKETS.STOP_FOR_HUMAN && newClassVerdict.ruleId === UNKNOWN_RULE_ID
  results.push({
    name: '反向牙:新增类无匹配器 ⇒ 停机',
    text: '执行 qzx 专有动作',
    ok: newClassOk,
    verdict: newClassVerdict,
  })
  if (!newClassOk) {
    failures.push(
      `数据新增自决类后未落 unknown 停机(实际 ${newClassVerdict.bucket}/${newClassVerdict.ruleId})`,
    )
  }

  // 坏数据三型:解析必须抛(调用方据此落 exit 2),不得静默降级成"没规则 ⇒ 全自决"。
  const badSamples = [
    ['非 JSON', '{ not json'],
    [
      '缺 reviewBy',
      JSON.stringify({
        rules: [{ id: 'x', title: 'x', bucket: 'self-serve', examples: ['x'], why: 'x' }],
      }),
    ],
    [
      '坏 reviewBy',
      JSON.stringify({
        rules: [
          {
            id: 'x',
            title: 'x',
            bucket: 'self-serve',
            examples: ['x'],
            why: 'x',
            reviewBy: '2026-02-31',
          },
        ],
      }),
    ],
    [
      '重复 id',
      JSON.stringify({
        rules: [
          {
            id: 'x',
            title: 'x',
            bucket: 'self-serve',
            examples: ['x'],
            why: 'x',
            reviewBy: '2027-01-01',
          },
          {
            id: 'x',
            title: 'y',
            bucket: 'stop-for-human',
            examples: ['y'],
            why: 'y',
            reviewBy: '2027-01-01',
          },
        ],
      }),
    ],
  ]
  for (const [name, raw] of badSamples) {
    let threw = false
    try {
      parseValveList(raw)
    } catch {
      threw = true
    }
    results.push({ name: `坏数据:${name} ⇒ 未判定`, text: raw, ok: threw, verdict: null })
    if (!threw) failures.push(`坏数据「${name}」未抛错,调用方会拿空规则去判定`)
  }

  const audit = auditValveList(rules, { now })
  for (const problem of audit.problems) failures.push(`清单对账:${problem}`)
  return { failures, results, audit }
}

function printSelfTest(report, json) {
  if (json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }
  for (const row of report.results) {
    const mark = row.ok ? 'PASS' : 'FAIL'
    const verdict = row.verdict ? `${row.verdict.bucket}/${row.verdict.ruleId}` : '-'
    console.log(`[${mark}] ${row.name} ⇒ ${verdict}`)
  }
  console.log(
    report.failures.length === 0
      ? `[OK] 人工阀自检通过:${report.results.length} 例(含 4 类票面停机 + 未知停机 + 到期降级 + 反向牙 + 坏数据 4 型)`
      : `[FAIL] 人工阀自检失败 ${report.failures.length} 项:\n  - ${report.failures.join('\n  - ')}`,
  )
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length === 0) {
    // 无参 = 看用法,不是错误:停机工具被人直接敲到时先给出口,不让人凭猜。
    console.log(HELP_TEXT)
    return 0
  }
  const opts = parseArgs(argv)
  if (opts.help) {
    console.log(HELP_TEXT)
    return 0
  }
  if (opts.errors.length > 0) {
    console.error(`[FAIL] 用法错:${opts.errors.join(';')}\n\n${HELP_TEXT}`)
    return 1
  }
  if (opts.selfTest) {
    const report = runSelfTest()
    printSelfTest(report, opts.json)
    return report.failures.length === 0 ? 0 : 1
  }

  let loaded
  try {
    loaded = readValveData()
  } catch (e) {
    console.error(
      `[UNDETERMINED] 未判定(exit 2):取不到或读不懂人工阀清单 ⇒ 不记绿也不冒红,不得据此放行任何动作。\n   ${e?.message ?? e}`,
    )
    return 2
  }

  if (opts.list) {
    const payload = {
      source: loaded.path,
      rules: loaded.data.rules.map((rule) => ({
        id: rule.id,
        title: rule.title,
        bucket: rule.bucket,
        reviewBy: rule.reviewBy,
        examples: rule.examples,
      })),
    }
    emit(payload, opts.json)
    return 0
  }

  if (opts.action === null) {
    console.error(`[FAIL] 用法错:需要 --action "<动作>" 或 --list / --self-test\n\n${HELP_TEXT}`)
    return 1
  }

  let verdict
  try {
    verdict = classifyAction(opts.action, { rules: loaded.data.rules })
  } catch (e) {
    console.error(`[UNDETERMINED] 未判定(exit 2):规则表不可用 ⇒ 不猜。\n   ${e?.message ?? e}`)
    return 2
  }
  emit({ action: opts.action, ...verdict }, opts.json)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      // 脚本自身异常 = 未判定,绝不能伪装成"判定完成"或"停机"。
      console.error(`[FAIL] 人工阀判定自身异常(未判定):${e?.stack ?? e}`)
      process.exit(2)
    })
}

// §22c/§22d:导出判据与自检用例本身,镜像测试直接 import,禁止复制一份。
export const __test__ = {
  DATA_PATH,
  SELF_TEST_CASES,
  runSelfTest,
  parseArgs,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
