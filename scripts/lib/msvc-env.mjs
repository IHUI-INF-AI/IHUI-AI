// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端 Rust 构建的 MSVC 环境注入判据 —— 全仓**唯一一份**(纯函数层,自身不做任何 IO)。
//
// ## 立因(实测,不是假想)
//   本机 `C:\Program Files\Git\usr\bin` **在系统 PATH 里**(cmd.exe 里同样在),该目录下有 GNU
//   coreutils 的 `link.exe`。任何**没有**加载 MSVC 环境的 shell 里,cargo 在 build script 链接阶段
//   解析到的 `link.exe` 是 GNU 那个,实测报 `link: missing operand after '\377\376'`
//   ⇒ Tauri release 构建在链接阶段就失败,且报错里一个字都没提"工具链没加载"。
//   注入 `vcvars64.bat` 后 `link.exe` 解析为
//   `...\BuildTools\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64\link.exe`(实测)。
//
// ## 为什么候选路径里**必须**有"已知安装位置"兜底,而不能只靠 vswhere
//   本机 `vswhere.exe -products * -format json` 返回 `[]`(空数组,实测)——
//   只认 vswhere 的实现在这台机上等于"永远找不到工具链",于是每次都退化成"未判定"。
//
// ## 三态(AGENTS §0.3):取不到输入 ⇒ 显式未判定,不记绿
//   `planBuildEnv` 只会给两种结论:{ok:true,env,...}(已注入,可直接 spawn)或
//   {ok:false,reason,tried,...}(**未判定**,reason 机器可读)。它**从不**在取不到工具链时
//   悄悄回落到"就那样吧,让 cargo 自己撞"。
//
// ## 为什么 PATH 键在 Windows 上大小写不敏感这件事必须在这里处理
//   本机 `cmd /c set` 输出的键名实测是 `Path`(不是 `PATH`),而 Windows 环境变量名大小写不敏感。
//   判据若只认字面量 `PATH=`,在这台机上会读成"vcvars 没注入" ⇒ 恒红;若无脑再写一个 `PATH=`,
//   子进程环境块里会出现两份同名变量(child 取哪一份由实现决定)。故:键名大小写不敏感查找,
//   并且**只保留一份**。

import { join } from 'node:path'

/** Windows 环境块的路径分隔符。 */
const PATH_SEP = ';'

/** 会遮蔽 MSVC 工具的 PATH 段判据(唯一实现;`sanitizePathForMsvc` 与 `removedDirs` 共用)。 */
const SHADOW_TAIL_SEGMENTS = ['USR', 'BIN']

/** MSVC 链接器目录的标准形态:`...\VC\Tools\MSVC\<版本>\bin\HostX64\x64`。 */
const MSVC_LINK_BIN_RE = /\\VC\\Tools\\MSVC\\[^\\]+\\bin\\HostX64\\x64$/i

/** 回落形态:少数布局不带 HostX64\x64 这一层。 */
const MSVC_TOOLS_BIN_RE = /\\VC\\Tools\\MSVC\\[^\\]+\\bin$/i

/** `vcvars64.bat` 在安装目录里的相对位置。 */
const VCVARS_REL = ['VC', 'Auxiliary', 'Build', 'vcvars64.bat']

/** 按序试的 VS 2022 版本目录名。 */
const EDITIONS = ['BuildTools', 'Community', 'Professional', 'Enterprise']

/**
 * 段规范化(只用于比较与判定,**不改写**调用方拿到的原串)。
 * 两件事:统一分隔符;去掉末尾的分隔符(`C:\a\` 与 `C:\a` 是同一个目录)。
 */
function normSegment(seg) {
  return String(seg).trim().replace(/\//g, '\\').replace(/\\+$/, '')
}

function segmentParts(seg) {
  return normSegment(seg).split('\\').filter((s) => s !== '')
}

/**
 * 该 PATH 段是不是**遮蔽 MSVC 工具**的目录。
 *
 * 判据 = 末两段是 `usr` + `bin`(大小写不敏感)。立因是 Git for Windows 把 GNU coreutils 装在
 * `C:\Program Files\Git\usr\bin`,`link.exe` 就在那里(实测 `where link` 的第一命中)。
 * MSYS2 的同名目录同理,所以判据不限定"必须是 Git 装的那种路径"。
 * 刻意**不做**的:子串匹配(`usr\bin-extra` / `binx` 不是遮蔽目录)——按段判,不做按串判。
 *
 * @param {string} seg 单个 PATH 段(可含 `/`)
 * @returns {boolean}
 */
function isShadowSegment(seg) {
  const parts = segmentParts(seg)
  if (parts.length < SHADOW_TAIL_SEGMENTS.length) return false
  const tail = parts.slice(parts.length - SHADOW_TAIL_SEGMENTS.length)
  return tail.every((p, i) => p.toUpperCase() === SHADOW_TAIL_SEGMENTS[i])
}

/** PATH 串 → 非空段列表(保留原样拼写,去空白段)。 */
function splitPathSegments(pathStr) {
  if (typeof pathStr !== 'string' || pathStr === '') return []
  return pathStr
    .split(PATH_SEP)
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

/**
 * 环境变量按**名字大小写不敏感**取值(Windows 语义)。
 * 注入面既有 `process.env`(Windows 上它本身大小写不敏感)也有测试里手搓的字面量 env 对象。
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} name
 * @returns {string | undefined} 非空字符串,否则 undefined
 */
function envGet(env, name) {
  if (!env || typeof env !== 'object') return undefined
  const want = name.toUpperCase()
  for (const k of Object.keys(env)) {
    if (k.toUpperCase() !== want) continue
    const v = env[k]
    if (typeof v === 'string' && v !== '') return v
  }
  return undefined
}

/**
 * 解析 `cmd /d /s /c "call vcvars64.bat && set"` 的输出。
 *
 * 形态:`KEY=VALUE` 每行一个(实测键名可能是 `Path` 而非 `PATH`,见头注)。
 *   · 空行、无 `=` 的行 ⇒ 忽略;
 *   · `=C:=C:\Users\...` 这类 cmd 的"当前盘目录"隐藏变量(键名为空)⇒ 忽略(名字为空的环境变量
 *     对 spawn 子进程无意义,留着只会污染 `Object.keys`);
 *   · 值里含 `=` ⇒ 按**首个** `=` 切分(实测 `Path=` 的值里就有大量 `=`);
 *   · 行尾 `\r\n` / `\n` / 纯 `\r` 三种换行都吃(实测本机输出是 CRLF);
 *   · 同名键后行覆盖前行(与 cmd 自身语义一致)。
 *
 * 纯函数:无 IO、不读环境、不 spawn。
 *
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseVsEnv(text) {
  /** @type {Record<string, string>} */
  const out = {}
  if (typeof text !== 'string' || text === '') return out
  for (const rawLine of text.split(/\r\n|\n|\r/)) {
    const eq = rawLine.indexOf('=')
    if (eq <= 0) continue
    const key = rawLine.slice(0, eq).trim()
    if (key === '') continue
    out[key] = rawLine.slice(eq + 1)
  }
  return out
}

/** 已知安装位置之外的目录变量(顺序即尝试顺序)。 */
function programFilesRoots(env) {
  return [envGet(env, 'ProgramFiles(x86)'), envGet(env, 'ProgramFiles')].filter((p) => typeof p === 'string')
}

/** 指向某个 VS 安装目录的变量(VSINSTALLDIR / VCVARSALL)解析出的候选。 */
function fromInstallDirVars(env) {
  const out = []
  const vsDir = envGet(env, 'VSINSTALLDIR')
  if (vsDir) out.push(join(vsDir, ...VCVARS_REL))
  const all = envGet(env, 'VCVARSALL')
  if (all) {
    // VCVARSALL 既可能指目录,也可能直接指 vcvarsall.bat / vcvars64.bat 本体。
    const base = normSegment(all)
    const parts = segmentParts(all)
    const leaf = parts.length ? parts[parts.length - 1].toLowerCase() : ''
    if (leaf === 'vcvarsall.bat' || leaf === 'vcvars64.bat') out.push(join(parts.slice(0, -1).join('\\'), ...VCVARS_REL))
    else out.push(join(base, ...VCVARS_REL))
  }
  return out
}

/**
 * 候选清单(**不判存在**)。`findVcvarsCandidates` 与 `planBuildEnv` 的 `tried` 共用这一份顺序,
 * 免得"报出来的候选"和"真正找过的候选"是两条会漂移的链。
 *
 * 顺序:① VSINSTALLDIR/VCVARSALL ② `${ProgramFiles(x86)}\…\2022\BuildTools` ③ `${ProgramFiles}\…\2022\{四档}`
 * ④ `${ProgramFiles(x86)}\…\2022\{四档}`。② 与 ④ 的 BuildTools 重复,去重时保首见。
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
function enumerateVcvarsCandidates(env) {
  const out = []
  out.push(...fromInstallDirVars(env))
  const [pf86, pf] = programFilesRoots(env)
  if (pf86) out.push(join(pf86, 'Microsoft Visual Studio', '2022', 'BuildTools', ...VCVARS_REL))
  if (pf) for (const e of EDITIONS) out.push(join(pf, 'Microsoft Visual Studio', '2022', e, ...VCVARS_REL))
  if (pf86) for (const e of EDITIONS) out.push(join(pf86, 'Microsoft Visual Studio', '2022', e, ...VCVARS_REL))
  const seen = new Set()
  const uniq = []
  for (const c of out) {
    const key = normSegment(c).toUpperCase()
    if (key === '' || seen.has(key)) continue
    seen.add(key)
    uniq.push(c)
  }
  return uniq
}

/**
 * 候选 vcvars64.bat 路径中**确实存在**的那些(顺序同上)。
 * 存在性由注入的 `existsSync` 判 ⇒ 测试不必赌本机装没装 VS。
 *
 * @param {{ env: Record<string, string | undefined>, existsSync: (p: string) => boolean }} args
 * @returns {string[]}
 */
export function findVcvarsCandidates({ env, existsSync }) {
  if (typeof existsSync !== 'function') throw new TypeError('findVcvarsCandidates 需要注入 existsSync')
  return enumerateVcvarsCandidates(env).filter((c) => existsSync(c))
}

/**
 * 把 MSVC 的链接器目录顶到 PATH 最前,并剔掉会遮蔽 MSVC 工具的目录。
 *
 * 规则:① 剔遮蔽段(见 `isShadowSegment`);② `msvcBinDir` 前插到最前;③ 其余项保持原有相对顺序;
 * ④ 去重(保首次出现,所以已经前插的 MSVC 目录不会被 PATH 里靠后的同名项挤回后面);
 * ⑤ 空段忽略。`msvcBinDir` 为空/非字符串时只做 ①②④⑤(不报错)。
 *
 * @param {string} pathStr 原 PATH(Windows 上分隔符是 `;`)
 * @param {string} [msvcBinDir] 要前插的 MSVC 链接器目录
 * @returns {string} 拼好的 PATH
 */
export function sanitizePathForMsvc(pathStr, msvcBinDir) {
  /** @type {string[]} */
  const kept = []
  const seen = new Set()
  const push = (seg) => {
    const key = normSegment(seg).toUpperCase()
    if (key === '' || seen.has(key)) return
    seen.add(key)
    kept.push(String(seg).trim())
  }
  if (typeof msvcBinDir === 'string') push(msvcBinDir)
  for (const seg of splitPathSegments(pathStr)) {
    if (isShadowSegment(seg)) continue
    push(seg)
  }
  return kept.join(PATH_SEP)
}

/** 在 PATH 段里找 MSVC 的链接器目录(优先标准形态,再回落无 HostX64 的形态)。 */
function locateMsvcLinkBinInPath(pathValue) {
  const segs = splitPathSegments(pathValue)
  return segs.find((s) => MSVC_LINK_BIN_RE.test(normSegment(s))) ?? segs.find((s) => MSVC_TOOLS_BIN_RE.test(normSegment(s)))
}

/** 在 `set` 输出给的 `VCToolsInstallDir` 上再找一次(路径里没写全时的兜底)。 */
function locateMsvcLinkBinFromEnv(parsed, existsSync) {
  const vcTools = envGet(parsed, 'VCToolsInstallDir')
  if (!vcTools) return undefined
  const cand = join(normSegment(vcTools), 'bin', 'HostX64', 'x64')
  return existsSync(cand) ? cand : undefined
}

/**
 * 算出"这次构建该用的 env",或者**显式未判定**。
 *
 * 成功档(`ok:true`)做三件事:
 *   ① 以 vcvars 注入后的 `set` 输出**覆盖**调用方的 env(那才是加载过工具链的环境块);
 *   ② PATH 里剔掉遮蔽段并把 MSVC 链接器目录顶到最前;
 *   ③ PATH 键只留一份(Windows 大小写不敏感,见头注),键名沿用 `set` 输出的原样拼写。
 *
 * 未判定档(`ok:false`)的 `reason` 取值(机器可读,调用方据此决定退出码):
 *   · `NO_VCVARS`  —— 一个候选都不存在(这台机没装,或装在没登记的位置);
 *   · `VC_RUN_FAILED` —— 候选在,但每个都跑不起来(cmd 缺失、批处理执行失败等,异常原文进 `details`);
 *   · `VCPARSE_EMPTY` —— 跑起来了,但输出里解析不出 PATH 行(空输出/被别的东西截断);
 *   · `NO_MSVCLINK` —— 有 PATH,但里面找不到 MSVC 的链接器目录(工具链没真正注入)。
 * `tried` 给的是**试过的全部候选**(含不存在的),`details` 逐条点名失败原因。
 *
 * 本函数自身不 spawn 任何进程:唯一的外部动作是调用注入的 `runCapture(vcvarsPath)`。
 *
 * @param {{ env?: Record<string, string | undefined>, existsSync: (p: string) => boolean, runCapture: (vcvars: string) => string }} args
 * @returns {{ ok: true, env: Record<string, string>, vcvars: string, linkFrom: string, removedDirs: string[] }
 *          | { ok: false, reason: 'NO_VCVARS' | 'VC_RUN_FAILED' | 'VCPARSE_EMPTY' | 'NO_MSVCLINK', tried: string[], candidates: string[], details: Array<{ vcvars: string, error: string }> }}
 */
export function planBuildEnv({ env = process.env, existsSync, runCapture } = {}) {
  if (typeof existsSync !== 'function') throw new TypeError('planBuildEnv 需要注入 existsSync')
  if (typeof runCapture !== 'function') throw new TypeError('planBuildEnv 需要注入 runCapture(vcvarsPath)')

  const tried = enumerateVcvarsCandidates(env)
  const candidates = findVcvarsCandidates({ env, existsSync })
  if (candidates.length === 0) return { ok: false, reason: 'NO_VCVARS', tried, candidates, details: [] }

  /** @type {Array<{ vcvars: string, error: string }>} */
  const details = []
  let sawRan = false
  let sawPath = false

  for (const vcvars of candidates) {
    let text
    try {
      text = runCapture(vcvars)
      sawRan = true
    } catch (e) {
      details.push({ vcvars, error: String(e && e.message ? e.message : e) })
      continue
    }
    const parsed = parseVsEnv(text)
    // PATH 键大小写不敏感(本机实测输出的是 `Path`)
    const pathKey = Object.keys(parsed).find((k) => k.toUpperCase() === 'PATH')
    if (!pathKey) {
      details.push({ vcvars, error: 'set 输出里没有可解析的 PATH 行' })
      continue
    }
    sawPath = true
    const pathValue = parsed[pathKey]
    const linkFrom = locateMsvcLinkBinInPath(pathValue) ?? locateMsvcLinkBinFromEnv(parsed, existsSync)
    if (!linkFrom) {
      details.push({ vcvars, error: 'PATH 里找不到 MSVC 链接器目录(工具链未真正注入)' })
      continue
    }
    const removedDirs = splitPathSegments(pathValue).filter((s) => isShadowSegment(s))
    /** @type {Record<string, string>} */
    const merged = { ...env, ...parsed }
    // 同名不同拼写只留一份(Windows 环境块里两份同名变量的取值由 child 侧实现决定,不可依赖)
    for (const k of Object.keys(merged)) {
      if (k !== pathKey && k.toUpperCase() === 'PATH') delete merged[k]
    }
    merged[pathKey] = sanitizePathForMsvc(pathValue, linkFrom)
    return { ok: true, env: merged, vcvars, linkFrom, removedDirs }
  }

  const reason = !sawRan ? 'VC_RUN_FAILED' : !sawPath ? 'VCPARSE_EMPTY' : 'NO_MSVCLINK'
  return { ok: false, reason, tried, candidates, details }
}

/**
 * MSVC 注入**只对 Windows 成立** —— 它治的是"Git usr\bin 的 link.exe 遮蔽 MSVC 链接器",
 * 而 macOS 用 clang、Linux 用 cc,压根没有 MSVC。
 *
 * ## 这条判据漏掉过一次,代价是真实回归(2026-10-19 审计实测)
 *   桌面构建入口改成薄壳后无条件调 `planBuildEnv`,而本文件的候选枚举在非 Windows 上
 *   `ProgramFiles` / `ProgramFiles(x86)` 全是 undefined ⇒ 候选 0 条 ⇒ `NO_VCVARS` ⇒ **exit 2**。
 *   改版前 `apps/desktop/package.json` 的 build 是裸 `tauri build`,在装了 rustc 的
 *   Linux/macOS 上真能编;改版后 `.github/workflows/desktop-build.yml` 的 build 步
 *   **没有矩阵条件**,ubuntu/macOS 两条腿全部走它 ⇒ 两条腿在 tauri 启动前就红了。
 *
 * ## 放这里而不是放执行层
 *   本文件是"MSVC 环境这件事"的唯一真相源(§0.6)。现在有**三个**调用点要问这个问题
 *   (`desktop-build.mjs` / `desktop-dev-saas.mjs` / `desktop-build-saas.mjs`),
 *   判据放在任何一个执行层都会立刻产生第二份。
 *
 * 纯函数、无 IO,可直接被测试与 CLI 共用。
 *
 * @param {string} [platform] 缺省取当前进程平台
 * @returns {boolean}
 */
export function needsMsvcInjection(platform = process.platform) {
  return platform === 'win32'
}

export const __test__ = { parseVsEnv, findVcvarsCandidates, sanitizePathForMsvc, planBuildEnv, needsMsvcInjection }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
