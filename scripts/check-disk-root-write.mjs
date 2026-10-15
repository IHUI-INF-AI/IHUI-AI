#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-disk-root-write.mjs — 盘根写入回归锁 (AGENTS.md §15/§15b,guardian-runner id 213)
 *
 * ## 这道门拦什么
 *
 * 扫描仓库代码里"往磁盘根(D:/G:/C: 一级,即项目树与 DevEnv 之外)写文件/建目录"的
 * **模式**,对**本次提交新增**的判红;存量按该文件 HEAD 自身的命中数只报数(差值棘轮)。
 * 盘根卫生门(check-disk-root-hygiene)守的是"盘上别留垃圾",本门守的是"代码别再产新的"。
 *
 * ## 判据(六族 W1 判红 / W2 只报数 / 动态与窄化不判)
 *
 * 射程 = 全仓文本源文件,扩展名 `.ts/.tsx/.js/.mjs/.cjs/.py/.ps1/.sh`
 * (不扫 .md/.json/.yaml/.toml——文档与配置里提路径是合理的;预筛走 git grep pathspec)。
 *
 *   W1(判红)六族:
 *     ① JS/TS `join/resolve` 首参是盘根 literal —— 路径构造的根落在盘根;
 *     ② JS/TS fs 写 sink 的**路径位**实参(writeFileSync/mkdirSync/mkdtempSync/cpSync/
 *        createWriteStream/fs-extra outputFile* 族/Py open(写模式)/os.makedirs/
 *        shutil.copy 族/Path.write_text 等;方法接收体也算路径位);
 *     ③ Node 子进程 exec/spawn 的**非程序位** literal(命令串中段、实参数组元素);
 *     ④ PowerShell 写 cmdlet 语句里的 literal(New-Item -Path "D:\foo"、Out-File D:\bar);
 *     ⑤ PowerShell 简单赋值 `$x = 'X:\seg…'`(真实生产者形态:db-second-copy.ps1 的
 *        $source/$target/$logDir、swap-tunnel-token.ps1 的 $serviceTokenFile);
 *     ⑥ sh 重定向(`>`/`>>`)与 cp/mv/mkdir/ln 类的 literal。
 *
 *   W2(只报数,进 --json):同一 literal 落在只读上下文 —— existsSync/readFileSync/
 *   statSync/readdirSync 族、Python os.path.exists/os.stat/listdir、`Path(<literal>)`
 *   构造器(见下方"有据收窄"①)、PS1 Test-Path/Get-Content、sh 的 cat/test/ls 族。
 *
 *   动态(只报数):模板插值 `` `${d}:\\x` ``、compose 后续实参是变量(`join('D:\\', x)`)
 *   —— 静态判不了就不判,绝不猜。
 *
 * ## 收窄规则(判据灵魂,必须实现)
 *
 * literal 第一段(大小写不敏感、**精确匹配**)∈ {IHUI-AI, DevEnv} ⇒ 不立 W1。
 * `D:\DevEnv\ihui-deploy-build`、`G:\IHUI-AI\.worktrees\x`、`D:\IHUI-AI\scripts` 全部
 * 天然过关;`G:\IHUI-AI-wt-b674\x`(首段是另一个目录,不是前缀匹配)照旧立 W1;
 * `.pytest_tmp`/`backups` 等不在收窄集内,立 W1(它们的合法性走豁免台账,不走收窄)。
 * 裸 `X:\`(无段)不立意——唯独两处例外:compose 首参(由后续第一个引号字面量定夺,
 * `join('D:\\','DevEnv',…)` 窄化放过、`join('G:\\','probe-x')` 立 W1)与写 sink 实参
 * (`mkdtempSync('D:\\')` 型造假夹具)。
 *
 * ## 差值棘轮(为什么存量不判红)
 *
 * 锚点 = 该文件在 HEAD 面自身的 W1 数(新文件 0;rename 从旧路径带基线)。
 * 与提交者无关的恒红门会逼人 `--no-verify`,一次绕过等于该提交上全部守门作废(§12e)。
 * 全量档(HEAD 面)按构造恒为"新增 0",是问责/巡检读数;提交链走 `--staged`。
 *
 * ## 取材纪律(守门 118 口径)
 *
 * 全量判 HEAD blob、`--staged` 判索引 blob;两面旗同给 = 用法错;取不到面一律抛
 * `Undetermined` ⇒ exit 2,不冒红也不记绿、不回落另一个面。清单(预筛 git grep)与
 * 正文(catBatch)同面同轮,都出自 `./lib/face-reader.mjs`。git grep 退出码 1 = 无命中
 * (合法的零候选),>1 = git 自己出错 ⇒ 无法判定。
 * **死判据**:HEAD 面零候选 ⇒ exit 2(尺子失效,同豁免到期账教训)。若仓库真有被清理到
 * "零盘根字面量"的一天,按报错里的指引把本判据随清理同批放宽——那不是悄悄放绿。
 *
 * ## 豁免台账
 *
 * `scripts/data/disk-root-write-exemptions.json`,`[{file, line?, reason, ticket, until}]`。
 * 命中台账且未到期 ⇒ 放过(只计数);到期 ⇒ 判红"豁免已到期回队列"(基线救不了——到期
 * 不回首评就等于把已知生产者永久钉死)。台账整份坏 ⇒ exit 2;缺字段/坏日期 ⇒ 该条判红。
 * **刻意不做"腐烂"判**(与 direct-run-guard 不同):本台账含登记性条目——pyproject.toml
 * 不在扫描扩展名、gitdir.mjs/git-rebuild-local.mjs 没有 W1 命中——按"登记了而没命中
 * 就红"会把它们永久钉红。台账取材同口径:索引优先、退回 HEAD;两处都取不到 ⇒ 按零豁免
 * 判并大声报出(缺席不等于通过)。
 *
 * ## 两处有据收窄(头注声明,依据是 HEAD 面实测而非偏好)
 *
 * ① Python `Path(<literal>)` 首参归**探针/只读**(W2):HEAD 面 9 处全是只读探测
 *    (browser_hub.py / chrome_import.py / shell_detect.py / browser_factory.py 的
 *    chrome.exe 候选位),写形态由 `open(…,'w')` / `write_text` / `mkdir` /
 *    `os.path.join` 收口——那四支照旧判红。`Path('D:\\x').write_text(…)` 这类链式写
 *    经"接收体路径位"判 W1,不漏。
 * ② exec 族**首参起始位**的 literal(含该位上的 compose,如
 *    `execFileSync(join('C:\\','Windows','System32','nssm.exe'), args)`)是**程序路径**
 *    不是写目标 ⇒ 豁免(计数为 probe);命令串中段(`execSync('git bundle create D:\\x')`)
 *    与后续实参数组元素照旧 W1。已知射程边界(如实登记):exec 的选项对象实参
 *    (`spawn('git', args, {cwd:'D:\\x'})`)里的 literal 只计数不判。
 *
 * ③ **盘符是模板变量**(`const p = \`${d}:\\x\``)时 DRIVE_RE 认不出盘符(前导是 `}` 而非
 *    字母),整条不判 —— 安全方向(不误红),代价是该形态不计入 dynamic(已知射程边界,
 *    如实登记;自检 ST11 即此)。真生产者写盘根几乎不会用"盘符存变量再模板插值"。
 *
 * ## 结构性排除(硬编码,头注理由)
 *
 * 本门自身与其镜像测试(判据正则与 fixture 串)、config/disk-root-allowlist.json
 * (白名单数据)、scripts/check-c-drive-paths.mjs(C 盘门的 PATTERNS 正则字面量)、
 * scripts/seal-c-root-stray.mjs(C 根封缄工具夹具)、scripts/check-c-drive-pollution.mjs
 * (同族材料)。这些文件里的盘根串是"尺子自己的材料",不是生产者。
 *
 * ## Python 遮罩(唯一一处自带遮罩,理由 = 共享层射程外)
 *
 * `scripts/lib/code-mask.mjs` 的词法只覆盖 JS 与 ps/sh/bat/vbs,不认 `#` 注释与三引号
 * 串,故 .py 的注释/字符串跨度由本门最小查找器产出(长度保持);JS 一律走共享层
 * (`scanSpans` + `maskCommentsStringsAndRegex` 双投影),脚本方言走 `maskScriptComments`
 * —— 分词器不造第二台,投影各取所需。
 *
 * ## CLI
 *
 * `node scripts/check-disk-root-write.mjs [--staged|--json|--quiet|--strict|--self-test] [--root <仓根>]`
 * 退出码:0 = 判定完成且无新增违规;1 = 业务失败(新增 W1 / 豁免到期 / 台账条目坏);
 * 2 = 无法判定或用法错(两面旗同给 / 取不到面 / 空候选 HEAD 面 / 台账 JSON 坏 / --root 非仓根)。
 * 本门**不设 --worktree 面**:工作树是并行会话的半编辑态,不得作为提交门禁(§22d 同口径);
 * 提交链只走 HEAD/索引两面。
 * 注册:guardian-runner id 213(blocking,无 stagedTriggers——任何提交都跑,--staged 档
 * 只读变更文件、廉价);紧急跳过 HUSKY_SKIP_DISK_ROOT_WRITE=1(不推荐)。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  selectFace,
} from './lib/face-reader.mjs'
import {
  maskCommentsStringsAndRegex,
  maskScriptComments,
  scanSpans,
} from './lib/code-mask.mjs'

// ROOT 取脚本所在目录的上一级(而非 process.cwd()):AGENTS.md §15"路径推导用
// import.meta.url,不硬编码",且 §5b"git 调用不得依赖环境"。--root 可覆盖(镜像测试
// 的临时仓走它);cwd 在子目录里跑也不会把基准悄悄挪走。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const SELF = 'scripts/check-disk-root-write.mjs'
export const OWN_TEST = 'scripts/tests/check-disk-root-write.test.mjs'
export const LEDGER_FILE = 'scripts/data/disk-root-write-exemptions.json'

/** 扫描面扩展名(与预筛 pathspec 同一集合)。.md/.json/.yaml/.toml 不扫:文档与配置里提路径合理。 */
export const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.ps1', '.sh'])
const EXT_GLOBS = ['*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs', '*.py', '*.ps1', '*.sh']

/** 收窄集:literal 首段(大小写不敏感、精确匹配)命中 ⇒ 不立 W1。 */
export const NARROWED_SEGS = new Set(['ihui-ai', 'devenv'])

/** 结构性排除(硬编码)。理由见头注「结构性排除」。 */
export const STRUCTURAL_EXCLUDES = new Set([
  SELF,
  OWN_TEST,
  'config/disk-root-allowlist.json',
  'scripts/check-c-drive-paths.mjs',
  'scripts/seal-c-root-stray.mjs',
  'scripts/check-c-drive-pollution.mjs',
])

const GIT_TIMEOUT = 120_000
/** 预筛模式(git grep -E):与判据正则同前导守卫,见 grepCandidates 注。 */
const PREFILTER_RE = '(^|[^A-Za-z0-9_])[A-Za-z]:[\\\\/]'
/** 只报清单/计数时的截断,免得 --json 之外的人读输出被几百条路径灌满。 */
const LIST_CAP = 40

// === CLI 参数 ===
const argv = process.argv.slice(2)
const JSON_OUT = argv.includes('--json')
const QUIET = argv.includes('--quiet')
const STRICT = argv.includes('--strict')
const SHOW_HELP = argv.includes('--help') || argv.includes('-h')

// §22d 双形态入口(G-1058651):CLI 直跑时 argv[1] == 本文件,守卫放行;被 import 时
// argv[1] 是宿主入口,守卫放行不了,于是导入不再执行 HUSKY_SKIP/--help 的 process.exit
// 与 main()。必须经 pathToFileURL():Windows 下 process.argv[1] 带反斜杠。
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// === 应急逃生舱(与 check-c-drive-paths / check-direct-run-guard 一致) ===
if (isDirectRun && process.env.HUSKY_SKIP_DISK_ROOT_WRITE === '1') {
  if (!QUIET && !JSON_OUT) {
    console.log('  ⏭  盘根写入回归锁 (HUSKY_SKIP_DISK_ROOT_WRITE=1, 跳过)')
  }
  process.exit(0)
}

// === 颜色 ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// === 帮助 ===
if (isDirectRun && SHOW_HELP) {
  console.log(`
check-disk-root-write.mjs — 盘根写入回归锁 (AGENTS.md §15/§15b,id 213)

拦什么:代码里"往磁盘根(D:/G:/C: 一级,项目树与 DevEnv 之外)写文件/建目录"的
**新增**模式。存量按该文件 HEAD 自身棘轮只报数(§12e)。

W1 六族:join/resolve 首参盘根 · fs 写 sink 路径位实参 · exec/spawn 非程序位 ·
  PowerShell 写 cmdlet · PowerShell 简单赋值 · sh 重定向与 cp/mv/mkdir 类
W2 只报数:existsSync/readFileSync/statSync 族、os.path.exists、Path(<literal>)
  构造器、Test-Path/Get-Content、sh 的 cat/test/ls 族
收窄:literal 首段(大小写不敏感,精确匹配)∈ {IHUI-AI, DevEnv} ⇒ 不立 W1
  (IHUI-AI-wt-b674 不是前缀匹配,照旧立)

用法:
  node scripts/check-disk-root-write.mjs [选项]

选项:
  --staged    提交档:判索引 blob,与 HEAD 面差值棘轮(违规 exit 1)
  --json      以 JSON 格式输出报告(机器可读,接入 CI)
  --quiet     仅返回 exit code,不打印诊断
  --strict    有未判定文件时也 exit 2(默认只报数)
  --self-test 跑判据自检(成对阳性/阴性对照)
  --root <dir> 判定根(默认脚本所在仓根;镜像测试的临时仓走它)
  --help      打印此帮助

退出码:
  0  通过(无新增违规)
  1  失败(新增 W1 / 豁免到期 / 台账条目坏)
  2  无法判定或用法错(取不到面 / HEAD 面空候选 / 台账 JSON 坏 / --root 非仓根)

豁免台账:scripts/data/disk-root-write-exemptions.json
  [{file, line?, reason, ticket, until}];命中且未到期放过,到期判红回队列。
集成位置:guardian-runner id 213(blocking,任何提交都跑)
跳过方法(应急):HUSKY_SKIP_DISK_ROOT_WRITE=1 git commit ...
`)
  process.exit(0)
}

// ───────────────────────────── 判据表 ─────────────────────────────

/**
 * 盘根字面量(源码坐标)。前导守卫 `(^|[^A-Za-z0-9_])` 防 URL 误匹配(https:// 的
 * 冒号前是字母);`{1,2}` 容 `D:\` 与 JS 串里转义成的 `D:\\` 两种写法;rest 停在
 * 空白/引号/逗号/分号/闭括号,防越界吃进后续代码。
 */
export const DRIVE_RE = /(^|[^A-Za-z0-9_])([A-Za-z]):([\\/]{1,2})([^\s'"`,;)\]}]*)/g

/** JS/TS 写 sink:哪些实参位是**路径位**(下标;`'recv'` = 方法接收体)。 */
const WRITE_SINKS = {
  // ── node:fs 同步族 ──
  writeFileSync: [0],
  appendFileSync: [0],
  createWriteStream: [0],
  writeSync: [0],
  mkdirSync: [0],
  mkdtempSync: [0],
  rmSync: [0],
  rmdirSync: [0],
  unlinkSync: [0],
  cpSync: [0, 1],
  copyFileSync: [0, 1],
  renameSync: [0, 1],
  symlinkSync: [0, 1],
  truncateSync: [0],
  chmodSync: [0],
  chownSync: [0],
  utimesSync: [0],
  // ── fs.promises 族(同名去 Sync)──
  writeFile: [0],
  appendFile: [0],
  mkdir: [0, 'recv'],
  rm: [0],
  unlink: [0, 'recv'],
  rmdir: [0, 'recv'],
  copyFile: [0, 1],
  rename: [0, 1, 'recv'],
  cp: [0, 1],
  truncate: [0],
  chmod: [0],
  chown: [0],
  // ── fs-extra 族(辨识度足够的名字;裸 copy/move/remove 太通用,不收)──
  outputFileSync: [0],
  outputFile: [0],
  outputJsonSync: [0],
  outputJson: [0],
  writeJsonSync: [0],
  writeJson: [0],
  ensureDirSync: [0],
  ensureDir: [0],
  ensureFileSync: [0],
  ensureFile: [0],
  createFileSync: [0],
  createFile: [0],
  copySync: [0, 1],
  moveSync: [0, 1],
  removeSync: [0],
  // ── Python 写族(全名,避免与通用方法名撞)──
  'os.remove': [0],
  'os.removedirs': [0],
  'os.replace': [0, 1],
  'shutil.copy': [0, 1],
  'shutil.copy2': [0, 1],
  'shutil.copyfile': [0, 1],
  'shutil.copytree': [0, 1],
  'shutil.move': [0, 1],
  'shutil.rmtree': [0],
  'shutil.make_archive': [0],
  // ── Python/Path 方法族(按 last segment 也收)──
  makedirs: [0],
  symlink: [0, 1],
  link: [0, 1],
  renames: [0, 1],
  // ── 方法接收体族(写)──
  write_text: ['recv'],
  write_bytes: ['recv'],
  touch: [0, 'recv'],
}

/** 只读 sink(同上表结构)。`Path` 族单列 PROBE_SINKS:要继续向外走(链式写)。 */
const READ_SINKS = {
  // ── node:fs 族 ──
  existsSync: [0],
  exists: [0],
  accessSync: [0],
  access: [0],
  readFileSync: [0],
  readFile: [0],
  createReadStream: [0],
  statSync: [0],
  stat: [0],
  lstatSync: [0],
  lstat: [0],
  readdirSync: [0],
  readdir: [0],
  realpathSync: [0],
  realpath: [0],
  readlinkSync: [0],
  readlink: [0],
  // ── Python 只读族 ──
  'os.path.exists': [0],
  'os.path.isfile': [0],
  'os.path.isdir': [0],
  'os.path.islink': [0],
  'os.path.getsize': [0],
  'os.path.getmtime': [0],
  'os.path.getatime': [0],
  'os.path.getctime': [0],
  'os.stat': [0],
  'os.lstat': [0],
  'os.listdir': [0],
  'os.scandir': [0],
  'os.walk': [0],
  'glob.glob': [0],
  'glob.iglob': [0],
  isfile: [0],
  isdir: [0],
  islink: [0],
  listdir: [0],
  scandir: [0],
  walk: [0],
  getsize: [0],
  getmtime: [0],
  glob: [0],
  iglob: [0],
  // ── 方法接收体族(读)──
  read_text: ['recv'],
  read_bytes: ['recv'],
  iterdir: ['recv'],
  is_file: ['recv'],
  is_dir: ['recv'],
}

/** 探针 sink:`Path(<literal>)` 是路径**构造**,不是写;链式写由接收体规则收口。 */
const PROBE_SINKS = new Set([
  'Path',
  'PurePath',
  'PurePosixPath',
  'PureWindowsPath',
  'PosixPath',
  'WindowsPath',
])

/** 模式实参定读写的 sink(arg1 含 w/a/x/+ ⇒ 写)。 */
const MODE_SINKS = new Set(['open', 'openSync', 'io.open', 'codecs.open', 'os.open'])

/** 子进程族:首参起始位是程序路径(豁免),其余 literal 是 W1。 */
const EXEC_BARE = new Set(['execSync', 'exec', 'execFileSync', 'execFile', 'spawn', 'spawnSync', 'fork'])
const EXEC_FULL = new Set([
  'subprocess.run',
  'subprocess.call',
  'subprocess.check_call',
  'subprocess.check_output',
  'subprocess.Popen',
  'subprocess.getoutput',
  'subprocess.getstatusoutput',
  'os.system',
  'os.popen',
  'os.execl',
  'os.execv',
  'os.spawnl',
  'os.spawnv',
  'os.posix_spawn',
])

/** compose 族:首参是盘根 literal 的路径构造。 */
const COMPOSE_NAMES = new Set(['join', 'resolve'])

/** JS 调用点扫描要跳过的关键字(直接后跟 `(` 的控制流/运算符)。 */
const JS_CALL_KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'with',
  'do', 'else', 'try', 'finally', 'async', 'await', 'new', 'delete', 'void',
  'yield', 'case', 'throw', 'in', 'of', 'instanceof',
])

// ── PowerShell  cmdlet 族 ──
const PS_WRITE_CMDLETS =
  /\b(?:New-Item|Remove-Item|Rename-Item|Copy-Item|Move-Item|Set-Content|Add-Content|Clear-Content|Out-File|Tee-Object|Export-Csv|Export-Clixml|Set-Item|Compress-Archive|Expand-Archive)\b/i
const PS_READ_CMDLETS =
  /\b(?:Test-Path|Get-Content|Get-Item|Get-ChildItem|Resolve-Path|Select-String|Get-Acl)\b/i
const PS_EXEC_CMDLETS = /\b(?:Start-Process|Invoke-Expression|iex)\b/i
/** 写 cmdlet 语句里,这些参数位的 literal 是**内容**不是路径(只计数不判)。 */
const PS_CONTENT_PARAMS = new Set([
  'Value', 'InputObject', 'Body', 'Encoding', 'Stream', 'Width', 'Delimiter', 'Separator', 'Subject',
])
/** PS1 简单赋值头:`$var = …`(写形态,见头注 W1 ⑤)。 */
const PS_ASSIGN_HEAD_RE = /^\s*\$\w+\s*=\s*(?![$(@])/

// ── sh 首词族 ──
const SH_WRITE_FIRST = new Set(['cp', 'mv', 'mkdir', 'ln', 'rsync', 'touch', 'install', 'dd', 'tee', 'truncate', 'sponge'])
const SH_READ_FIRST = new Set(['cat', 'test', '[', 'ls', 'stat', 'file', 'readlink', 'head', 'tail', 'grep', 'find', 'du', 'md5sum', 'sha256sum', 'wc', 'cmp', 'diff', 'realpath'])

// ───────────────────────────── 纯函数:字面量解析 ─────────────────────────────

function lineAt(src, idx) {
  let n = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') n += 1
  return n
}

/** literal 的首段;裸根(无段)回 null。 */
export function segOf(lit) {
  if (!lit || typeof lit.rest !== 'string') return null
  const cleaned = lit.rest.replace(/^[\\/]+/, '')
  if (cleaned === '') return null
  return cleaned.split(/[\\/]+/)[0]
}

export function narrowedSeg(seg) {
  return typeof seg === 'string' && NARROWED_SEGS.has(seg.toLowerCase())
}

/**
 * 实参文本 ⇒ 盘根路径解析。剥一层引号后要求 `X:` + 1~2 个分隔符开头。
 * @returns {{seg:string|null,letter:string}|null} seg=null 表示裸根
 */
export function drivePathOf(argText) {
  if (typeof argText !== 'string') return null
  const s = argText.trim()
  if (s === '') return null
  const q = s[0]
  const body =
    (q === "'" || q === '"' || q === '`') && s.length >= 2 && s[s.length - 1] === q
      ? s.slice(1, -1)
      : s
  const m = /^([A-Za-z]):([\\/]{1,2})(.*)$/.exec(body)
  if (!m) return null
  const rest = m[3].replace(/^[\\/]+/, '')
  return { letter: m[1], seg: rest === '' ? null : rest.split(/[\\/]+/)[0] }
}

/**
 * 实参文本的字面量性质(收窄判定用):引号包住的是 literal;反引号模板带 `${}` 是
 * dynamic;其余(变量/调用/三元)是 expr。
 * @returns {{kind:'literal',text:string}|{kind:'dynamic'}|{kind:'expr'}}
 */
export function literalArgText(argText) {
  if (typeof argText !== 'string') return { kind: 'expr' }
  const s = argText.trim()
  if (s === '') return { kind: 'expr' }
  const q = s[0]
  if (q === "'" || q === '"') {
    if (s.length >= 2 && s[s.length - 1] === q) return { kind: 'literal', text: s.slice(1, -1) }
    return { kind: 'expr' }
  }
  if (q === '`') {
    if (s.length >= 2 && s[s.length - 1] === '`') {
      const body = s.slice(1, -1)
      return /\$\{/.test(body) ? { kind: 'dynamic' } : { kind: 'literal', text: body }
    }
    return { kind: 'expr' }
  }
  return { kind: 'expr' }
}

/** 路径文本(已剥引号)的首段:自身带盘符按盘符解,否则按普通组件解。 */
export function firstSegmentOfPathText(text) {
  if (typeof text !== 'string') return null
  const m = /^[A-Za-z]:[\\/]{0,2}/.exec(text)
  const rest = (m ? text.slice(m[0].length) : text).replace(/^[\\/]+/, '')
  if (rest === '') return null
  return rest.split(/[\\/]+/)[0]
}

// ───────────────────────────── 纯函数:调用结构(JS/Py) ─────────────────────────────

/** 在 struct 投影上从 openIdx 的开括号走到配对闭括号之后;配不平回 -1。 */
function matchBracket(struct, openIdx) {
  if (openIdx < 0 || openIdx >= struct.length) return -1
  const opener = struct[openIdx]
  if (opener !== '(' && opener !== '[' && opener !== '{') return -1
  let d = 0
  for (let k = openIdx; k < struct.length; k++) {
    const c = struct[k]
    if (c === '(' || c === '[' || c === '{') d += 1
    else if (c === ')' || c === ']' || c === '}') {
      d -= 1
      if (d === 0) return k
      if (d < 0) return -1
    }
  }
  return -1
}

/** 按顶层逗号切实参区(跑在 struct 上:字符串已遮,串内逗号不参与)。 */
function splitArgs(struct, argStart, argEnd) {
  const args = []
  let depth = 0
  let start = argStart
  for (let i = argStart; i < argEnd; i++) {
    const c = struct[i]
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') depth -= 1
    else if (c === ',' && depth === 0) {
      args.push({ start, end: i })
      start = i + 1
    }
  }
  args.push({ start, end: argEnd })
  return args
}

const JS_CALL_RE = /([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*\(/g

/**
 * 索引全部调用点(含点分链与嵌套)。`X.method(` 的 X 若是表达式(以 `)`/`]` 收尾),
 * 其括号区登记为 recvStart —— 方法接收体在路径语义上等价于隐式实参
 * (`Path('D:\\x').write_text(…)` 的接收体就是被写的路径)。
 */
function indexCalls(struct) {
  const calls = []
  JS_CALL_RE.lastIndex = 0
  let m
  while ((m = JS_CALL_RE.exec(struct)) !== null) {
    const name = m[1]
    const lastSeg = name.split('.').pop().trim()
    if (JS_CALL_KEYWORDS.has(lastSeg)) continue
    const openIdx = m.index + m[0].length - 1
    const closeIdx = matchBracket(struct, openIdx)
    if (closeIdx < 0) {
      return { calls, error: `第 ${lineAt(struct, openIdx)} 行的 \`${name}(\` 括号配不平` }
    }
    let recvStart = -1
    let p = m.index - 1
    while (p >= 0 && /\s/.test(struct[p])) p -= 1
    if (p >= 0 && struct[p] === '.') {
      p -= 1
      while (p >= 0 && /\s/.test(struct[p])) p -= 1
      if (p >= 0 && (struct[p] === ')' || struct[p] === ']')) {
        const open = matchBracketBackward(struct, p)
        if (open >= 0) recvStart = open
      }
    }
    calls.push({
      name: name.replace(/\s+/g, ''),
      lastSeg,
      calleeStart: m.index,
      argStart: openIdx + 1,
      argEnd: closeIdx,
      recvStart,
    })
  }
  calls.sort((a, b) => a.calleeStart - b.calleeStart)
  return { calls, error: null }
}

/** 从 closeIdx 的闭括号反向走到配对开括号;配不平回 -1。 */
function matchBracketBackward(struct, closeIdx) {
  const closer = struct[closeIdx]
  if (closer !== ')' && closer !== ']' && closer !== '}') return -1
  let d = 0
  for (let k = closeIdx; k >= 0; k--) {
    const c = struct[k]
    if (c === ')' || c === ']' || c === '}') d += 1
    else if (c === '(' || c === '[' || c === '{') {
      d -= 1
      if (d === 0) return k
      if (d < 0) return -1
    }
  }
  return -1
}

/**
 * 包含 pos 的调用链,最内层优先。
 * 排序按**包含 span 的大小**升序,不是按 calleeStart:方法接收体调用
 * (`Path('D:\\x').write_text(…)`)的 calleeStart 比接收者还大,按它排会把外层
 * 方法排到内层构造器前面,链就断了。span = [接收体起点 ?? 实参区起点, 实参区终点)。
 */
function chainFor(calls, pos) {
  const out = calls.filter(
    (c) => pos >= (c.recvStart >= 0 ? c.recvStart : c.argStart) && pos < c.argEnd,
  )
  const spanOf = (c) => [c.recvStart >= 0 ? c.recvStart : c.argStart, c.argEnd]
  out.sort((a, b) => {
    const [as, ae] = spanOf(a)
    const [bs, be] = spanOf(b)
    const sa = ae - as
    const sb = be - bs
    if (sa !== sb) return sa - sb
    return bs - as
  })
  return out
}

function argTextOf(ctx, span) {
  return ctx.src.slice(span.start, span.end)
}

function argsOf(call, ctx) {
  if (!ctx._args) ctx._args = new Map()
  let a = ctx._args.get(call)
  if (!a) {
    a = splitArgs(ctx.struct, call.argStart, call.argEnd)
    ctx._args.set(call, a)
  }
  return a
}

/** pos 落在 call 的第几个顶层实参;接收体位回 -1;不在任何实参回 -2。 */
function argIndexOf(call, pos, ctx) {
  if (call.recvStart >= 0 && pos < call.argStart) return -1
  const args = argsOf(call, ctx)
  for (let i = 0; i < args.length; i++) {
    if (pos >= args[i].start && pos < args[i].end) return i
  }
  return -2
}

/**
 * 写/读 sink 表里 `'recv'`(方法接收体)归一为 `argIndexOf` 的接收体哨兵值 -1。
 * 缺这一步时 `role.pathArgs.includes(argIdx)` 对接收体恒假 ⇒ 所有"方法接收体"判定
 * (write_text/write_bytes/JS mkdir·unlink·rmdir·rename 等方法链)全落 other(2026-10-15 修)。
 */
const recvNorm = (arr) => arr.map((x) => (x === 'recv' ? -1 : x))

function sinkRoleOf(call, ctx) {
  const full = call.name
  const name = call.lastSeg
  if (MODE_SINKS.has(full) || MODE_SINKS.has(name)) {
    const args = argsOf(call, ctx)
    let w = false
    for (let i = 1; i < args.length; i++) {
      const t = argTextOf(ctx, args[i])
      if (/^\s*['"][wax+]/.test(t) || /=\s*['"][wax+]/.test(t)) {
        w = true
        break
      }
    }
    return { kind: w ? 'write' : 'read', pathArgs: [0] }
  }
  if (PROBE_SINKS.has(name)) return { kind: 'probe', pathArgs: [0] }
  if (WRITE_SINKS[full]) return { kind: 'write', pathArgs: recvNorm(WRITE_SINKS[full]) }
  if (WRITE_SINKS[name]) return { kind: 'write', pathArgs: recvNorm(WRITE_SINKS[name]) }
  if (READ_SINKS[full]) return { kind: 'read', pathArgs: recvNorm(READ_SINKS[full]) }
  if (READ_SINKS[name]) return { kind: 'read', pathArgs: recvNorm(READ_SINKS[name]) }
  if (EXEC_FULL.has(full) || EXEC_BARE.has(name)) return { kind: 'exec', pathArgs: [] }
  return null
}

// ───────────────────────────── 纯函数:分类 ─────────────────────────────

/** 模板插值动态判定:literal 所在的串是模板,且其之前出现过 `${` ⇒ 判不了。 */
function isDynamicLiteral(lit, ctx) {
  for (const sp of ctx.stringSpans) {
    if (lit.pos < sp.start || lit.pos >= sp.end) continue
    if (!sp.isTemplate) return false
    const before = ctx.src.slice(sp.bodyStart, lit.pos)
    return before.includes('${')
  }
  return false
}

/** compose 调用的分类:收窄/动态/候选,或与本 literal 无关。 */
function composeClassify(lit, call, ctx) {
  const args = argsOf(call, ctx)
  const idx = args.findIndex((a) => lit.pos >= a.start && lit.pos < a.end)
  if (idx < 0) return 'other'
  if (idx === 0) {
    const own = drivePathOf(argTextOf(ctx, args[0]))
    if (own === null) return 'other'
    if (own.seg !== null) return narrowedSeg(own.seg) ? 'narrowed' : 'candidate'
    // 裸根首参:由后续第一个引号字面量定夺
    const next = args[1]
    if (!next) return 'other'
    const la = literalArgText(argTextOf(ctx, next))
    if (la.kind === 'dynamic' || la.kind === 'expr') return 'dynamic'
    const seg = firstSegmentOfPathText(la.text)
    if (seg === null) return 'other'
    return narrowedSeg(seg) ? 'narrowed' : 'candidate'
  }
  const own = drivePathOf(argTextOf(ctx, args[idx]))
  if (own === null || own.seg === null) return 'other'
  return narrowedSeg(own.seg) ? 'narrowed' : 'candidate'
}

/** exec 调用内的 literal 分类:程序位豁免,其余 W1(选项实参只计数)。 */
function execLiteralClass(call, lit, ctx) {
  const args = argsOf(call, ctx)
  const argIdx = args.findIndex((a) => lit.pos >= a.start && lit.pos < a.end)
  if (argIdx < 0) return 'other'
  if (argIdx >= 2) return 'other' // 选项对象(如 {cwd:'D:\\x'}):登记为射程边界,只计数
  const seg = segOf(lit)
  if (seg !== null && narrowedSeg(seg)) return 'narrowed'
  if (argIdx === 1) return 'w1'
  const a0 = args[0]
  const t0 = argTextOf(ctx, a0)
  const lead = t0.length - t0.trimStart().length
  const trimmed = t0.trimStart()
  if (trimmed.startsWith('[')) {
    // 列表形:元素 0 是程序
    const open = a0.start + lead
    const close = matchBracket(ctx.struct, open)
    if (close < 0) return 'w1'
    const elems = splitArgs(ctx.struct, open + 1, close)
    const ei = elems.findIndex((e) => lit.pos >= e.start && lit.pos < e.end)
    return ei === 0 ? 'probe' : 'w1'
  }
  // arg0 由一个调用构成(程序路径是拼出来的)⇒ 其中的 literal 是程序位
  const csNonStr = a0.start + lead
  const progCall = ctx.calls.find((c) => c.calleeStart === csNonStr)
  if (progCall && lit.pos >= progCall.argStart && lit.pos < progCall.argEnd) return 'probe'
  // 字符串命令形:literal 须在串内容起始位(之前只允许空白)才是程序位
  if (trimmed[0] === "'" || trimmed[0] === '"' || trimmed[0] === '`') {
    let k = a0.start + lead + 1
    while (k < a0.end && /\s/.test(ctx.src[k])) k += 1
    if (lit.pos === k) return 'probe'
  }
  return 'w1'
}

/**
 * 从 chain[from] 起向外找裁决上下文。compose 候选(from=1)走投无路 ⇒ W1(spec:
 * join/resolve 首参本身即写入模式信号);探针链走投无路 ⇒ W2(只读引用)。
 */
function resolveOuter(lit, chain, from, ctx) {
  const seg = segOf(lit)
  let curPos = lit.pos
  let sawProbe = false
  for (let i = from; i < chain.length; i++) {
    const call = chain[i]
    const role = sinkRoleOf(call, ctx)
    if (!role) return 'other'
    if (role.kind === 'exec') return execLiteralClass(call, lit, ctx)
    const argIdx = argIndexOf(call, curPos, ctx)
    if (!role.pathArgs.includes(argIdx)) return 'other'
    if (role.kind === 'probe') {
      sawProbe = true
      curPos = call.calleeStart
      continue
    }
    if (seg !== null && narrowedSeg(seg)) return 'narrowed'
    if (role.kind === 'write') return 'w1'
    return seg === null ? 'other' : 'w2'
  }
  if (from > 0) return 'w1'
  return sawProbe ? 'w2' : 'other'
}

/** JS/Py 单 literal 分类。 */
function classifyCallLiteral(lit, ctx) {
  if (isDynamicLiteral(lit, ctx)) return 'dynamic'
  const chain = chainFor(ctx.calls, lit.pos)
  const inner = chain[0]
  if (inner && COMPOSE_NAMES.has(inner.lastSeg)) {
    const r = composeClassify(lit, inner, ctx)
    if (r !== 'candidate') return r
    return resolveOuter(lit, chain, 1, ctx)
  }
  return resolveOuter(lit, chain, 0, ctx)
}

// ───────────────────────────── 纯函数:遮罩与语句 ─────────────────────────────

/**
 * Python 最小遮罩(长度保持)。code-mask 的词法不覆盖 Python(见头注),故本门对 .py
 * 自带这一处:`strings=false` 只遮 `#` 注释(字面量投影,字符串保留——literal 住在
 * 字符串里);`strings=true` 连字符串一起遮(结构投影,括号配平用)。三引号串按普通
 * 串处理:模块/函数文档串在语句层 ⇒ 'other',不冤杀。
 */
export function pyMask(src, { strings = true } = {}) {
  const n = src.length
  const out = src.split('')
  const blank = (s, e) => {
    for (let k = s; k < e && k < n; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' '
  }
  let i = 0
  while (i < n) {
    const c = src[i]
    if (c === '#') {
      let j = i
      while (j < n && src[j] !== '\n') j += 1
      blank(i, j)
      i = j
      continue
    }
    if (c === "'" || c === '"') {
      const e = pyStringEnd(src, i, c)
      if (strings) blank(i, e)
      i = e
      continue
    }
    if (/[rRbBuUfF]/.test(c)) {
      const m = /^([rRbBuUfF]{1,2})('''|"""|'|")/.exec(src.slice(i, i + 6))
      if (m) {
        const e = pyStringEnd(src, i + m[1].length, m[2])
        if (strings) blank(i, e)
        i = e
        continue
      }
    }
    i += 1
  }
  return out.join('')
}

function pyStringEnd(src, from, quote) {
  const n = src.length
  const qlen = quote.length
  let j = from + qlen
  while (j < n) {
    if (src[j] === '\\') {
      j += 2
      continue
    }
    if (src.startsWith(quote, j)) return j + qlen
    j += 1
  }
  return n
}

/** 脚本方言(ps/sh)的字符串跨度:ps 认 `''`/`""`/反引号转义,sh 认 `\` 转义。 */
export function scriptStringSpans(text, dialect) {
  const spans = []
  const n = text.length
  let i = 0
  while (i < n) {
    const c = text[i]
    if (c === "'" || c === '"') {
      let j = i + 1
      while (j < n) {
        const d = text[j]
        if (dialect === 'sh' && d === '\\') {
          j += 2
          continue
        }
        if (d === c) {
          if (text[j + 1] === c) {
            j += 2
            continue
          }
          if (dialect === 'ps' && c === '"' && text[j + 1] === '"') {
            j += 2
            continue
          }
          break
        }
        if (dialect === 'ps' && c === '"' && d === '`') {
          j += 2
          continue
        }
        j += 1
      }
      spans.push({ start: i, end: Math.min(j + 1, n), quote: c })
      i = j + 1
      continue
    }
    i += 1
  }
  return spans
}

/** 语句切分:换行与 `;`(字符串内的不切)。管道不切——PS 管道是一条语句的多个段。 */
export function splitScriptStatements(text, dialect) {
  const spans = scriptStringSpans(text, dialect)
  const inSpan = (p) => spans.some((s) => p >= s.start && p < s.end)
  const out = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if ((c === '\n' || c === ';') && !inSpan(i)) {
      out.push({ start, end: i })
      start = i + 1
    }
  }
  if (start < text.length) out.push({ start, end: text.length })
  return out.filter((s) => text.slice(s.start, s.end).trim().length > 0)
}

/** 脚本方言动态判定:双引号串内、literal 之前出现过 `$` 变量/子表达式 ⇒ 判不了。 */
function scriptDynamic(masked, litPos, spans) {
  const sp = spans.find((s) => litPos >= s.start && litPos < s.end)
  if (!sp || sp.quote !== '"') return false
  return /\$[(\w]/.test(masked.slice(sp.start + 1, litPos))
}

// ───────────────────────────── 单文件判定 ─────────────────────────────

function emptyHits() {
  return { w1: [], w2: [], dynamic: [], narrowed: [], other: [], probe: [] }
}

function pushHit(bag, cls, hit) {
  if (cls === 'w1') bag.w1.push(hit)
  else if (cls === 'w2') bag.w2.push(hit)
  else if (cls === 'dynamic') bag.dynamic.push(hit)
  else if (cls === 'narrowed') bag.narrowed.push(hit)
  else if (cls === 'probe') bag.probe.push(hit)
  else bag.other.push(hit)
}

function snippetOf(src, pos, len) {
  const raw = src.slice(pos, pos + (len ?? 90)).replace(/\s+/g, ' ').trim()
  return raw.length > 110 ? `${raw.slice(0, 107)}...` : raw
}

/** JS/TS 判定。 */
function judgeJs(rel, src, base) {
  const struct = maskCommentsStringsAndRegex(src)
  const { calls, error } = indexCalls(struct)
  if (error) return { ...base, error }
  const spans = scanSpans(src)
  const commentSpans = spans
    .filter((s) => s.kind === 'line' || s.kind === 'block')
    .map((s) => [s.start, s.end])
  const stringSpans = spans.filter((s) => s.kind === 'string')
  const ctx = { src, struct, calls, stringSpans, _args: null }
  const bag = emptyHits()
  for (const lit of scanDriveLiterals(src, commentSpans)) {
    const cls = classifyCallLiteral(lit, ctx)
    const seg = segOf(lit)
    pushHit(bag, cls, {
      line: lineAt(src, lit.pos),
      kind: describeCallKind(lit, ctx, cls),
      seg,
      text: snippetOf(src, lit.pos, lit.rest.length + 2),
    })
  }
  return { ...base, ...bag }
}

/** 依据 literal 的所在调用给一个人读的判据名(报告可读性,不改判定)。 */
function describeCallKind(lit, ctx, cls) {
  const chain = chainFor(ctx.calls, lit.pos)
  const inner = chain[0]
  if (inner && COMPOSE_NAMES.has(inner.lastSeg)) return `${inner.name} 首参/组件`
  for (const call of chain) {
    const role = sinkRoleOf(call, ctx)
    if (role && role.kind !== 'probe') return `${call.name} ${role.kind === 'exec' ? '实参' : role.kind === 'write' ? '写实参' : '只读实参'}`
  }
  return cls === 'w1' ? '写入模式' : '上下文'
}

/** Python 判定。 */
function judgePy(rel, src, base) {
  const struct = pyMask(src, { strings: true })
  const { calls, error } = indexCalls(struct)
  if (error) return { ...base, error }
  // 字面量投影:只遮 # 注释(字符串保留)。注释跨度从 struct 反推不可靠,直接再跑一遍
  // 只遮注释的投影,按"字符不同即注释"取跨度——等长保持,坐标对齐。
  const litsrc = pyMask(src, { strings: false })
  const commentSpans = []
  for (let i = 0; i < src.length; i++) {
    if (litsrc[i] !== src[i]) {
      let j = i
      while (j < src.length && litsrc[j] !== src[j]) j += 1
      commentSpans.push([i, j])
      i = j - 1
    }
  }
  const ctx = { src, struct, calls, stringSpans: [], _args: null }
  const bag = emptyHits()
  for (const lit of scanDriveLiterals(src, commentSpans)) {
    const cls = classifyCallLiteral(lit, ctx)
    pushHit(bag, cls, {
      line: lineAt(src, lit.pos),
      kind: describeCallKind(lit, ctx, cls),
      seg: segOf(lit),
      text: snippetOf(src, lit.pos, lit.rest.length + 2),
    })
  }
  return { ...base, ...bag }
}

/** PowerShell 判定。 */
function judgePs(rel, src, base) {
  const masked = maskScriptComments(src, 'ps')
  const spans = scriptStringSpans(masked, 'ps')
  const bag = emptyHits()
  for (const st of splitScriptStatements(masked, 'ps')) {
    const text = masked.slice(st.start, st.end)
    const lits = scanDriveLiterals(text, [])
    if (lits.length === 0) continue
    const hasWrite = PS_WRITE_CMDLETS.test(text)
    const hasRead = PS_READ_CMDLETS.test(text)
    const hasExec = PS_EXEC_CMDLETS.test(text)
    const assignAt = PS_ASSIGN_HEAD_RE.test(text)
      ? text.indexOf('=') + 1
      : -1
    for (const lit of lits) {
      const absPos = st.start + lit.pos
      const hit = {
        line: lineAt(src, absPos),
        kind: '',
        seg: segOf(lit),
        text: snippetOf(src, absPos, lit.rest.length + 2),
      }
      if (scriptDynamic(masked, absPos, spans)) {
        hit.kind = '动态拼接'
        pushHit(bag, 'dynamic', hit)
        continue
      }
      if (assignAt >= 0 && lit.pos >= assignAt) {
        hit.kind = '简单赋值 $var ='
        pushHit(bag, hit.seg !== null && narrowedSeg(hit.seg) ? 'narrowed' : 'w1', hit)
        continue
      }
      if (hasWrite) {
        // literal 多在引号串里:先剥掉紧邻的开引号,再看最近一个 -Param
        const before = text.slice(0, lit.pos).replace(/["'`]$/, '')
        const pm = /-([A-Za-z]+)\s*$/.exec(before)
        if (pm && PS_CONTENT_PARAMS.has(pm[1])) {
          hit.kind = `写 cmdlet 内容位 -${pm[1]}`
          pushHit(bag, 'other', hit)
          continue
        }
        hit.kind = '写 cmdlet 实参'
        pushHit(bag, hit.seg !== null && narrowedSeg(hit.seg) ? 'narrowed' : 'w1', hit)
        continue
      }
      if (hasRead) {
        hit.kind = '只读 cmdlet 实参'
        pushHit(bag, hit.seg !== null && narrowedSeg(hit.seg) ? 'narrowed' : 'w2', hit)
        continue
      }
      if (hasExec) {
        const isFirst = lits[0] === lit
        const before = text.slice(0, lit.pos)
        const onlyWsQuotes = /[\s'"]*$/.test(before)
        if (isFirst && onlyWsQuotes) {
          hit.kind = 'exec 程序位'
          pushHit(bag, 'probe', hit)
          continue
        }
        hit.kind = 'exec 实参'
        pushHit(bag, hit.seg !== null && narrowedSeg(hit.seg) ? 'narrowed' : 'w1', hit)
        continue
      }
      hit.kind = '语句级字面量'
      pushHit(bag, hit.seg !== null && narrowedSeg(hit.seg) ? 'narrowed' : 'other', hit)
    }
  }
  return { ...base, ...bag }
}

/** sh 判定。 */
function judgeSh(rel, src, base) {
  const masked = maskScriptComments(src, 'sh')
  const spans = scriptStringSpans(masked, 'sh')
  const bag = emptyHits()
  for (const st of splitScriptStatements(masked, 'sh')) {
    const text = masked.slice(st.start, st.end)
    const lits = scanDriveLiterals(text, [])
    if (lits.length === 0) continue
    const first = /^\s*([A-Za-z0-9_.-]+)/.exec(text)?.[1] ?? ''
    const hasRedirect = />/.test(text)
    for (const lit of lits) {
      const absPos = st.start + lit.pos
      const hit = {
        line: lineAt(src, absPos),
        kind: '',
        seg: segOf(lit),
        text: snippetOf(src, absPos, lit.rest.length + 2),
      }
      if (scriptDynamic(masked, absPos, spans)) {
        hit.kind = '动态拼接'
        pushHit(bag, 'dynamic', hit)
        continue
      }
      const narrowed = hit.seg !== null && narrowedSeg(hit.seg)
      if (hasRedirect) {
        hit.kind = '重定向目标'
        pushHit(bag, narrowed ? 'narrowed' : 'w1', hit)
      } else if (SH_WRITE_FIRST.has(first)) {
        hit.kind = `${first} 实参`
        pushHit(bag, narrowed ? 'narrowed' : 'w1', hit)
      } else if (SH_READ_FIRST.has(first)) {
        hit.kind = `${first} 实参`
        pushHit(bag, narrowed ? 'narrowed' : 'w2', hit)
      } else {
        hit.kind = '语句级字面量'
        pushHit(bag, narrowed ? 'narrowed' : 'other', hit)
      }
    }
  }
  return { ...base, ...bag }
}

function langOf(rel) {
  const ext = rel.slice(rel.lastIndexOf('.')).toLowerCase()
  if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'js'
  if (ext === '.py') return 'py'
  if (ext === '.ps1') return 'ps'
  if (ext === '.sh') return 'sh'
  return null
}

/** 扫一份源码里的盘根字面量(跳过注释跨度)。 */
function scanDriveLiterals(text, skipRanges) {
  const out = []
  DRIVE_RE.lastIndex = 0
  let m
  while ((m = DRIVE_RE.exec(text)) !== null) {
    const pos = m.index + m[1].length
    let skip = false
    for (const [s, e] of skipRanges) {
      if (pos >= s && pos < e) {
        skip = true
        break
      }
    }
    if (skip) continue
    out.push({ pos, letter: m[2], sep: m[3], rest: m[4] })
  }
  return out
}

/**
 * 单文件判定(纯函数,自检/镜像都对这一张构造面动手)。
 * @returns {{rel,lang,w1,w2,dynamic,narrowed,other,probe,error}}
 */
export function judgeSource(rel, src) {
  const lang = langOf(rel)
  const base = { rel, lang, ...emptyHits(), error: null }
  if (src === null || src === undefined) {
    return { ...base, error: `${rel} 该面取不到内容 ⇒ 未判定(不回落另一个面)` }
  }
  if (lang === 'js') return judgeJs(rel, src, base)
  if (lang === 'py') return judgePy(rel, src, base)
  if (lang === 'ps') return judgePs(rel, src, base)
  if (lang === 'sh') return judgeSh(rel, src, base)
  return { ...base, error: `${rel} 扩展名不在射程(${lang ?? '未知'})` }
}

// ───────────────────────────── 取材(face-reader 共用层) ─────────────────────────────

/**
 * 预筛:git grep 找含盘根字面量的文件。退出码 1 = 无命中(合法的零候选);
 * 其它非零 = git 自己出错 ⇒ Undetermined(不冒红也不记绿)。
 * 模式与判据正则同前导守卫 `(^|[^A-Za-z0-9_])`:没有它,`https://` 的 `s:/` 会命中,
 * 候选从 449 涨到 11918(实测 2026-10-15)——预筛可以比判据松,但不能松到把 URL
 * 也算候选(那是把全文库读一遍)。判据正则还要求 rest 可空,预筛不要求 ⇒ 仍是超集。
 * `git grep <rev>` 输出带 `<rev>:` 前缀,必须剥掉,否则 catBatch 规格变成 `HEAD:HEAD:…`。
 */
function grepCandidates(top, face) {
  const args =
    face === 'staged'
      ? ['grep', '--cached', '-I', '-l', '-E', PREFILTER_RE, '--', ...EXT_GLOBS]
      : ['grep', '-I', '-l', '-E', PREFILTER_RE, 'HEAD', '--', ...EXT_GLOBS]
  let out
  try {
    out = gitRaw(args, top, { timeout: GIT_TIMEOUT })
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return []
    throw e
  }
  return String(out)
    .split(/\r?\n/)
    .map((p) => p.trim())
    .map((p) => (face === 'staged' ? p : p.replace(/^[A-Za-z0-9_.-]+:/, '')))
    .filter((p) => p.length > 0)
}

/** 一轮取材:清单与正文同面(`HEAD:<path>` / `:<path>`)。 */
function readFace(top, face, files) {
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const specs = files.map((p) => `${pre}${p}`)
  const got = catBatch(top, specs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
  return files.map((rel, i) => ({ rel, src: got.get(specs[i]) ?? null }))
}

/**
 * `git diff --cached --name-status -M -z` 解析(只为区分 A/rename 与取材失败)。
 * @returns {Map<newPath,{status:string,old:string|null}>}
 */
function nameStatusMap(top, files) {
  const out = gitRaw(
    ['diff', '--cached', '--name-status', '-M', '-z', '--', ...files],
    top,
    { timeout: GIT_TIMEOUT },
  )
  const map = new Map()
  const tokens = String(out).split('\0')
  let i = 0
  while (i < tokens.length) {
    const st = tokens[i]
    if (!st) {
      i += 1
      continue
    }
    if (/^[RC]/.test(st)) {
      const old = tokens[i + 1]
      const nw = tokens[i + 2]
      if (nw) map.set(nw, { status: st[0], old: old ?? null })
      i += 3
      continue
    }
    const p = tokens[i + 1]
    if (p) map.set(p, { status: st[0], old: null })
    i += 2
  }
  return map
}

/** 台账取材:索引优先、退回 HEAD;两处都无 ⇒ absent(按零豁免判并大声报)。 */
function readLedgerFromFace(top, face) {
  if (face === 'staged') {
    const m = catBatch(top, [`:${LEDGER_FILE}`], { timeout: GIT_TIMEOUT })
    const staged = m.get(`:${LEDGER_FILE}`) ?? null
    if (staged !== null) return { raw: staged, present: true, via: '索引' }
  }
  const m = catBatch(top, [`HEAD:${LEDGER_FILE}`], { timeout: GIT_TIMEOUT })
  const head = m.get(`HEAD:${LEDGER_FILE}`) ?? null
  if (head !== null) return { raw: head, present: true, via: 'HEAD' }
  return { raw: null, present: false, via: null }
}

// ───────────────────────────── 台账 ─────────────────────────────

/** 台账解析(纯函数)。整份坏 ⇒ broken(exit 2);条目字段不齐 ⇒ 该条判红而不是丢掉。 */
export function readLedger(raw) {
  if (raw === null || raw === undefined) return { entries: [], absent: true, broken: null }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return {
      entries: [],
      absent: false,
      broken: `台账 ${LEDGER_FILE} JSON 解析失败:${String(e && e.message ? e.message : e).split('\n')[0]}`,
    }
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], absent: false, broken: `台账 ${LEDGER_FILE} 必须是数组,实得 ${typeof parsed}` }
  }
  const entries = []
  for (const [i, e] of parsed.entries()) {
    const missing = ['file', 'reason', 'ticket', 'until'].filter((k) => !String(e?.[k] ?? '').trim())
    if (missing.length) {
      entries.push({ index: i, file: String(e?.file ?? ''), broken: `缺字段 ${missing.join('/')}` })
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.until))) {
      entries.push({ index: i, file: String(e.file), broken: `until 不是 ISO 日期(${e.until})` })
      continue
    }
    entries.push({
      index: i,
      file: String(e.file),
      line: e.line ?? null,
      reason: String(e.reason),
      ticket: String(e.ticket),
      until: String(e.until),
    })
  }
  return { entries, absent: false, broken: null }
}

/**
 * 落槌(纯函数):差值棘轮 + 台账两红(缺字段/坏日期、到期)。
 * 台账刻意不做腐烂判(见头注):登记了而本面没有 W1 命中的条目是**登记性**的
 * (pyproject.toml 不在扫描扩展名、gitdir.mjs 无 W1),不因此判红。
 */
export function decide({ judged, anchor, ledger, today, face }) {
  const byFile = new Map()
  for (const e of ledger.entries) if (!e.broken) byFile.set(e.file, e)
  const violations = []
  const stock = []
  const exempted = []
  const expired = []
  const brokenLedger = []
  const matched = new Set()
  for (const j of judged) {
    if (j.error || j.w1.length === 0) continue
    const base = anchor.get(j.rel) ?? 0
    const e = byFile.get(j.rel)
    if (e) {
      if (e.until < today) {
        expired.push(
          `${j.rel} 的豁免(${e.ticket}) until=${e.until} 已到期,而该文件现有 W1 ${j.w1.length} 处 ⇒ 回队列重新裁(基线救不了)`,
        )
      } else {
        matched.add(j.rel)
        exempted.push({ rel: j.rel, count: j.w1.length, ticket: e.ticket, until: e.until })
      }
      continue
    }
    if (face === 'head') {
      stock.push({ rel: j.rel, count: j.w1.length, lines: j.w1.map((h) => h.line) })
      continue
    }
    if (j.w1.length > base) {
      violations.push({
        rel: j.rel,
        hits: j.w1,
        base,
        count: j.w1.length - base,
        why: `本次新增 W1 ${j.w1.length - base} 处(HEAD 面该文件 ${base})`,
      })
    } else {
      stock.push({ rel: j.rel, count: j.w1.length, lines: j.w1.map((h) => h.line) })
    }
  }
  for (const e of ledger.entries) {
    if (e.broken) brokenLedger.push(`${e.file || `第 ${e.index + 1} 条`}:${e.broken}`)
  }
  return { violations, stock, exempted, expired, brokenLedger, matched }
}

// ───────────────────────────── 一面判定 ─────────────────────────────

/**
 * 空候选/失明判定(纯函数):HEAD 面枚举到 0 个候选 ⇒ 尺子失效 ⇒ 判死(exit 2)。
 * staged 面 0 候选是正常的绿色(本次提交没碰盘根字面量)。
 */
export function enumerationVerdict({ face, candidates }) {
  if (face === 'head' && !Number.isFinite(candidates)) return 'dead:候选数取不到'
  if (face === 'head' && candidates === 0) {
    return 'dead:HEAD 面一个盘根字面量候选都没有 ⇒ 尺子疑似失效(或仓库已清理到零——若确属后者,按此指引把本判据随清理同批放宽,不得悄悄放绿)'
  }
  return null
}

/**
 * 一面的完整判定。取不到面(预筛派生错 / 候选 blob 缺失 / 台账 JSON 坏)一律抛
 * `Undetermined` 或记 brokenLedger,由 main 折成 exit 2。
 */
export function analyze({ face = 'head', root = ROOT } = {}) {
  const top = assertRepoRoot(root, 'disk-root-write 的判定根')
  const grepped = grepCandidates(top, face)
  const candidates = grepped.filter((p) => !STRUCTURAL_EXCLUDES.has(p) && langOf(p))
  const rows = readFace(top, face, candidates)
  for (const r of rows) {
    if (r.src === null) {
      throw new Undetermined(
        `${face === 'staged' ? '索引' : 'HEAD'} blob 取不到 ${r.rel} ⇒ 该面无法判定(不冒红也不记绿)`,
      )
    }
  }
  const judged = rows.map((r) => judgeSource(r.rel, r.src))

  // 锚点:HEAD 面上"该文件自身的 W1 数"。head 档判的就是 HEAD ⇒ 锚点即本轮读数
  // (新增按构造为 0)。staged 档只给有 W1 命中的文件取锚点。
  const anchor = new Map()
  if (face === 'head') {
    for (const j of judged) if (!j.error) anchor.set(j.rel, j.w1.length)
  } else {
    const need = judged.filter((j) => !j.error && j.w1.length > 0).map((j) => j.rel)
    if (need.length) {
      const specs = need.map((r) => `HEAD:${r}`)
      const got = catBatch(top, specs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
      const status = nameStatusMap(top, need)
      const pendings = []
      for (const rel of need) {
        const src = got.get(`HEAD:${rel}`) ?? null
        if (src !== null) {
          anchor.set(rel, judgeSource(rel, src).w1.length)
          continue
        }
        const st = status.get(rel)
        if (st && st.status === 'A') {
          anchor.set(rel, 0) // 新文件基线 0(不是取材失败)
          continue
        }
        if (st && st.old) {
          pendings.push({ rel, old: st.old }) // rename:基线从旧路径带
          continue
        }
        throw new Undetermined(
          `HEAD blob 取不到 ${rel} 且 name-status 既不判 A 也不判 rename ⇒ 无法判定(不拿"当成新文件"冒红)`,
        )
      }
      if (pendings.length) {
        const ospecs = pendings.map((p) => `HEAD:${p.old}`)
        const ogot = catBatch(top, ospecs, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
        for (const p of pendings) {
          const osrc = ogot.get(`HEAD:${p.old}`) ?? null
          if (osrc === null) {
            throw new Undetermined(
              `rename 基线源 HEAD blob 取不到 ${p.old}(${p.rel}) ⇒ 无法判定`,
            )
          }
          anchor.set(p.rel, judgeSource(p.old, osrc).w1.length)
        }
      }
    }
  }

  const led = readLedgerFromFace(top, face)
  const ledger = readLedger(led.raw)
  const today = new Date().toISOString().slice(0, 10)
  const d = decide({ judged, anchor, ledger, today, face })
  const counts = {
    candidates: candidates.length,
    grepped: grepped.length,
    excluded: grepped.length - candidates.length,
    w1: judged.reduce((a, j) => a + j.w1.length, 0),
    w2: judged.reduce((a, j) => a + j.w2.length, 0),
    dynamic: judged.reduce((a, j) => a + j.dynamic.length, 0),
    narrowed: judged.reduce((a, j) => a + j.narrowed.length, 0),
    probe: judged.reduce((a, j) => a + j.probe.length, 0),
    other: judged.reduce((a, j) => a + j.other.length, 0),
    undetermined: judged.filter((j) => j.error).length,
  }
  return {
    face,
    root: top,
    judged,
    anchor,
    counts,
    ledgerPresent: led.present,
    ledgerVia: led.via,
    ledgerBroken: ledger.broken,
    today,
    ...d,
  }
}

// ───────────────────────────── 接线读数 ─────────────────────────────

/**
 * 接线读数(纯函数,给镜像测试与自检用)。注册了就必须 **blocking + skipEnv 成套** ——
 * 一条 blocking 门没有自己的紧急出口,等于把"跳门"的成本转嫁给整条钩子链(§12e)。
 * 本门按规格**不设 stagedTriggers**(任何提交都跑),所以这一格只如实报告在不在。
 */
export function wiringState(runnerText, script = 'check-disk-root-write.mjs') {
  if (typeof runnerText !== 'string') return { wired: false, reason: 'runner 取不到' }
  const at = runnerText.indexOf(`script: '${script}'`)
  if (at < 0) return { wired: false, reason: '注册块不在 runner 面 ⇒ 未接线' }
  // 2026-10-15 修:原 ±900 定窗会把**前一条目**的 skipEnv/mode 先收进来(相邻条目紧挨),
  // 故改为按条目边界取窗(条目以 `\n  {` 起、`\n  }` 止)。单行条目会过取到下一多行条目,
  // 但首命中仍是本条目自身字段,故无碍。
  const entryStart = runnerText.lastIndexOf('\n  {', at)
  const entryEnd = runnerText.indexOf('\n  }', at)
  const win = runnerText.slice(
    entryStart >= 0 ? entryStart : Math.max(0, at - 900),
    entryEnd > at ? entryEnd + 4 : at + 900,
  )
  const mode = /mode:\s*'(blocking|warn|info)'/.exec(win)?.[1] ?? null
  const skipEnv = /skipEnv:\s*'([^']+)'/.exec(win)?.[1] ?? null
  const id = /id:\s*'(\d+)'/.exec(win)?.[1] ?? null
  const triggers = /stagedTriggers:\s*\[[^\]]*\]/.test(win)
  const missing = []
  if (mode !== 'blocking') missing.push(`mode=${mode ?? '未标'}`)
  if (!skipEnv) missing.push('skipEnv 缺失')
  return { wired: true, id, mode, skipEnv, triggers, missing }
}

// ───────────────────────────── 自检 ─────────────────────────────

/** 成对构造面:每条判据都同时给"必须命中"与"必须放过"两侧,放宽判据会当场红在一侧。 */
export function selfTest() {
  const cases = []
  const t = (name, cond, extra = '') => {
    cases.push({ name, ok: cond === true, extra: cond === true ? '' : String(extra ?? '') })
  }
  const J = (rel, src) => judgeSource(rel, src)
  const w1 = (rel, src) => J(rel, src).w1.length
  const w2 = (rel, src) => J(rel, src).w2.length
  const oth = (rel, src) => J(rel, src).other.length

  // ── 字面量解析与收窄 ──
  t('ST1 首段收窄:D:\\DevEnv\\x / G:\\IHUI-AI\\x / 大小写不敏感', (() => {
    const j = J('a.mjs', "const a = join('D:\\\\', 'DevEnv', 'x')\nconst b = join('g:/', 'ihui-ai', 'y')\n")
    return j.w1.length === 0 && j.narrowed.length === 2
  })(), JSON.stringify(J('a.mjs', "join('D:\\\\', 'DevEnv', 'x')")))
  t('ST2 精确匹配不是前缀:IHUI-AI-wt-b674 照旧立 W1', w1('a.mjs', "join('G:\\\\', 'IHUI-AI-wt-b674', 'x')") === 1)
  t('ST3 非收窄首段(G:\\backups)立 W1', w1('a.mjs', "join('G:\\\\backups', 'x')") === 1)
  t('ST4 drivePathOf:裸根 / 分段 / 正斜杠', (() => {
    const bare = drivePathOf("'D:\\\\'")
    const seg = drivePathOf('"X:/fixture/lock-dir"')
    const none = drivePathOf('NAME')
    return bare && bare.seg === null && seg && seg.seg === 'fixture' && none === null
  })())
  t('ST5 firstSegmentOfPathText:组件与盘符两种形态', (() => {
    return (
      firstSegmentOfPathText('DevEnv') === 'DevEnv' &&
      firstSegmentOfPathText('DevEnv\\Temp') === 'DevEnv' &&
      firstSegmentOfPathText('D:\\DevEnv\\x') === 'DevEnv' &&
      firstSegmentOfPathText('probe-x') === 'probe-x'
    )
  })())

  // ── JS/TS 判据 ──
  t('ST6 fs 写 sink 实参立 W1', w1('a.mjs', "fs.writeFileSync('G:/a', data)\n") === 1)
  t('ST7 裸根写 sink(mkdtempSync 夹具)立 W1', w1('a.mjs', "mkdtempSync('D:\\\\')\n") === 1)
  t('ST8 compose 首参裸根 + 非收窄后续立 W1', w1('a.mjs', "const p = join('G:\\\\', 'probe-x')\n") === 1)
  t('ST9 compose 首参裸根 + DevEnv 后续收窄', (() => {
    const j = J('a.mjs', "const p = join('D:\\\\', 'DevEnv', 'Temp', NAME)\n")
    return j.w1.length === 0 && j.narrowed.length === 1
  })())
  t('ST10 compose 后续是变量 ⇒ 动态只报数', (() => {
    const j = J('a.mjs', "const p = join('D:\\\\', NAME)\n")
    return j.w1.length === 0 && j.dynamic.length === 1
  })())
  // 已知射程边界(头注「已知射程边界」):盘符是模板变量(`${d}:\\x`)时 DRIVE_RE 认不出
  // 盘符(前导是 `}` 而非字母),整条不判 —— 安全方向(不误红),但也不计入 dynamic。
  t('ST11 模板变量盘符 ⇒ 不判(安全方向,已知边界)', (() => {
    const j = J('a.mjs', 'const p = `${d}:\\\\x`\n')
    return j.w1.length === 0 && j.dynamic.length === 0
  })())
  t('ST12 只读上下文 ⇒ W2 不判红', (() => {
    const j = J('a.mjs', "if (existsSync(join('G:\\\\backups', 'x'))) {}\n")
    return j.w1.length === 0 && j.w2.length === 1
  })())
  t('ST13 裸根只读 ⇒ 不命中(计数进 other)', (() => {
    const j = J('a.mjs', "existsSync('D:\\\\')\n")
    return j.w1.length === 0 && j.w2.length === 0 && j.other.length === 1
  })())
  t('ST14 语句级 compose(resolve 首参)立 W1', w1('a.mjs', "resolve('X:/fixture/lock-dir')\n") === 1)
  t('ST15 JS 赋值 ⇒ other 不判红', w1('a.mjs', "const p = 'D:\\\\foo'\n") === 0 && oth('a.mjs', "const p = 'D:\\\\foo'\n") === 1)
  t('ST16 exec 程序位(字面量)豁免', (() => {
    const j = J('a.mjs', "execFileSync('C:/Windows/System32/nssm.exe', ['get', 'x'])\n")
    return j.w1.length === 0 && j.probe.length === 1
  })())
  t('ST17 exec 程序位(compose 拼出)豁免', (() => {
    const j = J('a.mjs', "execFileSync(join('C:\\\\', 'Windows', 'System32', 'nssm.exe'), ['get'])\n")
    return j.w1.length === 0 && j.probe.length === 1
  })())
  t('ST18 exec 命令串中段 literal 立 W1', w1('a.mjs', "execSync('git bundle create D:\\\\x.bundle')\n") === 1)
  t('ST19 exec 实参数组 literal 立 W1', w1('a.mjs', "spawn('git', ['bundle', 'create', 'D:\\\\x'])\n") === 1)
  t('ST20 exec 选项对象 literal 只计数', (() => {
    const j = J('a.mjs', "spawn('git', ['status'], { cwd: 'D:\\\\repo' })\n")
    return j.w1.length === 0 && j.other.length === 1
  })())
  t('ST21 写 sink 的内容位不是路径位', (() => {
    const j = J('a.mjs', "writeFileSync('out.txt', 'D:\\\\x')\n")
    return j.w1.length === 0 && j.other.length === 1
  })())
  t('ST22 注释里的 literal 不算', w1('a.mjs', "// writeFileSync('G:\\\\a', d)\n") === 0)
  t('ST23 括号配不平 ⇒ 未判定', J('a.mjs', "writeFileSync('D:\\\\x', \n").error !== null)
  t('ST24 Path 探针 ⇒ W2;链式写 ⇒ W1', (() => {
    const probe = J('a.py', "p = Path('C:\\\\Program Files\\\\x\\\\chrome.exe')\n")
    const chained = J('a.py', "Path('D:\\\\x').write_text('y')\n")
    return probe.w1.length === 0 && probe.w2.length === 1 && chained.w1.length === 1
  })())

  // ── Python 判据 ──
  t('ST25 open 写模式立 W1', w1('a.py', "open('D:\\\\x', 'w')\n") === 1)
  t('ST26 open 默认读 ⇒ W2', w2('a.py', "open('D:\\\\x')\n") === 1 && w1('a.py', "open('D:\\\\x')\n") === 0)
  t('ST27 os.path.join 首参立 W1', w1('a.py', "os.path.join('G:\\\\', 'probe')\n") === 1)
  t('ST28 os.makedirs 立 W1', w1('a.py', "os.makedirs('G:\\\\new-dir')\n") === 1)
  t('ST29 os.path.exists ⇒ W2', w2('a.py', "os.path.exists('G:\\\\backups\\\\x')\n") === 1)
  t('ST30 subprocess 列表形元素 0 是程序位', (() => {
    const j = J('a.py', "subprocess.Popen(['C:\\\\Program Files\\\\x\\\\chrome.exe', '--headless'])\n")
    return j.w1.length === 0 && j.probe.length === 1
  })())
  t('ST31 subprocess 命令串中段 literal 立 W1', w1('a.py', "subprocess.run('git bundle create D:\\\\x.bundle', shell=True)\n") === 1)
  t('ST32 Py 注释与文档串里的 literal 不算', (() => {
    const j = J('a.py', "# open('D:\\\\x', 'w')\n'''\\nopen('D:\\\\y', 'w')\\n'''\n")
    return j.w1.length === 0
  })())
  t('ST33 Py 字符串前缀(r/b/f)不挡判定', w1('a.py', "open(r'D:\\\\x', 'w')\n") === 1)

  // ── PowerShell 判据 ──
  t('ST34 PS1 简单赋值立 W1', w1('a.ps1', "$target = 'G:\\backups\\pg-second-copy'\n") === 1)
  t('ST35 PS1 简单赋值收窄(DevEnv)', w1('a.ps1', "$x = 'D:\\DevEnv\\foo'\n") === 0)
  t('ST36 PS1 写 cmdlet 实参立 W1', w1('a.ps1', 'New-Item -ItemType Directory -Force -Path "D:\\foo"\n') === 1)
  t('ST37 PS1 写 cmdlet 内容位(-Value)不判', w1('a.ps1', 'Set-Content -Path $x -Value "D:\\y"\n') === 0)
  t('ST38 PS1 只读 cmdlet ⇒ W2', w2('a.ps1', 'Test-Path "G:\\backups\\x"\n') === 1)
  t('ST39 PS1 注释里的 literal 不算', w1('a.ps1', "# $x = 'G:\\y'\n") === 0)
  t('ST40 PS1 双引号插值 ⇒ 动态只报数', (() => {
    const j = J('a.ps1', '$x = "$root\\D:\\y"\n')
    return j.w1.length === 0 && j.dynamic.length === 1
  })())
  t('ST41 PS1 exec 程序位豁免', (() => {
    const j = J('a.ps1', "Start-Process 'D:\\tools\\x.exe' -Wait\n")
    return j.w1.length === 0 && j.probe.length === 1
  })())

  // ── sh 判据 ──
  t('ST42 sh 重定向立 W1', w1('a.sh', 'echo x > D:\\out\n') === 1)
  t('ST43 sh cp 实参立 W1', w1('a.sh', 'cp D:\\a D:\\b\n') === 2)
  t('ST44 sh 只读首词 ⇒ W2', w2('a.sh', 'cat D:\\a\n') === 1)

  // ── 棘轮与台账 ──
  const hitJ = (rel, n) => ({
    rel,
    lang: 'js',
    w1: Array.from({ length: n }, (_, k) => ({ line: k + 1, kind: 'x', seg: 'x', text: 'x' })),
    w2: [],
    dynamic: [],
    narrowed: [],
    other: [],
    probe: [],
    error: null,
  })
  const cleanJ = (rel) => ({ ...hitJ(rel, 0) })
  const today = '2026-12-31'
  t('ST45 棘轮:staged 2 > head 1 ⇒ 判红并点名', (() => {
    const r = decide({
      judged: [hitJ('scripts/a.mjs', 2)],
      anchor: new Map([['scripts/a.mjs', 1]]),
      ledger: readLedger('[]'),
      today,
      face: 'staged',
    })
    return r.violations.length === 1 && r.violations[0].rel === 'scripts/a.mjs' && r.violations[0].count === 1
  })())
  t('ST46 棘轮:staged 1 == head 1 ⇒ 存量只报数', (() => {
    const r = decide({
      judged: [hitJ('scripts/a.mjs', 1)],
      anchor: new Map([['scripts/a.mjs', 1]]),
      ledger: readLedger('[]'),
      today,
      face: 'staged',
    })
    return r.violations.length === 0 && r.stock.length === 1
  })())
  t('ST47 全量档(HEAD 面)永不判新增', (() => {
    const r = decide({
      judged: [hitJ('scripts/a.mjs', 3)],
      anchor: new Map([['scripts/a.mjs', 3]]),
      ledger: readLedger('[]'),
      today,
      face: 'head',
    })
    return r.violations.length === 0 && r.stock.length === 1
  })())
  t('ST48 台账有效豁免 ⇒ 放过(计数涨了也放过)', (() => {
    const r = decide({
      judged: [hitJ('scripts/a.mjs', 5)],
      anchor: new Map([['scripts/a.mjs', 1]]),
      ledger: readLedger(
        JSON.stringify([{ file: 'scripts/a.mjs', reason: 'x', ticket: 'G-1', until: '2027-01-31' }]),
      ),
      today,
      face: 'staged',
    })
    return r.violations.length === 0 && r.exempted.length === 1
  })())
  t('ST49 台账到期 ⇒ 判红(基线救不了)', (() => {
    const r = decide({
      judged: [hitJ('scripts/a.mjs', 1)],
      anchor: new Map([['scripts/a.mjs', 1]]),
      ledger: readLedger(
        JSON.stringify([{ file: 'scripts/a.mjs', reason: 'x', ticket: 'G-1', until: '2026-12-30' }]),
      ),
      today,
      face: 'staged',
    })
    return r.expired.length === 1 && r.violations.length === 0
  })())
  t('ST50 登记性条目(本面无 W1)不腐烂不判红', (() => {
    const r = decide({
      judged: [cleanJ('apps/ai-service/pyproject.toml')],
      anchor: new Map(),
      ledger: readLedger(
        JSON.stringify([{ file: 'apps/ai-service/pyproject.toml', reason: 'x', ticket: 'G-2', until: '2027-01-31' }]),
      ),
      today,
      face: 'head',
    })
    return r.violations.length === 0 && r.expired.length === 0 && r.stock.length === 0
  })())
  t('ST51 台账缺字段 ⇒ 该条判红', (() => {
    const r = decide({
      judged: [hitJ('scripts/a.mjs', 1)],
      anchor: new Map(),
      ledger: readLedger(JSON.stringify([{ file: 'scripts/a.mjs', reason: '', ticket: '', until: '' }])),
      today,
      face: 'staged',
    })
    return r.brokenLedger.length === 1 && r.violations.length === 1
  })())
  t('ST52 坏 JSON 台账 ⇒ broken(exit 2 档)', readLedger('{ 坏').broken !== null)
  t('ST53 非数组台账 ⇒ broken', readLedger('{"file":"a"}').broken !== null)
  t('ST54 台账缺席 ⇒ absent(按零豁免,不折成通过)', (() => {
    const l = readLedger(null)
    const r = decide({ judged: [hitJ('scripts/a.mjs', 1)], anchor: new Map(), ledger: l, today, face: 'staged' })
    return l.absent === true && r.violations.length === 1
  })())
  t('ST55 HEAD 面空候选 ⇒ 判死', enumerationVerdict({ face: 'head', candidates: 0 }) !== null)
  t('ST56 staged 面空候选 ⇒ 正常放行', enumerationVerdict({ face: 'staged', candidates: 0 }) === null)

  // ── 接线读数 ──
  const RUNNER_WITH = `  {\n    id: '213',\n    label: 'x',\n    script: 'check-disk-root-write.mjs',\n    args: [],\n    mode: 'blocking',\n    skipEnv: 'HUSKY_SKIP_DISK_ROOT_WRITE',\n  },`
  const RUNNER_NOENV = RUNNER_WITH.replace(",\n    skipEnv: 'HUSKY_SKIP_DISK_ROOT_WRITE'", '')
  const RUNNER_WARN = RUNNER_WITH.replace("mode: 'blocking'", "mode: 'warn'")
  t('ST57 未注册 ⇒ 判"未接线"(不是判过)', wiringState('const CHECKS = []').wired === false)
  t('ST58 注册成套 ⇒ blocking + skipEnv 都在', (() => {
    const w = wiringState(RUNNER_WITH)
    return w.wired && w.missing.length === 0 && w.mode === 'blocking' && w.skipEnv === 'HUSKY_SKIP_DISK_ROOT_WRITE'
  })(), JSON.stringify(wiringState(RUNNER_WITH)))
  t('ST59 注册了而缺 skipEnv ⇒ 不完整', wiringState(RUNNER_NOENV).missing.length === 1)
  t('ST60 注册成 warn ⇒ 不完整(规格要求 blocking)', wiringState(RUNNER_WARN).missing.length === 1)
  t('ST61 runner 取不到 ⇒ 未接线而不是"已接线"', wiringState(null).wired === false)

  // ── 真仓面:尺子对整族必须看得见 ──
  let real = null
  try {
    real = analyze({ face: 'head', root: ROOT })
  } catch (e) {
    real = { error: e && e.message ? e.message : String(e) }
  }
  t(
    'ST62 真仓 HEAD 面:候选 > 0 且判定无异常(扫描面在位)',
    real && real.error === undefined && real.counts.candidates > 0 && real.counts.undetermined === 0,
    real && real.error ? real.error : JSON.stringify(real && real.counts),
  )
  t(
    'ST63 真仓 HEAD 面:全量档不判新增(非恒红门)',
    real && real.error === undefined && real.violations.length === 0 && real.expired.length === 0,
    real && real.error ? real.error : JSON.stringify({ v: real && real.violations, e: real && real.expired }),
  )
  t(
    'ST64 真仓 HEAD 面:收窄在真代码上生效(ihui-deploy.ps1 零 W1)',
    (() => {
      if (!real || real.error !== undefined) return false
      const j = real.judged.find((x) => x.rel === 'deploy/win/ihui-deploy.ps1')
      return j !== undefined && j.w1.length === 0 && j.narrowed.length > 0
    })(),
    real && !real.error
      ? JSON.stringify(
          (real.judged.find((x) => x.rel === 'deploy/win/ihui-deploy.ps1') ?? {}).w1?.length,
        )
      : 'analyze 失败',
  )
  t(
    'ST65 真仓 HEAD 面:已知存量生产者读数在(swap-tunnel-token.ps1 有 W1 且不被误判红)',
    (() => {
      if (!real || real.error !== undefined) return false
      const j = real.judged.find((x) => x.rel === 'deploy/scripts/prod-bundle/swap-tunnel-token.ps1')
      return j !== undefined && j.w1.length === 1
    })(),
    real && !real.error
      ? JSON.stringify(
          (real.judged.find((x) => x.rel === 'deploy/scripts/prod-bundle/swap-tunnel-token.ps1') ?? {}).w1?.length,
        )
      : 'analyze 失败',
  )
  t(
    'ST66 真仓 runner 面:注册条目 blocking + skipEnv 成套(接线四件套之 runner 件)',
    (() => {
      try {
        const runnerText = readFileSync(resolve(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
        const w = wiringState(runnerText)
        return w.wired && w.missing.length === 0
      } catch {
        return false
      }
    })(),
  )

  const failed = cases.filter((c) => !c.ok)
  return { cases, failed, pass: cases.length - failed.length, fail: failed.length, total: cases.length }
}

// ───────────────────────────── CLI ─────────────────────────────

function argValue(argv, flag) {
  const i = argv.indexOf(flag)
  if (i < 0) return null
  return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--self-test')) {
    const r = selfTest()
    for (const c of r.failed) console.log(`${C.red}❌ 自检 ${c.name}${c.extra ? ` —— ${c.extra}` : ''}${C.reset}`)
    console.log(`\n[disk-root-write] 自检 例数 ${r.total} 通过 ${r.pass} 失败 ${r.fail}`)
    return r.fail > 0 ? 1 : 0
  }
  if (argv.includes('--worktree')) {
    console.error(
      `${C.red}❌ 本门不设 --worktree 面:工作树是并行会话的半编辑态,不得作为提交门禁(§22d 同口径);提交链只走 HEAD/索引两面${C.reset}`,
    )
    return 2
  }
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: false, def: 'head' })
  if (sel.error) {
    console.error(`${C.red}❌ ${sel.error}${C.reset}`)
    return 2
  }
  const rootArg = argValue(argv, '--root')
  if (rootArg === undefined) {
    console.error(`${C.red}❌ --root 需要一个目录实参${C.reset}`)
    return 2
  }
  const root = rootArg === null ? ROOT : resolve(rootArg)

  let a
  try {
    a = analyze({ face: sel.face, root })
  } catch (e) {
    console.error(
      `${C.red}❌ 无法判定(不冒红也不记绿,不回落另一个面):${e && e.message ? e.message : e}${C.reset}`,
    )
    return 2
  }
  if (a.ledgerBroken) {
    console.error(`${C.red}❌ 无法判定:${a.ledgerBroken}${C.reset}`)
    return 2
  }
  const dead = enumerationVerdict({ face: a.face, candidates: a.counts.candidates })
  const bad = a.violations.length + a.expired.length + a.brokenLedger.length
  const summary = `[disk-root-write] 判定面=${a.face}:W1 命中 ${a.counts.w1}(本次新增 ${a.violations.length},存量 ${a.stock.length},台账豁免 ${a.exempted.length},到期 ${a.expired.length})/ W2 只读 ${a.counts.w2} / 动态 ${a.counts.dynamic} / 窄化 ${a.counts.narrowed} / 探针 ${a.counts.probe} / 候选 ${a.counts.candidates} / 未判定 ${a.counts.undetermined}`

  if (argv.includes('--json')) {
    // 机读档只打这一份 JSON(末行读数一并进 JSON.summary);掺一行散文就会把 JSON.parse 打断。
    console.log(
      JSON.stringify(
        {
          face: a.face,
          root: a.root,
          counts: a.counts,
          dead,
          rc: bad > 0 ? 1 : dead ? 2 : STRICT && a.counts.undetermined > 0 ? 2 : 0,
          summary,
          violations: a.violations,
          stock: a.stock,
          exempted: a.exempted,
          expired: a.expired,
          brokenLedger: a.brokenLedger,
          readonly: a.judged.filter((j) => j.w2.length > 0).map((j) => ({ rel: j.rel, count: j.w2.length })),
          dynamic: a.judged.filter((j) => j.dynamic.length > 0).map((j) => ({ rel: j.rel, count: j.dynamic.length })),
          narrowed: a.judged.filter((j) => j.narrowed.length > 0).map((j) => ({ rel: j.rel, count: j.narrowed.length })),
          probe: a.judged.filter((j) => j.probe.length > 0).map((j) => ({ rel: j.rel, count: j.probe.length })),
          undetermined: a.judged.filter((j) => j.error).map((j) => j.error),
          ledgerPresent: a.ledgerPresent,
          ledgerVia: a.ledgerVia,
          today: a.today,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(`${C.cyan}[disk-root-write] 判定面=${a.face} 根=${a.root}${C.reset}`)
    for (const v of a.violations) {
      console.log(
        `  ${C.red}❌ 新增盘根写入生产者 ${v.rel}:${v.hits.map((h) => h.line).join(',')} —— ${v.why}${C.reset}`,
      )
      for (const h of v.hits.slice(0, 5)) console.log(`     ${C.dim}${h.line} [${h.kind}] ${h.text}${C.reset}`)
    }
    for (const s of a.brokenLedger) console.log(`  ${C.red}❌ 台账 ${LEDGER_FILE}:${s}${C.reset}`)
    for (const s of a.expired) console.log(`  ${C.red}❌ 豁免已到期:${s}${C.reset}`)
    const und = a.judged.filter((j) => j.error)
    for (const u of und.slice(0, LIST_CAP)) console.log(`  ${C.yellow}ℹ 未判定:${u.error}${C.reset}`)
    for (const s of a.stock.slice(0, LIST_CAP))
      console.log(`  ${C.yellow}· 存量(只报数不判红):${s.rel} W1 ${s.count} 处(:${s.lines.join(',')})${C.reset}`)
    if (a.stock.length > LIST_CAP)
      console.log(`  ${C.yellow}· 存量另有 ${a.stock.length - LIST_CAP} 个文件未逐条列出(--json 拿全量)${C.reset}`)
    for (const s of a.exempted.slice(0, LIST_CAP))
      console.log(`  ${C.dim}ℹ 台账豁免:${s.rel} W1 ${s.count} 处(${s.ticket},until ${s.until})${C.reset}`)
    const ro = a.judged.filter((j) => j.w2.length > 0)
    for (const s of ro.slice(0, LIST_CAP))
      console.log(`  ${C.dim}ℹ 只读上下文(W2,只计数):${s.rel} ${s.w2.length} 处${C.reset}`)
    if (!a.ledgerPresent)
      console.log(
        `${C.yellow}⚠ 台账 ${LEDGER_FILE} 不在被审面上 ⇒ 按"零豁免"判并大声报出(缺席不等于通过)。${C.reset}`,
      )
    if (dead) console.log(`${C.red}❌ ${dead}${C.reset}`)
  }

  if (bad > 0 || dead) {
    if (!argv.includes('--json')) console.log(`${C.red}${summary}${C.reset}`)
  } else if (!argv.includes('--json')) console.log(`${C.green}${summary}${C.reset}`)
  if (bad > 0) return 1
  if (dead) return 2
  if (STRICT && a.counts.undetermined > 0) return 2
  return 0
}

if (isDirectRun) {
  const code = main()
  process.exit(code)
}

// §22c/§22d(G-1058651):导出判据单元,使镜像测试可走「调生产入口」通道,
// 不必再把材料抄一遍。导入本模块(经 isDirectRun 守卫)不再产生副作用、不再 process.exit。
export const __test__ = {
  judgeSource,
  decide,
  readLedger,
  analyze,
  enumerationVerdict,
  wiringState,
  selfTest,
  main,
  langOf,
  pyMask,
  scriptStringSpans,
  splitScriptStatements,
  drivePathOf,
  literalArgText,
  firstSegmentOfPathText,
  segOf,
  narrowedSeg,
  SELF,
  OWN_TEST,
  LEDGER_FILE,
  TARGET_EXTS,
  STRUCTURAL_EXCLUDES,
  NARROWED_SEGS,
  DRIVE_RE,
  WRITE_SINKS,
  READ_SINKS,
  PROBE_SINKS,
  MODE_SINKS,
  EXEC_BARE,
  EXEC_FULL,
  COMPOSE_NAMES,
}
