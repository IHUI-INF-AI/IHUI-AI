// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 环境变量穿透守卫 —— 「每个键必须说明它该从哪来」。
 *
 * ## 与既有 `blockedEnvVars` 的分工
 *
 * `blockedEnvVars`(`apps/cli/src/sandbox/index.ts`)是**黑名单**:列出不许继承的键。
 * 黑名单的固有问题是"没列进去就放行"——新增一个敏感键(如新的 token 变量)时,
 * 在有人想起来加进黑名单之前,它一直是穿透的。
 *
 * 本模块补的是另一条腿:**归类表 + 可诊断拒绝**。
 * 每个已知键都标注「它该从哪里传」,而非"能不能传";遇到归类表里标记为
 * "不该从 env 传"的键,不是笼统报"invalid",而是**告诉调用方正确做法**。
 *
 * 对齐依据:WorkBuddy `通用子智能体日志规范` 的 `lib/harness/create-harness.js`
 * 里那张 `new Map([...])` —— 每个 env 键映射到一句"pass via X"的指引,
 * 并对 `*_CONFIG_DIR` / `*_API_KEY` / `*_AUTH_TOKEN` 这类键直接抛错点名。
 *
 * ## 三条硬规则(逐条对应一个真实事故形态)
 *
 * ① **键名不得含 `=` 或 NUL** —— 含 `=` 的键在多数 env 实现里会被静默切成
 *    "键=值"两段,注入的值因此变成另一个变量名;
 * ② **敏感键不得经 env 传** —— 必须报错并说明应走哪条通道(凭据管理器/会话注入),
 *    因为 env 会进 `/proc/<pid>/environ`、进子进程、进崩溃日志;
 * ③ **值不得含 NUL,必须是字符串** —— NUL 会截断底层 `execve` 的字符串。
 */

/** 一个 env 键该怎么传。 */
export type EnvRoute =
  /** 从宿主环境原样继承。 */
  | { readonly kind: 'pass-host' }
  /** 不该经 env 传,应作为某个参数传入;`via` 是给调用方的指引。 */
  | { readonly kind: 'pass-as-param'; readonly via: string }
  /** 由本进程自己设置,调用方不得覆盖。 */
  | { readonly kind: 'set-by-us' }
  /** 完全禁止经 env 传(凭据类),必须走专用通道。 */
  | { readonly kind: 'forbidden'; readonly via: string }

/**
 * 归类表。
 *
 * 只登记**我方真实存在**的键。对照对方的表时做了取舍:
 *   · 对方的 `CODEBUDDY_*` 产品前缀换成我方的 `IHUI_*`;
 *   · 对方标记 `the Harness sets it` 的键,这里对应 `set-by-us`;
 *   · 对方的 `pass host` 里那些"宿主身份类"键,这里归 `pass-host`。
 */
const ROUTES: Readonly<Record<string, EnvRoute>> = Object.freeze({
  // ── 宿主机密:必须走凭据通道,不许进 env ────────────────────────────
  IHUI_API_TOKEN: {
    kind: 'forbidden',
    via: '用 registerCliTokenProvider 注册令牌提供者,或走凭据管理器;env 会进 /proc/<pid>/environ 与崩溃日志',
  },
  IHUI_CLI_MIN_VERSION: { kind: 'pass-host' },

  // ── 配置目录:应作为参数传,不从 env 猜 ──────────────────────────────
  IHUI_CLI_SESSIONS_DIR: {
    kind: 'pass-as-param',
    via: '作为 setupAgentTools / loadSession 的显式参数传入;仅测试用 env 覆盖',
  },
  IHUI_CLI_TURNS_DIR: {
    kind: 'pass-as-param',
    via: '作为 turn-store 的显式参数传入;仅测试用 env 覆盖',
  },
  IHUI_CLI_GOALS_DIR: {
    kind: 'pass-as-param',
    via: '作为 turn-store 的显式参数传入;仅测试用 env 覆盖',
  },

  // ── 由本进程设置,调用方不得覆盖 ────────────────────────────────────
  IHUI_LOCALE: { kind: 'set-by-us' },
  NODE_ENV: { kind: 'pass-host' },
})

/** 判定结果。 */
export type EnvVerdict =
  | { readonly ok: true; readonly route: EnvRoute }
  | { readonly ok: false; readonly reason: string }

/** 键名合法性(与对齐实现同判据)。 */
function keyProblem(key: string): string | undefined {
  if (key === '') return '键名为空'
  if (key.includes('=')) {
    return `键名含 "=":多数 env 实现会把它切成"键=值"两段,注入的值会变成另一个变量名`
  }
  if (key.includes('\u0000')) return '键名含 NUL:NUL 会截断底层 execve 的字符串'
  return undefined
}

/**
 * 判定一个 env 键能否穿过守卫。
 *
 * 未登记的键**放行**(与黑名单互补:黑名单管"已知危险",本表管"已知该走别处")。
 * 这一点刻意与 recovery-policy 相反 —— 那里未登记按最保守处理(结果未知),
 * 因为猜错会重复扣款;这里未登记按放行处理,因为猜错只是多传一个无害变量。
 */
export function checkEnvKey(key: string): EnvVerdict {
  const problem = keyProblem(key)
  if (problem !== undefined) return { ok: false, reason: problem }

  const route = ROUTES[key]
  if (route === undefined) {
    return { ok: true, route: { kind: 'pass-host' } }
  }
  if (route.kind === 'forbidden') {
    return { ok: false, reason: `不允许经 env 传递 ${key}:${route.via}` }
  }
  if (route.kind === 'set-by-us') {
    return { ok: false, reason: `${key} 由本进程设置,调用方不得覆盖` }
  }
  return { ok: true, route }
}

/**
 * 校验整个 env 对象。
 *
 * 返回**全部**问题而不是第一个 —— 调用方一次就能修完,不用反复试。
 * 这与对齐实现(逐条 throw)略不同:那里是构造期 fail-fast,
 * 我们这里是校验函数,一次性报全更有用。
 */
export function checkEnvMap(env: Record<string, unknown>): {
  readonly ok: boolean
  readonly problems: readonly { key: string; reason: string }[]
  /** 需要作为参数传给下游的项(而非从 env 继承)。 */
  readonly passAsParams: readonly { key: string; via: string }[]
  /** 值问题(非字符串/含 NUL)。 */
  readonly valueProblems: readonly { key: string; reason: string }[]
} {
  const problems: { key: string; reason: string }[] = []
  const passAsParams: { key: string; via: string }[] = []
  const valueProblems: { key: string; reason: string }[] = []

  for (const [key, value] of Object.entries(env)) {
    const verdict = checkEnvKey(key)
    if (!verdict.ok) {
      problems.push({ key, reason: verdict.reason })
      continue
    }
    if (verdict.route.kind === 'pass-as-param') {
      passAsParams.push({ key, via: verdict.route.via })
    }
    // 值检查:undefined 表示"删除该键",合法
    if (value === undefined) continue
    if (typeof value !== 'string') {
      valueProblems.push({ key, reason: `值必须是字符串(收到 ${typeof value})` })
      continue
    }
    if (value.includes('\u0000')) {
      valueProblems.push({ key, reason: '值含 NUL:NUL 会截断底层 execve 的字符串' })
    }
  }

  return {
    ok: problems.length === 0 && valueProblems.length === 0,
    problems,
    passAsParams,
    valueProblems,
  }
}

/**
 * 构造一个**安全的 env 合并结果**:只保留通过守卫的键。
 *
 * 用于"把用户/配置给的 env 叠加到子进程环境"这一场景:
 * 不合法的键被剔除并记入 `rejected`,而不是带着它们启动子进程。
 */
export function mergeSafeEnv(
  base: Readonly<Record<string, string>>,
  overlay: Readonly<Record<string, unknown>>,
): {
  readonly env: Record<string, string>
  readonly rejected: readonly { key: string; reason: string }[]
} {
  const report = checkEnvMap(overlay)
  const rejected = [...report.problems, ...report.valueProblems]
  const badKeys = new Set(rejected.map((r) => r.key))

  const env: Record<string, string> = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    if (badKeys.has(key)) continue
    if (value === undefined) {
      delete env[key]
      continue
    }
    env[key] = value as string
  }
  return { env, rejected }
}

/** 已登记的键清单(供审计)。 */
export function routedEnvKeys(): readonly string[] {
  return Object.keys(ROUTES).sort()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
