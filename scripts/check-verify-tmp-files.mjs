#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-verify-tmp-files.mjs — 一次性验证/探针脚本落点守门(AGENTS.md §25 配套)
 *
 * 背景(2026-07-26 立):
 *   Agent 在调试 / 验证 / 探查某项功能时,常在 apps 下各端(apps/web, apps/api)
 *   的源码根目录随手写 verify-xxx.mjs / verify-xxx.ts 脚本(如
 *   verify-permission-popover-v2.mjs / verify-permission-popover-v3.mjs /
 *   verify-login-tabs.mjs),git status 会显示为 untracked,极易被误 commit
 *   污染 main 分支。
 *
 * 扩面(2026-11-06,Z40 席;判据只增不减):
 *   Z38 席实测到本门结构上看不见的一型 —— apps/api/scripts/tmp-{mcode-guard,
 *   mcode-identity,queue-state}.ts 三枚未跟踪探针,把
 *   `pnpm turbo typecheck --filter=@ihui/api` 的第二腿(tsconfig.scripts.json
 *   的 include 面)打成 4 条红,挡住的是全端 typecheck(= 所有人的 pre-push)。
 *   当时本门移动前后同读「扫描总数 0 / 警告 0」,因为:
 *     ① VERIFY_FILE_RE 只认 `verify-` 前缀,认不出 `tmp-` 形态;
 *     ② EXCLUDE_DIRS 含 'scripts'(2026-07-27 verify-ops 假阳性修复),
 *        而该形态的主战场恰在 apps/<端>/scripts/ 下,游走期就被剪掉了。
 *   ⇒ 新增 TMP_FILE_RE + findTmpFiles 一族:游走时对 'scripts' 单目录放行
 *     (仅这一族,其余排除项含 node_modules/dist/测试目录一律照旧),把
 *     `apps/**` 下的 `tmp-*.{ts,mts,mjs,js}` 纳入点名。扩展名只收这四种,
 *     正是 tsconfig.scripts.json 能吃到的形。
 *   verify-* 一族的判据语义一个字节没改(含 apps/<端>/scripts/ 的豁免),
 *   档位也保持现读的 warn(§12e:升 blocking 的前置是存量归零,本席只负责
 *   让这把尺「能看见」)。
 *
 * 检查项:
 *   1. apps 下各端源码区的 verify-*.* (主项,口径不变):命中即警告
 *   2. apps 下各端的 tmp-*.{ts,mts,mjs,js} 一次性探针(2026-11-06 新增):
 *      含 apps/<端>/scripts/ 穿透;口径与 ① 同 —— 只判"落在错误的目录",
 *      合法落点 = .ihui-agent/tmp/<任务名>/
 *   3. 测试目录豁免:__tests__/ / tests/ / spec/ / test/ 目录下的命中是
 *      合法测试文件,跳过(否则与 §23 测试目录规则冲突)
 *   4. 隐藏目录/产物/依赖目录豁免:node_modules / .next / dist / .git /
 *      .ihui-agent 等
 *
 * 取材面(§0.4 口径的如实声明,不是逃生舱):
 *   本门射程 = **未跟踪的一次性落点**,而"未跟踪"这一事实在 HEAD blob 面与
 *   索引面上结构上不存在 ⇒ 唯一可见面是工作树文件系统。故取材面恒为工作树,
 *   并在输出里显式声明;--staged 透传时同样判工作树(不冒充索引面判定,
 *   也不因旗标而 exit 2)。扫描根缺失时打「扫描根缺失 ⇒ 射程为空」提示,
 *   不把它写成"全绿"。
 *
 * 退出码:
 *   0 — 通过(默认 warn-only,即使有警告也 exit 0)
 *   1 — --strict 模式下有警告 → 阻断;--self-test 判据不符
 *   2 — --strict 下扫描根缺失(未判定,不记绿)/ --self-test 夹具建不起来 / 脚本自身异常
 *
 * 用法:
 *   node scripts/check-verify-tmp-files.mjs                  (默认 warn-only)
 *   node scripts/check-verify-tmp-files.mjs --strict         (警告即阻断)
 *   node scripts/check-verify-tmp-files.mjs --staged         (pre-commit 透传)
 *   node scripts/check-verify-tmp-files.mjs --self-test      (门体判据自证,夹具走 mkScratch)
 *   取证另见镜像测试:node --test scripts/tests/check-verify-tmp-files.test.mjs(§22c)
 *
 * 集成位置: CI / guardian-runner 后续项(暂 warn-only)
 * 历史案例: 见 .ihui-agent/archive/AGENTS_history.md §25
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
// §15b:临时夹具唯一批准落点(mkScratch/rmScratch),不得用 os.tmpdir()、不得落仓库树内
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const ROOT = resolve(process.cwd())
// 只扫描源码区,跳过产物/依赖/审计
const SCAN_ROOTS = ['apps']
// 排除目录(产物/依赖/版本控制/审计)
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.output',
  'dist',
  'build',
  'coverage',
  '.ihui-agent',
  '.git',
  '.swc',
  '.cache',
  '.pnpm-store',
  '.husky',
  'storybook-static',
  '.vercel',
  '.nitro',
  '.angular',
  '__pycache__',
  'scripts', // apps/*/scripts/ 下的合法运维/验证脚本(非临时文件)—— 仅对 verify-* 一族剪除;tmp-* 一族穿透它,见 findTmpFiles
])
// 隐藏目录白名单
const ALLOWED_DOT_DIRS = new Set([
  '.vscode',
  '.idea',
  '.git',
  '.github',
  '.husky',
  '.changeset',
  '.vs',
])
// 测试目录白名单(verify-*.test.ts 命名不算临时文件,§23 配套)
const TEST_DIR_NAMES = new Set(['__tests__', 'tests', 'test', 'spec'])
// verify-*.{mjs,cjs,js,ts,tsx,jsx} 匹配
const VERIFY_FILE_RE = /^verify-.+\.(mjs|cjs|js|ts|tsx|jsx)$/i
// tmp-*.{ts,mts,mjs,js} 一次性探针形态匹配(2026-11-06 Z40 席扩面,立因见文件头)
// 只收这四种扩展名:正是 apps/api/tsconfig.scripts.json 的 include 面能吃到的形
// (收宽会把 .tsx/.jsx 这类端内真实源码一起卷进来 —— 那是缩面式的误伤,不是扩面)。
const TMP_FILE_RE = /^tmp-.+\.(mts|mjs|ts|js)$/i

/**
 * 两种命中形态的登记(判据表唯一出口,main 与 __test__ 共用同一份)
 * descendScriptDirs:是否穿透名为 scripts 的目录 —— verify-* 一族保持 2026-07-27
 * 的假阳性修复语义(false),tmp-* 一族必须穿透(true),否则 Z38 实测那一型仍看不见。
 */
const STRAY_FORMS = [
  {
    key: 'verify-*',
    title: '1. apps/*/verify-*.mjs / verify-*.ts 扫描',
    re: VERIFY_FILE_RE,
    cleanLine: '无 verify-*.* 临时文件',
    hitLine: '个 verify-*.* 临时文件,逐个核对…',
    descendScriptDirs: false,
    reason: 'verify-*.* 临时验证文件位于 apps/* 源码根目录,易被误 commit 污染 main',
    fixExample: (b) => `.ihui-agent/tmp/perm-popover-debug/${b}`,
  },
  {
    key: 'tmp-*',
    title: '2. apps/**/tmp-*.ts|mts|mjs|js 一次性探针扫描(含 apps/*/scripts/ 穿透)',
    re: TMP_FILE_RE,
    cleanLine: '无 tmp-*.* 一次性探针文件',
    hitLine: '个 tmp-*.* 一次性探针文件,逐个核对…',
    descendScriptDirs: true,
    reason:
      'tmp-*.{ts,mts,mjs,js} 一次性探针落在 apps/ 源码区(含 apps/*/scripts/),会被该端 tsconfig 的 include 面吃进 typecheck —— 2026-11-06 Z38 实测:apps/api/scripts/tmp-*.ts 三枚把 @ihui/api typecheck 第二腿打成 4 条红,挡的是全端 typecheck(= 所有人的 pre-push)',
    fixExample: (b) => `.ihui-agent/tmp/rea-goal-b49/${b}`,
  },
]

function header(label) {
  return `\n${C.cyan}${C.bold}── ${label} ──${C.reset}`
}

/**
 * 递归扫描目录,返回所有命中 fileRe 的文件绝对路径(游走器唯一实现,两种形态共用)
 * @param {string} root 扫描根目录(绝对路径)
 * @param {RegExp} fileRe 命中形态
 * @param {{descendScriptDirs?: boolean}} [opts] 为 true 时穿透名为 scripts 的目录
 *        —— 只放宽"这一格",EXCLUDE_DIRS 其余项(依赖/产物/.ihui-agent)与测试目录
 *           豁免一律照旧生效(其子目录仍逐格过同一套判据)。
 * @returns {string[]} 命中文件绝对路径列表
 */
function collectStrayFiles(root, fileRe, opts = {}) {
  const descendScriptDirs = opts.descendScriptDirs === true
  const results = []
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const name = entry.name
      const full = join(dir, name)
      if (entry.isDirectory()) {
        const pierce = descendScriptDirs && name === 'scripts'
        if (!pierce) {
          if (EXCLUDE_DIRS.has(name)) continue
          if (name.startsWith('.') && !ALLOWED_DOT_DIRS.has(name)) continue
          // 测试目录豁免(§23):tests/ __tests__/ spec/ test/ 下的是合法测试文件
          if (TEST_DIR_NAMES.has(name)) continue
        }
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!fileRe.test(name)) continue
      results.push(full)
    }
  }
  return results
}

/**
 * verify-*.* 一族:口径与 2026-07-26 建门时逐字一致(含 apps/<端>/scripts/ 豁免)
 * @param {string} root 扫描根目录(绝对路径)
 * @returns {string[]} 命中文件绝对路径列表
 */
function findVerifyFiles(root) {
  return collectStrayFiles(root, VERIFY_FILE_RE)
}

/**
 * tmp-*.{ts,mts,mjs,js} 一族(2026-11-06 扩面):穿透 apps/<端>/scripts/
 * @param {string} root 扫描根目录(绝对路径)
 * @returns {string[]} 命中文件绝对路径列表
 */
function findTmpFiles(root) {
  return collectStrayFiles(root, TMP_FILE_RE, { descendScriptDirs: true })
}

function toRel(absPath) {
  return relative(ROOT, absPath).split(sep).join('/')
}

/**
 * --self-test(2026-11-06 补):门体判据的进程内自证,夹具落 §15b 唯一批准落点。
 * 钉两件事:① verify-* 一族口径与建门时逐字一致(含 scripts/ 与测试目录豁免);
 * ② tmp-* 一族必须穿透 scripts/ 而不放宽其他豁免。CLI 面由镜像测试钉,这里不重复。
 * 退出码(§22d 约定):0 = 全部通过 / 1 = 判据不符 / 2 = 夹具建不起来(未判定,不记绿)。
 * @returns {Promise<number>}
 */
async function selfTest() {
  const FIXTURES = [
    'apps/web/verify-a.mjs',
    'apps/web/src/verify-deep.ts',
    'apps/web/scripts/verify-ops.mjs', // verify 族对 scripts/ 的 2026-07-27 豁免,必须原样生效
    'apps/web/tests/verify-t.mjs', // 测试目录豁免
    'apps/web/node_modules/verify-p.mjs', // 依赖目录豁免
    'apps/api/scripts/tmp-probe.ts',
    'apps/api/scripts/tmp-mcode-guard.ts', // ↓ 三枚 = Z38 席实测现场形态
    'apps/api/scripts/tmp-mcode-identity.ts',
    'apps/api/scripts/tmp-queue-state.ts',
    'apps/api/scripts/tmp-run.mts',
    'apps/api/scripts/tmp-shell.js',
    'apps/api/scripts/tmp-comp.tsx', // 不收:端内真实源码面
    'apps/api/scripts/tests/tmp-keep.ts', // 穿透不得顺带放宽测试目录豁免
    'apps/api/.ihui-agent/tmp/x/tmp-probe.ts', // 合法落点
    'apps/web/check-tmp.mjs', // 必须锚定 tmp- 前缀
  ]
  const WANT_VERIFY = ['web/verify-a.mjs', 'web/src/verify-deep.ts']
  const WANT_TMP = [
    'api/scripts/tmp-mcode-guard.ts',
    'api/scripts/tmp-mcode-identity.ts',
    'api/scripts/tmp-probe.ts',
    'api/scripts/tmp-queue-state.ts',
    'api/scripts/tmp-run.mts',
    'api/scripts/tmp-shell.js',
  ]

  const dir = mkScratch('ihui-verify-selftest-')
  const results = []
  const check = (label, actual, want) => {
    const a = [...actual].sort().join('|')
    const w = [...want].sort().join('|')
    results.push({ label, ok: a === w, detail: `实际=[${a}] 期望=[${w}]` })
  }
  try {
    for (const rel of FIXTURES) {
      const full = join(dir, rel)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, 'export const x = 1\n')
    }
    const apps = join(dir, 'apps')
    const relOf = (absList) =>
      absList.map((p) =>
        p
          .slice(apps.length + 1)
          .split(sep)
          .join('/'),
      )
    // 登记表(STRAY_FORMS)必须与具名包装器逐字同面:main 走前者、测试走后者,
    // 两边一旦漂移(例如有人把 descendScriptDirs 改回 false)本条当场翻红。
    const WANT = { 'verify-*': WANT_VERIFY, 'tmp-*': WANT_TMP }
    const wrapperOf = { 'verify-*': findVerifyFiles, 'tmp-*': findTmpFiles }
    for (const form of STRAY_FORMS) {
      const tableHits = relOf(
        collectStrayFiles(apps, form.re, {
          descendScriptDirs: form.descendScriptDirs,
        }),
      )
      check(`形态 ${form.key} 命中面(登记表驱动)`, tableHits, WANT[form.key])
      check(`形态 ${form.key} 包装器与登记表同源`, relOf(wrapperOf[form.key](apps)), tableHits)
    }
    check(
      'TMP_FILE_RE 扩展名口径',
      ['tmp-a.ts', 'tmp-a.mts', 'tmp-a.mjs', 'tmp-a.js']
        .filter((n) => TMP_FILE_RE.test(n))
        .concat(
          ['tmp-a.tsx', 'tmp-a.py', 'check-tmp.mjs', 'utils.mjs'].filter((n) =>
            TMP_FILE_RE.test(n),
          ),
        ),
      ['tmp-a.ts', 'tmp-a.mts', 'tmp-a.mjs', 'tmp-a.js'],
    )
  } finally {
    rmScratch(dir)
  }

  const failed = results.filter((r) => !r.ok)
  console.log(`${C.cyan}${C.bold}── --self-test 门体判据自证 ──${C.reset}`)
  for (const r of results) {
    console.log(
      `  ${r.ok ? `${C.green}✔${C.reset}` : `${C.red}✖${C.reset}`} ${r.label}${r.ok ? '' : `  ${C.dim}${r.detail}${C.reset}`}`,
    )
  }
  console.log(`  自检例数: ${C.bold}${results.length}${C.reset} 失败: ${failed.length}`)
  if (failed.length > 0) {
    console.log(`${C.red}❌ 判据与期望不符 ⇒ exit 1${C.reset}`)
    return 1
  }
  console.log(`${C.green}✅ 自检通过${C.reset}`)
  return 0
}

async function main() {
  const isStrict = process.argv.includes('--strict')
  const isStaged = process.argv.includes('--staged')

  if (process.argv.includes('--self-test')) return selfTest()

  console.log(
    `${C.cyan}${C.bold}🛡️  verify-*.mjs / verify-*.ts 临时文件归档守门(AGENTS.md §25 配套;2026-11-06 扩面纳入 tmp-*.{ts,mts,mjs,js})${C.reset}`,
  )
  console.log(`${C.dim}扫描根: ${ROOT}${C.reset}`)
  console.log(`${C.dim}扫描范围: ${SCAN_ROOTS.join(', ')}${C.reset}`)
  console.log(
    `${C.dim}取材面: 工作树文件系统 —— "未跟踪"这一事实只在工作树面存在(HEAD blob / 索引面结构上看不见),故 §0.4 的 HEAD/索引两档不适用本门;此处如实声明,不冒充${C.reset}`,
  )
  if (isStaged) {
    console.log(`${C.dim}--staged 透传:仍判工作树面(不冒充索引面结论,也不因旗标改档)${C.reset}`)
  }
  console.log(
    `${C.dim}模式: ${isStrict ? 'strict(警告即阻断)' : 'warn-only(仅提示不阻断)'}${C.reset}`,
  )

  const issues = []
  let totalScanned = 0

  const missingRoots = SCAN_ROOTS.filter((r) => !existsSync(join(ROOT, r)))
  if (missingRoots.length > 0) {
    // §0.3:射程为空要说明"为空",绝不写成"已全部归档"
    console.log(
      `  ${C.yellow}⚠${C.reset} 扫描根缺失: ${missingRoots.join(', ')} —— 本轮射程为空(不等于"已归档")`,
    )
  }

  // ── 1./2. apps 下各端逐形态扫描(形态表 STRAY_FORMS 唯一出口) ──
  for (const form of STRAY_FORMS) {
    console.log(header(form.title))
    for (const r of SCAN_ROOTS) {
      const abs = join(ROOT, r)
      if (!existsSync(abs)) continue
      const files = collectStrayFiles(abs, form.re, {
        descendScriptDirs: form.descendScriptDirs,
      })
      totalScanned += files.length
      if (files.length === 0) {
        console.log(`  ${C.green}✅${C.reset} ${C.dim}${r}/${C.reset} ${form.cleanLine}`)
      } else {
        console.log(
          `  ${C.yellow}⚠${C.reset} 发现 ${C.bold}${files.length}${C.reset} ${form.hitLine}`,
        )
        for (const file of files) {
          const rel = toRel(file)
          const basename = file.split(/[\\/]/).pop()
          issues.push({
            level: 'warn',
            form: form.key,
            path: rel,
            reason: form.reason,
            fix: `移动到 ${C.cyan}.ihui-agent/tmp/<任务名>/${C.reset}(如 ${form.fixExample(basename)})`,
          })
          console.log(
            `  ${C.yellow}⚠${C.reset} ${C.bold}${rel}${C.reset}  ${C.yellow}[WARN]${C.reset}`,
          )
        }
      }
    }
  }

  // ── 3. 综合判定 ──
  console.log(header('3. 综合判定'))
  const warnIssues = issues.filter((i) => i.level === 'warn')
  const byForm = new Map()
  for (const it of warnIssues) {
    byForm.set(it.form, (byForm.get(it.form) ?? 0) + 1)
  }

  console.log(`  扫描总数: ${C.bold}${totalScanned}${C.reset}`)
  console.log(`  警告项: ${C.yellow}${C.bold}${warnIssues.length}${C.reset}`)
  if (warnIssues.length > 0) {
    // 存量必须按形态分桶报数(谁的现场点谁,不并桶、不代清理)
    for (const [form, n] of byForm) {
      console.log(`    · ${form} 形态命中: ${n}`)
    }
  }
  if (missingRoots.length > 0) {
    console.log(`  ${C.yellow}未判定维度:${C.reset} 扫描根缺失 ${missingRoots.join(', ')}`)
  }

  if (warnIssues.length === 0 && missingRoots.length === 0) {
    console.log(
      `\n  ${C.green}${C.bold}✅ 所有 verify-*.* / tmp-*.* 一次性脚本均在合法落点(或未发现)${C.reset}`,
    )
    return 0
  }

  // §0.3:扫描根整体缺失 ⇒ 射程为空,这一轮是「未判定」而不是「全绿」
  if (warnIssues.length === 0 && missingRoots.length > 0) {
    console.log(
      `\n  ${C.yellow}${C.bold}⚠️  未判定:扫描根缺失 ⇒ 本轮一枚候选都没枚举到,不记绿${C.reset}`,
    )
    return isStrict ? 2 : 0
  }

  // 输出警告列表
  console.log(`\n${C.yellow}${C.bold}⚠️  发现 ${warnIssues.length} 个警告项:${C.reset}`)
  for (const it of warnIssues) {
    console.log(
      `  ${C.yellow}⚠${C.reset} ${C.bold}${it.path}${C.reset} ${C.dim}[形态:${it.form}]${C.reset}`,
    )
    console.log(`     ${C.dim}原因:${C.reset} ${it.reason}`)
    console.log(`     ${C.dim}修复:${C.reset} ${it.fix}`)
  }

  console.log(`\n${C.yellow}💡 建议(AGENTS.md §25):${C.reset}`)
  console.log(
    `   1. 把 ${C.cyan}apps/**/verify-*.mjs${C.reset} 与 ${C.cyan}apps/**/tmp-*.{ts,mts,mjs,js}${C.reset} 移到 ${C.cyan}.ihui-agent/tmp/<任务名>/${C.reset}`,
  )
  console.log(`   2. 详细规则见 ${C.cyan}AGENTS.md §25${C.reset}`)
  console.log(
    `   3. ${C.dim}默认 warn-only 不阻断,加 ${C.reset}${C.cyan}--strict${C.reset}${C.dim} 启用阻断模式;扫描根缺失时 --strict 记 exit 2(未判定)${C.reset}`,
  )

  if (isStrict) {
    console.log(`\n${C.red}❌ --strict 模式下警告即阻断,exit 1${C.reset}`)
    return 1
  }

  console.log(`\n${C.green}✅ 警告项已提示(不阻塞,默认 warn-only)${C.reset}`)
  return 0
}

// ── §22d 双形态入口守卫(G-1058651)────────────────────────────────
// 改前本门顶层是裸 `main().catch(...)`:任何 import 本门的进程都会在 import 期真的跑
// 一遍全仓 apps/ 扫描并打印 13 行 CLI 输出(实测),而且 main() 用 process.exit 收尾,
// 等于把宿主进程一起带走 —— 镜像测试因此只能走进程面、拿不到判据。
// 现在:CLI 直跑才执行 main();被 import 时零副作用,判据单元经 __test__ 单点导出(§22c)。
// 必须经 pathToFileURL():Windows 下 process.argv[1] 带反斜杠,手拼 file:/// 永不相等。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`${C.red}❌ 脚本执行异常:${C.reset}`, e?.message ?? e)
      console.error(e?.stack ?? '(no stack)')
      process.exit(2) // 2 = 脚本自身异常,1 = 业务判定失败(§22d 档位约定)
    })
}

// §22c:判据单元经 __test__ 单点暴露给镜像测试
// (scripts/tests/check-verify-tmp-files.test.mjs),测试禁止再抄一份豁免表/正则。
// 出口形状由镜像用例 'test: __test__ 出口形状锁' 钉住:新增形态必须同时出现在
// STRAY_FORMS 与本出口,否则测试侧只能再抄一份判据(= 两份真相必漂移)。
export const __test__ = {
  findVerifyFiles,
  findTmpFiles,
  collectStrayFiles,
  SCAN_ROOTS,
  EXCLUDE_DIRS,
  ALLOWED_DOT_DIRS,
  TEST_DIR_NAMES,
  VERIFY_FILE_RE,
  TMP_FILE_RE,
  STRAY_FORMS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
