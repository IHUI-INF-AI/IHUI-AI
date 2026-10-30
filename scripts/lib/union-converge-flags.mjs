// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * union-converge 旗标面的唯一真相源（票 RP-79 剩余面，2026-10-30 立）。
 *
 * 为什么"先把清单抽成单源（含转发面）"是装闸的前置，而不是可选的美化：
 *   本器的消费点住在一把 5.8k 行的收敛器里，且写法不统一（`argv.includes(...)` /
 *   `argv[i] === '--x'` / `requireFlagValue(argv, '--x')` 三族并存，相等式那一族还是主力）。
 *   2026-10-30 只按 `argv.includes|indexOf|has|getFlag` 四形态扫只得 7 枚，而按本文件的
 *   `scanFlagConsumption` 现读是 17 枚（含 `--help`）。给"清单扫不全"的器装闸，失效方向会
 *   翻成**把同步链的正当动作拦停** —— `git-sync-converge` 明摆着会转发 `--accept-state-growth`
 *   与六条声明旗给它，漏一枚就是每次自动收敛当场死在闸上（§0.10 要求失效方向恒为"多要一次
 *   定向说明"）。所以清单必须先完备、且完备性由机器证。
 *
 * 本文件同时是四件事，一件都不许在别处再写一份（§0.6 单一真相源 / §22c）：
 *   ① 旗标清单（动作档 ∪ 带值档；声明族；调用方转发族）；
 *   ② 消费点扫描器 `scanFlagConsumption` —— 闸的**完备性**由它证明，而不是由注释宣称；
 *   ③ 闸本体 `judgeFlags`（纯函数、零 IO、零副作用，可被镜像测试直接问）；
 *   ④ 定向说明放行出路 `unknownFlagEscape` + 同一句写在 `USAGE` 里的出路（§0.8 不许写跑不通的出路）。
 *
 * ⚠️ 与 `scripts/git-sync-converge.mjs` 的关系：那把闸判的是**它自己那面旗**（`--status`
 *   `--align-only` 等，与本表无交集），清单已由本文件供给（`DECLARATION_FLAGS` 与转发族）；
 *   它的 argv 扫描循环本轮刻意不动（票面禁改其逻辑），故"扫描算法"暂存两处 —— 收口动作 =
 *   让 sync 侧改调本文件的 `findUnknownFlagToken`，见交付报告，不在此另立清单。
 */

/** 动作/开关档（不吃值）。 */
export const UNION_BOOLEAN_FLAGS = Object.freeze([
  '--self-test',
  '--apply',
  '--move-aware-detail',
  '--resurrect-block',
  '--show-all-bad',
  '--help',
])

/** 带值档（紧随其后的非旗 token 是它的值，不得被当成"未知旗"再判一遍）。 */
export const UNION_VALUE_FLAGS = Object.freeze([
  '--theirs',
  '--base',
  '--take-ours',
  '--take-theirs',
  '--take-theirs-doc',
  '--resolve',
  '--union-capped',
  '--supersede',
  '--fold-keep',
  '--declare-side-loss',
  '--accept-state-growth',
])

/**
 * 声明族：人对某一路径/某一行做的**声明式出口**。
 * 这六枚同时是本文件存在的另一半理由 —— `git-sync-converge` 逐条原样转发它们，
 * 两处各写一份必漂移（漂移过一次：转发面缺 `--accept-state-growth`，见票面）。
 */
export const DECLARATION_FLAGS = Object.freeze([
  '--take-theirs-doc',
  '--take-ours',
  '--take-theirs',
  '--resolve',
  '--union-capped',
  '--supersede',
])

/** 本器认识的全部旗 = 动作档 ∪ 带值档（两份不得各自演进，否则正当用法被自己拦死）。 */
export const UNION_KNOWN_FLAGS = Object.freeze([...UNION_BOOLEAN_FLAGS, ...UNION_VALUE_FLAGS])

/** `--accept-state-growth` 单独具名：调用方常驻裁决那一族量纲放行时要原样转这枚旗号。 */
export const SYNC_STATE_GROWTH_FLAG = '--accept-state-growth'

/**
 * 调用方 `scripts/git-sync-converge.mjs` 实际转发给本器的旗号（2026-10-30 按其派生点现读：
 * `const args = ['scripts/union-converge.mjs', '--apply', '--theirs', freshRemote]` +
 * `args.push(SYNC_STATE_GROWTH_FLAG, r)` + `declarationArgs(process.argv)`）。
 * 闸"绝不误杀同步链正当动作"这一半由 `SYNC_FORWARDED_FLAGS ⊆ UNION_KNOWN_FLAGS` 证明。
 */
export const SYNC_FORWARDED_FLAGS = Object.freeze(['--apply', '--theirs', SYNC_STATE_GROWTH_FLAG, ...DECLARATION_FLAGS])

/**
 * 消费点的全部书写形态（票面列了前四种；第五种"相等式"是本器主力，也正是"只得 7 枚"的漏因）。
 * 只认 argv 上的取用，不认任意 `.includes('--x')` —— 后者会命中错误文案里的字面量。
 */
export const FLAG_CONSUMPTION_FORMS = Object.freeze([
  ['argv.includes', /argv\.includes\(\s*['"](--[a-z][a-z0-9-]*)['"]/g],
  ['argv.indexOf', /argv\.indexOf\(\s*['"](--[a-z][a-z0-9-]*)['"]/g],
  ['set.has', /\.has\(\s*['"](--[a-z][a-z0-9-]*)['"]/g],
  ['getFlag/getOpt/requireFlagValue', /(?:getFlag|getOpt|requireFlagValue)\s*\(\s*[^,)]*,\s*['"](--[a-z][a-z0-9-]*)['"]/g],
  ['相等式 ===/!==', /(?:===|!==)\s*['"](--[a-z][a-z0-9-]*)['"]/g],
])

/** 扫描源码文本 ⇒ 实际被消费的旗标集合（清单完备性的机器证明，纯字符串进、集合出）。 */
export function scanFlagConsumption(sourceText) {
  const out = new Set()
  if (typeof sourceText !== 'string' || sourceText === '') return out
  for (const [, re] of FLAG_CONSUMPTION_FORMS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(sourceText)) !== null) out.add(m[1])
  }
  return out
}

/**
 * 纯校验：返回第一枚不认识的旗（字符串），全合法 ⇒ null。不 process.exit，好被镜像测试直接问。
 * 认 `--x=v` 等号形；`-h`/`--` 放行；不带 `-` 的 token 视为某个旗的值或位置参数，一律放行
 * （与 `flag-value.mjs` 的 `isFlagValueToken` 同口径：值必须不以 `-` 开头才算值）。
 */
export function findUnknownFlagToken(argv, opts = {}) {
  const known = opts.known ?? UNION_KNOWN_FLAGS
  const valueFlags = opts.valueFlags ?? UNION_VALUE_FLAGS
  const list = Array.isArray(argv) ? argv.slice(2) : []
  for (let i = 0; i < list.length; i++) {
    const a = String(list[i])
    if (!a.startsWith('-')) continue
    if (a === '-h' || a === '--') continue
    const key = a.includes('=') ? a.slice(0, a.indexOf('=')) : a
    if (!known.includes(key)) return a
    if (valueFlags.includes(key) && !a.includes('=')) {
      const v = list[i + 1]
      if (v !== undefined && !String(v).startsWith('-')) i++
    }
  }
  return null
}

/**
 * 三态判定（§0.3「没判」绝不写成「判过」，也绝不写成「红」）：
 *   ok           ⇒ 全部旗标认识；
 *   unknown      ⇒ 点名是哪一枚；
 *   undetermined ⇒ 闸本身拿不到输入（argv 不是数组 / 清单为空或形状坏）⇒ **闸没资格判**，
 *                  既不冒绿也不冒红，出路只有"给一次定向说明"或"把清单补全"。
 */
export function judgeFlags(argv, opts = {}) {
  const known = opts.known ?? UNION_KNOWN_FLAGS
  const valueFlags = opts.valueFlags ?? UNION_VALUE_FLAGS
  if (!Array.isArray(argv)) {
    return {
      verdict: 'undetermined',
      flag: null,
      reason: 'argv 没取到或不是数组 ⇒ 闸无从判"有没有未知旗"（不记绿也不冒红）',
    }
  }
  if (!Array.isArray(known) || known.length === 0) {
    return {
      verdict: 'undetermined',
      flag: null,
      reason: '旗标清单单源为空或形状坏 ⇒ 闸没资格判：放行是瞎放行，拦停是拿整条同步链押在一份空清单上',
    }
  }
  const bad = findUnknownFlagToken(argv, { known, valueFlags })
  if (bad) return { verdict: 'unknown', flag: bad, reason: `未认识的旗标 ${bad}` }
  return { verdict: 'ok', flag: null, reason: '' }
}

/** 定向说明放行的两个环境变量名（形态照本仓先例 `IHUI_ALLOW_REBASE` + `IHUI_ALLOW_REBASE_REASON`）。 */
export const UNKNOWN_FLAG_ESCAPE_ENV = Object.freeze({
  enable: 'IHUI_ALLOW_UNKNOWN_FLAG',
  reason: 'IHUI_ALLOW_UNKNOWN_FLAG_REASON',
  minReasonLength: 10,
})

/**
 * 「多要一次定向说明」那条出路本体（§0.10：闸的失效方向绝不能是"把同步链正当动作拦停"）。
 * 清单是人抄的，就会漏；漏了不能让下一手去裸做 git 手术（那把本器全部断言一起绕过）。
 * 纪律（§0.7「验过才免」）：必须 `enable==='1'` **且** 理由 ≥10 字才放行；缺一半、过短、
 * 只给空格 ⇒ 视同无放行，照旧 exit 2 并点名缺的是哪一半。放行时调用方必须逐条打印
 * 被放的是哪枚旗 + 理由，不得静默。
 */
export function unknownFlagEscape(env = process.env) {
  const e = env && typeof env === 'object' ? env : {}
  const { enable, reason, minReasonLength } = UNKNOWN_FLAG_ESCAPE_ENV
  const on = e[enable]
  const text = typeof e[reason] === 'string' ? e[reason].trim() : ''
  if (on !== '1') {
    return { allowed: false, reason: '', problem: `未设 ${enable}=1（本枚不放行）` }
  }
  if (text === '') return { allowed: false, reason: '', problem: `设了 ${enable}=1 却没给 ${reason}（空理由的放行等于没有判据）` }
  if (text.length < minReasonLength) {
    return {
      allowed: false,
      reason: text,
      problem: `${reason} 只有 ${text.length} 字，不足 ${minReasonLength} 字定向说明`,
    }
  }
  return { allowed: true, reason: text, problem: '' }
}

/**
 * 用法档。每一条旗号都必须与本表成套（双向形状锁见
 * `scripts/tests/union-converge-arg-guard.test.mjs`：清单里有而这里没印 = 跑不通的出路 §0.8；
 * 这里印了而清单里没有 = 文档承诺了一个不存在的动作）。
 * ⚠️ 本文本里除本表旗号与 `-h` 外不得出现别的 `--xxx`（那会被成套锁读成"承诺了没实现的旗"）。
 */
export const USAGE = [
  '用法: node scripts/union-converge.mjs                     # 只报告(零副作用,不落地)',
  '      node scripts/union-converge.mjs --apply             # 落地合并(临时索引+commit-tree+CAS,从不 checkout)',
  '      node scripts/union-converge.mjs --theirs <sha>      # 指定归并目标(默认 origin/<当前分支>)',
  '      node scripts/union-converge.mjs --base <sha>        # 显式指定三方归并基底(仅远端被强制重写过才需要)',
  `      声明旗(可重复,逐条打印并写进合并提交信息): ${DECLARATION_FLAGS.join(' ')}`,
  '      node scripts/union-converge.mjs --fold-keep \'<path>=<声明档 JSON>\'      # 折叠层拒裁时由人指定 keeper',
  '      node scripts/union-converge.mjs --declare-side-loss \'<path>=<声明档 JSON>\' # 逐行声明"对侧某行被有意取代"',
  '      node scripts/union-converge.mjs --accept-state-growth <维>=<理由>          # 声明并集天然放大的量纲',
  '      node scripts/union-converge.mjs --show-all-bad      # 全列落地闸障碍(缺省只印前 15 条并报名余下几条)',
  '      node scripts/union-converge.mjs --move-aware-detail # 逐行打印"因搬运感知而未取回"的行',
  '      node scripts/union-converge.mjs --resurrect-block   # 把行级复活的"新增强"折进落地闸(缺省只报数)',
  '      node scripts/union-converge.mjs --self-test         # 真临时仓回归自检',
  '      node scripts/union-converge.mjs --help|-h           # 本用法(rc=0,不执行任何动作)',
  `未知/拿不准的旗标出路(闸不静默掉进默认档,也不把同步链押死): ${UNKNOWN_FLAG_ESCAPE_ENV.enable}=1 ` +
    `${UNKNOWN_FLAG_ESCAPE_ENV.reason}="<≥${UNKNOWN_FLAG_ESCAPE_ENV.minReasonLength} 字:为什么这枚旗在本器上合法>" ` +
    'node scripts/union-converge.mjs … —— 被放行的旗号与理由会逐条打印,缺理由或理由过短仍按用法错 exit 2',
  '退出码: 0 = 无需合并/已落地且复核干净/用法打印 · 1 = 判据不过或需人工 · 2 = 用法错(含未知旗标)、闸未判定(UNDETERMINED)、或本器没资格判',
]

export const __test__ = {
  UNION_BOOLEAN_FLAGS,
  UNION_VALUE_FLAGS,
  DECLARATION_FLAGS,
  UNION_KNOWN_FLAGS,
  SYNC_STATE_GROWTH_FLAG,
  SYNC_FORWARDED_FLAGS,
  FLAG_CONSUMPTION_FORMS,
  scanFlagConsumption,
  findUnknownFlagToken,
  judgeFlags,
  UNKNOWN_FLAG_ESCAPE_ENV,
  unknownFlagEscape,
  USAGE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
