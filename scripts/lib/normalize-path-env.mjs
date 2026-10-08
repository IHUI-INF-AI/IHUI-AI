// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lib/normalize-path-env.mjs — Windows `Path` / `PATH` 双键收口的唯一出口(G-998128 票 4)
 *
 * 治的是这一型:往子进程 env 里塞大写 `PATH`,而宿主环境块把它写成 `Path`(Windows 原生拼写)时,
 * `{ ...process.env, PATH: <patch> }` 产出的**同一个对象**里就并存两份大小写变体。Node 在 Windows
 * 上给 `CreateProcess` 拼环境块前会把所有键**统一大写**(child_process 的 envPairs),于是两份变成
 * 同名同块的两条条目;子进程读到的只有一份,而丢掉的那一份恰好是"继承来的完整用户 PATH"。
 * 症状是"能跑、只是找不到裸名命令",typecheck / lint / 其余门全都不响。
 *
 * 语义以 `apps/ai-service/app/core/exec_env.py` 为准(本仓已存在且正确的那一份对照实现),三条锚点:
 *  - `populate_env()` Step 4「set 覆盖(Windows 先大小写不敏感移除旧键)」⇒ **一个名字至多一种拼写**;
 *  - `merge_path_entries()` 的注释「既有条目保持原序在前(不抢用户/继承条目的优先级)」⇒ **继承值优先**;
 *  - `_get_env_value_ci()`「大小写不敏感取第一个匹配」⇒ 平局时按**键序第一份**,不做相似度、不猜。
 *
 * 由此得到本函数的取值规则(只动键名,**绝不合并/猜测值**):
 *  1. 删掉对象里全部大小写变体,统一以大写 `PATH` 写回;
 *  2. 多份并存时,取「与真实进程环境那一份相等」的变体;都不相等 ⇒ 取键序第一份(同 `_get_env_value_ci`);
 *  3. 对象里一份都没有 ⇒ **不发明值**(键保持缺席)。给"干净环境"策略注入进程 PATH 属于猜值,
 *     会把 `inherit: NONE` 那类策略悄悄变成 `ALL`,所以这一格只登记 choice,不写值;
 *  4. 变体值不是字符串 ⇒ 丢弃并计数;全部不可用 ⇒ 判「未判定」(见 PATH_ENV_UNDETERMINED),
 *     **不得静默写成空串**(空串与"没判出来"在子进程里表现相同,并桶就等于把没判写成判过了)。
 *
 * ⚠️ 规则 2 的后果要如实说:当调用方写的是 `{ ...process.env, PATH: 短patch }` 而宿主把 PATH 写成
 * `Path` 时,"真实进程环境优先"选中的是**继承的完整 PATH**,那个短 patch 会被丢弃。所以本出口
 * **不能当成站点改写的即插修复** —— 要把某个目录前置进子环境,正确写法是先归一、再在归一结果上
 * 显式赋值(一次写入、一种拼写):
 *     const env = normalizePathEnvKey({ ...process.env })
 *     env.PATH = [dir, env.PATH ?? ''].join(process.delimiter)
 *
 * 取证结论(2026-10-06 本机 Git Bash 宿主 / Windows 11 26200 / node v24.19.0,可重跑):
 *  - `Object.keys(process.env)` 里 PATH 族只有一种拼写 `PATH`(且 Node **确实保留**环境块原始大小写 ——
 *    同一份清单里 `CommonProgramFiles(x86)`、`PSModulePath` 都是混合大小写,所以这不是枚举归一化的假象),
 *    ⇒ 本机的 spread 复制根本产不出第二份键,三个候选站点(票面点名的两处 + 一处测试夹具)在
 *    **现取环境下不可达**;子进程侧实测 childPathCount=1、前置目录可见。
 *  - 双键的**破坏方向**只在构造面上被证实(构造 `{Path:A, PATH:B}` 派生真子进程 ⇒ 子进程只读到
 *    `["PATH"]` 且值 = B,A 那份整块消失)。构造面只证明"机制成立",不证明"我方站点会产出双键"。
 *  - 因此本票**只落纯函数 + 镜像测试,不改任何调用点**;而"其它宿主形状(钩子进程 / nssm 服务身份 /
 *    CI)下环境块是否写成 `Path`"在本会话不可实测 ⇒ 那一格是**未判定**,不得读成"不存在"。
 *
 * 定级:本模块是**出口不是判据**,刻意不接提交链(不改 guardian-runner / package.json / .husky /
 * pre-commit-hook,注册表类共享文件归主会话单写者),因此没有紧急跳过变量。
 */

/** 归一失败时挂在返回对象上的「未判定」原因(用 Symbol ⇒ 不进 Object.keys,不会被递给子进程)。 */
export const PATH_ENV_UNDETERMINED = Symbol.for('ihui.pathEnv.undetermined')
/** 归一做了什么选择的自述(同样是 Symbol 键,只给调用方与测试读,不进子进程 env)。 */
export const PATH_ENV_CHOICE = Symbol.for('ihui.pathEnv.choice')

const PATH_UPPER = 'PATH'

/** 对象里所有「大小写不敏感等于 PATH」的**自身可枚举字符串键**,保持键序。 */
export function variantsOfPathKey(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return []
  return Object.keys(obj).filter((k) => k.toUpperCase() === PATH_UPPER)
}

/**
 * 真实进程环境的 PATH(大小写不敏感地读,不写、不改 process.env)。
 * 取不到就返回 null 并附原因 —— 调用方据此走「未判定」,不得拿空串顶替。
 */
export function readProcessPath() {
  try {
    const v = process.env[PATH_UPPER]
    if (typeof v === 'string') return { value: v, available: true }
    return { value: null, available: false, reason: 'process.env.PATH 不是字符串' }
  } catch (e) {
    return { value: null, available: false, reason: `读不到进程环境:${e && e.message ? e.message : String(e)}` }
  }
}

/**
 * 从多份大小写变体里选一份值(纯决策,不碰对象)。
 * 优先级:与真实进程环境相等的那一份 > 键序第一份(= `_get_env_value_ci` 的"第一个匹配")。
 * 非字符串的变体一律丢弃并计数(它们不能进环境块)。
 */
export function pickPathVariant(variants, processPath, { processAvailable = true } = {}) {
  const usable = []
  const dropped = []
  for (const { key, value } of variants) {
    if (typeof value === 'string') usable.push({ key, value })
    else dropped.push(key)
  }
  if (usable.length === 0) {
    return { chosen: null, dropped, reason: dropped.length > 0 ? `PATH 变体值全部不是字符串(${dropped.join(', ')})` : '无可用的 PATH 变体' }
  }
  if (processAvailable && typeof processPath === 'string') {
    const match = usable.find((c) => c.value === processPath)
    if (match) {
      return {
        chosen: match,
        dropped,
        matchedProcessEnv: true,
        note: usable.length > 1 ? `多份变体(${usable.map((c) => c.key).join(', ')}),取与真实进程环境相等的那一份` : '唯一变体即进程环境那一份',
      }
    }
    // 都不等于进程环境 ⇒ 不猜"哪个更新",按键序第一份(exec_env._get_env_value_ci 同一条口径)
    return {
      chosen: usable[0],
      dropped,
      matchedProcessEnv: false,
      note: `没有一份变体等于真实进程环境(变体 ${usable.length} 份),按键序取 ${usable[0].key}`,
    }
  }
  return {
    chosen: usable[0],
    dropped,
    matchedProcessEnv: false,
    processEnvUnavailable: true,
    note: `真实进程环境取不到,按键序取 ${usable[0].key}`,
  }
}

/**
 * 归一入口:返回**新对象**(入参逐字不变),PATH 族至多剩一份且拼写为大写 `PATH`。
 *
 * @param {object} env 待归一的 env 对象(通常是 `{ ...process.env, ... }` 的那份副本)
 * @param {{ processPath?: string|null, processAvailable?: boolean }} [opts]
 *        测试通道:显式喂"真实进程环境的 PATH",缺省则现读 process.env
 * @returns {object} 新对象;Symbol 键上带 `PATH_ENV_CHOICE`(做了什么选择)与可能带
 *                   `PATH_ENV_UNDETERMINED`(为什么判不出)。Symbol 不进 Object.keys ⇒ 不会被递给子进程。
 */
export function normalizePathEnvKey(env, opts = {}) {
  const out = {}
  if (env === null || env === undefined || typeof env !== 'object') {
    out[PATH_ENV_UNDETERMINED] = `入参不是对象:${env === null ? 'null' : typeof env}`
    out[PATH_ENV_CHOICE] = { action: 'rejected', dropped: [] }
    return out
  }

  const keys = Object.keys(env)
  const variantKeys = keys.filter((k) => k.toUpperCase() === PATH_UPPER)
  const processProbe = opts.processPath === undefined ? readProcessPath() : { value: opts.processPath, available: true }
  // "取不到"与"取到了但不相等"是两件事:opts.processPath 传 null 属前者,不得被记成后者
  const processAvailable = processProbe.available !== false && typeof processProbe.value === 'string'

  // 非 PATH 键原样按序复制;`PATH` 追加在末尾 —— 键序对子进程环境块无语义(Node 拼块时按名解析,
  // libuv 还会排序),所以这里刻意不做"保位"的额外承诺,免得注释替实现撒謡。
  for (const k of keys) {
    if (k.toUpperCase() === PATH_UPPER) continue
    out[k] = env[k]
  }

  if (variantKeys.length === 0) {
    // 一份都没有:不发明值(见文件头规则 3),键保持缺席
    out[PATH_ENV_CHOICE] = { action: 'no-variant', dropped: [], wrote: false }
    return out
  }

  const picked = pickPathVariant(
    variantKeys.map((k) => ({ key: k, value: env[k] })),
    processProbe.value,
    { processAvailable },
  )

  if (!picked.chosen) {
    out[PATH_ENV_UNDETERMINED] = picked.reason
    out[PATH_ENV_CHOICE] = { action: 'undetermined', dropped: picked.dropped, wrote: false }
    return out
  }

  // 写回:统一大写键,落在第一个变体原本的键位上
  out[PATH_UPPER] = picked.chosen.value
  out[PATH_ENV_CHOICE] = {
    action: 'collapsed',
    collapsedFrom: variantKeys,
    keptKey: picked.chosen.key,
    dropped: picked.dropped,
    matchedProcessEnv: picked.matchedProcessEnv === true,
    processEnvUnavailable: picked.processEnvUnavailable === true,
    wrote: true,
    note: picked.note,
  }
  return out
}

// §22c:判据一律从本文件导出给测试用,测试不得再抄一份实现。
export const __test__ = { normalizePathEnvKey, variantsOfPathKey, pickPathVariant, readProcessPath, PATH_ENV_CHOICE, PATH_ENV_UNDETERMINED }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
