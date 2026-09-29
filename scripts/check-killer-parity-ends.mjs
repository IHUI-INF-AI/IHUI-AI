#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 全端杀手锏常量同构守门(GAP-PLAN P3-11)。
//
// 真源:apps/ai-service/app/core/tunables.py;TS 镜像:packages/shared/src/constants.ts;
// Py↔TS 逐值断言:apps/ai-service/tests/test_killer_parity.py(漂移即失败)。
// 本脚本负责另一半:扫描全部 TS 端(web/cli/miniapp/desktop/extension/packages)源码中
// 的"二次写死"(绕过单源 import 直接硬编码杀手锏常量值),白名单显式列出豁免。
//
// 用法:node scripts/check-killer-parity-ends.mjs [--warn-only] [--staged] [--worktree] [--strict] [--json] [--self-test]
// 退出码:0 = 无违例;1 = 有违例(--warn-only 时仅告警);2 = 无法判定(两面旗同给 / 清单或内容取不到 /
//   枚举到 0 个候选 / 豁免登记表自身坏了)。**2 不得被读成"判过了"**。
//
// 取材面(2026-09-28 从磁盘 walk 迁到被审面,由守门 118「门脚本取材面纪律对账」逼出):
// 全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 只作人工逃生舱,且仍走层的
// `readWorktreeFile`(不在门里留 `readFileSync` 读被审内容 —— 那正是本门迁出前的形态)。
// 旧实现按磁盘判,两个方向都会错:别人未 `git add` 的在途文件会被算成本仓违例(恒红),
// 而已入库的违例若恰好被人本地改过则看不见(假绿)。扫描集口径变化如实登记:旧磁盘档现读
// 3207,新档由 git 清单给出(差 1 个,来自 `ls-tree` 对非 ASCII 路径的引号化,不是内容差异)。
//
// 判据形状一条未改:四条 pattern 逐字保留。**同值不同义的假阳走 EXEMPT 登记理由**(本门
// 自己给的出路),而不是给 pattern 加"语义识别"—— 加语义识别等于让判据自己解释自己,
// 而它当初就是因为只能按值形状判才立得住。

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const GIT_TIMEOUT = 60000
const GIT_MAX_BUFFER = 1 << 26
const BATCH_MAX_BUFFER = 1 << 29

// 扫描范围:全部 TS 端源码(排除单源/镜像/产物/依赖)。相对路径 = git 清单的路径口径。
const SCAN_DIRS = [
  'apps/web/src',
  'apps/cli/src',
  'apps/miniapp-taro/src',
  'apps/desktop/src',
  'apps/extension/src',
  'packages',
]

const SRC_EXT = /\.(ts|tsx|mjs)$/
const EXCLUDE_DIR_PARTS = [
  'node_modules',
  'dist',
  '.next',
  'build',
  'out',
  'coverage',
  'constants.ts', // packages/shared/src/constants.ts = TS 镜像本体(单源侧)
]
// 单源侧目录:packages/context-compaction 是 TS 侧压缩算法包(真源的 TS 双胞胎,允许)
const SINGLE_SOURCE_PARTS = ['context-compaction']

/**
 * 一个被审面上的路径是否进射程。判据与旧磁盘 walk 同形:逐段看目录名(命中排除表或以 `.`
 * 开头即整棵跳过)、单源包跳过、只看 .ts/.tsx/.mjs。
 * ⚠️ 旧 walk 里 `'constants.ts'` 挂在**目录名**比对表上,而它是文件 —— 那一条从未生效过(dead
 * entry)。这里保持同形(不"顺手修好"),因为单源文件已由每条规则自己的 whitelist 兜住;
 * 把它当缺陷改活会同时改变扫描集,与本次"判据形状一字未改"的前提冲突。
 */
export function inScope(rel) {
  const segs = rel.split('/')
  const base = segs[segs.length - 1]
  if (!SRC_EXT.test(base)) return false
  for (const seg of segs.slice(0, -1)) {
    if (EXCLUDE_DIR_PARTS.includes(seg) || seg.startsWith('.')) return false
  }
  if (SINGLE_SOURCE_PARTS.some((p) => rel.includes(p))) return false
  return true
}

// 违例模式( killer 常量的典型二次写死形态)与各自豁免白名单:
const RULES = [
  {
    name: 'MCP 协议版本二次写死(须 import DEFAULT_PROTOCOL_VERSION)',
    pattern: /['"]2024-11-05['"]/,
    // 白名单:TS 镜像(SUPPORTED_PROTOCOL_VERSIONS 数组)、cli mcp-runtime(收敛注释提及旧版字符串)
    whitelist: [
      /packages[\\/]shared[\\/]src[\\/]constants\.ts$/,
      /apps[\\/]cli[\\/]src[\\/]tools[\\/]mcp-runtime\.ts$/, // 收敛历史注释中的字符串
      /\.test\.tsx?$/,
      /tests?\//,
    ],
  },
  {
    name: '压缩触发阈值 0.88 二次写死(须 import DEFAULT_TRIGGER_RATIO)',
    // 只抓赋值/兜底形态;>=、<=、>、< 比较、对象字面量(含 opacity 样式)与注释行不算
    pattern: /(?<![><!=])=\s*0\.88\b(?![.\d])|\?\?\s*0\.88\b/,
    whitelist: [
      /packages[\\/]context-compaction[\\/]/,
      /packages[\\/]shared[\\/]src[\\/]constants\.ts$/,
      /\.test\.tsx?$/,
      /tests?\//,
      /compaction-v2\.ts$/, // cli 压缩实现(已 import 单源,允许算法内部引用)
    ],
  },
  {
    name: '压缩目标比率 0.6 二次写死(须 import DEFAULT_TARGET_RATIO)',
    pattern: /(?<![><!=])=\s*0\.6\b(?![.\d])|\?\?\s*0\.6\b/,
    whitelist: [
      /packages[\\/]context-compaction[\\/]/,
      /packages[\\/]shared[\\/]src[\\/]constants\.ts$/,
      /\.test\.tsx?$/,
      /tests?\//,
      /compaction-v2\.ts$/,
    ],
  },
  {
    name: 'keep_recent=6 二次写死(须 import DEFAULT_KEEP_RECENT)',
    pattern: /KEEP_RECENT\s*=\s*6\b|keepRecent\s*[:=]\s*6\b(?![.\d])/,
    whitelist: [
      /packages[\\/]context-compaction[\\/]/,
      /packages[\\/]shared[\\/]src[\\/]constants\.ts$/,
      /\.test\.tsx?$/,
      /tests?\//,
      /compaction-cache\.ts$/, // P3-11 已收敛为 DEFAULT_KEEP_RECENT 引用(本行是赋值形态)
    ],
  },
]

// 显式豁免登记(带理由,新增豁免必须在此留痕):
// 1. apps/cli/src/commands/repl.ts triggerRatioOverride: 0.87 —— 故意覆盖(0.87 < 0.88,
//    否则 ceil(t/0.87)*0.88 恒 > t 永不触发强制压缩;API 端点同此数学),非漂移。
// 2. packages/shared/src/ui/back-chevron-spec.ts BACK_CHEVRON_PRESSED_OPACITY = 0.6 ——
//    **同值不同义**:0.6 在这里是图标按下态不透明度(opacity),不是压缩目标比率。
//    立此豁免的门自己撞上的(2026-09-28 `pnpm check:all` 唯一红项),而该文件的**存在理由**
//    恰是把"两端各自写死 0.6"收进一处 —— 按本门的设计意图,它是解药不是病灶。豁免**只挂到
//    0.6 那一条规则**(见 `rule` 字段):同一个文件里若再出现 MCP 协议版本或 0.88/keep_recent
//    写死,照旧判红。真阳性/假阳性各由 `--self-test` 与镜像测试钉住,不得靠"文件级整片放行"。
//
// `rule` 可选:不写 = 对该文件的所有规则放行(保持 1. 那条的历史语义);写了必须逐字命中某条
// 规则名 —— 名字写歪会让豁免**静默不生效**还是**静默扩大**?两者都可能,所以坏登记表一律
// 判"无法判定"(exit 2)而不是让它继续跑。
const EXEMPT = [
  {
    file: /apps[\\/]cli[\\/]src[\\/]commands[\\/]repl\.ts$/,
    reason: '强制压缩数学故意覆盖 0.87 < 0.88(见行内注释),非漂移',
  },
  {
    file: /packages[\\/]shared[\\/]src[\\/]ui[\\/]back-chevron-spec\.ts$/,
    rule: '压缩目标比率 0.6 二次写死(须 import DEFAULT_TARGET_RATIO)',
    reason: '图标按下态不透明度,与压缩目标比率同值不同义;该文件本身就是把两端 0.6 收进一处的单源',
  },
]

/**
 * 登记表自证:每条 `rule` 必须逐字命中一条规则名,每条必须有非空 reason。
 * 返回问题清单(空 = 表是好的)。本门把它当成**前置条件**而不是提示 —— 豁免表坏掉时,
 * 报告里的"违例 0 处"可能只是"豁免静默失效后我又把它当通过了"的反面。
 */
export function validateExemptRegistry(rules, exempts) {
  const problems = []
  const names = new Set(rules.map((r) => r.name))
  exempts.forEach((ex, i) => {
    if (!ex || typeof ex.file !== 'object' || !(ex.file instanceof RegExp)) {
      problems.push(`EXEMPT[${i}] 缺 file 正则 ⇒ 该条永远不会命中任何东西`)
      return
    }
    if (typeof ex.reason !== 'string' || ex.reason.trim() === '') {
      problems.push(`EXEMPT[${i}](${String(ex.file)})缺 reason ⇒ 豁免必须带理由`)
    }
    if (ex.rule !== undefined && !names.has(ex.rule)) {
      problems.push(`EXEMPT[${i}](${String(ex.file)})的 rule 名在任何规则里都不存在:${ex.rule}`)
    }
  })
  return problems
}

/** 某路径 + 某规则名当前生效的豁免条目(规则级优先;无 `rule` 的条目对所有规则生效)。 */
export function exemptionsFor(rel, ruleName, exempts = EXEMPT) {
  return exempts.filter(
    (ex) => ex.file.test(rel) && (ex.rule === undefined || ex.rule === ruleName),
  )
}

/**
 * 单个文件源的判据(与旧实现逐字同形:whitelist 按路径、行级注释跳过、EXEMPT 按路径)。
 * 抽成纯函数是为了让 `--self-test` 能拿**构造面**证明豁免是窄的 —— 判据一旦被磁盘状态喂,
 * 自检就只能复读实现(§22c「镜像测试只复读实现就是复读机」)。
 */
export function scanSource(rel, text, rules = RULES, exempts = EXEMPT) {
  const violations = []
  const exempted = []
  const lines = String(text).split('\n')
  for (const rule of rules) {
    if (rule.whitelist.some((re) => re.test(rel))) continue
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (rule.pattern.test(line)) {
        // 行级豁免:纯注释行(// 或 * 或 /*)中的提及不算写死
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*'))
          continue
        const ex = exemptionsFor(rel, rule.name, exempts)
        if (ex.length > 0) {
          exempted.push({
            file: rel,
            line: i + 1,
            rule: rule.name,
            reasons: ex.map((e) => e.reason),
          })
          continue
        }
        violations.push({ file: rel, line: i + 1, rule: rule.name, text: trimmed.slice(0, 160) })
      }
    }
  }
  return { violations, exempted }
}

/** 被审面上的文件清单。`staged` 走索引(= 本次暂存集),其余走 HEAD 树。 */
export function listFiles(face, root = ROOT) {
  if (face === 'staged') {
    const out = gitRaw(
      ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...SCAN_DIRS],
      root,
      {
        timeout: GIT_TIMEOUT,
        maxBuffer: GIT_MAX_BUFFER,
      },
    )
    return out
      .split('\0')
      .map((s) => s.replace(/\r$/, ''))
      .filter((p) => p && inScope(p))
  }
  if (face === 'head') {
    const out = gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS], root, {
      timeout: GIT_TIMEOUT,
      maxBuffer: GIT_MAX_BUFFER,
    })
    return out
      .split('\0')
      .map((s) => s.replace(/\r$/, ''))
      .filter((p) => p && inScope(p))
  }
  // worktree 档:清单仍取 git(只跟踪面),内容取磁盘 —— 且必须经层的 readWorktreeFile。
  const out = gitRaw(['ls-files', '-z', '--', ...SCAN_DIRS], root, {
    timeout: GIT_TIMEOUT,
    maxBuffer: GIT_MAX_BUFFER,
  })
  return out
    .split('\0')
    .map((s) => s.replace(/\r$/, ''))
    .filter((p) => p && inScope(p))
}

export function analyze({ face = 'head', root = ROOT, rules = RULES, exempts = EXEMPT }) {
  const problems = validateExemptRegistry(rules, exempts)
  if (problems.length > 0)
    throw new Error(`豁免登记表坏了,本门拒绝出具任何结论:\n  - ${problems.join('\n  - ')}`)

  const files = listFiles(face, root)
  const pre = face === 'staged' ? ':' : 'HEAD:'
  let contents
  if (face === 'worktree') {
    contents = null
  } else {
    try {
      contents = catBatch(
        root,
        files.map((p) => `${pre}${p}`),
        { maxBuffer: BATCH_MAX_BUFFER, timeout: GIT_TIMEOUT },
      )
    } catch (e) {
      throw new Error(`内容取不到:${String(e.message).split('\n')[0]}`)
    }
  }

  const violations = []
  const exempted = []
  const undetermined = []
  let scanned = 0
  for (const rel of files) {
    const src =
      face === 'worktree' ? readWorktreeFile(root, rel) : (contents.get(`${pre}${rel}`) ?? null)
    if (typeof src !== 'string') {
      undetermined.push(`${rel} —— 该面取不到内容 ⇒ 未判定(不回落另一个面)`)
      continue
    }
    scanned++
    const r = scanSource(rel, src, rules, exempts)
    violations.push(...r.violations)
    exempted.push(...r.exempted)
  }
  return { face, files, scanned, violations, exempted, undetermined }
}

/**
 * 自检全部走构造面:同一处 `= 0.6` 分别在"被豁免文件的 0.6 规则 / 同一文件的其它规则 /
 * 另一个未豁免文件"三种位置喂给判据,三态必须各自不同。真仓那一格只在被审面上跑一次,
 * 用来证明"豁免确实在被审面上生效"而不是"判据看不见那个文件"。
 */
export function selfTest({ face = 'head', root = ROOT } = {}) {
  const results = []
  const t = (name, cond) => {
    const okv =
      typeof cond === 'function'
        ? (() => {
            try {
              return cond()
            } catch {
              return false
            }
          })()
        : cond
    results.push({ name, ok: okv === true })
    return okv === true
  }
  const SIX = 'packages/shared/src/constants.ts'
  const CHEVRON = 'packages/shared/src/ui/back-chevron-spec.ts'
  const OTHER = 'apps/web/src/components/whatever.tsx'
  const ratio6 = 'export const BACK_CHEVRON_PRESSED_OPACITY = 0.6\n'
  const protoLine = "export const P = '2024-11-05'\n"
  const keepLine = 'const keepRecent = 6\n'

  // ① 该文件的 0.6 被规则级豁免放过(本票要消的那一条假阳)
  const a = scanSource(CHEVRON, ratio6)
  t(
    'A1 被豁免文件的 0.6 ⇒ 不判红、计入 exempted',
    a.violations.length === 0 && a.exempted.length === 1,
  )
  // ② **同一个文件**的其它规则必须照判红 —— 豁免不得整片放行
  const b = scanSource(CHEVRON, protoLine + keepLine)
  t('A2 同一文件的协议版本/keep_recent 写死 ⇒ 仍判红(豁免是按规则的)', b.violations.length === 2)
  // ③ 另一个未豁免文件的 0.6 必须照判红 —— 豁免不得按值扩散
  const c = scanSource(OTHER, ratio6)
  t('A3 未豁免文件的 0.6 ⇒ 判红(豁免是按路径的)', c.violations.length === 1)
  // ④ 单源侧文件由 whitelist 放过(旧行为保持)
  const d = scanSource(SIX, ratio6)
  t(
    'A4 单源镜像文件仍由 whitelist 放过(未因新判据变严)',
    d.violations.length === 0 && d.exempted.length === 0,
  )
  // ⑤ 注释行不判(旧行为保持)
  const e = scanSource(OTHER, '// export const X = 0.6\n')
  t('A5 纯注释行不判红', e.violations.length === 0)
  // ⑥ 坏登记表必须拒绝出结论:rule 名写歪 / 缺理由
  const p1 = validateExemptRegistry(RULES, [{ file: /x$/, reason: 'r', rule: '不存在的名' }])
  const p2 = validateExemptRegistry(RULES, [{ file: /x$/, rule: RULES[2].name }])
  t('A6 豁免条目 rule 名不在规则集 ⇒ 报问题', p1.length === 1)
  t('A7 豁免条目缺 reason ⇒ 报问题(豁免必须带理由)', p2.length === 1)
  // ⑧ 扫描集口径:inScope 与旧 walk 同形(目录排除、单源跳过、扩展名)
  t(
    'A8 inScope 判据:端源码在射程、产物/单源/点开头目录不在',
    inScope('packages/shared/src/ui/x.ts') === true &&
      inScope('packages/context-compaction/src/x.ts') === false &&
      inScope('apps/web/src/a/dist/x.ts') === false &&
      inScope('apps/web/src/.cache/x.ts') === false &&
      inScope('apps/web/src/x.css') === false,
  )

  // ⑨ 真仓阳性对照:被审面上必须**看得见**那个文件本身(否则"违例 0"是瞎出来的)
  try {
    const act = analyze({ face, root })
    const seen = act.files.includes(CHEVRON)
    t(`A9 真仓(${face} 面)清单里点名 ${CHEVRON} ⇒ 0 违例不是因为看不见它`, seen === true)
    t(
      'A10 真仓判红 0 处、且豁免恰好命中 1 处(那条假阳确实被"带理由豁免"关掉而非被无视)',
      act.violations.length === 0 && act.exempted.filter((x) => x.file === CHEVRON).length === 1,
    )
    t('A11 真仓扫描集非空(空枚举不配结论)', act.scanned > 1000)
    // ⑫ 把**真仓那一行**喂给同一判据、但清空豁免表 ⇒ 必须判红。这一条是"判据有牙"的证明:
    //    A1/A10 只能证明"豁免生效",证不了"pattern 认得出被审面上的那个形态"。
    const pre = face === 'staged' ? ':' : 'HEAD:'
    const blob =
      face === 'worktree'
        ? readWorktreeFile(root, CHEVRON)
        : catBatch(root, [`${pre}${CHEVRON}`], {
            maxBuffer: BATCH_MAX_BUFFER,
            timeout: GIT_TIMEOUT,
          }).get(`${pre}${CHEVRON}`)
    const naked = typeof blob === 'string' ? scanSource(CHEVRON, blob, RULES, []) : null
    t(
      'A12 同一份真仓内容 + 空豁免表 ⇒ 必须判红(阳性对照,证明 pattern 认得这个形态)',
      naked !== null && naked.violations.length >= 1 && naked.violations[0].rule === RULES[2].name,
    )
  } catch (err) {
    t(`A9–A12 真仓对照跑不动:${err.message.split('\n')[0]}`, false)
  }

  const fail = results.filter((r) => !r.ok)
  for (const r of results) console.log(`${r.ok ? '  ✅' : '  ❌'} ${r.name}`)
  console.log(
    `[check-killer-parity-ends] 自检 ${results.length - fail.length}/${results.length} 通过`,
  )
  return fail.length === 0 ? 0 : 1
}

function main(argv) {
  const warnOnly = argv.includes('--warn-only')
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    return 2
  }
  if (argv.includes('--self-test')) return selfTest({ face: sel.face })

  let a
  try {
    a = analyze({ face: sel.face })
  } catch (e) {
    console.error(`❌ 无法判定(不冒红也不记绿):${String(e.message)}`)
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face: a.face, scanned: a.scanned, ...a }, null, 2))
  } else {
    if (a.files.length === 0 && a.face === 'staged') {
      console.log(
        '[check-killer-parity-ends] 判定面=staged:本次没有射程内文件 ⇒ 本门不适用,不是"已判定干净"。',
      )
      return 0
    }
    if (a.files.length === 0) {
      console.error('❌ 枚举到 0 个候选文件 ⇒ 判据失明,不记通过')
      return 2
    }
    console.log(
      `[check-killer-parity-ends] 判定面=${a.face === 'worktree' ? '工作树(仅人工)' : a.face}:` +
        `扫描 ${a.scanned} 个 TS 源文件,违例 ${a.violations.length} 处,带理由豁免 ${a.exempted.length} 处`,
    )
    for (const v of a.violations)
      console.error(`  ❌ [${v.rule}] ${v.file}:${v.line}\n    ${v.text}`)
    for (const x of a.exempted)
      console.log(`  ℹ️ 已豁免(带理由):${x.file}:${x.line} [${x.rule}] —— ${x.reasons.join(' / ')}`)
    for (const u of a.undetermined) console.log(`  ⚠️ 未判定:${u}`)
    if (a.violations.length > 0) {
      console.error(
        '\n修复方式:改 import @ihui/context-compaction(压缩)或 @ihui/shared(MCP 协议)单源常量;' +
          '\n确属故意的本地参数请在此脚本 EXEMPT 登记理由(且必须写 rule 限定到哪一条规则),' +
          '\n不得静默扩散硬编码。',
      )
      if (!warnOnly) return 1
      console.warn('[check-killer-parity-ends] --warn-only:仅告警不阻断')
    }
  }
  if (argv.includes('--strict') && a.undetermined.length > 0) return 2
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${String(e?.message ?? e)}`)
    process.exit(2)
  }
}

export const __test__ = {
  RULES,
  EXEMPT,
  SCAN_DIRS,
  inScope,
  scanSource,
  validateExemptRegistry,
  exemptionsFor,
  listFiles,
  analyze,
  selfTest,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
