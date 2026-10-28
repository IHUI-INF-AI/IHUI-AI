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
 *
 * 三态(§0.3,不并桶):
 *   0 = 已接线(W1–W7 全中)
 *   1 = 有缺口(逐条点名 id + 修法)
 *   2 = 未判定(被审文件取不到 / 找不到 Invoke-CanaryGate 段 ⇒ 绝不记绿)
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
export const DEFAULT_LOOP_PS1 = join(ROOT, 'deploy', 'win', 'ihui-deploy-loop.ps1')

export const EXIT_WIRED = 0
export const EXIT_GAP = 1
export const EXIT_UNDETERMINED = 2

/** 判据表:一条一格,`test` 收函数体文本。新增一格必须同时在自证里给"摘掉即翻红"的夹具。 */
export const WIRING_RULES = [
  {
    id: 'W1',
    need: /ihui-canary-stage\.mjs/,
    why: '观察窗没有调用档位编排层 ⇒ 灰度比例从未被产出,分流执行体读不到契约',
    fix: "在 Invoke-CanaryGate 内调 `& $Node $stageCli --status/--decide …`(deploy/win/ihui-canary-stage.mjs)",
  },
  {
    id: 'W2',
    need: /ihui-canary-gray\.ps1/,
    why: '分流器与灰度实例的进程编排没被调用 ⇒ 契约写得再对也没有进程消费它',
    fix: "在 Invoke-CanaryGate 内调 `& $PwshExe … -File $grayPs1 -Action start …`",
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
    fix: "把 rc 映射成 pass|fail|unknown 后调 `--decide --verdict <v>`(比例只来自 canary-policy.json)",
  },
  {
    id: 'W5',
    need: /-Action\s+stop/,
    why: '判死时没有撤灰度(停进程 + 契约归零)⇒ 坏构建还留在分流路径上',
    fix: "fail 分支在整包回滚之前先 `-Action stop`(撤流量),再调 ihui-deploy.ps1 -rollbackOnly",
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
    fix: "fail 分支调 ihui-deploy.ps1 -rollbackOnly -CanaryRollback(撤灰度在前、退包在后)",
  },
  {
    id: 'W9',
    order: { first: /-Action\s+stop/, second: /-rollbackOnly/ },
    why: '撤灰度(-Action stop)排在整包回滚之后 ⇒ 包都退完了,分流器还按老契约把请求往已拆掉的候选槽位上送',
    fix: 'fail 分支先 -Action stop(并已由 --decide 把契约比例归零),再调 -rollbackOnly',
  },
]

/**
 * 取 `function Invoke-CanaryGate` 到下一个顶格 `function` 之间的整段(行级,不做花括号解析:
 * PowerShell 的字符串里 `{0}` 这类插值占位会让括号配平假配不上,而行级"下一个顶格 function"
 * 是本文件既有的稳定结构)。找不到段 ⇒ 返回 null(由调用方落「未判定」,绝不空串记绿)。
 */
export function canaryGateBody(text) {
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

/** 判据本体:返回缺口数组(空 = 已接线)。输入不是文本 ⇒ 抛(调用方落未判定)。 */
export function wiringGaps(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('接线判据输入为空文本(取不到被审面)')
  const body = canaryGateBody(text)
  if (body === null) throw new Error('找不到 `function Invoke-CanaryGate` 段(判据对象不在位 ⇒ 未判定)')
  if (!body.trim()) throw new Error('Invoke-CanaryGate 段为空 ⇒ 未判定(空段不记绿)')
  const gaps = []
  for (const rule of WIRING_RULES) {
    // 形状自锁:一格判据若没声明任何一种"判法",它会永远绿 —— 这正是"加了格子却没人判"
    // 的形态(§0.9:造好没装车 = 没有;这里连造都没造出来)。当场抛,不当绿。
    if (!rule.need && !rule.also && !rule.minCount && !rule.forbid && !rule.order) {
      throw new Error(`判据 ${rule.id} 没声明任何判法(need/also/minCount/forbid/order 全空 ⇒ 恒绿摆设)`)
    }
    if (rule.need && !rule.need.test(body)) {
      gaps.push({ id: rule.id, why: rule.why, fix: rule.fix })
      continue
    }
    if (rule.also && !rule.also.test(body)) {
      gaps.push({ id: rule.id, why: `${rule.why}(缺 ${rule.also})`, fix: rule.fix })
      continue
    }
    if (rule.minCount) {
      const hits = body.match(rule.minCount.pattern)
      if (!hits || hits.length < rule.minCount.atLeast) {
        gaps.push({ id: rule.id, why: `${rule.why}(现读 Test-Path ${hits ? hits.length : 0} 处 < ${rule.minCount.atLeast})`, fix: rule.fix })
        continue
      }
    }
    if (rule.order) {
      const a = body.search(rule.order.first)
      const b = body.search(rule.order.second)
      if (a < 0 || b < 0) {
        gaps.push({ id: rule.id, why: `${rule.why}(stop 位置=${a} 退包位置=${b} ⇒ 两格中有一格根本不在)`, fix: rule.fix })
        continue
      }
      if (a > b) {
        gaps.push({ id: rule.id, why: `${rule.why}(现读:stop 在第 ${a} 字、rollbackOnly 在第 ${b} 字)`, fix: rule.fix })
        continue
      }
    }
    if (rule.forbid) {
      const hit = rule.forbid.find((re) => re.test(body))
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
    for (const rule of WIRING_RULES) {
      t(`正向:真部署环命中 ${rule.id}`, () => {
        const gaps = wiringGaps(real)
        if (gaps.some((g) => g.id === rule.id)) throw new Error(`${rule.id} 判为缺口:${gaps.find((g) => g.id === rule.id)?.why}`)
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
    ]
    for (const m of mutations) {
      t(`变异:${m.name} ⇒ ${m.want} 翻红`, () => {
        const mutated = real.replace(m.re, '「已摘线」')
        if (mutated === real) throw new Error('变异未生效(原文里没有这一格 ⇒ 本自证假绿)')
        const gaps = wiringGaps(mutated)
        if (!gaps.some((g) => g.id === m.want)) throw new Error(`摘线后仍判 ${m.want} 绿 ⇒ 判据是摆设`)
      })
    }
    // 成对夹具工厂:除被检的那一格之外,其余各格都必须齐备 —— 否则"翻红"可能来自别格,
    // 而那是假阳(与"摘掉即翻红"要证的恰好相反)。
    const fakeGate = ({ hardcode = false, swapOrder = false } = {}) => {
      const stop = '  & $PwshExe -File $grayPs1 -Action stop'
      const rb = "  & $PwshExe -File (Join-Path $WinDir 'ihui-deploy.ps1') -rollbackOnly -CanaryRollback"
      return [
        'function Invoke-CanaryGate {',
        "  $stageCli = Join-Path $WinDir 'ihui-canary-stage.mjs'",
        "  $grayPs1 = Join-Path $WinDir 'ihui-canary-gray.ps1'",
        '  if (-not (Test-Path $stageCli)) { Log "GRAY 未判定:stage 件不在位"; return $false }',
        '  if (-not (Test-Path $grayPs1)) { Log "GRAY 未判定:gray 件不在位"; return $false }',
        '  if (-not (Test-Path $trafficCli)) { Log "GRAY 未判定:traffic 件不在位"; return $false }',
        "  & $Node $trafficCli --gray-policy --stage $s --out $gp",
        "  & $Node $stageCli --decide --verdict 'pass' --current $s --contract $r",
        swapOrder ? rb : stop,
        swapOrder ? stop : rb,
        hardcode ? '  # 反例:把槽位端口/比例写死在部署环里 ⇒ 第二份策略(§0.6)' : '  $samplePolicy = $policyPath',
        hardcode ? '  $u = "http://127.0.0.1:8845/health"' : '  $u = $samplePolicy',
        '}',
      ].join('\n')
    }
    t('夹具自证:其余各格齐备的假段落 ⇒ 零缺口(防本判据恒红的假阳对照)', () => {
      const gaps = wiringGaps(fakeGate({}))
      if (gaps.length) throw new Error(`应全中,实得 ${gaps.map((g) => `${g.id}:${g.why}`).join(' | ')}`)
    })
    t('W7 反向对照:同一段里出现端口/比例字面量即判缺口(其余各格齐备也不放过)', () => {
      const gaps = wiringGaps(fakeGate({ hardcode: true }))
      if (!gaps.some((g) => g.id === 'W7')) throw new Error(`比例/端口字面量未被 W7 咬住(实得 ${JSON.stringify(gaps)})`)
      const others = gaps.filter((g) => g.id !== 'W7')
      if (others.length) throw new Error(`夹具除 W7 外应全中,实得 ${others.map((g) => g.id).join(',')}`)
    })
    t('W9 反向对照:撤灰度排在退包之后 ⇒ 只有 W9 翻红', () => {
      const gaps = wiringGaps(fakeGate({ swapOrder: true }))
      if (gaps.length !== 1 || gaps[0].id !== 'W9') throw new Error(`实得 ${JSON.stringify(gaps)}`)
    })
    t('形状自锁:一格判据没声明任何判法 ⇒ 抛(不得恒绿)', () => {
      WIRING_RULES.push({ id: 'X0', why: '故意造的空格', fix: '不该存在' })
      try {
        let hit = false
        try {
          wiringGaps(fakeGate({}))
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
  for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  console.log(`\n通过 ${checks.length - failed.length} / 失败 ${failed.length}`)
  if (failed.length) process.exitCode = 1
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args['self-test']) return selfTest()

  const file = args.file ? resolve(String(args.file)) : DEFAULT_LOOP_PS1
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    console.error(`接线未判定:${file} 读不到(${e?.message ?? e})`)
    process.exit(EXIT_UNDETERMINED)
  }
  let gaps
  try {
    gaps = wiringGaps(text)
  } catch (e) {
    console.error(`接线未判定:${e?.message ?? e}`)
    process.exit(EXIT_UNDETERMINED)
  }
  if (args.json) console.log(JSON.stringify({ file, wired: gaps.length === 0, gaps }))
  else if (gaps.length === 0) console.log(`CANARY-WIRING wired  ${file} 判据 ${WIRING_RULES.length} 格全中`)
  else {
    console.log(`CANARY-WIRING GAP  ${file} 缺 ${gaps.length}/${WIRING_RULES.length} 格:`)
    for (const g of gaps) console.log(`  - ${g.id} ${g.why}\n    修法:${g.fix}`)
  }
  process.exit(gaps.length === 0 ? EXIT_WIRED : EXIT_GAP)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
}

export const __test__ = { canaryGateBody, wiringGaps, WIRING_RULES, DEFAULT_LOOP_PS1, EXIT_WIRED, EXIT_GAP, EXIT_UNDETERMINED }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
