#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui-canary-wiring — 金丝雀「灰度分流」的**接线判据**(O65 第 2 期 · 2026-10-28 立)。
 *
 * 立因:观察窗(canary-verdict)与回滚出口(-rollbackOnly -CanaryRollback)早已在 HEAD 装车,
 * 而「灰度分流」这一格的执行体(stage.mjs 契约 + gray.ps1 进程编排 + split.mjs 切流)曾长期
 * 处于"文件在盘上、部署环一次都没调过"的状态 = §0.9「造好没装车 = 没有」。PowerShell 那一层
 * 没有 typecheck、没有守护进程在场时更是**改了也看不出来**,所以这一格必须有一把机械尺子:
 * 它判的不是"文件存不存在"(那是门 244 check-gate-rot 的活),而是**部署环拿到判定之后
 * 到底有没有把分流这件事做下去**。
 *
 * 判据对象 = `deploy/win/ihui-deploy-loop.ps1` 里 `function Invoke-CanaryGate` 那一段
 * (到下一个顶格 `function` 为止)。为什么只裁这一段:整文件判会把"别处提到过 gray.ps1"
 * 也算接线,而永不执行的那一段照样绿 —— 裁到函数体才量得到"观察窗这一轮真调了谁"。
 *
 * 判据(缺一即缺口,逐条点名给修法):
 *   W1 调 `ihui-canary-stage.mjs`   —— 档位契约与动作决策由执行体产出,不在 PowerShell 里手搓比例
 *   W2 调 `ihui-canary-gray.ps1`    —— 分流器/灰度实例真被拉起与停掉(进程编排层在链路里)
 *   W3 调 `--gray-policy`           —— 采样目标由 canary-policy.json 派生(槽位端口不写死)
 *   W4 `--decide` 且带 `--verdict`  —— 观察窗的 pass/fail/unknown 结论喂给档位推进
 *   W5 `-Action stop`               —— 判死时先撤灰度流量(归零契约 + 停进程),再谈整包回滚
 *   W6 缺件守护                     —— 分流件不在位时必须走「GRAY 未判定」降级路径(Test-Path ≥ 3),
 *                                      既不冒绿说"已分流",也不因此让观察窗失去回滚能力
 *   W7 单一真源                     —— 这一段里不得出现 88xx 端口字面量,也不得出现
 *                                      `percent = <数字>` 之类的比例字面量(比例/阈值/槽位只住
 *                                      scripts/data/canary-policy.json,AGENTS §0.6)
 *   W8 整包回滚出口                 —— fail 分支必须真调 ihui-deploy.ps1 -rollbackOnly,
 *                                      否则"异常自动回滚"这一格只是日志上的话
 *   W9 撤量/退包次序                —— -Action stop 必须排在 -rollbackOnly 之前(顺序反了
 *                                      就是"包退完了,分流器还往已拆掉的候选槽位送请求")
 *   W10 灰度在位 ∧ 采样面折算        —— --decide 必须同时带 --canary-serving yes|no|unknown 与
 *                                      --verdict $rampVerdict(按 $graySampledFrom 折算过的那枚),两维缺一即缺口
 *                                      (票 31460:灰度实例不在位时的"现网侧 pass"不得被喂给
 *                                      档位推进冒充"灰度侧通过";缺省 unknown ⇒ hold 不推进)
 *   W11 实切量落日志/台账             —— Invoke-CanaryGate 必须读分流器的车道计数产物并打成
 *                                      一行 `GRAY 实切=<canary>/<total> 占比=…`,同时随
 *                                      --reason-append 进决策台账(取不到也要如实打"未判定")
 *   W12 计数落盘出口本体              —— 分流器 CLI(deploy/win/ihui-canary-split.mjs 源码)必须
 *                                      把 onLane 接到计数落盘出口(createLaneStatsWriter ∧
 *                                      onLane: stats.observe):响应头只是单枚排障线索,进程整轮
 *                                      只 print 一行 ⇒ 灰度期"放过多少量"没有任何持久产物。
 *                                      这一格判的是**另一份文件**,所以输入取不到即未判定(§0.3),
 *                                      绝不"这一格跳过就算绿"。
 *
 * 三态(§0.3,不并桶):
 *   0 = 已接线(W1–W12 全中)
 *   1 = 有缺口(逐条点名 id + 修法)
 *   2 = 未判定(被审文件取不到 / 找不到 Invoke-CanaryGate 段 / 分流器源码取不到 ⇒ 绝不记绿)
 *
 * 用法:
 *   node deploy/win/ihui-canary-wiring.mjs --check [--file <ps1>] [--json]
 *   node deploy/win/ihui-canary-wiring.mjs --self-test
 *   镜像测试:deploy/tests/ihui-canary-wiring.test.mjs(import 本文件判据,不复制)
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEFAULT_LOOP_PS1 = join(ROOT, 'deploy', 'win', 'ihui-deploy-loop.ps1')
/** W12 的第二枚被审文件:分流器本体(车道计数落盘出口住在这里,不在部署环里)。 */
const DEFAULT_SPLIT_MJS = join(ROOT, 'deploy', 'win', 'ihui-canary-split.mjs')

const EXIT_WIRED = 0
const EXIT_GAP = 1
const EXIT_UNDETERMINED = 2

/** 判据表:一条一格,`test` 收函数体文本。新增一格必须同时在自证里给"摘掉即翻红"的夹具。 */
const WIRING_RULES = [
  {
    id: 'W1',
    need: /ihui-canary-stage\.mjs/,
    why: '观察窗没有调用档位编排层 ⇒ 灰度比例从未被产出,分流执行体读不到契约',
    fix: '在 Invoke-CanaryGate 内调 `& $Node $stageCli --status/--decide …`(deploy/win/ihui-canary-stage.mjs)',
  },
  {
    id: 'W2',
    need: /ihui-canary-gray\.ps1/,
    why: '分流器与灰度实例的进程编排没被调用 ⇒ 契约写得再对也没有进程消费它',
    fix: '在 Invoke-CanaryGate 内调 `& $PwshExe … -File $grayPs1 -Action start …`',
  },
  {
    id: 'W3',
    need: /--gray-policy/,
    why: '采样目标没有按策略派生 ⇒ 观察窗量的还是现网端点,灰度槽位没有任何证据',
    fix: '用 canary-traffic.mjs --gray-policy --stage <档位> --out <灰期策略>,再让 --sample/--decide 吃这份 --policy',
  },
  {
    id: 'W4',
    need: /--decide/,
    also: /--verdict/,
    why: '观察窗的结论没有喂给档位推进 ⇒ 判过也没有下一档,判死也没有归零',
    fix: '把 rc 映射成 pass|fail|unknown 后调 `--decide --verdict <v>`(比例只来自 canary-policy.json)',
  },
  {
    id: 'W5',
    need: /-Action\s+stop/,
    why: '判死时没有撤灰度(停进程 + 契约归零)⇒ 坏构建还留在分流路径上',
    fix: 'fail 分支在整包回滚之前先 `-Action stop`(撤流量),再调 ihui-deploy.ps1 -rollbackOnly',
  },
  {
    id: 'W6',
    need: /GRAY 未判定/,
    minCount: { pattern: /Test-Path/g, atLeast: 3 },
    why: '分流件缺失/起不来时没有显式「未判定」降级路径 ⇒ 要么假绿说已分流,要么整窗一起哑掉',
    fix: '每处调用前 Test-Path 守护,取不到就 Log "GRAY 未判定:…" 并继续按现网端点观察(不改既有回滚能力)',
  },
  {
    id: 'W7',
    forbid: [/\b88\d\d\b/, /\bpercent\s*=\s*\d/, /\b--percent\s+\d/],
    why: '这一段里出现了端口/比例字面量 ⇒ 与 scripts/data/canary-policy.json 形成第二份策略(§0.6)',
    fix: '比例/阈值/槽位一律经 stage.mjs 与 --gray-policy 派生,PowerShell 侧只搬运结论',
  },
  {
    id: 'W8',
    need: /-rollbackOnly/,
    why: '观察窗判死却没有真调用整包回滚出口 ⇒ "异常自动回滚"只是日志上的话',
    fix: 'fail 分支调 ihui-deploy.ps1 -rollbackOnly -CanaryRollback(撤灰度在前、退包在后)',
  },
  {
    id: 'W9',
    order: { first: /-Action\s+stop/, second: /-rollbackOnly/ },
    why: '撤灰度(-Action stop)排在整包回滚之后 ⇒ 包都退完了,分流器还按老契约把请求往已拆掉的候选槽位上送',
    fix: 'fail 分支先 -Action stop(并已由 --decide 把契约比例归零),再调 -rollbackOnly',
  },
  {
    id: 'W10',
    need: /--canary-serving/,
    also: /rampVerdict/,
    why:
      '档位推进没有同时携带「灰度实例在位维」与「按采样面折算的档位判定」⇒ 灰度实例不在位时(采样面=stable)' +
      '那枚"现网侧 pass"照样被喂给 --decide 升档,而升档这一格从来是空的(票 31460 治的形态;2026-11-01 实测:' +
      '近 20 轮 20/20 灰度无产物,档位照样 ramp-1 → ramp-2。§0.3:未判定不得折成判过)。',
    fix: '先按 $graySampledFrom 折算 $rampVerdict(≠canary ⇒ unknown ⇒ 原地不动),再把灰度实例是否在位现算成 yes|no|unknown,' +
      '随 --decide 一起传 `--verdict $rampVerdict --canary-serving $canaryServing`;缺省/取不到一律 unknown ⇒ stage.mjs 侧落 hold,不推进也不回滚',
  },
  {
    id: 'W11',
    need: /GRAY 实切=/,
    also: /--reason-append/,
    why:
      '灰度期"到底放过多少量"没有落到日志与决策台账 —— 分流器只把车道写进响应头(单枚排障线索),' +
      '契约文件写的是期望比例,台账写的是判定结论,三者都证明不了实切量(2026-11-01 现读:' +
      '部署环通篇读不到 split-stats.json)。取不到计数时也必须打出「GRAY 实切=未判定」而不是不提(§0.3)。',
    fix: '在 Invoke-CanaryGate 内读 .ihui-agent\\state\\canary\\split-stats.json 折算成一行 ' +
      '`GRAY 实切=<canary>/<total> 占比=x%`,随 --decide 传 `--reason-append` 并入台账 reason,' +
      '并在档位决策之后 Log 同一行(计数只作观测,绝不回流进回滚阈值,也不进告警去重身份 §5e-3)',
  },
  {
    id: 'W12',
    scope: 'split',
    need: /createLaneStatsWriter/,
    also: /onLane:\s*stats\.observe/,
    why:
      '分流器 CLI 没有车道计数落盘出口(或出口造好却没接进 CLI)⇒ 灰度期整轮跑完磁盘上没有任何实切产物。' +
      '2026-11-01 现读:ihui-canary-gray.ps1 正是以 CLI 形态起分流器并把 stdout 重定向进日志,' +
      '而 main() 里 createSplitServer 不传 onLane、进程只在 listen 时 print 一行 —— 这一格是空的。',
    fix: '在 deploy/win/ihui-canary-split.mjs 的 main() 里 createLaneStatsWriter({ statsPath }) ' +
      '并以 `onLane: stats.observe` 接进 createSplitServer;节流落盘(默认 5s / 100 枚一写)+' +
      '退出前 flush,写失败只点名不得抛穿转发路径,契约缺失也计数(contractMissing)',
  },
]

/**
 * 取 `function Invoke-CanaryGate` 到下一个顶格 `function` 之间的整段(行级,不做花括号解析:
 * PowerShell 的字符串里 `{0}` 这类插值占位会让括号配平假配不上,而行级"下一个顶格 function"
 * 是本文件既有的稳定结构)。找不到段 ⇒ 返回 null(由调用方落「未判定」,绝不空串记绿)。
 */
function canaryGateBody(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  let start = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (/^function\s+Invoke-CanaryGate\b/.test(lines[i])) {
      start = i
      break
    }
  }
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^function\s+\S/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

/** 判据本体:返回缺口数组(空 = 已接线)。输入不是文本 ⇒ 抛(调用方落未判定)。
 *
 * 两个输入面:`text` = 部署环全文(W1–W11,裁到 Invoke-CanaryGate 段);
 * `splitText` = 分流器源码全文(W12)。带 `scope:'split'` 的格子**必须**拿到自己的输入,
 * 拿不到就抛 —— "这一格没有输入所以跳过"等于把没判写成判过(§0.3)。
 */
function wiringGaps(text, splitText) {
  if (typeof text !== 'string' || !text.trim())
    throw new Error('接线判据输入为空文本(取不到被审面)')
  const body = canaryGateBody(text)
  if (body === null)
    throw new Error('找不到 `function Invoke-CanaryGate` 段(判据对象不在位 ⇒ 未判定)')
  if (!body.trim()) throw new Error('Invoke-CanaryGate 段为空 ⇒ 未判定(空段不记绿)')
  const gaps = []
  for (const rule of WIRING_RULES) {
    // 形状自锁:一格判据若没声明任何一种"判法",它会永远绿 —— 这正是"加了格子却没人判"
    // 的形态(§0.9:造好没装车 = 没有;这里连造都没造出来)。当场抛,不当绿。
    if (!rule.need && !rule.also && !rule.minCount && !rule.forbid && !rule.order) {
      throw new Error(
        `判据 ${rule.id} 没声明任何判法(need/also/minCount/forbid/order 全空 ⇒ 恒绿摆设)`,
      )
    }
    const isSplit = rule.scope === 'split'
    if (isSplit && (typeof splitText !== 'string' || !splitText.trim()))
      throw new Error(`分流器源码取不到 ⇒ ${rule.id} 未判定(绝不因"没有输入"记绿)`)
    const corpus = isSplit ? splitText : body
    if (rule.need && !rule.need.test(corpus)) {
      gaps.push({ id: rule.id, why: rule.why, fix: rule.fix })
      continue
    }
    if (rule.also && !rule.also.test(corpus)) {
      gaps.push({ id: rule.id, why: `${rule.why}(缺 ${rule.also})`, fix: rule.fix })
      continue
    }
    if (rule.minCount) {
      const hits = corpus.match(rule.minCount.pattern)
      if (!hits || hits.length < rule.minCount.atLeast) {
        gaps.push({
          id: rule.id,
          why: `${rule.why}(现读 Test-Path ${hits ? hits.length : 0} 处 < ${rule.minCount.atLeast})`,
          fix: rule.fix,
        })
        continue
      }
    }
    if (rule.order) {
      const a = corpus.search(rule.order.first)
      const b = corpus.search(rule.order.second)
      if (a < 0 || b < 0) {
        gaps.push({
          id: rule.id,
          why: `${rule.why}(stop 位置=${a} 退包位置=${b} ⇒ 两格中有一格根本不在)`,
          fix: rule.fix,
        })
        continue
      }
      if (a > b) {
        gaps.push({
          id: rule.id,
          why: `${rule.why}(现读:stop 在第 ${a} 字、rollbackOnly 在第 ${b} 字)`,
          fix: rule.fix,
        })
        continue
      }
    }
    if (rule.forbid) {
      const hit = rule.forbid.find((re) => re.test(corpus))
      if (hit) {
        gaps.push({ id: rule.id, why: `${rule.why}(命中 ${hit})`, fix: rule.fix })
        continue
      }
    }
  }
  return gaps
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

function selfTest() {
  const checks = []
  const t = (name, fn) => {
    try {
      fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }
  const real = (() => {
    try {
      return readFileSync(DEFAULT_LOOP_PS1, 'utf8')
    } catch {
      return ''
    }
  })()
  const splitReal = (() => {
    try {
      return readFileSync(DEFAULT_SPLIT_MJS, 'utf8')
    } catch {
      return ''
    }
  })()
  const body = canaryGateBody(real)

  t('被审文件取不到 ⇒ 抛(未判定,不记绿)', () => {
    let hit = false
    try {
      wiringGaps('')
    } catch {
      hit = true
    }
    if (!hit) throw new Error('空输入未抛')
  })
  t('找不到 Invoke-CanaryGate 段 ⇒ 抛(不拿整文件凑绿)', () => {
    let hit = false
    try {
      wiringGaps('Write-Host "随便一份 ps1"\nfunction SomethingElse { }\n')
    } catch {
      hit = true
    }
    if (!hit) throw new Error('无段未抛')
  })
  if (body) {
    if (!splitReal.trim())
      throw new Error(`分流器源码取不到(${DEFAULT_SPLIT_MJS})⇒ W12 无从判定,自检不得记绿`)
    for (const rule of WIRING_RULES) {
      t(`正向:真部署环/真分流器命中 ${rule.id}`, () => {
        const gaps = wiringGaps(real, splitReal)
        if (gaps.some((g) => g.id === rule.id))
          throw new Error(`${rule.id} 判为缺口:${gaps.find((g) => g.id === rule.id)?.why}`)
      })
    }
    // 变异对:每一格"摘掉即翻红"——判据必须是活的,不是恒绿。
    const mutations = [
      { name: '摘掉 stage 调用', re: /ihui-canary-stage\.mjs/g, want: 'W1' },
      { name: '摘掉 gray 进程编排', re: /ihui-canary-gray\.ps1/g, want: 'W2' },
      { name: '摘掉灰期策略派生', re: /--gray-policy/g, want: 'W3' },
      { name: '摘掉 --verdict 推进', re: /--verdict/g, want: 'W4' },
      { name: '摘掉撤灰度(stop)', re: /-Action\s+stop/g, want: 'W5' },
      { name: '摘掉整包回滚出口', re: /-rollbackOnly/g, want: 'W8' },
      { name: '摘掉灰度在位维(--canary-serving)', re: /--canary-serving/g, want: 'W10' },
      { name: '摘掉采样面折算的档位判定', re: /rampVerdict/g, want: 'W10' },
      { name: '摘掉实切量日志行(GRAY 实切=)', re: /GRAY 实切=/g, want: 'W11' },
      { name: '摘掉实切量并台账(--reason-append)', re: /--reason-append/g, want: 'W11' },
    ]
    for (const m of mutations) {
      t(`变异:${m.name} ⇒ ${m.want} 翻红`, () => {
        const mutated = real.replace(m.re, '「已摘线」')
        if (mutated === real) throw new Error('变异未生效(原文里没有这一格 ⇒ 本自证假绿)')
        const gaps = wiringGaps(mutated, splitReal)
        if (!gaps.some((g) => g.id === m.want))
          throw new Error(`摘线后仍判 ${m.want} 绿 ⇒ 判据是摆设`)
      })
    }
    // W12 的变异面在分流器源码里(不在部署环里):摘掉 CLI 的接线 ⇒ 翻红
    t(`变异:摘掉分流器 CLI 的计数接线(onLane: stats.observe)⇒ W12 翻红`, () => {
      const mutated = splitReal.replace(/onLane:\s*stats\.observe/g, '「计数出口已摘线」')
      if (mutated === splitReal) throw new Error('变异未生效(分流器 CLI 根本没接出口)')
      const gaps = wiringGaps(real, mutated)
      if (!gaps.some((g) => g.id === 'W12')) throw new Error('摘线后仍判 W12 绿 ⇒ 判据是摆设')
    })
    t('W12 输入面:分流器源码取不到 ⇒ 抛(未判定,绝不跳过这一格记绿)', () => {
      let hit = false
      try {
        wiringGaps(real, '')
      } catch (e) {
        hit = /W12 未判定/.test(String(e?.message ?? e))
      }
      if (!hit) throw new Error('缺输入未抛 ⇒ 这一格会静默变绿')
    })
    // 成对夹具工厂:除被检的那一格之外,其余各格都必须齐备 —— 否则"翻红"可能来自别格,
    // 而那是假阳(与"摘掉即翻红"要证的恰好相反)。
    const fakeGate = ({ hardcode = false, swapOrder = false, noReadout = false } = {}) => {
      const stop = '  & $PwshExe -File $grayPs1 -Action stop'
      const rb =
        "  & $PwshExe -File (Join-Path $WinDir 'ihui-deploy.ps1') -rollbackOnly -CanaryRollback"
      const readout = noReadout
        ? '  $grayRealSplit = "未判定"'
        : [
            "  $grayRealSplit = 'GRAY 实切=未判定(计数产物取不到)'",
            '  if (Test-Path -LiteralPath $splitStatsPath) { $grayRealSplit = "GRAY 实切=$($splitCanary)/$($splitTotal) 占比=$($splitShare)%" }',
            "  $dArgs += @('--reason-append', $grayRealSplit)",
            '  Log $grayRealSplit',
          ].join('\n')
      return [
        'function Invoke-CanaryGate {',
        "  $stageCli = Join-Path $WinDir 'ihui-canary-stage.mjs'",
        "  $grayPs1 = Join-Path $WinDir 'ihui-canary-gray.ps1'",
        '  if (-not (Test-Path $stageCli)) { Log "GRAY 未判定:stage 件不在位"; return $false }',
        '  if (-not (Test-Path $grayPs1)) { Log "GRAY 未判定:gray 件不在位"; return $false }',
        '  if (-not (Test-Path $trafficCli)) { Log "GRAY 未判定:traffic 件不在位"; return $false }',
        '  & $Node $trafficCli --gray-policy --stage $s --out $gp',
        '  $rampVerdict = if ($graySampledFrom -eq "canary") { $verdictWord } else { "unknown" }',
        "  & $Node $stageCli --decide --verdict $rampVerdict --canary-serving yes --current $s --contract $r",
        swapOrder ? rb : stop,
        swapOrder ? stop : rb,
        hardcode
          ? '  # 反例:把槽位端口/比例写死在部署环里 ⇒ 第二份策略(§0.6)'
          : '  $samplePolicy = $policyPath',
        hardcode ? '  $u = "http://127.0.0.1:8845/health"' : '  $u = $samplePolicy',
        readout,
        '}',
      ].join('\n')
    }
    /** W12 的分流器夹具:接了出口 / 摘了出口(成对反向对照)。 */
    const fakeSplit = ({ unwired = false, noWriter = false } = {}) =>
      [
        'function main() {',
        noWriter
          ? '  const stats = { observe: () => {} }'
          : '  const stats = createLaneStatsWriter({ statsPath })',
        unwired
          ? '  const server = createSplitServer({ contractPath, stablePortFallback })'
          : '  const server = createSplitServer({ contractPath, stablePortFallback, onLane: stats.observe })',
        '}',
      ].join('\n')
    t('夹具自证:其余各格齐备的假段落 ⇒ 零缺口(防本判据恒红的假阳对照)', () => {
      const gaps = wiringGaps(fakeGate({}), fakeSplit())
      if (gaps.length)
        throw new Error(`应全中,实得 ${gaps.map((g) => `${g.id}:${g.why}`).join(' | ')}`)
    })
    t('W7 反向对照:同一段里出现端口/比例字面量即判缺口(其余各格齐备也不放过)', () => {
      const gaps = wiringGaps(fakeGate({ hardcode: true }), fakeSplit())
      if (!gaps.some((g) => g.id === 'W7'))
        throw new Error(`比例/端口字面量未被 W7 咬住(实得 ${JSON.stringify(gaps)})`)
      const others = gaps.filter((g) => g.id !== 'W7')
      if (others.length)
        throw new Error(`夹具除 W7 外应全中,实得 ${others.map((g) => g.id).join(',')}`)
    })
    t('W9 反向对照:撤灰度排在退包之后 ⇒ 只有 W9 翻红', () => {
      const gaps = wiringGaps(fakeGate({ swapOrder: true }), fakeSplit())
      if (gaps.length !== 1 || gaps[0].id !== 'W9') throw new Error(`实得 ${JSON.stringify(gaps)}`)
    })
    t('W11 反向对照:整块实切量读数被摘掉(日志+台账一起没)⇒ 只有 W11 翻红', () => {
      const gaps = wiringGaps(fakeGate({ noReadout: true }), fakeSplit())
      if (gaps.length !== 1 || gaps[0].id !== 'W11') throw new Error(`实得 ${JSON.stringify(gaps)}`)
    })
    t('W12 反向对照:分流器 CLI 没把计数出口接进 createSplitServer ⇒ 只有 W12 翻红', () => {
      const gaps = wiringGaps(fakeGate({}), fakeSplit({ unwired: true }))
      if (gaps.length !== 1 || gaps[0].id !== 'W12') throw new Error(`实得 ${JSON.stringify(gaps)}`)
    })
    t('W12 反向对照:出口本体都不存在(只有个空 observe)⇒ 只有 W12 翻红', () => {
      const gaps = wiringGaps(fakeGate({}), fakeSplit({ noWriter: true }))
      if (gaps.length !== 1 || gaps[0].id !== 'W12') throw new Error(`实得 ${JSON.stringify(gaps)}`)
    })
    t('形状自锁:一格判据没声明任何判法 ⇒ 抛(不得恒绿)', () => {
      WIRING_RULES.push({ id: 'X0', why: '故意造的空格', fix: '不该存在' })
      try {
        let hit = false
        try {
          wiringGaps(fakeGate({}), fakeSplit())
        } catch (e) {
          hit = /恒绿摆设/.test(String(e?.message ?? e))
        }
        if (!hit) throw new Error('空格子未被形状自锁抛住 ⇒ 它会变成一道恒绿门')
      } finally {
        WIRING_RULES.pop()
      }
    })
  } else {
    t('正向档跳过(取不到 deploy-loop 文本 ⇒ 未判定)', () => {
      throw new Error(`读不到 ${DEFAULT_LOOP_PS1}`)
    })
  }

  const failed = checks.filter((c) => !c.ok)
  for (const c of checks)
    console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  console.log(`\n通过 ${checks.length - failed.length} / 失败 ${failed.length}`)
  if (failed.length) process.exitCode = 1
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args['self-test']) return selfTest()

  const file = args.file ? resolve(String(args.file)) : DEFAULT_LOOP_PS1
  const splitFile = args.split ? resolve(String(args.split)) : DEFAULT_SPLIT_MJS
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    console.error(`接线未判定:${file} 读不到(${e?.message ?? e})`)
    process.exit(EXIT_UNDETERMINED)
  }
  let splitText
  try {
    splitText = readFileSync(splitFile, 'utf8')
  } catch (e) {
    console.error(`接线未判定:${splitFile} 读不到(W12 的判据面,取不到不跳过 ⇒ ${e?.message ?? e})`)
    process.exit(EXIT_UNDETERMINED)
  }
  let gaps
  try {
    gaps = wiringGaps(text, splitText)
  } catch (e) {
    console.error(`接线未判定:${e?.message ?? e}`)
    process.exit(EXIT_UNDETERMINED)
  }
  if (args.json) console.log(JSON.stringify({ file, splitFile, wired: gaps.length === 0, gaps }))
  else if (gaps.length === 0)
    console.log(`CANARY-WIRING wired  ${file} 判据 ${WIRING_RULES.length} 格全中(分流器面=${splitFile})`)
  else {
    console.log(`CANARY-WIRING GAP  ${file} 缺 ${gaps.length}/${WIRING_RULES.length} 格:`)
    for (const g of gaps) console.log(`  - ${g.id} ${g.why}\n    修法:${g.fix}`)
  }
  process.exit(gaps.length === 0 ? EXIT_WIRED : EXIT_GAP)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
}

export const __test__ = {
  canaryGateBody,
  wiringGaps,
  WIRING_RULES,
  DEFAULT_LOOP_PS1,
  DEFAULT_SPLIT_MJS,
  EXIT_WIRED,
  EXIT_GAP,
  EXIT_UNDETERMINED,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
