// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// C 盘污染实地扫描(编号以 runner 里本 script 所在条目为准,文档不写死)。
// 与 check-c-drive-paths(只看源码字面量)互补:那道门看不见 os.tmpdir() 派生的写入,
// 而实测残骸正是从那条路来的。2026-09-24 起还认"盘根写歪项是否已封口"(见 seal-c-root-stray.mjs)。
// 同日补 TEMP 内容归因一维:名字白名单结构性抓不到随手起名的残骸(实测 clean-o7b.cjs 等 5 个
// 自己的脚本对全链失明),故对按名字认不出的 TEMP 文件改按**内容**认(仓库根路径/@ihui/ 包名/水印横幅)。

import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
// 封口清单**不抄第二份**:名字与目标路径的唯一真相源在封口器里,本门只读它。
import { ORPHAN_FILES, SEALED_DIRS, devEnvRoot, pathsFor, sealedFootprint } from './seal-c-root-stray.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')

/**
 * 本项目产物的识别特征。只按名字判,内容不看 —— 宁可漏报也不误删他人文件;
 * 名字不认识的一律进 foreign 清单交人判断,脚本本身永不删文件。
 */
const OUR_ROOT_PATTERNS = [
  { re: /^IHUI-/i, why: '盘根 IHUI- 前缀(探查脚本 / 构建状态文件)' },
  { re: /^\.empty-tmp\d*$/, why: '盘根 .empty-tmp*(清理实验残骸)' },
  { re: /^\.pnpm-store$/, why: '盘根 pnpm store(在 C:\\ 当 cwd 跑 pnpm 所致)' },
]
const OUR_TMP_PATTERNS = [
  { re: /^ihui-/, why: '临时夹具(测试 / --self-test 残留)' },
  { re: /^next-backup-node\d+/, why: '.next 构建备份($BackupRoot 曾写死 C 盘)' },
  { re: /^probe-.*\.sh$/, why: '现场探查脚本' },
  { re: /^wb-ext-debug\.log$/, why: '扩展调试日志' },
]

/**
 * TEMP 内容归因的特征串(2026-09-24 加)—— **导出的唯一真相源**,测试经 __test__ 直接引用,
 * 不得在别处再抄一份(§22c)。名字白名单抓不到"随手起名"的残骸(实测 C:\Windows\Temp 里
 * clean-o7b.cjs / verify-o7b.cjs 等 5 个自己的脚本既不计产物也不进未识别清单),而内容里
 * 出现仓库根路径 / @ihui/ 包名 / 溯源横幅的证据强度远高于文件名。
 * 仓库根特征按**本 checkout 的 REPO** 动态派生:反斜杠/正斜杠两种分隔符都认,串内转义形态
 * (`'D:\\IHUI-AI'` 双写)与行尾/引号收口(后面不是字母数字)也认 —— 残骸里的路径多为 JS 字符串字面量;
 * `G:\IHUI-AI` / `G:/IHUI-AI` 是额外钉死的强特征 —— 仓库历史上从 G: 迁到 D:(AGENTS.md 顶部),
 * 旧盘符只可能来自我们的旧脚本,同样归因给我们。
 */
function rootSigRe(root) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = /^([A-Za-z]:)([\\/])(.+)$/.exec(root)
  // 尾随判据用"下一个字符不得是字母数字":`IHUI-AI\bak` 之类近邻目录不误伤,
  // 而 `IHUI-AI\scripts`(更深路径)/ `IHUI-AI'`(引号收口)/ `IHUI-AI.git-backup-*`(归档)都放过。
  if (!m) return new RegExp(esc(root))
  return new RegExp(`${esc(m[1])}[\\\\/]{1,2}${esc(m[3])}(?![A-Za-z0-9])`)
}
export const CONTENT_SIGNATURES = [
  { re: rootSigRe(REPO), why: '内容含本仓仓库根路径(内容归因)' },
  { re: /G:[\\/]{1,2}IHUI-AI(?![A-Za-z0-9])/i, why: '内容含旧盘符仓库根 G:\\IHUI-AI(迁移前的我方脚本,内容归因)' },
  { re: /@ihui\//, why: '内容含本仓包命名空间 @ihui/(内容归因)' },
  { re: /IHUI-AI-PROVENANCE/, why: '内容含溯源水印横幅特征(§5c,内容归因)' },
  { re: /IHUI AI/, why: '内容含版权横幅 "IHUI AI"(§5c L1,内容归因)' },
]

/** 内容嗅探的大小上限:守门不为归因整读大文件,超限如实计 skipped 而非静默放过。 */
export const CONTENT_SNIFF_MAX_BYTES = 2 * 1024 * 1024

/**
 * 纯函数:对已读出的文本做特征匹配(与 IO 分离,便于 --self-test 不碰真盘钉死判据)。
 * 命中返回 { matched:true, why };不命中返回 { matched:false }。
 */
export function matchContentSignatures(text, sigs = CONTENT_SIGNATURES) {
  for (const s of sigs) if (s.re.test(text)) return { matched: true, why: s.why }
  return { matched: false }
}

/**
 * 读一个小文本文件并按内容归因。返回状态恒为四态之一,**绝不存在"没结论"**:
 *  - hit          命中仓库特征 ⇒ 归因"本项目产物(内容归因)"
 *  - notMatched   正常读完但未命中 ⇒ 继续留在"未识别"侧(他人工具态不得判成我们的)
 *  - skipped      目录 / 超 CONTENT_SNIFF_MAX_BYTES / 前 8KB 含 NUL(二进制)
 *  - failed       读取抛错(EISDIR/权限/竞态删除);若解码出的文本已命中特征则仍判 hit,
 *                 一条既有证据不因解码噪音(U+FFFD 等)被丢掉
 */
export function attributeByContent(path, sigs = CONTENT_SIGNATURES) {
  try {
    const st = statSync(path)
    if (st.isDirectory()) return { state: 'skipped', reason: '目录' }
    if (st.size > CONTENT_SNIFF_MAX_BYTES) return { state: 'skipped', reason: `超体积上限 ${CONTENT_SNIFF_MAX_BYTES}B` }
    const head = readFileSync(path)
    if (head.subarray(0, 8192).includes(0)) return { state: 'skipped', reason: '二进制(前 8KB 含 NUL)' }
    const text = head.toString('utf8')
    const m = matchContentSignatures(text, sigs)
    if (m.matched) return { state: 'hit', why: m.why }
    if (text.includes('\uFFFD')) return { state: 'failed', reason: 'utf8 解码含替代符(乱码/非 utf8)' }
    return { state: 'notMatched' }
  } catch (e) {
    if (e?.code === 'EISDIR') return { state: 'skipped', reason: '目录' }
    return { state: 'failed', reason: e?.code || e?.message || '读取异常' }
  }
}

/** 明确不属于本项目的盘根条目:只登记不报违规,免得把别人的东西当成我们的债。 */
const FOREIGN_ROOT = new Set([
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  'users',
  '$recycle.bin',
  'system volume information',
  'recovery',
  'boot',
  'perflogs',
  'inetpub',
  'temp',
  'tmp',
  'tools',
  'logs',
  'documents and settings',
])

/**
 * 封口形态判据(纯函数)—— 抽出来是为了让 --self-test 不碰真盘就能钉死两侧:
 * - SEALED   :名字在封口表里且当前是链接 ⇒ 内容已在 D 盘,**不占 C、不得计残骸**
 * - BROKEN   :名字在封口表里却是**真目录** ⇒ 封口被人删了/程序绕过了 ⇒ 必计残骸(回潮)
 * - FOREIGN  :不在封口表里 ⇒ 走原有分类
 * 本门此前把 `tmp`/`tools` 整体当他人目录跳过(FOREIGN_ROOT),于是 C:\tmp 里 5.9MB 的
 * git 抢救副本对门完全隐形 —— 这是"改道之后必须让门重新看见它"的原因。
 */
export function classifySeal(name, { exists, isLink, isDir }) {
  const entry = SEALED_DIRS.find((e) => e.name.toLowerCase() === String(name).toLowerCase())
  if (!entry) return 'FOREIGN'
  if (!exists) return 'ABSENT'
  if (isLink) return 'SEALED'
  if (isDir) return 'BROKEN'
  return 'BLOCKED-BY-FILE'
}

/** 是否重解析点(junction / symlink)。Node 对 junction 的 lstat 报 isSymbolicLink()=true(实测)。 */
function isReparsePoint(p) {
  try {
    return lstatSync(p).isSymbolicLink()
  } catch {
    return false
  }
}

function classifyRoot(name) {
  for (const p of OUR_ROOT_PATTERNS) if (p.re.test(name)) return p.why
  return null
}

/**
 * 盘根出现"单个字母命名的目录"= MSYS/Git-Bash 把 `/c/...` 当相对路径用的错位指纹。
 * 实测:2026-08-06 一次克隆就是这样在 C 盘里套出 `C:\c`(内含 4 份 origin 浅克隆 379MB
 * 与一份错位的 npm 全局前缀 136MB,共 515MB),`git status` 与其余守门全都不知道。
 * 只认目录:同名文件(如某些工具的 `c` 脚本)不判,宁漏不误报。
 */
function classifyRootEntry(name, isDir) {
  const byName = classifyRoot(name)
  if (byName) return byName
  if (isDir && /^[a-z]$/i.test(name)) return '盘根单字母目录(MSYS 把 /c/... 当相对路径的错位指纹)'
  return null
}

function classifyTmp(name) {
  for (const p of OUR_TMP_PATTERNS) if (p.re.test(name)) return p.why
  return null
}

/** 单文件体积(MB)。门原先对文件一律记 0,导致"合计 0 MB"的假小量级。 */
function fileSizeMB(p) {
  try {
    return statSync(p).size / 1048576
  } catch {
    return 0
  }
}

/** 输出用:小于 0.01MB 走 KB,免得 500 多个小文件读成一屏 0.000MB 噪音。 */
function fmtMB(mb) {
  if (!mb) return ''
  if (mb < 0.01) return (mb * 1024).toFixed(1) + 'KB'
  return mb.toFixed(2) + 'MB'
}

/**
 * 要扫的 TEMP 落点 —— **必须包含服务身份的 TEMP**,不能只有调用者的 `tmpdir()`。
 * 单独抽成函数是为了让它可被 `--self-test` 钉住:这条清单被谁缩回"只扫自己那一侧",
 * 本门就会重新给出假绿灯(2026-09-24 实测:部署脚本向 `C:\Windows\Temp` 泄漏 526 项,
 * 而门一路报 0 项)。纯函数,不碰文件系统,所以测试可以自己喂 sysRoot 断言。
 */
export function tempScanDirs(sysRoot, procTmp) {
  const win = (sysRoot || 'C:\\Windows').replace(/[\\/]$/, '')
  const list = ['C:\\tmp', 'C:\\temp', procTmp, win + '\\Temp', 'C:\\Windows\\Temp']
  // Windows 文件系统**大小写不敏感**:`SystemRoot` 实测可能是 `C:\windows`,与兜底字面量
  // `C:\Windows\Temp` 是同一个目录却成了两个条目 ⇒ 同一批文件被计两次(实跑 1056 项 vs 真实
  // 526)。按小写键去重,顺序保持"先精确后兜底"。
  const seen = new Set()
  return list.filter((p) => {
    if (!p || seen.has(p.toLowerCase())) return false
    seen.add(p.toLowerCase())
    return true
  })
}

function dirSizeMB(path) {
  let bytes = 0
  let visited = 0
  let capped = false
  const stack = [path]
  // 守门跑在 pre-commit 链上,体积只作量级参考:访问条目设上限,超限如实标 capped,
  // 绝不假装是精确值(曾按"弹栈次数 400"截断,把一个 5.1G 的 .next 备份报成 164MB)。
  while (stack.length) {
    if (visited++ > 60000) {
      capped = true
      break
    }
    const cur = stack.pop()
    let entries
    try {
      entries = readdirSync(cur, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = join(cur, e.name)
      if (e.isDirectory()) stack.push(full)
      else {
        try {
          bytes += statSync(full).size
        } catch {
          /* 句柄占用/权限不足时按 0 计,不影响"是否存在"的结论 */
        }
      }
    }
  }
  return { sizeMB: Math.round((bytes / 1024 / 1024) * 10) / 10, capped }
}

function scanTargets(target, classify) {
  const hits = []
  if (!existsSync(target)) return hits
  let names
  try {
    names = readdirSync(target)
  } catch {
    return hits
  }
  for (const name of names) {
    const why = classify(name, target)
    if (!why) continue
    const full = join(target, name)
    let kind = 'file'
    try {
      kind = statSync(full).isDirectory() ? 'dir' : 'file'
    } catch {
      /* 竞态删除:仍按命中报告,体积记 0 */
    }
    let fileSizeMBv = 0
    if (kind === 'file') fileSizeMBv = fileSizeMB(full)
    hits.push({
      path: full,
      kind,
      why,
      // ⚠️ 原来这里对**文件**直接写 `sizeMB: 0`,只有目录才量体积 ⇒ 526 个泄漏日志全按 0 计,
      // 门打印"合计约 0 MB"把真量级(6.9MB)报没了。文件必须量单文件字节。
      ...(kind === 'dir' ? dirSizeMB(full) : { sizeMB: fileSizeMBv, capped: false }),
    })
  }
  return hits
}

/** 盘根只挑"我们的"条目;白名单外的未知条目单列,交人判身份后再定性。 */
function scanDriveRoot(drive, devEnv) {
  const root = `${drive}\\`
  const hits = []
  const unknown = []
  const sealed = []
  if (!existsSync(root)) return { hits, unknown, sealed }
  let names
  try {
    names = readdirSync(root)
  } catch {
    return { hits, unknown, sealed }
  }
  for (const name of names) {
    if (name.endsWith('.sys') || name.toLowerCase() === 'bootmgr' || name === 'BOOTNXT') continue
    const full = join(root, name)
    let isDir = false
    let isLink = false
    try {
      isLink = lstatSync(full).isSymbolicLink()
      isDir = !isLink && statSync(full).isDirectory()
    } catch {
      /* 竞态/权限:按文件处理,单字母规则自然不命中 */
    }
    const seal = classifySeal(name, { exists: true, isLink, isDir })
    if (seal === 'SEALED') {
      // 已改道:内容在 D 盘。这里**绝对不能**去量它的体积 —— statSync 会跟随链接,
      // 把 D 盘目标算成"C 盘残骸"(改道后第一版就把 12MB 的 D 侧目标报到了 C 头上)。
      const entry = SEALED_DIRS.find((e) => e.name.toLowerCase() === name.toLowerCase())
      sealed.push({ path: full, name, target: pathsFor(entry, drive, devEnv ?? devEnvRoot()).target })
      continue
    }
    if (seal === 'BROKEN') {
      hits.push({
        path: full,
        kind: 'dir',
        why: '封口丢失:该名字应以 junction 改道,现在又是真目录(回潮)',
        ...dirSizeMB(full),
      })
      continue
    }
    if (seal === 'BLOCKED-BY-FILE') {
      hits.push({
        path: full,
        kind: 'file',
        why: '封口位被一个同名文件占住 ⇒ 改道建不起来',
        sizeMB: fileSizeMB(full),
        capped: false,
      })
      continue
    }
    const orphan = ORPHAN_FILES.find((o) => o.name.toLowerCase() === name.toLowerCase())
    if (orphan) {
      // 这两个 DLL 的在用版本在 System32,盘根那份是安装器往盘根解包的旧版重复件。
      // 复现即再计残骸 —— 不再放进"未识别清单"交人猜(本轮已逐条验明身份)。
      hits.push({
        path: full,
        kind: 'file',
        why: `盘根孤儿组件复现:${orphan.reason}`,
        sizeMB: fileSizeMB(full),
        capped: false,
      })
      continue
    }
    const why = classifyRootEntry(name, isDir)
    if (why) {
      hits.push({
        path: full,
        kind: isDir ? 'dir' : 'file',
        why,
        ...(isDir ? dirSizeMB(full) : { sizeMB: fileSizeMB(full), capped: false }),
      })
      continue
    }
    if (!FOREIGN_ROOT.has(name.toLowerCase())) unknown.push(join(root, name))
  }
  return { hits, unknown, sealed }
}

/**
 * TEMP 漂移检测:HKCU 声明的 TEMP 与活进程实际拿到的 TEMP 不一致,就是"改了指针
 * 但老进程不认"的那道根因(C 盘残骸天天新增的机制)。读注册表失败时如实报 unknown。
 */
function readHkcuTemp() {
  try {
    const out = execFileSync('reg.exe', ['query', 'HKCU\\Environment', '/v', 'TEMP'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const m = out.match(/TEMP\s+REG_SZ\s+(.+)/)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
}

/**
 * `reg query ... /v PagingFiles` 的输出 → 结构化。
 * **真机语料实测**(2026-09-24):REG_MULTI_SZ 的多个值不是分行,而是**同一行内用字面两字符
 * `\0` 分隔**(不是 NUL 字节 —— 实测 stdout 里 NUL 计数为 0),且前面还挂着
 * `    PagingFiles    REG_MULTI_SZ    ` 这段值名。所以不能"按行匹配整行",必须先把两种分隔符
 * (字面 `\0` 与真 NUL)统一换成空格,再全局抓 `X:\...sys [min max]`。
 * 第一版按"每行一条"写,真机上直接解析出 0 条 ⇒ 30GB 的待重启落差会被静默报成"配置一致"。
 */
export function parsePagingFiles(raw) {
  const text = String(raw || '').replace(/\\0|\u0000/g, ' ')
  const re = /([A-Za-z]:\\[^\s]+?\.sys)(?:\s+(\d+)\s+(\d+))?/gi
  const seen = new Set()
  const out = []
  for (const m of text.matchAll(re)) {
    const path = m[1]
    const key = path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const initial = m[2] === undefined ? null : Number(m[2])
    const max = m[3] === undefined ? null : Number(m[3])
    out.push({
      path,
      drive: path.slice(0, 1).toUpperCase(),
      initialMB: initial,
      maxMB: max,
      // "0 0" 是 Windows 表示"系统管理大小"的写法 —— 没有上限可对照,哨兵对它无意义
      systemManaged: initial === null ? false : initial === 0 && max === 0,
    })
  }
  return out
}

/**
 * 量 pagefile 的磁盘大小 —— **不能用 fs.statSync**:实测 Node 对 `C:\pagefile.sys` 报
 * `EINVAL`(它是内存管理器持有的特殊文件,libuv 的 stat 走"打开句柄再 fstat",而它打不开)。
 * 第一版因此把两条都算成"量不到",输出却写成「配置与磁盘一致(合计 0 GB)」= 标准的假绿灯。
 * 也不能改走 `cmd /c for %A in (...) do %~zA`:Node 会给含空格的整串参数加引号,cmd 再剥一次
 * 首尾引号 ⇒ 嵌套引号失配,实测同样一条都量不到(已真机验过,不是猜的)。
 * 现走 WMI:`Win32_PageFileUsage.AllocBaseSize` 就是"当前已分配 MB",连路径都不用拼。
 */
export function parsePagefileUsage(raw) {
  const map = new Map()
  for (const line of String(raw || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(\S+\.sys)\t\s*(\d+)\s*$/i)
    if (m) map.set(m[1].toLowerCase(), Number(m[2]))
  }
  return map
}

function pwshCandidates() {
  const out = [join(resolve(REPO, '..', '..'), 'Program Files', 'PowerShell', '7', 'pwsh.exe')]
  if (process.env.ProgramFiles) out.push(join(process.env.ProgramFiles, 'PowerShell', '7', 'pwsh.exe'))
  out.push('pwsh.exe')
  // 绝对路径候选先过滤存在性:不然每次先白抛一个 ENOENT(本机 PowerShell 装在 C:,而仓库在 D:)
  return [...new Set(out)].filter((p) => p === 'pwsh.exe' || existsSync(p))
}

function measurePagefilesMB() {
  // 属性名必须是 **AllocatedBaseSize**:MSDN 文档写的 `AllocBaseSize` 在本机这个类里根本不存在,
  // 用它拿到的值会被 PowerShell 静默渲染成空串 ⇒ 一条都量不到 ⇒ "未判定"(实测踩过)。
  const script =
    'Get-CimInstance Win32_PageFileUsage | ForEach-Object { "{0}`t{1}" -f $_.Name, $_.AllocatedBaseSize }'
  for (const bin of pwshCandidates()) {
    try {
      const out = execFileSync(bin, ['-NoProfile', '-NonInteractive', '-Command', script], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
      })
      const map = parsePagefileUsage(out)
      if (map.size) return map
    } catch {
      /* 换下一个候选;全落空则由调用方报「未判定」,绝不记为通过 */
    }
  }
  return new Map()
}

function readPagingFiles() {
  try {
    const raw = execFileSync(
      'reg.exe',
      ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management', '/v', 'PagingFiles'],
      { encoding: 'utf8', windowsHide: true, timeout: 8000 },
    )
    return parsePagingFiles(raw)
  } catch {
    return null
  }
}

/**
 * 页面文件"配置已改小 / 磁盘仍是旧大小"的对照哨兵。
 * 为什么要有这条:Windows 的内存管理器在运行期**锁住** pagefile.sys,注册表改了也要重启才收缩 ——
 * 与 TEMP 漂移同一形态("指针改了,活的东西不认")。没有这条,改完配置的人会以为 30GB 已经回来了,
 * 而 df 显示没变。文件缩到位后本条自动不再报。
 * ⚠️ `measured === false`(一条都没量到)必须报"未判定",**不得**记为通过。
 */
export function pagefilePending(paging, sizes) {
  if (!Array.isArray(paging)) return { readable: false, entries: 0, measured: 0, pending: [], totalMB: 0 }
  const pending = []
  let measured = 0
  let totalMB = 0
  for (const p of paging) {
    const actualMB = sizes.get(p.path.toLowerCase())
    if (actualMB === undefined || !Number.isFinite(actualMB)) continue
    measured++
    totalMB += actualMB
    if (p.maxMB === null || p.systemManaged) continue
    const gap = actualMB - p.maxMB
    // 落差既要绝对值可观(>512MB)又要比例可观(>25%)才判"待重启",防四舍五入级别的抖动
    if (gap > 512 && gap / actualMB > 0.25) pending.push({ ...p, actualMB: Math.round(actualMB), gapMB: Math.round(gap) })
  }
  return { readable: true, entries: paging.length, measured, pending, totalMB: Math.round(totalMB) }
}

function detectTempDrift(options = {}) {
  const proc = resolve(options.procTmp || tmpdir())
  const declared = 'declaredTemp' in options ? options.declaredTemp : readHkcuTemp()
  if (!declared) return { status: 'unknown', proc, declared: null }
  if (resolve(declared) === proc) return { status: 'ok', proc, declared }
  return { status: 'drift', proc, declared }
}

export const MAINTAIN_TASK_NAME = 'IHUI C-Drive AutoMaintain'
/** 按名字**片段**而非全名匹配:注册名含空格,§26 记录过拿文档旧名点名查会得到"系统找不到指定的文件",
 *  于是"查法失效"与"任务真不存在"产出同一个结论;片段比对大小写不敏感,不吃尾空格与连字符变体。 */
const MAINTAIN_TASK_NEEDLE = 'c-drive'

/**
 * 纯函数:`schtasks /Query /FO CSV /NH` 的原始 stdout → 三态(registered / unregistered / undetermined)。
 * 判「未注册」的前置条件是**输出形态自证**:至少要有一行首字段是 `\` 开头的任务路径。
 * 为什么把"没查到"与"查法失效"分成两态:本门此前反过来把不存在的任务硬写成"已注册" —— 两者是
 * 同一种病(结论没有依据),只是方向相反;把空扫说成未注册,同样会在别的机器上造出一个假红。
 */
export function judgeTaskRegistration(raw, needle = MAINTAIN_TASK_NEEDLE) {
  const text = raw === null || raw === undefined ? '' : String(raw)
  if (!text.trim()) return { state: 'undetermined', reason: 'schtasks 输出为空(命令没跑成 / stdout 被吞)', rows: 0, matched: [] }
  const lines = text.split(/\r?\n/)
  const names = []
  for (const line of lines) {
    const m = /^\s*"((?:[^"]|"")*)"/.exec(line)
    if (m) names.push(m[1].replace(/""/g, '"'))
  }
  if (!names.length)
    return { state: 'undetermined', reason: `输出里解不出任何 CSV 首字段(共 ${lines.filter((l) => l.trim()).length} 行非空)`, rows: 0, matched: [] }
  const shaped = names.filter((n) => n.startsWith('\\'))
  if (!shaped.length)
    return {
      state: 'undetermined',
      reason: `解出 ${names.length} 个字段却无一项是 \\ 开头的任务路径 ⇒ 输出形态不是 /fo CSV,不能据此判未注册`,
      rows: 0,
      matched: [],
    }
  const n = String(needle).toLowerCase()
  const matched = shaped.filter((x) => x.toLowerCase().includes(n))
  return matched.length
    ? { state: 'registered', reason: '', rows: shaped.length, matched }
    : { state: 'unregistered', reason: '', rows: shaped.length, matched: [] }
}

/**
 * 计划任务在不在 —— 只回答"在不在",不伸到 S4U/StartBoundary 等注册验收细节(那是注册动作的验收,
 * 不属本只读门)。非 win32 / 命令不可用 / 超时 / 退出异常 / 输出形态不符 ⇒ 一律 `未判定` + 原因,
 * **绝不记为通过**(与本门"空扫不报绿"、§26"一条都没量到必须未判定"同一取向)。
 * `raw` / `bin` / `timeout` 是给测试与离线巡检的注入口(与本文件 `scanC` 的注入约定同形,
 * **默认行为一字不变**):没有它们,「命令不可用」「超时」两条失效分支就只能靠读源码断言 ——
 * 而那种断言会跟着判据一起被改坏,不等于测过。
 */
export function queryMaintainTask(options = {}) {
  if (typeof options.raw === 'string') return judgeTaskRegistration(options.raw, options.needle)
  if (process.platform !== 'win32')
    return { state: 'undetermined', reason: `非 win32 平台(${process.platform}),没有 schtasks 可查`, rows: 0, matched: [] }
  try {
    const out = execFileSync(options.bin || 'schtasks.exe', ['/Query', '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: options.timeout || 15000,
      maxBuffer: 1 << 24,
    })
    return judgeTaskRegistration(out, options.needle)
  } catch (e) {
    const detail = String(e?.stderr || e?.message || '')
      .replace(/\r?\n/g, ' ')
      .trim()
      .slice(0, 160)
    const reason =
      e?.code === 'ENOENT'
        ? 'schtasks.exe 不可用(ENOENT)'
        : e?.code === 'ETIMEDOUT' || e?.signal === 'SIGTERM'
          ? `schtasks 查询超时(${options.timeout || 15000}ms)被杀`
          : `schtasks 查询失败(${detail || e?.code || '未知异常'})`
    return { state: 'undetermined', reason, rows: 0, matched: [] }
  }
}

/** 三态到人话(输出面与 --json 共用一份措辞,避免两处各写一版)。 */
export function describeMaintainTask(task) {
  if (task.state === 'registered') return `已注册(实测命中:${task.matched.join(', ')})`
  if (task.state === 'unregistered') return `未注册(全量 ${task.rows} 项任务里零命中 "${MAINTAIN_TASK_NEEDLE}")`
  return `未判定(${task.reason})`
}

export function scanC(options = {}) {
  const drive = options.drive || 'C:'
  const devEnv = options.devEnv || devEnvRoot()
  // 两个仅供测试/巡检的注入口(**默认行为完全不变**):
  // `scanDriveRoot` 与 TEMP 枚举扫的是**这台机器此刻**的内容,而"两次扫描结果必须一致"这类
  // 断言测的是本门只读、不改文件。全量镜像测试是**文件级并行**跑的(一个 `node --test` 批次里
  // 多个文件同时跑),兄弟测试正在创建/删除 `ihui-*` 夹具 ⇒ 21s 的双扫描窗口内数量必然漂移
  // (2026-09-24 全量首跑就是这么红的,且它在任何机器包括 CI 上都会间歇红 —— 与仓库内容无关)。
  // 因此让调用方可以把扫描面钉到自己的隔离目录,而不是去削断言。
  const root = options.skipDriveRoot ? { hits: [], unknown: [], sealed: [] } : scanDriveRoot(drive, devEnv)
  // 夹具落点一律要扫(落在哪盘都要报);"是不是又掉回 C 盘"由 temp 漂移单独结论回答
  // ⚠️ 这里必须列**所有身份的 TEMP**,不能只列 `tmpdir()`:同一个 `$env:TEMP` 在不同身份下
  // 指向不同目录 —— 守门跑在交互账户下拿到 `C:\Users\<me>\AppData\Local\Temp`,而
  // nssm 服务(IHUI-API / IHUI-DEPLOYLOOP)跑在 LocalSystem 下拿到 `C:\Windows\Temp`。
  // 2026-09-24 实测:部署脚本每次构建泄漏 2 个 `ihui-next-build-*.log` 到服务侧 TEMP,
  // 攒了 **526 项 / 6.9MB、当天还在 +5**,而本门一直报"本项目产物 0 项" —— 因为它只扫自己
  // 那一侧的 TEMP。这类"守门与污染源不同身份"的盲区,比漏扫一个目录更危险:它给的是假绿灯。
  const sysRoot = options.sysRoot || process.env.SystemRoot || process.env.windir || 'C:\\Windows'
  const dirs = options.tempDirs || tempScanDirs(sysRoot, options.procTmp || tmpdir())
  const items = []
  const sealedScanSkipped = []
  // 内容归因一维的如实计数(绝不静默):candidates=按名字认不出、真去嗅探了的文件数
  const contentAttribution = { candidates: 0, hits: 0, skippedSizeOrBinary: 0, readFailed: 0, hitPaths: [] }
  for (const d of new Set(dirs)) {
    // 已改道的扫描位(现 C:\tmp 就是 junction)一律不跟随:跟随会把 D 盘目标算成 C 盘残骸,
    // 而任何"按名字删"的下游动作会顺着链接打进 D 盘 —— 实测 PS 的 -Recurse 确实穿透 junction。
    if (isReparsePoint(d)) {
      sealedScanSkipped.push(d)
      continue
    }
    items.push(...scanTargets(d, (n) => classifyTmp(n)))
    // 名字判据是必要非充分的:命中过的不再嗅探;其余**文件**候选做内容归因。
    // 用 dirname 精确匹配而不是 startsWith(d):'C:\temp\x' 能以字面 'C:\tmp' 开头,前缀比较会把
    // 邻目录的名字误当本目录已命中,使那枚文件两头都不看(名字没判、内容被跳过)= 静默漏归因。
    // 候选目录清单取不到(readdir 抛错)按候选 0 计,由输出面的"未判定"行揭穿,不静默记通过。
    const byName = new Set(items.filter((h) => dirname(h.path) === d).map((h) => basename(h.path)))
    let names
    try {
      names = readdirSync(d)
    } catch {
      continue
    }
    for (const name of names) {
      if (byName.has(name)) continue
      const full = join(d, name)
      try {
        if (!statSync(full).isFile()) continue // 目录不是文件候选,不计任何一态
      } catch {
        continue // 竞态删除/权限:量不到身份,不充候选
      }
      contentAttribution.candidates++
      const r = attributeByContent(full)
      if (r.state === 'hit') {
        contentAttribution.hits++
        contentAttribution.hitPaths.push(full)
        items.push({ path: full, kind: 'file', why: r.why, sizeMB: fileSizeMB(full), capped: false })
      } else if (r.state === 'skipped') contentAttribution.skippedSizeOrBinary++
      else if (r.state === 'failed') contentAttribution.readFailed++
    }
  }
  const ours = [...root.hits, ...items]
  const brokenSeal = ours.filter((h) => /封口|孤儿组件复现/.test(h.why))
  const bytesMB = ours.reduce((s, i) => s + (i.sizeMB || 0), 0)
  const paging = readPagingFiles()
  const pagefile = pagefilePending(paging, measurePagefilesMB())
  return {
    drive,
    devEnv,
    pagefile,
    ours,
    unknownRoot: root.unknown,
    sealed: root.sealed,
    sealedScanSkipped,
    brokenSeal,
    contentAttribution,
    temp: detectTempDrift(options),
    totalMB: Math.round(bytesMB * 10) / 10,
  }
}

function main(argv) {
  const json = argv.includes('--json')
  const strict = argv.includes('--strict')
  if (argv.includes('--self-test')) return selfTest()
  const r = scanC()
  const task = queryMaintainTask()
  if (json) {
    console.log(JSON.stringify({ ...r, maintainTask: task }, null, 2))
  } else {
    console.log(`C 盘污染实地扫描:本项目产物 ${r.ours.length} 项,合计约 ${r.totalMB} MB`)
    for (const i of r.ours)
      console.log(
        `  ⚠️  ${i.path}  [${i.why}]${i.sizeMB ? ` ${fmtMB(i.sizeMB)}` : ''}`,
      )
    if (r.unknownRoot.length) {
      console.log(`\n未识别的盘根条目 ${r.unknownRoot.length} 项(只登记,不定性、不清理):`)
      for (const u of r.unknownRoot.slice(0, 15)) console.log(`  · ${u}`)
      if (r.unknownRoot.length > 15) console.log(`  …另 ${r.unknownRoot.length - 15} 项`)
    }
    if (r.sealed.length) {
      console.log(`\n已封口(以 junction 改道到外置根,不占 C)${r.sealed.length} 项:`)
      for (const s of r.sealed) console.log(`  ✔ ${s.path} → ${s.target}`)
      const fp = sealedFootprint(r.drive, r.devEnv)
      const mb = fp.reduce((a, b) => a + b.bytes, 0) / 1048576
      const cnt = fp.reduce((a, b) => a + b.count, 0)
      console.log(`   封口目标实际占用(在 D 盘,不是 C 的债):${mb.toFixed(2)} MB / ${cnt} 个文件`)
      console.log(`   封口健康自检:node scripts/seal-c-root-stray.mjs --check`)
    }
    if (r.sealedScanSkipped.length)
      console.log(`\n扫描位已改道、本门刻意不跟随(跟随会把 D 盘目标算成 C 的债):${r.sealedScanSkipped.join(', ')}`)
    // 内容归因一维**永不静默**:三态计数一律打印;候选为 0 时如实报"未判定"而非默默记通过
    // (空扫 = 扫描目录读不到/全被跳过,与"扫过了、确实没有"是两件必须让读者分开的事)。
    const ca = r.contentAttribution
    console.log(
      `\nTEMP 内容归因(按名字认不出的候选再做内容嗅探):候选 ${ca.candidates} 个 |` +
        ` 命中 ${ca.hits} 个 | 因体积>2MB/二进制跳过 ${ca.skippedSizeOrBinary} 个 | 读取失败 ${ca.readFailed} 个`,
    )
    if (ca.candidates === 0)
      console.log('  ⚠️ 本轮一个 TEMP 文件候选都没扫到 ⇒ 内容归因**未判定**,不计为通过(扫描目录不可读?新装机器?)')
    for (const p of ca.hitPaths) console.log(`  ⚠️  ${p}  [本项目产物(内容归因:命中仓库特征串)]`)
    console.log(
      r.temp.status === 'ok'
        ? `\nTEMP 一致:进程 ${r.temp.proc}`
        : r.temp.status === 'drift'
          ? `\n❌ TEMP 漂移:注册表=${r.temp.declared},本进程仍=${r.temp.proc}\n   ⇒ 活进程环境块未刷新,夹具会继续落回旧盘。新建终端/重启宿主后自愈。`
          : `\nTEMP 注册表值读不到(离线/权限),仅比对进程 TEMP=${r.temp.proc}`,
    )
    // 页面文件"配置已改小但文件仍占着旧大小"—— 只有重启会收缩,不写出来的话就是
    // "改了配置的人以为空间回来了,而 df 没变"那一类静默落差。缩到位后本行自动不再出现。
    const pf = r.pagefile
    if (!pf.readable) {
      console.log('\n页面文件:注册表 PagingFiles 读不到(离线/权限)⇒ **未判定**,不计为通过')
    } else if (pf.measured === 0) {
      console.log(
        `\n页面文件:配置读到 ${pf.entries} 条,但磁盘大小一条都没量到 ⇒ **未判定**,不计为通过` +
          `(statSync 对 pagefile.sys 必报 EINVAL、cmd 的 %~zA 又栽在嵌套引号上,故量大小走 WMI 的 AllocBaseSize)`,
      )
    } else {
      for (const p of pf.pending)
        console.log(
          `\n⚠️ 页面文件待重启生效:${p.path} 配置上限 ${p.maxMB}MB,磁盘上仍是 ${p.actualMB}MB(差 ${p.gapMB}MB)⇒ 下次重启才释放`,
        )
      if (!pf.pending.length)
        console.log(
          `\n页面文件:配置与磁盘一致(量到 ${pf.measured}/${pf.entries} 条,合计 ${Math.round(pf.totalMB / 1024)} GB${
            pf.measured < pf.entries ? ';余下几条未量到,不作数' : ''
          })`,
        )
    }
    // 原提示写的是 `pnpm c-drive:clean-ours`,而根 package.json 里**从来没有这个脚本**
    // (实测 `node -p "...scripts['c-drive:clean-ours']"` → undefined)⇒ 门给出了一个跑不通的
    // 修复动作,等于没有修复动作。这里改成真实存在的入口,并要求先预演。
    console.log('\n本门只读,不删除任何文件。清理(只删上面列出的本项目产物,按名字筛):')
    console.log('  1) 预演  pwsh -NoProfile -File scripts/c-drive-auto-maintain.ps1 -DryRun')
    console.log('  2) 执行  pwsh -NoProfile -File scripts/c-drive-auto-maintain.ps1')
    // 这一行原先无条件打印「已注册(S4U,wscript 包装)」,而脚本内一次 schtasks 都没调过 ——
    // 一道揭示 C 盘污染可见性的门,替一个已经不存在的防护背书:读它输出的人会以为每天在自动清理,
    // 从而不去查真正没在跑的东西。现改为实测三态(权威查法 = 全量列表 + 名字片段匹配,见 §26)。
    if (task.state === 'registered') {
      console.log(`  ✔ 计划任务 ${MAINTAIN_TASK_NAME}:${describeMaintainTask(task)}(全量 ${task.rows} 项任务)`)
    } else if (task.state === 'unregistered') {
      console.log(`  ❌ 计划任务 ${MAINTAIN_TASK_NAME}:${describeMaintainTask(task)}⇒ **每日自动清理当前没有在跑**`)
      console.log('     注册 = 影响全机的每日自动删除,须用户授权 ⇒ 本门只报不注册(注册动作由人执行,见 AGENTS.md §26)。')
      const windir = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows'
      const q = (p) => `\\"${p}\\"`
      const tr = `"${q(join(windir, 'System32', 'wscript.exe'))} //B ${q(join(REPO, 'scripts', 'c-drive-maintain-hidden.vbs'))}"`
      console.log('     人工注册两步(① 必须经 wscript 包装 —— 直跑 pwsh/node 每天闪黑窗;② 必须升 S4U —— 否则无人登录的凌晨不跑):')
      console.log(`     1) schtasks /Create /F /TN "${MAINTAIN_TASK_NAME}" /SC DAILY /ST 03:00 /TR ${tr}`)
      console.log(`     2) cscript //nologo "${join(REPO, 'scripts', 'task-set-s4u.vbs')}" "${MAINTAIN_TASK_NAME}"`)
      console.log('     注册后回读仍只认全量列表法:node scripts/check-c-drive-pollution.mjs | grep 计划任务')
    } else {
      console.log(`  ⚠️ 计划任务 ${MAINTAIN_TASK_NAME}:${describeMaintainTask(task)}⇒ 不记为已注册,也不据此判未注册`)
    }
    if (r.brokenSeal.length)
      console.log(
        '\n❌ 上面有「封口丢失/孤儿复现」项 ⇒ 根治器重跑一次即可(幂等):node scripts/seal-c-root-stray.mjs --apply',
      )
  }
  // --strict 的判红面**必须含 brokenSeal**:封口回潮是本门唯一的"根治失效"信号,
  // 若只按 ours 判,回潮会被算进 ours 却永远靠名字白名单看不见(旧版 tmp/tools 整体跳过即此坑)。
  if (strict && (r.ours.length || r.brokenSeal.length)) return 1
  return 0
}

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg}: 期望 ${b},实际 ${a}`)
  }

  t('盘根 IHUI- 前缀识别为自有产物', () => eq(classifyRoot('IHUI-probe-tail.ps1') !== null, true, '命中'))
  t('盘根单字母**目录**判为 MSYS 错位指纹(C:\\c 曾藏 515MB 浅克隆)', () =>
    eq(classifyRootEntry('c', true) !== null, true, '未识别 C:\\c 这类错位目录'))
  t('单字母**文件**不判(宁漏不误报)', () => eq(classifyRootEntry('c', false), null, '误判单字母文件'))
  t('多字母目录不因新规则误判', () => eq(classifyRootEntry('Windows', true), null, 'Windows 误判'))
  t('盘根 .pnpm-store 识别', () => eq(classifyRoot('.pnpm-store') !== null, true, '命中'))
  t('系统条目不得判为我们的', () => eq(classifyRoot('Windows'), null, 'Windows 误判'))
  t('Temp 里 ihui- 夹具识别', () => eq(classifyTmp('ihui-origin-Ab12Cd') !== null, true, '命中'))
  t('Temp 里 .next 备份识别', () => eq(classifyTmp('next-backup-node22-20260918-094636') !== null, true, '命中'))
  t('Temp 里他人随机 .tmp 不得命中', () => eq(classifyTmp('8f575ef0-6180-4c22-b1d4-4161278b643b.tmp'), null, '误判'))

  // —— TEMP 内容归因(2026-09-24 补,堵名字白名单的结构性盲区:clean-o7b.cjs 那型) ——
  t('内容特征串:仓库根两种分隔符 + 旧盘 G: + @ihui/ + 水印横幅两形都必须命中', () => {
    for (const s of [
      `${REPO}\\scripts\\x.mjs`,
      `${REPO.replace(/\\/g, '/')}/apps`,
      // JS 字符串字面量里的双写转义形态 + 引号收口(探针的原始形状,判据必须吃下)
      `const root='${REPO.replace(/\\/g, '\\\\')}'`,
      'G:\\IHUI-AI\\.git.broken-x',
      'G:/IHUI-AI/a.ts',
      "from '@ihui/design-tokens'",
      '// [IHUI-AI-PROVENANCE]:…',
      '// © 2026 IHUI AI (智汇AI)',
    ])
      eq(matchContentSignatures(s).matched, true, `漏命中:${s}`)
  })
  t('内容归因反向对照:他人工具态与泛文本不得判为我们的(清理任务最严重的失误方向)', () => {
    for (const s of [
      'C:\\Users\\me\\AppData\\Local\\Temp\\out.log',
      '{"k":1}',
      'D:\\OtherRepo\\src\\a.ts',
      'ihui-ai-provenance-lowercase',
      'qoder session state dump',
      // 前缀相似但不是仓库根(后面紧跟的既不是分隔符也不是旧盘特征):不得误伤。
      // 必须跟着本机真根拼:写死别的盘符时,这条在本仓不是那个盘时根本进不了 guard 的射程,
      // 于是"不误伤"退化成人畜无害的空断言 —— 绿色但不看守任何东西。
      `${REPO}IsHugeOtherThing\\x`,
    ])
      eq(matchContentSignatures(s).matched, false, `误判:${s}`)
    // 旧盘 G: 特征是钉死的:迁移前的旧脚本只认当前 REPO 就会重新失明。
    // 按 why 锁定"旧盘符"那一族,而不是随便找一条能 test('G:\IHUI-AI\') 的 —— 后者在本仓就在 G: 时
    // 会被"当前仓库根"特征顺手满足,删掉钉死族也照样报绿(假绿)。
    const legacy = CONTENT_SIGNATURES.filter((x) => /旧盘符/.test(x.why))
    if (legacy.length !== 1) throw new Error(`旧盘符强特征须恰好一条,实得 ${legacy.length} 条`)
    if (!legacy[0].re.test('G:\\IHUI-AI\\')) throw new Error('G: 盘强特征不吃反斜杠形态')
    if (!legacy[0].re.test('G:/IHUI-AI/a.ts')) throw new Error('G: 盘强特征不吃正斜杠形态')
  })
  t('内容归因四态护栏:hit/notMatched/skipped(体积·二进制·目录)/failed 各有结论,绝不静默', () => {
    const base = mkScratch('content-attr-')
    try {
      const hit = join(base, 'probeattr-hit.cjs')
      writeFileSync(hit, `const root='${REPO}\\scripts'\n`)
      eq(attributeByContent(hit).state, 'hit', '默认特征集下,含仓库根的文件必须判 hit')
      eq(/内容归因/.test(attributeByContent(hit).why || ''), true, 'hit 必须带可区分的 why')
      const foreign = join(base, 'qoder-session.json')
      writeFileSync(foreign, '{"id":"abc","cwd":"C:\\\\Users\\\\me"}')
      eq(attributeByContent(foreign).state, 'notMatched', '他人文件必须判 notMatched 而非 hit')
      const big = join(base, 'big.log')
      writeFileSync(big, Buffer.concat([Buffer.from(`${REPO}\\x `), Buffer.alloc(CONTENT_SNIFF_MAX_BYTES + 16, 0x41)]))
      eq(attributeByContent(big).state, 'skipped', '超 2MB 必须跳过(守门不为归因整读大文件)')
      const bin = join(base, 'dump.bin')
      writeFileSync(bin, Buffer.concat([Buffer.from(`${REPO}\\x`), Buffer.from([0, 1, 2]), Buffer.from('IHUI AI')]))
      eq(attributeByContent(bin).state, 'skipped', '前 8KB 含 NUL 必须按二进制跳过(即便带特征串也不整读)')
      eq(attributeByContent(base).state, 'skipped', '目录不是文件候选')
      eq(attributeByContent(join(base, 'no-such-file.cjs')).state, 'failed', '读不到必须判 failed,不得当 notMatched 混过去')
      const mojibake = join(base, 'gbk.txt')
      writeFileSync(mojibake, Buffer.from([0xff, 0xfe, 0xfd, 0x41, 0x42]))
      eq(attributeByContent(mojibake).state, 'failed', 'utf8 解码出替代符(乱码)必须计入读取失败而非静默')
    } finally {
      rmScratch(base)
    }
  })
  t('端到端取证:扫描面上名字不带项目前缀、内容带仓库路径的探针必须被抓到,删掉后必须消失', () => {
    // 探针落点从真实 TEMP 迁到 mkScratch(§26 临时夹具唯一落点,2026-09-25):写入面不再碰
    // 可能钉在 C 盘的 $env:TEMP;扫描面经 scanC({tempDirs}) 注入这枚隔离目录 —— 被测对象
    // (readdir → 名字分类 → 内容归因 → ours 统计)一字不变。真实 TEMP 仍在本门默认扫描面内,
    // 那是"读",由上方 tempScanDirs 用例钉死(扫描面缩回去即红),不属于本次迁移范围。
    const base = mkScratch('probeattr-e2e-')
    const probe = join(base, `probeattr-${Date.now().toString(36)}.cjs`)
    writeFileSync(probe, `const root='${REPO}\\scripts'; // @ihui/probe\n`)
    try {
      const a = scanC({ tempDirs: [base] })
      if (!a.contentAttribution.hitPaths.includes(probe))
        throw new Error(
          `探针未被内容归因抓到(候选 ${a.contentAttribution.candidates}/命中 ${a.contentAttribution.hits})⇒ 新维度空转`,
        )
      if (!a.ours.some((h) => h.path === probe && /内容归因/.test(h.why)))
        throw new Error('内容归因命中未计入「本项目产物」统计口径(--strict 判红通路会漏掉它)')
    } finally {
      rmScratch(base)
    }
    const b = scanC({ tempDirs: [base] })
    if (b.ours.some((h) => h.path === probe)) throw new Error('现场未清理:探针删除后仍被计为产物')
  })
  t('内容归因结构在位:candidates/hits/skipped/readFailed 四计数必须始终存在(报告面靠它们拒绝静默)', () => {
    const ca = scanC().contentAttribution
    for (const k of ['candidates', 'hits', 'skippedSizeOrBinary', 'readFailed'])
      if (!Number.isFinite(ca[k])) throw new Error(`缺计数 ${k} ⇒ 空扫/跳过会被静默成通过`)
  })
  t('TEMP 扫描面必须含**服务身份**的 TEMP(门跑在交互账户,污染写在 C:\\Windows\\Temp)', () => {
    const d = tempScanDirs('D:\\WinNT', 'X:\\mineTmp')
    eq(d.includes('X:\\mineTmp'), true, '没扫调用者自己的 TEMP')
    eq(d.includes('D:\\WinNT\\Temp'), true, '没扫 SystemRoot\\Temp(服务/LocalSystem 侧 TEMP)')
    eq(d.includes('C:\\Windows\\Temp'), true, '丢了兜底的 C:\\Windows\\Temp')
    // 真实环境里这一条才是本票的根因防回归:清单必须真的覆盖到 Windows\Temp
    const live = tempScanDirs(process.env.SystemRoot || 'C:\\Windows', tmpdir())
    eq(live.some((p) => /[\\/]Windows[\\/]Temp$/i.test(p)), true, '实机扫描面不含 Windows\\Temp ⇒ 服务侧泄漏不可见')
    return true
  })
  t('scanC 不改文件:跑两次结果一致', () => {
    const a = scanC().ours.length
    const b = scanC().ours.length
    eq(a, b, '两次扫描数量漂移')
  })
  t('夹具落点必须在仓库外(守门自身不得再往 C 塞东西)', () => {
    const d = mkScratch('guard-selftest-')
    try {
      if (d.startsWith(REPO)) throw new Error(`落点回到了仓库内:${d}`)
      if (/^[cC]:[\\/]/.test(d)) throw new Error(`落点仍在 C 盘:${d}`)
    } finally {
      rmScratch(d)
    }
  })
  t('classifySeal:名字不在封口表 → FOREIGN(不因新规则误判他人条目)', () =>
    eq(classifySeal('Windows', { exists: true, isLink: false, isDir: true }), 'FOREIGN', '分类'))
  t('classifySeal:封口表内的真目录 → BROKEN(回潮必须被看见)', () =>
    eq(classifySeal('common_attachment', { exists: true, isLink: false, isDir: true }), 'BROKEN', '分类'))
  t('classifySeal:表内且是链接 → SEALED', () =>
    eq(classifySeal('tmp', { exists: true, isLink: true, isDir: false }), 'SEALED', '分类'))
  t('classifySeal:表内但压根不存在 → ABSENT(不算残骸,否则每天白报)', () =>
    eq(classifySeal('tools', { exists: false, isLink: false, isDir: false }), 'ABSENT', '分类'))
  t('封口登记表不得被过滤空(空表 = 门对盘根写歪项重新失明)', () => {
    if (!SEALED_DIRS.length) throw new Error('封口清单为空 ⇒ BROKEN 判据永不触发')
    if (!ORPHAN_FILES.length) throw new Error('孤儿清单为空 ⇒ 复现不可见')
    const names = SEALED_DIRS.map((e) => e.name.toLowerCase())
    if (new Set(names).size !== names.length) throw new Error('封口清单有重名')
  })

  // —— 端到端:假盘根上验"改道前后门给的是相反且正确的结论" ——
  t('端到端:真目录判残骸 / 改道后判已封口且不含量级(不跟随链接)', () => {
    const base = mkScratch('seal-gate-')
    const fakeRoot = join(base, 'root')
    const fakeDev = join(base, 'devenv')
    try {
      const stray = join(fakeRoot, 'common_attachment')
      mkdirSync(stray, { recursive: true })
      writeFileSync(join(stray, 'a.json'), 'x'.repeat(5000))
      const r1 = scanDriveRoot(fakeRoot, fakeDev)
      if (!r1.hits.some((h) => h.why.includes('封口丢失')))
        throw new Error(`真目录没被判回潮(hits=${JSON.stringify(r1.hits.map((h) => h.why))})`)

      // 改道:内容搬进目标后建 junction —— 门必须翻结论:残骸 0、sealed 1、量级 0
      const entry = SEALED_DIRS.find((e) => e.name === 'common_attachment')
      const target = pathsFor(entry, fakeRoot, fakeDev).target
      mkdirSync(target, { recursive: true })
      writeFileSync(join(target, 'a.json'), 'x'.repeat(5000))
      rmSync(stray, { recursive: true, force: true })
      symlinkSync(target, stray, 'junction')

      const r2 = scanDriveRoot(fakeRoot, fakeDev)
      if (r2.hits.some((h) => h.why.includes('封口丢失'))) throw new Error('已封口仍判回潮 ⇒ 每日必红')
      if (!r2.sealed.some((s) => s.name === 'common_attachment')) throw new Error('已封口项没进 sealed 清单')
      const sz = r2.hits.reduce((a, b) => a + (b.sizeMB || 0), 0)
      if (sz !== 0) throw new Error(`跟随了链接、把 D 盘目标算成 C 残骸:${sz}MB`)
    } finally {
      rmScratch(base)
    }
  })
  t('isReparsePoint:链接为真、真目录为假(扫描位跳过判据的底座)', () => {
    const base = mkScratch('seal-rep-')
    try {
      const t1 = join(base, 'tgt')
      mkdirSync(t1)
      const ln = join(base, 'lnk')
      symlinkSync(t1, ln, 'junction')
      if (!isReparsePoint(ln)) throw new Error('junction 没被认出 ⇒ 扫描位会跟随进 D 盘')
      if (isReparsePoint(t1)) throw new Error('真目录被误判为链接 ⇒ 残骸会被整体跳过')
      if (isReparsePoint(join(base, 'nope'))) throw new Error('不存在的路径不得判真')
    } finally {
      rmScratch(base)
    }
  })

  t('parsePagingFiles:真机语料(同一行 + 字面 \\0 分隔 + 值名前缀)必须解出 2 条', () => {
    // 这条 fixture 是 2026-09-24 从本机 stdout 逐字节抄回来的,不是构造的:
    // 第一版按"每行一条"解析,喂这份真语料得 0 条 ⇒ 哨兵恒报"配置一致"的假绿。
    const real =
      '\r\nHKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\r\n    PagingFiles    REG_MULTI_SZ    C:\\pagefile.sys 2048 2048\\0D:\\pagefile.sys 98304 98304\r\n\r\n'
    const rows = parsePagingFiles(real)
    eq(rows.length, 2, '行数')
    eq(rows[0].drive, 'C', '盘符')
    eq(rows[0].maxMB, 2048, 'C 上限')
    eq(rows[1].initialMB, 98304, 'D 初始值')
    eq(rows[0].systemManaged, false, '明确数值不得判系统管理')
    // 真 NUL 分隔的形态也得吃下(不同 reg.exe 版本/代码页可能直接吐 NUL)
    eq(parsePagingFiles('    C:\\pagefile.sys 2048 2048\u0000D:\\pagefile.sys 4096 4096').length, 2, '真 NUL 分隔')
  })
  t('parsePagingFiles:"0 0" 判系统管理、无数字判上限为空(否则哨兵永不响或永远响)', () => {
    const a = parsePagingFiles('    C:\\pagefile.sys 0 0')
    eq(a[0].systemManaged, true, '0 0 未判系统管理')
    const b = parsePagingFiles('    C:\\pagefile.sys')
    eq(b[0].maxMB, null, '无数字应得 null')
    eq(b[0].systemManaged, false, '无数字不等于系统管理')
  })
  // sizes 映射的值现在是 **MB**(来自 WMI AllocBaseSize),不再乘 1048576
  const sizesMB = (n) => new Map([['c:\\pagefile.sys', n]])
  t('pagefilePending:配置 2048 而磁盘仍 32768 ⇒ 必须报待重启(30GB 落差不许静默)', () => {
    const r = pagefilePending(parsePagingFiles('    C:\\pagefile.sys 2048 2048'), sizesMB(32768))
    eq(r.pending.length, 1, '待生效条数')
    eq(r.pending[0].gapMB, 30720, '落差')
    eq(r.measured, 1, '量到条数')
  })
  t('pagefilePending 反向对照①:文件已缩到位 ⇒ 哨兵必须清空(恒红的门只会逼人忽略)', () => {
    const r = pagefilePending(parsePagingFiles('    C:\\pagefile.sys 2048 2048'), sizesMB(2048))
    eq(r.pending.length, 0, '已生效却仍报待重启')
  })
  t('pagefilePending 反向对照②:系统管理与"落差小"(≤25%)不判(防抖)', () => {
    eq(pagefilePending(parsePagingFiles('    C:\\pagefile.sys 0 0'), sizesMB(32768)).pending.length, 0, '系统管理被误判')
    // 30000 配置 vs 32768 磁盘 = 8.5% 落差:属"正在收缩中/四舍五入",不该天天报
    eq(pagefilePending(parsePagingFiles('    C:\\pagefile.sys 30000 30000'), sizesMB(32768)).pending.length, 0, '8% 差额被误判')
  })
  t('pagefilePending 反向对照③:注册表读不到 = 未判定,绝不记为通过', () => {
    const r = pagefilePending(null, sizesMB(32768))
    eq(r.readable, false, '读不到却报正常')
    eq(r.pending.length, 0, '读不到还硬造待办')
  })
  t('pagefilePending 反向对照④:一条都没量到 = 未判定(第一版正是在这里报了"一致 0GB"的假绿)', () => {
    const r = pagefilePending(parsePagingFiles('    C:\\pagefile.sys 2048 2048'), new Map())
    eq(r.readable, true, '配置是读到了的')
    eq(r.measured, 0, '不该记为量到')
    eq(r.pending.length, 0, '量不到却造待办')
    eq(r.totalMB, 0, '量不到却报体积')
  })
  t('parsePagefileUsage:WMI 的 `路径⇥已分配MB` 逐行配对;认不出的行不计(绝不猜)', () => {
    // fixture 即 `Get-CimInstance Win32_PageFileUsage` 那行的真实形状(Name TAB AllocBaseSize)
    const raw = 'C:\\pagefile.sys\t32768\r\nD:\\pagefile.sys\t98304\r\n'
    const m = parsePagefileUsage(raw)
    eq(m.size, 2, '配对条数')
    eq(m.get('c:\\pagefile.sys'), 32768, 'C 已分配 MB')
    eq(m.get('D:\\PAGEFILE.SYS'), undefined, '键一律小写化后再查,大小写混用不得漏')
    eq(parsePagefileUsage('Get-CimInstance : 无法连接\r\n').size, 0, '报错文本必须作废')
    eq(parsePagefileUsage('').size, 0, '空输出必须作废')
  })

  // —— 计划任务活性三态(取代原先那句无条件的"已注册"断言;判据全部走注入,不碰真机) ——
  const csvWith = (names) => names.map((n) => `"${n}","2026/9/25 03:00:00","Ready"`).join('\r\n') + '\r\n'
  t('计划任务:全量列表命中 c-drive ⇒ 已注册', () =>
    eq(judgeTaskRegistration(csvWith(['\\AliProctectUpdate', '\\IHUI C-Drive AutoMaintain'])).state, 'registered', '命中却未判已注册'))
  t('计划任务反向对照(关键):零命中样本判未注册,且结论行里不得出现"已注册"字样', () => {
    const r = judgeTaskRegistration(
      csvWith(['\\IHUI-AI git-guardian', '\\IHUI credential-health', '\\Microsoft\\Windows\\ScheduleTask']),
    )
    eq(r.state, 'unregistered', '零命中却没判未注册')
    const line = describeMaintainTask(r)
    if (/已注册/.test(line)) throw new Error(`未注册的结论行里出现了"已注册":${line}`)
    eq(/未注册/.test(line), true, `结论行没如实说明:${line}`)
    eq(r.rows > 0, true, '判未注册时 rows 必须>0(证明确实取到了全量列表,而非空扫)')
  })
  t('计划任务失效对照:空输出/报错文本/形态不符 ⇒ 一律未判定且原因非空(绝不记为通过)', () => {
    for (const [label, raw] of [
      ['空字符串', ''],
      ['只有空白行', '   \r\n\t\r\n'],
      ['非 CSV 的报错文本', 'ERROR: Access is denied.\r\n'],
      ['解得出字段但无 \\ 开头(表头行/别的分隔格式)', '"TaskName","Next Run Time","Status"\r\n'],
      [null, null],
    ]) {
      const r = judgeTaskRegistration(raw)
      eq(r.state, 'undetermined', `${label} 必须判未判定`)
      if (!r.reason) throw new Error(`${label} 判了未判定却没写原因`)
    }
  })
  t('计划任务:大小写与含空格/连字符名不得影响命中(§26 名字陷阱的正面解法)', () => {
    eq(judgeTaskRegistration(csvWith(['\\ihui c-drive automaintain'])).state, 'registered', '小写名漏判')
    // 文档旧名那型:点名查会得"系统找不到指定的文件",全量列表法必须连这种写法也认住
    eq(judgeTaskRegistration(csvWith(['\\IHUI-C-Drive-AutoMaintain'])).state, 'registered', '连字符变体漏判')
  })
  t('计划任务装车证明:真机查询落在三态之一且各态自带依据(不得退回硬编码)', () => {
    const r = queryMaintainTask()
    if (!['registered', 'unregistered', 'undetermined'].includes(r.state)) throw new Error(`非法状态:${r.state}`)
    if (r.state === 'undetermined' && !r.reason) throw new Error('未判定却无原因')
    if (r.state === 'unregistered' && !(r.rows > 0)) throw new Error('判未注册却没量到全量列表 ⇒ 与空扫无法区分')
    if (r.state === 'registered' && !r.matched.length) throw new Error('判已注册却无命中项')
  })
  t('源码级防回归:无条件"已注册"断言不得回潮(判据串自身分片拼,否则门咬自己尾巴恒红)', () => {
    const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    // needle 必须分片拼:写成连续字面量的话,本用例自己的标题/正则就成了它所禁的那个串 ——
    // 于是"门让你怎么写,门就看不见怎么写"(守门 77 B6 括号形态同型坑)。
    const claim = '每天 03:00' + ' 已注册'
    if (src.includes(claim)) throw new Error('硬编码断言回潮 ⇒ 门又开始替不存在的防护背书')
  })

  let failed = 0
  for (const c of cases) {
    try {
      c.fn()
      console.log(`  ✔ ${c.name}`)
    } catch (e) {
      failed++
      console.log(`  ✖ ${c.name}\n    ${e.message}`)
    }
  }
  console.log(`\ncheck-c-drive-pollution 自检:${cases.length - failed}/${cases.length} 通过`)
  return failed ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  classifyRoot,
  classifyRootEntry,
  classifyTmp,
  classifySeal,
  isReparsePoint,
  parsePagingFiles,
  pagefilePending,
  scanDriveRoot,
  scanC,
  detectTempDrift,
  FOREIGN_ROOT,
  // 仓库根:内容归因特征由它派生,测试必须同源取(§22c)—— 在测试里另写一个盘符,换 checkout 即恒红
  REPO,
  // 计划任务活性三态(§22c:判据只从这里出,测试不得另抄一份匹配逻辑)
  MAINTAIN_TASK_NAME,
  judgeTaskRegistration,
  queryMaintainTask,
  describeMaintainTask,
  // 内容归因一维(§22c:测试从这里取,不得另抄一份特征串)
  CONTENT_SIGNATURES,
  CONTENT_SNIFF_MAX_BYTES,
  matchContentSignatures,
  attributeByContent,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
