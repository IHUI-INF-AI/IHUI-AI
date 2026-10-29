#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-relay-capacity-zero.mjs —— 中转号池「容量归零」只读哨兵(2026-10-26 立)
 *
 * 立因(不是"再加一个面板",是一件事实测没人量):
 *   key 池早就有按 provider 的可调度聚合(`ihui_relay_key_pool_schedulable_keys`),
 *   账号池**没有同族聚合**;而两处回退点(`relay-upstream-forwarder` 的 key 池候选为 0、
 *   `relay-account-forwarder` 的 `catch { return null }`)此前一行日志、一个计数都没有
 *   ⇒ "healthy 号 = 0" 与"上游一切正常"在观面上同形(AGENTS §0.9:判据没被真跑到 = 没有)。
 *   本尺子把这件事变成一条能跑、能到人、能复现的读数。
 *
 * 判据(两型,共用 stats 层那把尺子):
 *   S1 provider 容量归零:某 provider 在该池里 **有 is_enabled=true 的行,但按
 *      `isRelayPoolRowSchedulable` 折叠出来的可调度数 = 0**(号都在、全被临时摘除)⇒ breach。
 *      两池都扫(账号池 + key 池),因为"回落链"是 key 池 → 账号池 → ai-service 一条链。
 *   S2 整池归零:账号池 0 行,或有行但 `enabledRows` 全 0(整条腿不存在)⇒ breach。
 *      唯一合法暂存 = 白名单:`IHUI_RELAY_CAPACITY_ALLOW_EMPTY_POOL="<≥10 字理由>"`
 *      (本站确实不用账号池);理由不足 10 字 ⇒ **视同没登记**,照旧 breach
 *      —— 豁免必须"验过才免"(§0.7),它不是白名单化的入口(§0.10)。
 *
 * 三态(退出码恒定三档,§0.3「没判」绝不写成「判过」):
 *   ok        ⇒ exit 0:S1/S2 皆未命中(报逐 provider 读数)
 *   breach    ⇒ exit 1:命中任一型,逐条点名 provider + enabled/schedulable + 下一步
 *   unjudged  ⇒ exit 2:**显式「未判定」并点名原因**(psql 取不到 / DSN 取不到 /
 *              查询失败或超时 / 哨兵行缺失(输出被截断或表不存在)/ 判据抽取失败 /
 *              DSN 不指向本机)。任何一支都**既不冒绿也不冒红**,更不拿 0 冒充"池子空=健康"。
 *
 * 判据单源(§0.6):可调度与容量折叠**不在本文件重写一遍**。运行期把
 * `apps/api/src/services/relay-pool-stats-service.ts` 里那四个函数(`isRelayPoolRowSchedulable`
 * / `foldRelayPoolCapacity` / `zeroCapacityProviders` / `poolHasNoEnabledRows`)按锚点逐段
 * 取出、用本仓自带的 typescript 剥掉类型注解后求值 —— 跑的就是生产实现本身;源文件漂移
 * (锚点找不到 / 括号不配平 / 抽出来不是函数)一律落 unjudged,不猜、不复制第二份。
 *
 * 差值档(2026-10-26 补,照 `check-gate-rot --ratchet` 同格,治"存量归零天天喊、真新增反被淹"):
 *   `--ratchet [--baseline <file>]` 与基线做集合差,**只把相对基线新增的 breach 当失败喊人**
 *   (存量只报数)。breach 的稳定身份 = `kind|providerCode`(刻意不含 detail/读数——那会抖)。
 *   基线读不到/形状坏 ⇒ **不回落成"空基线=全 known=静默放行"**,而是把当下每条都算新增
 *   (失效方向=多喊一次,§0.10),并点名 `baseline=undetermined`。基线只能由人看读数后
 *   `--write-baseline` 显式认账(自动追认会把新增 breach 第一次就吞掉);未判定档拒绝写基线。
 *
 * 密码与落点纪律:DSN 只经 `PGPASSWORD` 进 psql 子进程,任何输出不回显 DSN/凭据;
 * 判据路径**只读**、零写盘(唯一写路径=人显式 `--write-baseline` 认账,落 `.ihui-agent/state/`);
 * `psql` 派生带 `windowsHide` + 显式 stdio(§5f/§12g)。
 * 生产库护栏:解析出的 DSN host 不在本机/私网白名单内 ⇒ unjudged(本尺子为本机开发库而写)。
 *
 * 接线状态(2026-10-26 已装车,枚 5015c3a422 + 差值档同批):派发点 = `scripts/git-guardian.mjs`
 * 的巡检轮 `dispatchRelayCapacity`(main tick 与 daemon tick 各一处),默认 5 分钟节流
 * (`IHUI_RELAY_CAPACITY_INTERVAL_MS` 可覆盖),跑的就是本器的 `--json --ratchet` 面;
 * 喊人走既有通知层 `notifyGuardRed` 唯一出口(§5e,禁自拼 SMTP),
 * 去重身份 = `relay-capacity-zero:new + 新增条数`(不按会抖动的 provider 清单,§5e-3)。
 * 不进提交链:它判的是机器/库状态,与提交内容无关 —— 挂成提交门就是 §12e 的恒红门。
 *
 * 用法:
 *   node scripts/check-relay-capacity-zero.mjs [--json] [--self-test] [--env-file <path>]
 *   node scripts/check-relay-capacity-zero.mjs --json --ratchet [--baseline <file>]
 *   node scripts/check-relay-capacity-zero.mjs --write-baseline   # 人看读数后显式认账存量
 * 退出码:全量档 0=ok / 1=breach / 2=未判定;差值档 0=known|clean / 1=new / 2=未判定。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { psqlArgsFromDsn, readDsn } from './check-db-migration-gaps.mjs'
import { locatePsqlClient } from './lib/psql-client-locate.mjs'
import { makeRegistrar } from './lib/selftest-registrant.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 判据的唯一来源文件(相对仓库根);锚点在它里面逐字存在,否则本尺子当场未判定。 */
const STATS_TS_REL = join('apps', 'api', 'src', 'services', 'relay-pool-stats-service.ts')
const REQUIRED_JUDGES = [
  'isRelayPoolRowSchedulable',
  'foldRelayPoolCapacity',
  'zeroCapacityProviders',
  'poolHasNoEnabledRows',
]
const ALLOW_EMPTY_ENV = 'IHUI_RELAY_CAPACITY_ALLOW_EMPTY_POOL'
/** 差值档基线(机器态,与巡检节流戳同目录;照 check-gate-rot 的 `.ihui-agent/state/` 落点)。 */
const DEFAULT_BASELINE = join(REPO, '.ihui-agent', 'state', 'relay-capacity-baseline.json')
const SCHEMA_VERSION = 1
/** 白名单理由下界(与 all-checks-runner 那档豁免一致:短到能随手填 = 不是豁免)。 */
const MIN_REASON_LEN = 10
/** 哨兵行标记:证明这次查询真跑完了(两表都 0 行时,输出本身只有这一行)。 */
const SENTINEL = 'IHUI_ROWS_END'
/** 本机/私网 DSN 主机名(本尺子只为本机开发库而写)。 */
const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'host.docker.internal',
  'localhost.localdomain',
])

/** 该 DSN 主机是否算"本机"(私网 10/172.16-31/192.168 也算,本机 dev 常挂内网段)。 */
export function isLocalHost(hostname) {
  const h = String(hostname ?? '')
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (LOCAL_HOSTS.has(h)) return true
  if (/^127\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  return false
}

/**
 * 从 `export function NAME(` 起做括号配平,取整个函数声明的源码段。
 * 字符串('、"、`)与两种注释里的括号一律不算(注释里有中文括号是常态)。
 * 配不上 ⇒ -1(调用方据此落未判定,绝不"凑一段能跑的")。
 */
export function sliceTopLevelFunction(src, startIdx) {
  const text = String(src ?? '')
  if (startIdx < 0 || startIdx >= text.length) return -1
  let i = text.indexOf('(', startIdx)
  if (i < 0) return -1
  // 先跨过参数表的圆括号
  let paren = 0
  for (; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') paren++
    else if (ch === ')') {
      paren--
      if (paren === 0) break
    }
  }
  if (paren !== 0) return -1
  const bodyOpen = text.indexOf('{', i + 1)
  if (bodyOpen < 0) return -1
  let depth = 0
  for (let j = bodyOpen; j < text.length; j++) {
    const c = text[j]
    const next = text[j + 1]
    if (c === '/' && next === '/') {
      j = text.indexOf('\n', j)
      if (j < 0) return -1
      continue
    }
    if (c === '/' && next === '*') {
      j = text.indexOf('*/', j + 2)
      if (j < 0) return -1
      j += 1
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const close = text.indexOf(c, j + 1)
      if (close < 0) return -1
      j = close
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return j
    }
  }
  return -1
}

/**
 * 装载生产判据(读源文件 → 逐函数取段 → typescript 剥类型 → data URL 求值)。
 * 任何一步不成立都返回 `{ ok:false, why }` ⇒ 调用方落 unjudged。
 */
export async function loadPoolJudges({ repo = REPO } = {}) {
  let src
  try {
    src = readFileSync(join(repo, STATS_TS_REL), 'utf8')
  } catch (e) {
    return { ok: false, why: `读不到判据源文件 ${STATS_TS_REL}(${String(e?.code ?? e)})` }
  }
  const parts = []
  for (const name of REQUIRED_JUDGES) {
    const anchor = `export function ${name}(`
    const at = src.indexOf(anchor)
    if (at < 0) return { ok: false, why: `${STATS_TS_REL} 里找不到锚点「${anchor}」⇒ 判据已漂移` }
    const end = sliceTopLevelFunction(src, at)
    if (end < 0) return { ok: false, why: `${name} 的函数体括号不配平 ⇒ 抽不出可信的一段` }
    parts.push(src.slice(at, end + 1))
  }
  let js = ''
  try {
    js = ts.transpileModule(parts.join('\n\n'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText
  } catch (e) {
    return { ok: false, why: `剥类型失败:${String(e?.message ?? e)}` }
  }
  let mod
  try {
    mod = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`)
  } catch (e) {
    return { ok: false, why: `抽出的判据无法求值:${String(e?.message ?? e)}` }
  }
  const missing = REQUIRED_JUDGES.filter((n) => typeof mod[n] !== 'function')
  if (missing.length > 0) return { ok: false, why: `抽出的段里这些不是函数:${missing.join(',')}` }
  return { ok: true, fns: mod }
}

/** 一条 SQL 把两张池表 + 一行哨兵一起取回(-A -t -F '\t' 出裸行)。 */
export function buildSql() {
  const cols = (table) =>
    `select '${table === 'ai_relay_account_pool' ? 'account' : 'key'}'::text as pool, ` +
    `coalesce(nullif(trim(provider_code), ''), 'unknown') as provider, ` +
    `coalesce(is_enabled, false)::text as en, ` +
    `coalesce(temp_unschedulable, false)::text as tu from ${table}`
  return (
    `${cols('ai_relay_account_pool')}\nunion all\n${cols('ai_relay_key_pool')}\nunion all\n` +
    `select 'sentinel'::text, '${SENTINEL}', ` +
    `(select count(*)::text from ai_relay_account_pool), ` +
    `(select count(*)::text from ai_relay_key_pool);`
  )
}

/**
 * 解析 psql 的制表符裸行。布尔有两种拼法都必须吃:SQL 里写了 `::text`,PG 出的是
 * `true`/`false`,而 psql 的原始 bool 显示是 `t`/`f` —— 只认 `'t'` 的话,
 * `Boolean('false')` 又是 true,于是"停用号"被读成"启用号"、容量归零永远读不出来
 * (本文件写完第一次真跑就撞上这一脚,已按两种拼法收口并在自检里钉住)。
 * 未识别的行一律忽略(不猜);哨兵行缺失由调用方判未判定。
 */
export function parsePoolRows(stdout) {
  const toBool = (raw) => {
    const v = String(raw ?? '')
      .trim()
      .toLowerCase()
    return v === 't' || v === 'true'
  }
  const out = { account: [], key: [], sentinel: null }
  for (const line of String(stdout ?? '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const cols = trimmed.split('\t')
    if (cols.length < 4) continue
    const [pool, provider, en, tu] = cols
    if (pool === 'sentinel') {
      if ((provider ?? '').trim() === SENTINEL) {
        const accountCount = Number.parseInt(String(en ?? '').trim(), 10)
        const keyCount = Number.parseInt(String(tu ?? '').trim(), 10)
        if (Number.isFinite(accountCount) && Number.isFinite(keyCount)) {
          out.sentinel = { accountCount, keyCount }
        }
      }
      continue
    }
    if (pool !== 'account' && pool !== 'key') continue
    const row = {
      providerCode: (provider ?? 'unknown').trim() || 'unknown',
      isEnabled: toBool(en),
      tempUnschedulable: toBool(tu),
    }
    if (pool === 'account') out.account.push(row)
    else out.key.push(row)
  }
  return out
}

export function runPsql(psql, dsn, extra, { timeout = 60_000 } = {}) {
  const p = psqlArgsFromDsn(dsn)
  if (!p.ok) return { ok: false, why: p.why }
  const r = spawnSync(psql, [...p.args, ...extra], {
    encoding: 'utf8',
    timeout,
    windowsHide: true, // §5f:不得因钩子省略逐点参数
    stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生 git/子进程必须显式接管 stdio
    env: p.env,
    maxBuffer: 1 << 22,
  })
  if (r.error) return { ok: false, why: String(r.error.code ?? r.error.message) }
  if (r.status !== 0) {
    return {
      ok: false,
      why: `psql exit=${r.status}: ${String(r.stderr ?? '')
        .trim()
        .slice(0, 200)}`,
    }
  }
  return { ok: true, stdout: String(r.stdout ?? '') }
}

/** 逐 provider 读数串(account/key 两池),给输出与到人正文用。 */
function fmtCap(cap) {
  return cap
    .map(
      (c) =>
        `${c.providerCode} total=${c.totalRows}/enabled=${c.enabledRows}/schedulable=${c.schedulableRows}`,
    )
    .join(' ')
}

/**
 * 纯判据(镜像测试与 --self-test 直接调它,输入全由调用方注入)。
 * `judges` / `rows` / `sentinel` 任一取不到 ⇒ unjudged;绝不返回 ok。
 */
export function judgeCapacity({ judges, accountRows, keyRows, sentinel, allowEmptyReason }) {
  if (!judges || judges.ok !== true) {
    return {
      state: 'unjudged',
      reason: `判据未装载(${judges?.why ?? '未调用 loadPoolJudges'})⇒ 未判定`,
      breaches: [],
    }
  }
  if (!Array.isArray(accountRows) || !Array.isArray(keyRows) || !sentinel) {
    return {
      state: 'unjudged',
      reason: '池表读数取不到(查询失败或输入缺失)⇒ 未判定,不拿 0 冒充"池子空也健康"',
      breaches: [],
    }
  }
  if (
    !Number.isInteger(sentinel.accountCount) ||
    !Number.isInteger(sentinel.keyCount) ||
    sentinel.accountCount < 0 ||
    sentinel.keyCount < 0
  ) {
    return {
      state: 'unjudged',
      reason: `哨兵行数值不合法(${JSON.stringify(sentinel)})⇒ 输出被截断,未判定`,
      breaches: [],
    }
  }
  // 表里行数与逐行读到的条数必须相等:少一条就是"输出被切/行解析漏了",
  // 这种时候宁可未判定,也不能把没读到的号算成"容量归零"或"一切正常"。
  if (accountRows.length !== sentinel.accountCount || keyRows.length !== sentinel.keyCount) {
    return {
      state: 'unjudged',
      reason:
        `读数与表行数不符(account:${accountRows.length}/${sentinel.accountCount} ` +
        `key:${keyRows.length}/${sentinel.keyCount})⇒ 未判定`,
      breaches: [],
    }
  }
  const { foldRelayPoolCapacity, zeroCapacityProviders, poolHasNoEnabledRows } = judges.fns
  const accountCap = foldRelayPoolCapacity(accountRows)
  const keyCap = foldRelayPoolCapacity(keyRows)
  const breaches = []
  const notes = []

  /** 按 provider 定制的「凭据死亡复活出口」(§5e-1 收信人要能当场做一件事;§0.8 出路必须真跑得通):
   *  客户端为主策略的平台,凭据死了不是去后台找按钮——把客户端重登一次,回灌链自己顶上。
   *  与「冷却解除」出口分列,免得收信人对着 temp_unschedulable 文案去做重登、或反之。 */
  const providerReauthExit = Object.freeze({
    trae:
      '若系 Trae 凭据已死(auth 类失败/refresh 失效):在本机重新打开 Trae 客户端登录一次即可——' +
      'worker 的 trae-session-sync 每 10 分钟自动把新会话回灌入池(含 refreshToken 与设备材料),' +
      '无需手动跑命令;手头暂时没有 Trae 客户端,才走后台「中转-号池-账号池」导入账号 JSON',
    workbuddy:
      '若系 WorkBuddy 凭据已死:本机打开桌面版并登录后跑' +
      ' `node scripts/relay-account-pool.mjs --from workbuddy` 重新提取(密钥只存在于桌面主进程)',
    qoder:
      'Qoder 池内通用巡检自动换票(适配器已实现 refresh 通道),多数"归零"是冷却或摘除;若换票一并失效,' +
      ' 在本机登录 Qoder 客户端后跑 `node scripts/relay-account-pool.mjs --from qoder` 重新提取' +
      '(需 pwsh 7+,以登录 Qoder 的同一 Windows 用户跑;客户端不必在跑)',
    codearts:
      'CodeArts 池内适配器已实现 refresh_token 刷新,先按摘除/冷却面处置;' +
      ' 彻底失效在本机登录 CodeArts Agent 后跑 `node scripts/relay-account-pool.mjs --from codearts` 重新提取' +
      '(Windows 自带 powershell 即可,须同一 Windows 用户;桌面在跑先关再提);' +
      '该平台无签到引擎,映射即拦截,不要求签到动作',
    // 2026-10-27 扩容八平台:提取器均已装车,--from 全部真跑得通(§0.8)
    codex:
      '若系 Codex 凭据已死:在本机 `codex login`(config.toml 置 cli_auth_credentials_store="file")后' +
      ' 跑 `node scripts/relay-account-pool.mjs --from codex` 重新提取' +
      '(keyring 模式提取不到,错误码 CODEX_NO_SESSION 会点名出路)',
    opencode:
      '若系 OpenCode 凭据已死:在本机 `opencode auth login` 后跑' +
      ' `node scripts/relay-account-pool.mjs --from opencode` 重新提取(auth.json 明文直读)',
    minimax:
      '若系 MiniMax 凭据已死:在本机 `mcode login`(国际版 `mcode login --region global`)后跑' +
      ' `node scripts/relay-account-pool.mjs --from minimax` 重新提取',
    zcode:
      '若系 ZCode 凭据已死:在本机桌面端/TUI 重新连接 BigModel/Z.ai 账号后跑' +
      ' `node scripts/relay-account-pool.mjs --from zcode` 重新提取(credentials.json 直读)',
    loomy:
      '若系 Loomy 凭据已死:在本机重新登录 Loomy 桌面端后跑' +
      ' `node scripts/relay-account-pool.mjs --from loomy` 重新提取' +
      '(会话持久化形状未实证,提取不到会如实点名不冒绿)',
    doubao:
      '若系豆包凭据已死:在本机重新登录豆包桌面端后跑' +
      ' `node scripts/relay-account-pool.mjs --from doubao` 重新提取(passport 会话 cookie 直读)',
    lingma:
      '若系灵码凭据已死:在本机 IDE 登录通义灵码后跑' +
      ' `node scripts/relay-account-pool.mjs --from lingma` 重新提取(凭证文件/vscdb 双路探测)',
    grokbot:
      'GrokBot 本机凭证为密封串(sandSealedFile,提取器只取证不解封)——当前唯一出路:' +
      ' 后台「中转-号池-账号池」导入账号 JSON,或拿到明文凭据后 `--file` 导入',
  })

  // S1:有 enabled 号但可调度 = 0(两池都扫)
  for (const c of zeroCapacityProviders(accountCap)) {
    const reauth = providerReauthExit[c.providerCode]
    breaches.push({
      kind: 'account_provider_zero_capacity',
      providerCode: c.providerCode,
      detail:
        `账号池 provider=${c.providerCode} enabled=${c.enabledRows} schedulable=0(共 ${c.totalRows} 行)` +
        ` —— 该 provider 的账号池回退每次都在静默落回 ai-service`,
      nextStep:
        '后台「中转-号池-账号池」解除 temp_unschedulable(冷却到点会自愈,先看该号 consecutive_failures 是否还在涨),' +
        '或直接补入可用号' +
        (reauth ? `;${reauth}` : ''),
    })
  }
  for (const c of zeroCapacityProviders(keyCap)) {
    breaches.push({
      kind: 'key_provider_zero_capacity',
      providerCode: c.providerCode,
      detail:
        `key 池 provider=${c.providerCode} enabled=${c.enabledRows} schedulable=0(共 ${c.totalRows} 行)` +
        ` —— 该 provider 的渠道这一侧已打光`,
      nextStep: '后台「中转-渠道」为该 provider 配渠道组或解除 key 停用/临时摘除',
    })
  }

  // S2:整池归零(0 行 / 有行但无一条 enabled)
  const wholePoolEmpty = sentinel.accountCount === 0
  const noEnabledRows = !wholePoolEmpty && poolHasNoEnabledRows(accountCap)
  if (wholePoolEmpty || noEnabledRows) {
    const reason = String(allowEmptyReason ?? '').trim()
    if (reason.length >= MIN_REASON_LEN) {
      notes.push(
        `白名单生效:账号池${wholePoolEmpty ? ' 0 行' : ' 无一条启用号'}已登记理由(${reason.length} 字)⇒ 不判红`,
      )
    } else {
      breaches.push({
        kind: wholePoolEmpty ? 'account_pool_empty' : 'account_pool_no_enabled_rows',
        providerCode: accountCap.map((c) => c.providerCode).join(',') || '(无行)',
        detail: wholePoolEmpty
          ? '账号池 ai_relay_account_pool 一行都没有 —— 补票这条腿不存在'
          : `账号池有 ${sentinel.accountCount} 行但 is_enabled 全为 false —— 补票这条腿被整体停用`,
        nextStep:
          `确实不用账号池 ⇒ 设 ${ALLOW_EMPTY_ENV}="<≥${MIN_REASON_LEN} 字定向说明>"(会到期,属白名单不属挂账);` +
          '否则在后台把需要的 provider 的号重新启用',
      })
    }
  }

  const counts = {
    accountRows: sentinel.accountCount,
    keyRows: sentinel.keyCount,
    accountSchedulable: accountCap.reduce((acc, c) => acc + c.schedulableRows, 0),
    keySchedulable: keyCap.reduce((acc, c) => acc + c.schedulableRows, 0),
  }
  const reading = `账号池 ${fmtCap(accountCap) || '(0 行)'} | key 池 ${fmtCap(keyCap) || '(0 行)'}`
  if (breaches.length > 0) {
    return {
      state: 'breach',
      reason: `${breaches.length} 项命中:${breaches.map((b) => b.kind).join(', ')}`,
      breaches,
      notes,
      reading,
      counts,
    }
  }
  return {
    state: 'ok',
    reason: `两池逐 provider 容量未见归零(账号池可调度 ${counts.accountSchedulable} / key 池可调度 ${counts.keySchedulable})`,
    breaches,
    notes,
    reading,
    counts,
  }
}

export function exitCodeFor(state) {
  return state === 'ok' ? 0 : state === 'breach' ? 1 : 2
}

/**
 * breach 的稳定身份 = 型别 + provider。刻意不含 detail/读数/时刻:那几样每次重扫都会抖,
 * 进身份就变成"每次都算新增"(照 check-gate-rot 的 rotKeyOf 同一把尺子)。
 */
export function breachKeyOf(b) {
  return `${b?.kind ?? '?'}|${b?.providerCode ?? '?'}`
}

/** 与基线做集合差:新增(要喊)/ 已修(基线有、本轮没有)分开报,存量只报数。 */
export function ratchetOf(breaches, baselineKeys) {
  const base = new Set(Array.isArray(baselineKeys) ? baselineKeys : [])
  const current = new Set(breaches.map(breachKeyOf))
  return {
    keys: [...current].sort(),
    newBreaches: breaches.filter((b) => !base.has(breachKeyOf(b))),
    fixed: [...base].filter((k) => !current.has(k)).sort(),
  }
}

/**
 * 读基线。读不到/形状坏 ⇒ status='undetermined' 且 keys=[] —— 调用方据此把当下每条都算
 * 新增(方向:多喊一次),**绝不**回落成"空基线 ⇒ 全 known ⇒ 静默放行"。
 */
export function readBaseline(file, readFile = (p) => readFileSync(p, 'utf8')) {
  let doc
  try {
    doc = JSON.parse(readFile(file))
  } catch (e) {
    return {
      status: 'undetermined',
      keys: [],
      why: `基线读不到或非法 JSON(${file}):${e?.message ?? e}`,
    }
  }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.keys)) {
    return { status: 'undetermined', keys: [], why: `基线形状坏(缺 keys 数组):${file}` }
  }
  return {
    status: 'ok',
    keys: doc.keys.filter((k) => typeof k === 'string' && k.trim()),
    at: doc.at ?? null,
  }
}

/** 写基线(只有人显式 --write-baseline 才走这里;自动追认会把新增 breach 吞掉)。 */
export function writeBaseline(file, keys, { now = new Date() } = {}) {
  const dir = dirname(file)
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
  const uniq = [...new Set(keys.map(String))].sort()
  writeFileSync(
    file,
    `${JSON.stringify({ v: SCHEMA_VERSION, at: now.toISOString(), keys: uniq }, null, 1)}\n`,
    'utf8',
  )
  return { written: uniq.length, file }
}

// ─────────────────────────── 自检(不落库、不派子进程)───────────────────────────
export async function runSelfTest() {
  const { t, report } = makeRegistrar()
  const nowMs = Date.now()

  // 先装载生产判据 —— 这一步失败就是"尺子的输入没了",后面的语义用例无从判起。
  const judges = await loadPoolJudges()
  t(
    'J0 判据能从 stats 源文件抽出并求值(锚点在、括号配平、确实是函数)',
    judges.ok === true,
    judges.why ?? 'ok',
  )
  const fns = judges.ok ? judges.fns : {}

  // 阳性对照:证明抽出来的是**真判据**,不是恒 true/false 的空壳。
  t(
    'J1 阳性对照:isEnabled=true ∧ tempUnschedulable=false ⇒ 可调度',
    typeof fns.isRelayPoolRowSchedulable === 'function'
      ? fns.isRelayPoolRowSchedulable({ isEnabled: true, tempUnschedulable: false }) === true
      : '判据未装载',
  )
  t(
    'J2 阳性对照:被临时摘除 ⇒ 不可调度(反向牙,摘掉即翻红)',
    typeof fns.isRelayPoolRowSchedulable === 'function'
      ? fns.isRelayPoolRowSchedulable({ isEnabled: true, tempUnschedulable: true }) === false
      : '判据未装载',
  )
  t(
    'J3 阳性对照:is_enabled=false ⇒ 不可调度',
    typeof fns.isRelayPoolRowSchedulable === 'function'
      ? fns.isRelayPoolRowSchedulable({ isEnabled: false, tempUnschedulable: false }) === false
      : '判据未装载',
  )
  t(
    'J4 折叠按 provider 分档且三档口径正确',
    typeof fns.foldRelayPoolCapacity === 'function'
      ? JSON.stringify(
          fns.foldRelayPoolCapacity([
            { providerCode: 'trae', isEnabled: true, tempUnschedulable: true },
            { providerCode: 'trae', isEnabled: true, tempUnschedulable: false },
            { providerCode: 'agn', isEnabled: false, tempUnschedulable: false },
          ]),
        ) ===
          '[{"providerCode":"agn","totalRows":1,"enabledRows":0,"schedulableRows":0},{"providerCode":"trae","totalRows":2,"enabledRows":2,"schedulableRows":1}]'
      : '判据未装载',
  )

  // 未判定族:输入取不到时**一个也不许**读成 ok(本次变异证明就打在这一格)。
  const u1 = judgeCapacity({
    judges: { ok: false, why: '锚点找不到' },
    accountRows: [],
    keyRows: [],
    sentinel: { accountCount: 0, keyCount: 0 },
    allowEmptyReason: null,
  })
  t('U1 判据未装载 ⇒ unjudged(且 exit 2)', u1.state === 'unjudged' && exitCodeFor(u1.state) === 2)
  const u2 = judgeCapacity({
    judges,
    accountRows: null,
    keyRows: [],
    sentinel: { accountCount: 0, keyCount: 0 },
  })
  t(
    'U2 池表读数缺失 ⇒ unjudged(不拿 0 冒充"池子空也健康")',
    u2.state === 'unjudged' && exitCodeFor(u2.state) === 2,
  )
  const u3 = judgeCapacity({ judges, accountRows: [], keyRows: [], sentinel: null })
  t('U3 哨兵行缺失 ⇒ unjudged(无法区分"查询跑空"与"表真没行")', u3.state === 'unjudged')
  const u4 = judgeCapacity({
    judges,
    accountRows: [{ providerCode: 'trae', isEnabled: true, tempUnschedulable: false }],
    keyRows: [],
    sentinel: { accountCount: 3, keyCount: 0 },
  })
  t('U4 读数与表行数不符 ⇒ unjudged(输出被截断不许当读数)', u4.state === 'unjudged')

  // 两型命中 + 白名单 + 解析族
  const b1 = judgeCapacity({
    judges,
    accountRows: [
      { providerCode: 'trae', isEnabled: true, tempUnschedulable: true },
      { providerCode: 'trae', isEnabled: true, tempUnschedulable: true },
    ],
    keyRows: [{ providerCode: 'trae', isEnabled: true, tempUnschedulable: false }],
    sentinel: { accountCount: 2, keyCount: 1 },
  })
  t(
    'S1 有 enabled 号但可调度 0 ⇒ breach 并点名 provider',
    b1.state === 'breach' &&
      b1.breaches.some(
        (x) => x.kind === 'account_provider_zero_capacity' && x.providerCode === 'trae',
      ),
  )
  const okCase = judgeCapacity({
    judges,
    accountRows: [{ providerCode: 'trae', isEnabled: true, tempUnschedulable: false }],
    keyRows: [{ providerCode: 'openai', isEnabled: true, tempUnschedulable: false }],
    sentinel: { accountCount: 1, keyCount: 1 },
  })
  t(
    'S0 有可调度号 ⇒ ok(反向牙:S1 不许见号就红)',
    okCase.state === 'ok' && exitCodeFor(okCase.state) === 0,
  )
  const b2 = judgeCapacity({
    judges,
    accountRows: [],
    keyRows: [],
    sentinel: { accountCount: 0, keyCount: 0 },
  })
  t(
    'S2 整池 0 行 ⇒ breach(且给出可执行下一步)',
    b2.state === 'breach' &&
      b2.breaches[0]?.kind === 'account_pool_empty' &&
      typeof b2.breaches[0]?.nextStep === 'string' &&
      b2.breaches[0].nextStep.length > 10,
  )
  const b2w = judgeCapacity({
    judges,
    accountRows: [],
    keyRows: [],
    sentinel: { accountCount: 0, keyCount: 0 },
    allowEmptyReason: '本站未启用第三方账号池,渠道直连即全部链路',
  })
  t(
    'S2+ 白名单理由充分 ⇒ 不判红但留 note(§5e-1 不能整改的合法态)',
    b2w.state === 'ok' && (b2w.notes ?? []).length === 1,
  )
  const b2s = judgeCapacity({
    judges,
    accountRows: [],
    keyRows: [],
    sentinel: { accountCount: 0, keyCount: 0 },
    allowEmptyReason: '不用',
  })
  t('S2× 理由短于下界 ⇒ 视同未登记,照旧 breach(验过才免,§0.7)', b2s.state === 'breach')
  const b3 = judgeCapacity({
    judges,
    accountRows: [{ providerCode: 'trae', isEnabled: false, tempUnschedulable: false }],
    keyRows: [],
    sentinel: { accountCount: 1, keyCount: 0 },
  })
  t(
    'S2b 有行但无一条 enabled ⇒ breach(account_pool_no_enabled_rows)',
    b3.state === 'breach' && b3.breaches.some((x) => x.kind === 'account_pool_no_enabled_rows'),
  )

  const parsed = parsePoolRows(
    [
      'account\ttrae\tt\tf',
      'account\ttrae\tt\tt',
      'key\topenai\tt\tf',
      `sentinel\t${SENTINEL}\t2\t1`,
    ].join('\n'),
  )
  t(
    'P1 t/f 显式转布尔(不是 Boolean("f")=true 那一坑)',
    parsed.account.length === 2 &&
      parsed.account[0].isEnabled === true &&
      parsed.account[1].tempUnschedulable === true &&
      parsed.key[0].isEnabled === true,
  )
  t(
    'P1b 两种布尔拼法同解(SQL 里 ::text 出 true/false,psql 裸 bool 出 t/f;实测撞过:只认 t 就把启用号读成停用号)',
    JSON.stringify(
      parsePoolRows(['account\ttrae\ttrue\tfalse', 'account\ttrae\tfalse\ttrue'].join('\n'))
        .account,
    ) ===
      JSON.stringify([
        { providerCode: 'trae', isEnabled: true, tempUnschedulable: false },
        { providerCode: 'trae', isEnabled: false, tempUnschedulable: true },
      ]),
  )
  t(
    'P2 哨兵行解析出两表行数',
    parsed.sentinel?.accountCount === 2 && parsed.sentinel?.keyCount === 1,
  )
  t(
    'P3 坏行(列数不足/未知 pool)忽略且不影响哨兵',
    parsePoolRows(['garbage', 'account\tx', `sentinel\t${SENTINEL}\t0\t0`, '', '   '].join('\n'))
      .sentinel?.accountCount === 0,
  )
  t(
    'P4 SQL 含哨兵行与两表名',
    buildSql().includes(SENTINEL) &&
      buildSql().includes('ai_relay_account_pool') &&
      buildSql().includes('ai_relay_key_pool'),
  )
  t(
    'H1 本机主机名判定:localhost/127.x/192.168.x 收,公网不收',
    isLocalHost('localhost') &&
      isLocalHost('127.0.0.1') &&
      isLocalHost('192.168.1.9') &&
      !isLocalHost('db.example.com'),
  )
  t(
    'H2 退出码三档恒成套:ok=0 / breach=1 / unjudged=2',
    exitCodeFor('ok') === 0 &&
      exitCodeFor('breach') === 1 &&
      exitCodeFor('unjudged') === 2 &&
      exitCodeFor('任何别的') === 2,
  )
  t(
    'H3 未判定族不许出现 exit 0(变异证明的靶:把 unjudged 改成 ok 必翻这一条)',
    [u1, u2, u3, u4].every((v) => exitCodeFor(v.state) === 2) &&
      [u1, u2, u3, u4].every((v) => v.state !== 'ok'),
  )

  // 差值档族(照 check-gate-rot --ratchet 同格的语义,逐条钉死"只拦新增、坏基线多喊"):
  const bTrae = { kind: 'account_provider_zero_capacity', providerCode: 'trae', detail: '旧读数' }
  const bTrae2 = {
    kind: 'account_provider_zero_capacity',
    providerCode: 'trae',
    detail: '新读数会抖',
  }
  const bGem = { kind: 'key_provider_zero_capacity', providerCode: 'gemini', detail: 'x' }
  t(
    'R1 breach 稳定身份=kind|provider,detail 抖动不换身份',
    breachKeyOf(bTrae) === breachKeyOf(bTrae2) && breachKeyOf(bTrae) !== breachKeyOf(bGem),
  )
  const r2 = ratchetOf([bTrae2, bGem], [breachKeyOf(bTrae)])
  t(
    'R2 基线内存量不算新增;本轮新 provider 点名;fixed=基线有、本轮无',
    r2.newBreaches.length === 1 &&
      r2.newBreaches[0].providerCode === 'gemini' &&
      r2.fixed.length === 0,
  )
  const r2b = ratchetOf([bTrae], [breachKeyOf(bTrae), breachKeyOf(bGem)])
  t(
    'R2b 存量归零已修 ⇒ fixed 报出且 newBreaches 空(差值为 0 不喊人)',
    r2b.newBreaches.length === 0 && r2b.fixed.length === 1 && r2b.fixed[0] === breachKeyOf(bGem),
  )
  const r3 = readBaseline('__no_such_file_relay_capacity_baseline__.json')
  t(
    'R3 基线读不到 ⇒ undetermined 且 keys 空 ⇒ 当下 breach 一律按新增报出(绝不静默放行)',
    r3.status === 'undetermined' &&
      r3.keys.length === 0 &&
      ratchetOf([bTrae, bGem], r3.keys).newBreaches.length === 2,
  )
  const r3b = readBaseline('x.json', () => '{"notKeys":[]}')
  t('R3b 基线形状坏(缺 keys)⇒ 同 undetermined,不回落成空 known', r3b.status === 'undetermined')
  const scratch = mkScratch('relay-capacity-baseline')
  try {
    const bFile = join(scratch, 'baseline.json')
    const w = writeBaseline(bFile, [breachKeyOf(bTrae), breachKeyOf(bGem), breachKeyOf(bTrae)])
    const rb = readBaseline(bFile)
    t(
      'R4 显式认账往返:writeBaseline 去重落盘 ⇒ readBaseline ok,当下全 known,newBreaches 空',
      w.written === 2 &&
        rb.status === 'ok' &&
        rb.keys.length === 2 &&
        ratchetOf([bTrae2, bGem], rb.keys).newBreaches.length === 0,
    )
    const wEmpty = writeBaseline(join(scratch, 'empty.json'), [])
    const rbEmpty = readBaseline(join(scratch, 'empty.json'))
    t(
      'R5 显式认账"无存量"(空 keys)⇒ status=ok 且当下 breach 全算新增(空基线≠坏基线,但同样不吞新增)',
      wEmpty.written === 0 &&
        rbEmpty.status === 'ok' &&
        rbEmpty.keys.length === 0 &&
        ratchetOf([bTrae], rbEmpty.keys).newBreaches.length === 1,
    )
  } finally {
    rmScratch(scratch)
  }

  const r = report()
  const line = `SELF-TEST check-relay-capacity-zero:${r.pass} passed / ${r.fail} failed(共 ${r.cases.length} 例,now=${nowMs})`
  for (const c of r.cases) if (!c.pass) console.log(`  ❌ ${c.name} ⇒ got=${c.got}`)
  console.log(line)
  return r.fail === 0 ? 0 : 1
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    process.exit(await runSelfTest())
    return
  }
  const json = args.includes('--json')
  const ratchet = args.includes('--ratchet')
  const writeBase = args.includes('--write-baseline')
  const baseIdx = args.indexOf('--baseline')
  const baselineFile =
    baseIdx >= 0 && args[baseIdx + 1] && !args[baseIdx + 1].startsWith('--')
      ? args[baseIdx + 1]
      : DEFAULT_BASELINE
  const envIdx = args.indexOf('--env-file')
  const envFile = envIdx >= 0 ? args[envIdx + 1] : join(REPO, 'apps', 'api', '.env')
  const allowEmptyReason = process.env[ALLOW_EMPTY_ENV] ?? null

  const emit = (obj, code) => {
    if (json) console.log(JSON.stringify(obj))
    else {
      console.log(
        `${obj.state.toUpperCase()} relay-capacity-zero: ${obj.reason}${obj.reading ? ` | ${obj.reading}` : ''}`,
      )
      for (const b of obj.breaches ?? [])
        console.log(`  ⚠ [${b.kind}] ${b.detail}\n     下一步:${b.nextStep}`)
      for (const n of obj.notes ?? []) console.log(`  · ${n}`)
      if (obj.state === 'unjudged') {
        console.log('  ⇒ 未判定:既不记绿也不冒红(§0.3),请按 reason 修输入后复跑')
        if (writeBase) console.log('  ⇒ --write-baseline 已拒绝:判不了的面不得被认账')
      }
    }
    process.exit(code)
  }

  const judges = await loadPoolJudges()
  if (!judges.ok) {
    return emit({ state: 'unjudged', reason: `判据装载失败:${judges.why}`, breaches: [] }, 2)
  }
  const locate = locatePsqlClient()
  if (!locate.psql) {
    return emit(
      {
        state: 'unjudged',
        reason: `psql 客户端取不到(${(locate.tried ?? []).length} 个候选皆不在位)⇒ 未判定`,
        breaches: [],
      },
      2,
    )
  }
  const dsn = readDsn({ envFile, env: process.env })
  if (!dsn.ok)
    return emit(
      {
        state: 'unjudged',
        reason: `DSN 取不到(${dsn.why ?? 'env 与 .env 皆空'})⇒ 未判定`,
        breaches: [],
      },
      2,
    )
  let host = ''
  try {
    host = new URL(dsn.dsn).hostname
  } catch {
    return emit(
      { state: 'unjudged', reason: 'DSN 不是合法 URL ⇒ 未判定(不回显 DSN)', breaches: [] },
      2,
    )
  }
  if (!isLocalHost(host)) {
    return emit(
      {
        state: 'unjudged',
        reason: `DSN 主机不在本机/私网白名单内(host=${host})—— 本尺子只为本机开发库而写,不连生产库 ⇒ 未判定`,
        breaches: [],
      },
      2,
    )
  }
  const q = runPsql(locate.psql, dsn.dsn, ['-At', '-F', '\t', '-c', buildSql()])
  if (!q.ok) return emit({ state: 'unjudged', reason: `查询失败:${q.why}`, breaches: [] }, 2)
  const rows = parsePoolRows(q.stdout)
  const verdict = judgeCapacity({
    judges,
    accountRows: rows.account,
    keyRows: rows.key,
    sentinel: rows.sentinel,
    allowEmptyReason,
  })

  // 显式认账档:只有人看读数后才跑。自动追认 = 新增 breach 第一次就被吞掉(§0.10 反向失效)。
  if (writeBase) {
    if (verdict.state === 'unjudged') {
      return emit(
        { ...verdict, reason: `未判定(${verdict.reason})⇒ 拒绝写基线(判不了的面不得被认账)` },
        2,
      )
    }
    const w = writeBaseline(baselineFile, (verdict.breaches ?? []).map(breachKeyOf))
    if (json)
      console.log(JSON.stringify({ written: w.written, file: w.file, state: verdict.state }))
    else console.log(`已写基线:${w.written} 条 ⇒ ${w.file}(此后 --ratchet 只拦新增)`)
    process.exit(0)
    return
  }

  if (ratchet) {
    const base = readBaseline(baselineFile)
    const ratch = ratchetOf(verdict.breaches ?? [], base.keys)
    const rState =
      verdict.state === 'unjudged'
        ? 'unjudged'
        : ratch.newBreaches.length > 0
          ? 'new'
          : (verdict.breaches ?? []).length > 0
            ? 'known'
            : 'clean'
    const payload = {
      ...verdict,
      ratchetState: rState,
      newBreaches: ratch.newBreaches,
      fixed: ratch.fixed,
      baseline: {
        file: baselineFile,
        status: base.status,
        count: base.keys.length,
        why: base.why ?? null,
      },
    }
    if (!json) {
      const known = (verdict.breaches ?? []).length - ratch.newBreaches.length
      console.log(
        `RATCHET state=${rState} known=${known} new=${ratch.newBreaches.length} fixed=${ratch.fixed.length}` +
          `${base.status === 'ok' ? '' : ` baseline=${base.status}`}`,
      )
      for (const k of ratch.fixed) console.log(`✅ 已修(基线有、本轮无):${k}`)
      if (rState === 'known')
        console.log(
          `ℹ 存量 breach ${(verdict.breaches ?? []).length} 处只报数(差值档只拦新增;认账 --write-baseline)`,
        )
      if (base.status !== 'ok')
        console.log(`ℹ 基线${base.status}:${base.why ?? baselineFile} ⇒ 当下 breach 一律按新增报出`)
    }
    return emit(payload, rState === 'unjudged' ? 2 : rState === 'new' ? 1 : 0)
  }

  emit(verdict, exitCodeFor(verdict.state))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  REQUIRED_JUDGES,
  ALLOW_EMPTY_ENV,
  MIN_REASON_LEN,
  SENTINEL,
  DEFAULT_BASELINE,
  loadPoolJudges,
  judgeCapacity,
  exitCodeFor,
  parsePoolRows,
  buildSql,
  isLocalHost,
  sliceTopLevelFunction,
  breachKeyOf,
  ratchetOf,
  readBaseline,
  writeBaseline,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
