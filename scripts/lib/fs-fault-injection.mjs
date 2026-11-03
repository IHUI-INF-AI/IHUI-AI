// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * fs-fault-injection.mjs — 工具层「文件系统故障注入」面(G-815961,2026-10-03 立)。
 *
 * 病灶(现读复核,不是假想):`scripts/check-file-write-safety.mjs` 只判**静态形态** ——
 *   出口在位(R2)、落盘方真用它(R3)、裸写盘没变多(R1 棘轮)。这三条能证明"接线在位",
 *   证明不了**失败时会不会留半个文件**。而失败路径恰恰是这台机器上最容易坏的一格:
 *   `scripts/lib/atomic-write.mjs:16-18` 记着实测 rename 撞"目标已被别的句柄打开"在
 *   Windows 上回 **EPERM**(不是 EEXIST),同族还有 EBUSY/EACCES、父目录被并发删走给 ENOENT。
 *   那份实现的失败语义是"重试用尽 ⇒ 清掉自己的临时文件并抛 `AtomicReplaceFailedError`,
 *   磁盘上仍是完整旧内容"(`atomic-write.mjs:305-325`)—— 但**这是一段注释,不是一次证明**。
 *   本仓反复记过的失效型正是"把没做成写成做过了";注释里写过的失败路径与实际行为漂开,
 *   静态门一条都不响(它判的是 import 与调用次数,不是"抛错后磁盘剩什么")。
 *
 * 所以把"失败时磁盘应该长什么样"变成**可执行、可断言**的一等测试面:在真正做事之前
 * 摆一个注入点,由本模块按规则抛合成的 `NodeJS.ErrnoException`(带 `code`/`path`/`syscall`/
 * `zcodeFsFaultId` 四个可断言字段),让 `atomicWriteFileSync` 的失败分支被**真的走一遍**。
 *
 * 三条不许漂的写法(与上游 `apps/zcode-cli/packages/adapters/src/storage/fs-fault-injection.ts`
 * 逐条对齐 —— 那是本仓 `apps/**` 之外的上游参照,行为契约以它为准):
 *   1. **默认关,且要两个条件同时成立才开**:`ZCODE_E2E_FS_FAULTS` 有值 **且**
 *      (`ZCODE_ENV === "test"` 或 `ZCODE_E2E_FS_FAULTS_ALLOW === "1"`)。
 *      单有规则串不开 ⇒ 规则串可以落进提交、可以进 CI 的 env 模板,不会在生产面上打穿写盘。
 *      **这条兜底本身有测试锁**(守门 122 自检臂 F20/镜像 F20):它是防"注入被误带进生产"
 *      的唯一一道,拆掉即红,不许因为"测试里方便"而放宽。
 *   2. **规则写错在解析期抛,不是静默失效**。`operations` 不在闭集内、`maxMatches` 不是
 *      非负整数、`id`/`code` 不是非空串、`pathRegex` 编译不过 —— 一律在**构造注入器那一刻**
 *      抛。静默失效是这一族最坏的形态:规则拼错了、什么都没注入、测试一路绿,
 *      而你以为测过失败路径(上游同款,`:76-117`)。
 *   3. **注入点摆在真正做事之前**。`maybeThrowStorageFsFault({operation, path})` 必须在
 *      目标动作**之前**调(上游实例:`paths.ts:13` 在 `mkdir` 之前)。摆在之后 = 动作已经
 *      做完了才抛,那注入的是"事后报错",证明不了任何回滚语义。
 *
 * 规则匹配三条件**取与**(`pathIncludes` / `pathEndsWith` / `pathRegex`,缺一即不参与判定),
 * 路径比较前统一 `\` → `/`(Windows 面)。`maxMatches` 默认 **1** —— 默认只炸第一次,
 * 免得一个规则把整轮测试的后续步骤全带走;要连炸要显式写 `maxMatches: N`。
 *
 * 面向"三段式守门"的分工:**本模块是判据单份的所在地**(纯函数,零 IO 零 fs 依赖),
 * 守门只做"取材 + 调 + 传神"(见 `scripts/check-file-write-safety.mjs` 的 `--self-test` 臂
 * 与 `scripts/tests/check-file-write-safety.test.mjs` 的 F 组)。判据不得在门里另抄一份。
 *
 * 取证面(为何这值得是一等公民):`scripts/lib/atomic-write.mjs` 的 `atomicWriteFileSync`
 * 自带 `fs` 注入面(`opts.fs`),镜像测试据此证真/证伪各条失败分支。故障注入补的是它**证不了**
 * 的那一格 —— 前者换掉整个 fs 袋(于是失去"真 rename 失败"的真实性),后者只让**一次**
 * rename 真的返回 EPERM,其余步骤仍走真 fs。两者互补,不是同一件事。
 */

/** 规则 JSON 从哪个环境变量读(与上游同名,便于同一套 env 模板复用) */
export const FAULTS_ENV = 'ZCODE_E2E_FS_FAULTS'
/** 逃生阀:显式声明"我知道我在非 test 环境开故障注入" */
export const FAULTS_ALLOW_ENV = 'ZCODE_E2E_FS_FAULTS_ALLOW'
/** 首个条件:环境必须自报 test */
export const FAULTS_ENV_GUARD = 'ZCODE_ENV'
/** 首个条件的取值 */
export const FAULTS_ENV_GUARD_VALUE = 'test'

/**
 * 规则闭集。**刻意不做 `Object.keys` 派生、不接受通配前缀** ——
 * 规则拼错(operation 少个字母、写成 `sqlite_open`)必须在解析期炸出来;
 * 若闭集是"照着写下来的清单派生"的,清单与判据就是同一份自证,拼错反而静默通过。
 * (上游同款,`fs-fault-injection.ts:4-12` / `:46-55`。)
 */
export const FAULT_OPERATIONS = Object.freeze([
  'sqliteOpen',
  'sqliteRun',
  'writeFile',
  'rename',
  'rm',
  'appendFile',
  'mkdir',
  'any',
])

/** 合成错误上供断言的字段名(缺任一,断言就只能靠 match 字符串,那是在测运气) */
export const FAULT_ERROR_FIELDS = Object.freeze(['code', 'path', 'syscall', 'zcodeFsFaultId'])

/** 路径比较前统一分隔符(Windows 面:调用方给的可能是 `C:\a\b`,规则里可能是 `C:/a/b`) */
export function normalizeFaultPath(p) {
  return String(p).replace(/\\/g, '/')
}

function requireNonEmptyString(value, field, index) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid fs fault rule at index ${index}: ${field} must be a non-empty string`)
  }
  return value.trim()
}

function optionalString(value, field, index) {
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw new Error(`Invalid fs fault rule at index ${index}: ${field} must be a string`)
  }
  return value
}

/** `operations` 缺省 = `['any']`;给了就必须是非空数组且每一项在闭集内 */
function normalizeOperations(value, index) {
  if (value === undefined) return ['any']
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid fs fault rule at index ${index}: operations must be a non-empty array`)
  }
  return value.map((operation) => {
    if (typeof operation !== 'string' || !FAULT_OPERATIONS.includes(operation)) {
      throw new Error(`Invalid fs fault rule at index ${index}: unsupported operation ${String(operation)}`)
    }
    return operation
  })
}

/**
 * 一条规则 → 归一形态。**每一条非法都在这里抛**(第 2 条不许漂)。
 * `maxMatches` 缺省 1(见头注);`pathRegex` 在此编译 —— 编译不过的表达式不许活到匹配期。
 */
export function normalizeFaultRule(rule, index) {
  const record = { ...(rule ?? {}) }
  const maxMatches = record.maxMatches === undefined ? 1 : record.maxMatches
  if (typeof maxMatches !== 'number' || !Number.isInteger(maxMatches) || maxMatches < 0) {
    throw new Error(`Invalid fs fault rule at index ${index}: maxMatches must be a non-negative integer`)
  }
  const pathRegexRaw = optionalString(record.pathRegex, 'pathRegex', index)
  // 编译不过的表达式同样要在**构造期**炸(不许活到匹配期),但必须带上是第几条、哪个字段 ——
  // 裸 `new RegExp` 抛的 SyntaxError 不带规则下标,十条规则里坏一条时得自己逐条试。
  let pathRegex
  if (pathRegexRaw !== undefined) {
    try {
      pathRegex = new RegExp(pathRegexRaw)
    } catch (e) {
      throw new Error(
        `Invalid fs fault rule at index ${index}: pathRegex is not a valid regular expression (${e instanceof Error ? e.message : String(e)})`,
      )
    }
  }
  return {
    id: requireNonEmptyString(record.id, 'id', index),
    code: requireNonEmptyString(record.code, 'code', index),
    message: optionalString(record.message, 'message', index),
    operations: normalizeOperations(record.operations, index),
    pathIncludes: optionalString(record.pathIncludes, 'pathIncludes', index),
    pathEndsWith: optionalString(record.pathEndsWith, 'pathEndsWith', index),
    pathRegex,
    maxMatches,
    matchedCount: 0,
  }
}

/** 规则串 → 规则数组。JSON 不对 / 不是数组 / 某项不是对象,一律在解析期抛。 */
export function parseFaultRules(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error(`Invalid ${FAULTS_ENV}: ${e instanceof Error ? e.message : String(e)}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid ${FAULTS_ENV}: expected a JSON array`)
  }
  return parsed.map((rule, index) => {
    if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
      throw new Error(`Invalid fs fault rule at index ${index}: rule must be an object`)
    }
    return rule
  })
}

/** 注入器是否启用 —— **双条件的唯一判据**,不许在别处再写一遍(见头注第 1 条) */
export function isFaultInjectionEnabled(env = process.env) {
  const raw = typeof env[FAULTS_ENV] === 'string' ? env[FAULTS_ENV].trim() : ''
  if (!raw) return false
  return env[FAULTS_ENV_GUARD] === FAULTS_ENV_GUARD_VALUE || env[FAULTS_ALLOW_ENV] === '1'
}

/** 合成错误:四个可断言字段一个都不能少(少一个,断言就退化成 match 字符串) */
export function createInjectedFault({ code, id, message, operation, path }) {
  const error = new Error(message ?? `Injected fs fault ${code} for ${operation}: ${path}`)
  error.code = code
  error.path = path
  error.syscall = operation
  error.zcodeFsFaultId = id
  return error
}

function operationMatches(rule, operation) {
  return rule.operations.includes('any') || rule.operations.includes(operation)
}

/** 三条件取与:未给出的条件不参与判定(而不是"当作不匹配") */
function pathMatches(rule, p) {
  const target = normalizeFaultPath(p)
  if (rule.pathIncludes !== undefined && !target.includes(normalizeFaultPath(rule.pathIncludes))) return false
  if (rule.pathEndsWith !== undefined && !target.endsWith(normalizeFaultPath(rule.pathEndsWith))) return false
  if (rule.pathRegex !== undefined && !rule.pathRegex.test(target)) return false
  return true
}

/**
 * 单条规则此刻是否还能命中(纯函数,供自检臂做构造面断言)。
 * 额度用尽(`matchedCount >= maxMatches`,含 `maxMatches: 0` = 永不使用)即不再命中 ——
 * 这与 `createFaultInjector().maybeThrow` 里那一行是同一条判据,写在一处。
 */
export function ruleMatches(rule, input) {
  if (rule.matchedCount >= rule.maxMatches) return false
  return operationMatches(rule, input.operation) && pathMatches(rule, input.path)
}

/**
 * 造注入器。`rules` 已在**此刻**全部归一(非法即抛)——
 * 注入器一旦造出来,`maybeThrow` 这条路上不再有任何解析期检查。
 */
export function createFaultInjector(rules = []) {
  const normalized = rules.map((rule, index) => normalizeFaultRule(rule, index))
  return {
    rules: normalized,
    maybeThrow(input) {
      for (const rule of normalized) {
        if (rule.matchedCount >= rule.maxMatches) continue
        if (!operationMatches(rule, input.operation) || !pathMatches(rule, input.path)) continue
        rule.matchedCount += 1
        throw createInjectedFault({
          code: rule.code,
          id: rule.id,
          message: rule.message,
          operation: input.operation,
          path: input.path,
        })
      }
    },
    reset() {
      for (const rule of normalized) rule.matchedCount = 0
    },
  }
}

/**
 * 从环境造注入器。**未启用 ⇒ 空注入器**(什么都不注入)——
 * 这一句是防生产误开的锁,拆掉它等于把整个面变成"生产也可能被打穿",故有测试锁。
 */
export function createFaultInjectorFromEnv(env = process.env) {
  if (!isFaultInjectionEnabled(env)) return createFaultInjector([])
  return createFaultInjector(parseFaultRules(String(env[FAULTS_ENV]).trim()))
}

let envInjector = null
let injectedForTests = null

/** 取当前注入器:测试可注入,否则按 env 造一个并缓存 */
export function getFaultInjector() {
  if (injectedForTests) return injectedForTests
  if (envInjector === null) envInjector = createFaultInjectorFromEnv()
  return envInjector
}

/** 测试/镜像用例的注入口;传 `null` 交回 env 档 */
export function setFaultInjectorForTests(injector) {
  injectedForTests = injector
  envInjector = null
}

/** 清掉 env 档缓存(改了 env 之后要重取时用) */
export function resetFaultInjectorCache() {
  envInjector = null
}

/**
 * **注入点**。必须摆在真正做事**之前**(头注第 3 条)。
 * @param {{operation:string, path:string}} input
 */
export function maybeThrowStorageFsFault(input) {
  getFaultInjector().maybeThrow(input)
}

export const __test__ = {
  FAULTS_ENV,
  FAULTS_ALLOW_ENV,
  FAULTS_ENV_GUARD,
  FAULTS_ENV_GUARD_VALUE,
  FAULT_OPERATIONS,
  FAULT_ERROR_FIELDS,
  normalizeFaultPath,
  normalizeFaultRule,
  parseFaultRules,
  isFaultInjectionEnabled,
  createInjectedFault,
  createFaultInjector,
  createFaultInjectorFromEnv,
  getFaultInjector,
  setFaultInjectorForTests,
  resetFaultInjectorCache,
  maybeThrowStorageFsFault,
  ruleMatches,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
