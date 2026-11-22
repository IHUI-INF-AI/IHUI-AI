// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「厂商账户状态不进到人告警通道」——两层耦合的镜像测试(2026-10-26 机主令)。
 *
 * 机主原话:「这些 key 我想配自然会配,别总说,也别报警」⇒ 模型厂商 api_key 缺失/失效/过期
 * (401/403)属**机主自主动作面**,不进到人告警通道,报告里也不列为「待用户操作」。
 *
 * 这条约定在本仓落成三处,本测试锁的是**三处之间的耦合**(不是各处的孤立形状):
 *   层1(代码)apps/ai-service/app/middleware/llm_metrics.py
 *        `llm_error_status()` 把 401/403 **单列成一档 'auth'**(不是 '4xx' 的一部分),
 *        判据单源在 `_AUTH_STATUS_CODES = frozenset({401, 403})`。
 *   层2(告警表达式)monitoring/prometheus/alerts.yml
 *        `LlmProviderErrorBurst` 的分子**两处**选择器都带 `status!="auth"`。
 *   层3(文案)monitoring/prometheus/alerts-ai.yml
 *        `AiLlmHighFailureRate` 的 description 不得出现「充值/补 key/重新配置」这类
 *        把收信人推去改厂商账户的出路,也不得点名已退役厂商。
 *
 * 为什么必须另写这个测试(而不是靠 promtool 用例):
 *   monitoring/prometheus/tests/llm-provider-error-burst.test.yml 喂的是**合成**指标序列
 *   (status="auth"),它验的是**规则语义**;它**验不到层1**。哪天有人把 `llm_error_status`
 *   改回 '4xx',promtool 用例照样全绿,而线上 401 会重新落进 '4xx' 桶、重新开始喂那条告警。
 *   两层的耦合此前没有任何东西在提交链上锁住 —— 这就是本文件补的那一格。
 *
 * 判据纪律:
 *   · 本仓 scripts 测试是**纯 node、零外部依赖、零网络、只读不写**;本文件不跑 python,
 *     一律**按源码形状断言**(§「不要真的去跑 python」)。
 *   · 被读文件的**根目录可注入**(IHUI_TEST_ROOT,缺省 = 仓根),变异自证靠它把判据指向
 *     临时夹具根;**真仓里的真实文件一个字节都不改**。
 *   · 取不到输入 ⇒ 判「未判定」并按红计(§0.3:没判绝不写成判过);枚举到 0 个候选不记绿。
 *   · 夹具落点 = 仓内 `.ihui-agent/tmp`(§15 项目内路径,已 gitignore);
 *     **不用 os.tmpdir()** —— 门 284 的 F2 把进程 TEMP 判红,项目内路径才是本仓认可的落点。
 *
 * 跑法:
 *   node --test scripts/tests/llm-auth-alert-coupling.test.mjs
 *   node scripts/run-script-tests.mjs -- llm-auth-alert-coupling   # 全量 runner 收录(自动发现,无白名单)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const REPO_ROOT = resolve(dirname(SELF), '../..')
/** 被读文件的「根目录」:IHUI_TEST_ROOT 可注入(缺省 = 仓根)。 */
const ROOT = resolve(process.env.IHUI_TEST_ROOT || REPO_ROOT)
/** 本轮是不是在审真仓(决定变异自证跑不跑:夹具根下再跑会自举递归)。 */
const IS_REPO_ROOT = ROOT === REPO_ROOT
/** 夹具落点:仓内 .ihui-agent/tmp(§15)。 */
const TMP_ROOT = join(REPO_ROOT, '.ihui-agent', 'tmp')

/** 被读的四份文件(相对根目录)。退役厂商名单从 model_sync.py 现读,不写死字面量。 */
const REL = {
  metrics: 'apps/ai-service/app/middleware/llm_metrics.py',
  alerts: 'monitoring/prometheus/alerts.yml',
  alertsAi: 'monitoring/prometheus/alerts-ai.yml',
  modelSync: 'apps/ai-service/app/services/model_sync.py',
}

/** 层2 的告警表达式按**指标名字面量**过滤 —— 它是告警侧的契约,改名即脱钩。 */
const PROVIDER_ERROR_METRIC = 'ihui_llm_provider_errors_total'

/**
 * 层3 的出路措辞黑名单:出现即表示「把收信人推去改厂商账户」。
 * 只认**指令式**出现:紧邻前面(≤2 字)有否定词(不需要/不用/别/勿/…)时不算出路(否则一句
 * 「厂商账户侧错误由机主自行处置,不需要重新配置」会被误判成出路 —— 误判方向是逼人改文案,
 * 那是本仓 §12e 说的恒红门方向)。
 * 否定窗口取 2 字而不是更长:「请勿忘记充值」里「充值」前面是「忘记」不含否定词 ⇒ 仍判出路;
 * 窗口放宽到 6 字会把「请勿忘记充值」误放行(漏判方向更危险)。
 */
const ACTION_WORDS = ['充值', '补 key', '补key', '重新配置', '重新申请', '续费']
const NEGATIONS = ['不', '无需', '不用', '别', '勿', '非', '禁']

/**
 * 文案层判据的**射程**:全部 LLM 相关告警规则(不止一条)。
 * 逐条列明而不是用前缀通配:通配会把将来新增的无关规则一并纳入射程,
 * 让「文案不许出现出路措辞」变成一把越用越宽的钝刀。
 */
const WORDING_RULES = [
  { file: 'alerts', name: 'LlmProviderUnhealthy' },
  { file: 'alerts', name: 'LlmProviderErrorBurst' },
  { file: 'alerts', name: 'LlmTokenCostSurge' },
  { file: 'alertsAi', name: 'AiLlmHighFailureRate' },
]

// ──────────── 判据(纯函数:只读不写) ────────────

/** 取一条规则块:`- alert: NAME` 到下一条 `- alert:` 之前。读不到 ⇒ null。 */
function ruleBlockOf(text, ruleName) {
  const lines = String(text).split(/\r?\n/)
  const start = lines.findIndex((l) => new RegExp(`^\\s*-\\s*alert:\\s*${ruleName}\\s*$`).test(l))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*-\s*alert:/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

/** 取规则块里 expr 的值(`expr: |` 之后的缩进块);读到 for/labels/annotations 为止。 */
function exprOf(block) {
  const lines = block.split(/\r?\n/)
  const i = lines.findIndex((l) => /^\s*expr:/.test(l))
  if (i < 0) return null
  const body = []
  for (let k = i + 1; k < lines.length; k++) {
    if (/^\s*(for|keep_firing_for|labels|annotations)\s*:/.test(lines[k])) break
    body.push(lines[k])
  }
  return body.join('\n')
}

/** 取规则块里 description 的值(单行引号串)。 */
function descriptionOf(block) {
  const lines = block.split(/\r?\n/)
  const i = lines.findIndex((l) => /^\s*description:/.test(l))
  if (i < 0) return null
  let raw = lines[i].replace(/^\s*description:\s*/, '').trim()
  if (
    raw.length >= 2 &&
    ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"')))
  ) {
    raw = raw.slice(1, -1)
  }
  return raw
}

/** 读 `_AUTH_STATUS_CODES` 的成员;读不到 ⇒ null(未判定,不得当成空集合放行)。 */
function authStatusCodesOf(py) {
  const m = /_AUTH_STATUS_CODES[^=\n]*=\s*frozenset\(\s*\{([^}]*)\}\s*\)/.exec(py)
  if (!m) return null
  return [...m[1].matchAll(/\d+/g)].map((x) => Number(x[0]))
}

/** 取 `llm_error_status` 的函数体(到下一个顶层 def/class 为止);读不到 ⇒ null。 */
function llmErrorStatusBody(py) {
  const m = /^def\s+llm_error_status\s*\([^)]*\)\s*->\s*[^:]+:/m.exec(py)
  if (!m) return null
  const after = py.slice(m.index + m[0].length)
  const next = /^(?:def|class)\s/m.exec(after)
  return after.slice(0, next ? next.index : after.length)
}

/** 埋点侧声明的指标名(告警侧必须用同一个名字,否则过滤器打在不存在的指标上)。 */
function providerErrorMetricOf(py) {
  const m = /llm_provider_errors_total\s*=\s*Counter\(\s*'([^']+)'/.exec(py)
  return m ? m[1] : null
}

/** 取 `RETIRED_PROVIDERS` 的键(商务性永久退役的厂商);读不到 ⇒ null(未判定)。 */
function retiredProvidersOf(py) {
  const m = /RETIRED_PROVIDERS[^{]*\{/.exec(py)
  if (!m) return null
  const rest = py.slice(m.index + m[0].length)
  const end = rest.indexOf('}')
  const block = end < 0 ? rest : rest.slice(0, end)
  return [...block.matchAll(/^\s*"([A-Za-z0-9_.-]+)"\s*:\s*\(/gm)].map((x) => x[1])
}

/** text 里是否出现「指令式」的出路措辞(否定语境不算)。 */
function actionWordHits(text, word) {
  const hits = []
  let idx = text.indexOf(word)
  while (idx >= 0) {
    const before = text.slice(Math.max(0, idx - 2), idx)
    if (!NEGATIONS.some((n) => before.includes(n))) hits.push(word)
    idx = text.indexOf(word, idx + word.length)
  }
  return hits
}

/**
 * 判据主体:对给定根目录判三层耦合,返回 {violations, facts}。
 * violations 每条带 layer(读层/code/alert/wording/coupling)+ why(为什么红)。
 */
export function judge(root = ROOT) {
  const violations = []
  const facts = {}
  const texts = {}
  for (const [key, rel] of Object.entries(REL)) {
    try {
      texts[key] = readFileSync(join(root, ...rel.split('/')), 'utf8')
    } catch (e) {
      violations.push({
        layer: 'read',
        why: `读不到 ${rel}(${e.code || e.message})⇒ 未判定,按红计`,
      })
    }
  }
  if (violations.length) return { violations, facts }

  // ── 层1:代码侧判据(单源在 llm_error_status) ──
  const py = texts.metrics
  const codes = authStatusCodesOf(py)
  if (codes === null) {
    violations.push({ layer: 'code', why: '读不到 _AUTH_STATUS_CODES 的定义(未判定)' })
  } else {
    facts.authStatusCodes = codes
    for (const c of [401, 403]) {
      if (!codes.includes(c)) {
        violations.push({
          layer: 'code',
          why: `_AUTH_STATUS_CODES 缺 ${c}(现读 ${JSON.stringify(codes)})—— 厂商鉴权类会掉回 '4xx' 桶,重新开始喂那条告警`,
        })
      }
    }
  }
  const body = llmErrorStatusBody(py)
  if (body === null) {
    violations.push({ layer: 'code', why: '读不到 llm_error_status 的定义(未判定)' })
  } else {
    const authTest = /status\s+in\s+_AUTH_STATUS_CODES/.exec(body)
    const range4xx = /400\s*<=\s*status\s*<\s*500/.exec(body)
    if (!authTest) {
      violations.push({
        layer: 'code',
        why: "llm_error_status 里没有 `status in _AUTH_STATUS_CODES` 判定(未判定)",
      })
    }
    if (!range4xx) {
      violations.push({
        layer: 'code',
        why: 'llm_error_status 里读不到 4xx 码段判定(未判定)',
      })
    }
    if (authTest && range4xx) {
      if (authTest.index > range4xx.index) {
        violations.push({
          layer: 'code',
          why: "llm_error_status 把 4xx 码段判在 _AUTH_STATUS_CODES 之前 ⇒ 401/403 会先落进 '4xx' 桶",
        })
      }
      const tail = body.slice(authTest.index)
      const nextIf = /\n\s*if\b/.exec(tail)
      const branchBody = nextIf ? tail.slice(0, nextIf.index) : tail
      const ret = /return\s+'([^']+)'/.exec(branchBody)
      if (!ret) {
        violations.push({
          layer: 'code',
          why: "llm_error_status 命中 _AUTH_STATUS_CODES 的分支没有 return 'auth'",
        })
      } else {
        facts.authLabel = ret[1]
        if (ret[1] !== 'auth') {
          violations.push({
            layer: 'code',
            why: `llm_error_status 的鉴权档标签是 '${ret[1]}',不是 'auth'`,
          })
        }
      }
      if (/return\s+'4xx'/.test(body.slice(0, authTest.index))) {
        violations.push({
          layer: 'code',
          why: "llm_error_status 在 auth 判定之前就 return '4xx'",
        })
      }
    }
  }
  const metricName = providerErrorMetricOf(py)
  if (!metricName) {
    violations.push({ layer: 'code', why: '读不到 provider 错误计数器的埋点声明(未判定)' })
  } else {
    facts.metricName = metricName
    if (metricName !== PROVIDER_ERROR_METRIC) {
      violations.push({
        layer: 'coupling',
        why: `埋点指标名是 '${metricName}',而告警侧按 '${PROVIDER_ERROR_METRIC}' 过滤 ⇒ 两层脱钩`,
      })
    }
  }

  // ── 层2:告警表达式(alerts.yml / LlmProviderErrorBurst) ──
  const block = ruleBlockOf(texts.alerts, 'LlmProviderErrorBurst')
  if (!block) {
    violations.push({ layer: 'alert', why: 'alerts.yml 里读不到 LlmProviderErrorBurst 规则(未判定)' })
  } else {
    const expr = exprOf(block)
    if (expr === null) {
      violations.push({ layer: 'alert', why: 'LlmProviderErrorBurst 读不到 expr(未判定)' })
    } else {
      facts.expr = expr
      const selectors = [...expr.matchAll(/ihui_llm_provider_errors_total\{([^}]*)\}/g)].map(
        (m) => m[1],
      )
      if (selectors.length < 2) {
        violations.push({
          layer: 'alert',
          why: `LlmProviderErrorBurst 里 ${PROVIDER_ERROR_METRIC} 只出现 ${selectors.length} 处(分子与占比两处都必须带 status!="auth" 过滤)`,
        })
      }
      selectors.forEach((sel, i) => {
        if (!/status\s*!=\s*"auth"/.test(sel)) {
          violations.push({
            layer: 'alert',
            why: `LlmProviderErrorBurst 第 ${i + 1} 处 ${PROVIDER_ERROR_METRIC} 选择器缺 status!="auth"(现读 {${sel}})⇒ 厂商鉴权类会重新落进这条告警`,
          })
        }
      })
      // 耦合:告警侧排除的标签必须与代码侧产出的标签逐字相同。
      const excluded = [...new Set([...expr.matchAll(/status\s*!=\s*"([^"]+)"/g)].map((m) => m[1]))]
      if (facts.authLabel && !excluded.includes(facts.authLabel)) {
        violations.push({
          layer: 'coupling',
          why: `代码侧产出的鉴权标签是 '${facts.authLabel}',而 LlmProviderErrorBurst 排除的是 ${JSON.stringify(excluded)} ⇒ 两层脱钩,厂商账户状态会重新进到人告警通道`,
        })
      }
    }
  }

  // ── 层3:文案层(全部 LLM 告警规则的 description) ──
  // 射程 2026-10-26 扩到 LlmProviderUnhealthy / LlmProviderErrorBurst / LlmTokenCostSurge:
  // 「厂商账户状态不进到人通道」是**告警文案整体**的约定,不是单条规则的属性 ——
  // 只判一条,下一条新告警照样能把收信人推去改厂商账户。
  const retired = retiredProvidersOf(texts.modelSync)
  if (retired === null) {
    violations.push({ layer: 'wording', why: 'model_sync.py 里读不到 RETIRED_PROVIDERS(未判定)' })
  } else if (retired.length === 0) {
    violations.push({
      layer: 'wording',
      why: 'RETIRED_PROVIDERS 解析出 0 个厂商(解析失效 ⇒ 退役厂商名这一格会恒真)',
    })
  } else {
    facts.retiredProviders = retired
  }
  facts.descriptions = {}
  for (const { file, name } of WORDING_RULES) {
    const block = ruleBlockOf(texts[file], name)
    if (!block) {
      violations.push({ layer: 'wording', why: `${file} 里读不到 ${name} 规则(未判定)` })
      continue
    }
    const desc = descriptionOf(block)
    if (desc === null) {
      violations.push({ layer: 'wording', why: `${name} 读不到 description(未判定)` })
      continue
    }
    facts.descriptions[name] = desc
    for (const word of ACTION_WORDS) {
      const hits = actionWordHits(desc, word)
      if (hits.length) {
        violations.push({
          layer: 'wording',
          why: `${name} 的 description 含出路措辞「${hits[0]}」—— 厂商账户状态不进到人通道,文案不得把收信人推去改厂商账户`,
        })
      }
    }
    if (facts.retiredProviders) {
      for (const p of facts.retiredProviders) {
        if (desc.toLowerCase().includes(p.toLowerCase())) {
          violations.push({
            layer: 'wording',
            why: `${name} 的 description 点名了已退役厂商「${p}」`,
          })
        }
      }
    }
  }

  return { violations, facts }
}

// ──────────── 真仓现读(判据正读面) ────────────

const verdict = judge(ROOT)
const ofLayer = (layer) => verdict.violations.filter((v) => v.layer === layer)
const fmt = (vs) => (vs.length ? vs.map((v) => `[${v.layer}] ${v.why}`).join('\n') : '(无)')

test('C1 代码层:401/403 必须单列为 auth(判据单源在 llm_error_status,不是 4xx 的一部分)', () => {
  assert.deepEqual(ofLayer('code'), [], `代码层判据被破坏:\n${fmt(ofLayer('code'))}`)
})

test('C2 告警层:LlmProviderErrorBurst 的两处选择器都必须带 status!="auth"', () => {
  assert.deepEqual(ofLayer('alert'), [], `告警层判据被破坏:\n${fmt(ofLayer('alert'))}`)
})

test('C3 文案层:全部 LLM 告警规则的 description 无出路措辞、无退役厂商名', () => {
  assert.deepEqual(ofLayer('wording'), [], `文案层判据被破坏:\n${fmt(ofLayer('wording'))}`)
})

test('C7 射程覆盖自证:射程里的每条规则都真读到了 description(不许有规则静默跳过)', () => {
  const missing = WORDING_RULES.filter((r) => !verdict.facts.descriptions?.[r.name]).map(
    (r) => r.name,
  )
  assert.deepEqual(missing, [], `这些规则没读到 description ⇒ 文案层射程有空洞:${JSON.stringify(missing)}`)
})

test('C4 耦合层:代码侧产出的标签/指标名与告警表达式逐字对得上', () => {
  assert.deepEqual(ofLayer('coupling'), [], `两层脱钩:\n${fmt(ofLayer('coupling'))}`)
})

test('C5 整仓现读:三层一起判绿(厂商账户状态不进到人告警通道)', () => {
  assert.deepEqual(verdict.violations, [], `被审面 ${ROOT} 有违规:\n${fmt(verdict.violations)}`)
})

test('C6 取料面自证:退役厂商名单是从 model_sync.py 现读的(不是写死的字面量)', () => {
  assert.ok(Array.isArray(verdict.facts.retiredProviders), '退役厂商名单必须现读')
  assert.ok(verdict.facts.retiredProviders.length > 0, '现读出 0 个退役厂商 ⇒ 那一格是恒真的')
  assert.equal(verdict.facts.authLabel, 'auth', `鉴权档标签现读:${verdict.facts.authLabel}`)
  assert.equal(verdict.facts.metricName, PROVIDER_ERROR_METRIC)
})

// ──────────── 变异自证(临时夹具根;真仓文件一个字节都不改) ────────────

/** 造一份夹具根:复制四份真文件,然后按需变异。 */
function makeFixture(mutate) {
  mkdirSync(TMP_ROOT, { recursive: true })
  const dir = mkdtempSync(join(TMP_ROOT, 'llm-auth-coupling-'))
  for (const rel of Object.values(REL)) {
    const dest = join(dir, ...rel.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, readFileSync(join(REPO_ROOT, ...rel.split('/')), 'utf8'))
  }
  if (mutate) mutate(dir)
  return dir
}

function fixtureRead(dir, rel) {
  return readFileSync(join(dir, ...rel.split('/')), 'utf8')
}

function fixtureWrite(dir, rel, text) {
  writeFileSync(join(dir, ...rel.split('/')), text)
}

/** 在夹具里改某条规则的 description 行(只动那一行;换行符原样保留)。 */
function mutateRuleDescription(text, ruleName, fn) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => new RegExp(`^\\s*-\\s*alert:\\s*${ruleName}\\s*$`).test(l))
  if (start < 0) throw new Error(`读不到规则 ${ruleName}`)
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*-\s*alert:/.test(lines[i])) {
      end = i
      break
    }
  }
  const di = lines.findIndex((l, i) => i > start && i < end && /^\s*description:/.test(l))
  if (di < 0) throw new Error(`规则 ${ruleName} 里读不到 description 行`)
  lines[di] = fn(lines[di])
  return lines.join('\n')
}

/** 夹具清理:删自己刚造的那一个目录(失败只告警,不推翻判据结论)。 */
function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch (e) {
    console.warn(`⚠ 夹具未清理:${dir} —— ${e && e.message ? e.message : e}`)
  }
}

/** 用注入根跑本文件自己(子进程),看它到底红不红。 */
function runSelfAgainst(root) {
  const env = { ...process.env, IHUI_TEST_ROOT: root }
  // 剥掉 NODE_TEST_CONTEXT:被别的 runner 调起时它会继承下来,嵌套 `node --test` 就不再输出 TAP 计数。
  delete env.NODE_TEST_CONTEXT
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', SELF], {
    cwd: REPO_ROOT,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
  })
  return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
}

const MUTATION_SKIP = IS_REPO_ROOT
  ? false
  : '变异自证只在真仓根下跑(本轮被审面是注入的夹具根,再跑会自举递归)'

test('M0 反向对照:同一夹具机制、内容不改 ⇒ 子进程必须绿(红是变异带来的,不是装置本身恒红)', { skip: MUTATION_SKIP }, () => {
  const dir = makeFixture(null)
  try {
    const r = runSelfAgainst(dir)
    assert.ok(r.status !== null, `子进程没跑起来\n${r.out}`)
    assert.equal(r.status, 0, `未变异的夹具必须绿\n${r.out}`)
  } finally {
    cleanup(dir)
  }
})

test('M1 变异①:alerts.yml 分子少一处 status!="auth" ⇒ 子进程必须红', { skip: MUTATION_SKIP }, () => {
  const dir = makeFixture((d) => {
    const rel = REL.alerts
    const before = fixtureRead(d, rel)
    const after = before.replace(
      `${PROVIDER_ERROR_METRIC}{job="ai-service",status!="auth"}`,
      `${PROVIDER_ERROR_METRIC}{job="ai-service"}`,
    )
    if (after === before) throw new Error('变异①没改成(锚点字面量漂了)')
    fixtureWrite(d, rel, after)
  })
  try {
    const r = runSelfAgainst(dir)
    assert.ok(r.status !== null, `子进程没跑起来\n${r.out}`)
    assert.notEqual(r.status, 0, `少一处过滤必须红\n${r.out}`)
    assert.match(r.out, /缺 status!="auth"/, `红的原因必须点名缺失的那处过滤\n${r.out}`)
  } finally {
    cleanup(dir)
  }
})

test('M2 变异②:_AUTH_STATUS_CODES 里删掉 401 ⇒ 子进程必须红', { skip: MUTATION_SKIP }, () => {
  const dir = makeFixture((d) => {
    const rel = REL.metrics
    const before = fixtureRead(d, rel)
    const after = before.replace('frozenset({401, 403})', 'frozenset({403})')
    if (after === before) throw new Error('变异②没改成(锚点字面量漂了)')
    fixtureWrite(d, rel, after)
  })
  try {
    const r = runSelfAgainst(dir)
    assert.ok(r.status !== null, `子进程没跑起来\n${r.out}`)
    assert.notEqual(r.status, 0, `401 不再单列必须红\n${r.out}`)
    assert.match(r.out, /_AUTH_STATUS_CODES 缺 401/, `红的原因必须点名丢掉的 401\n${r.out}`)
  } finally {
    cleanup(dir)
  }
})

test('M3 变异③:AiLlmHighFailureRate 的 description 里塞回「充值」⇒ 子进程必须红', { skip: MUTATION_SKIP }, () => {
  const dir = makeFixture((d) => {
    const rel = REL.alertsAi
    const before = fixtureRead(d, rel)
    const after = mutateRuleDescription(before, 'AiLlmHighFailureRate', (line) => {
      const next = line.replace('别先改代码。', '别先改代码。若失败请先充值。')
      if (next === line) throw new Error('变异③没改成(锚点字面量漂了)')
      return next
    })
    fixtureWrite(d, rel, after)
  })
  try {
    const r = runSelfAgainst(dir)
    assert.ok(r.status !== null, `子进程没跑起来\n${r.out}`)
    assert.notEqual(r.status, 0, `文案塞回出路措辞必须红\n${r.out}`)
    assert.match(r.out, /含出路措辞/, `红的原因必须点名出路措辞\n${r.out}`)
  } finally {
    cleanup(dir)
  }
})

test('M4 变异④:把 auth 判定挪到 4xx 码段之后 ⇒ 子进程必须红(顺序也是判据)', { skip: MUTATION_SKIP }, () => {
  const dir = makeFixture((d) => {
    const rel = REL.metrics
    const before = fixtureRead(d, rel)
    const re = /([ \t]*)if status in _AUTH_STATUS_CODES:(\r?\n)([ \t]*)return 'auth'\2([ \t]*)if 400 <= status < 500:(\r?\n)([ \t]*)return '4xx'/
    const m = re.exec(before)
    if (!m) throw new Error('变异④没改成(源码形状漂了)')
    const [, i1, eol, i2, i3, , i4] = m
    const after = before.replace(
      m[0],
      `${i3}if 400 <= status < 500:${eol}${i4}return '4xx'${eol}${i1}if status in _AUTH_STATUS_CODES:${eol}${i2}return 'auth'`,
    )
    if (after === before) throw new Error('变异④没改成')
    fixtureWrite(d, rel, after)
  })
  try {
    const r = runSelfAgainst(dir)
    assert.ok(r.status !== null, `子进程没跑起来\n${r.out}`)
    assert.notEqual(r.status, 0, `auth 判定排在 4xx 之后必须红\n${r.out}`)
    assert.match(r.out, /4xx 码段判在/, `红的原因必须点名判定顺序\n${r.out}`)
  } finally {
    cleanup(dir)
  }
})

test('M5 变异⑤:LlmProviderUnhealthy 的 description 里塞回「补 key」⇒ 子进程必须红(扩射程才抓得住)', { skip: MUTATION_SKIP }, () => {
  const dir = makeFixture((d) => {
    const rel = REL.alerts
    const before = fixtureRead(d, rel)
    const after = mutateRuleDescription(before, 'LlmProviderUnhealthy', (line) => {
      const next = line.replace('厂商账户恢复后自动恢复', '补 key 后自动恢复')
      if (next === line) throw new Error('变异⑤没改成(锚点字面量漂了)')
      return next
    })
    fixtureWrite(d, rel, after)
  })
  try {
    const r = runSelfAgainst(dir)
    assert.ok(r.status !== null, `子进程没跑起来\n${r.out}`)
    assert.notEqual(r.status, 0, `LlmProviderUnhealthy 文案塞回 key 出路必须红\n${r.out}`)
    assert.match(r.out, /含出路措辞/, `红的原因必须点名出路措辞\n${r.out}`)
  } finally {
    cleanup(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
