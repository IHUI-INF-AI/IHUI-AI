#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产签出外来工作只读尺子(2026-10-21 立;判机器状态 ⇒ 不进提交链、不进 CI,§12e;
 * 唯一调度器 = scripts/git-guardian.mjs 经 git-guardian-prod-foreign.mjs 的 auditProdForeignWork())。
 *
 * 立因(2026-10-21 15:0x~16:1x 实测,该形态后来漂了 ⇒ 判据面改多通道,见下):当天生产服务与部署环
 * 跑**独立生产签出**(当时 nssm `IHUI-DEPLOYLOOP` 现读指向 `D:\DevEnv\ihui-prod` 形态),16:0x 实测
 * 该签出里躺过 `apps/ai-service/app/services/model_catalog.py` 的工作区 blob `bf7ee8ab8c...`,而 prod
 * HEAD 与 origin 两侧都是 `4159ac393c...` ⇒ 那 29 行新增只活在盘上,仓里没有、远端没有、CI 看不见、
 * 任何提交链守门判不到,一次 `git checkout` 就静默蒸发。另有 11 枚 `A ` 的
 * `apps/web/app/(main)/plugins/plugins-data/market-plugins-parts/part-*.ts`(远端没有的新文件被
 * `git add` 进索引),一次 reset 就整批蒸发。
 *
 * 判据面(2026-10-21 立项时写的是"nssm `IHUI-DEPLOYLOOP` 的 AppDirectory/AppParameters 现读";
 * 2026-10-24 归因后改为**多通道现读**,因为那一形态在本机已经不存在,详见下面"归因档"):
 *   通道 A 注册表(主通道,不依赖 nssm 在位):枚举 `HKLM\\SYSTEM\\CurrentControlSet\\Services`
 *          的子键 ⇒ 取 `IHUI*` 前缀的服务键(值与本服务的 `Parameters` 子键一并读)⇒ 从
 *          `AppDirectory` / `AppParameters` / `ImagePath`(`cmd.exe /c "cd /d <dir> && …"` 形态)
 *          解出目录,再**向上找最近带 `.git` 的祖先**折成 checkout 根(部署环的 AppDirectory 实测
 *          是 `<root>` 或 `<root>\\deploy\\prod-bundle`,直接当根用会漏)。
 *   通道 B nssm get(次通道,仅当 A 没给出根 ∧ 服务在位):nssm.exe 的位置按该服务 `ImagePath`
 *          现读(§5e"判断执行的是哪份文件按实际路径"),`NSSM_CANDIDATES` 只作兜底候选。
 *   通道 C 约定目录(兜底):`<devEnvRoot>/ihui-prod`(出口复用 seal-c-root-stray 的 `devEnvRoot`,
 *          §0.6 单一真相源)。这一条管"签出躺在盘上但承载体已被拆"那一格 —— 只按服务发现会瞎。
 *   通道 D 人工/复核:`--prod-root <path>` 或 `IHUI_PROD_CHECKOUT_ROOT`(阳性对照与"发现了但没判"
 *          时的定向复核出口;§0.8 写进文档的每条出路都必须真跑得通,已由镜像测试实跑钉住)。
 *   自我让路:解出的根若等于**本仓工作树根**,不计入判定面(记 `self-excluded`)。这不是漏判 ——
 *          共享开发签出常年有在飞未提交工作(§1 实测"工作树副本常年不净"),把它当外来工作面会把
 *          每一处在飞改动读成 foreign 并每轮 critical 到人 = §12e 恒红门;那一族工作由提交链/
 *          索引层/回捞器各门负责,本尺只管**独立**签出。
 *
 * 归因档(2026-10-24 立,治"连续 52 小时判不出却没人收敛"):未判定必须**逐型点名**到结论行,
 *   不许把三种根因揉成一个桶。`undet=` 的取值(ASCII 码位,可机读):
 *     `reg-not-located`            连 reg.exe 都定位不到(通道 A/D 全瞎,B 独木)
 *     `svc-enum-fail(exit N)`      服务枚举问不到(A 坏了)
 *     `svc-enum-empty`             枚举到 0 枚服务 ⇒ 判通道坏,不判"没有服务"(§0.3 枚举到 0 不记绿)
 *     `svc-key-fail:<name>(exit N)` 某候选服务键读不到(逐枚点名,不折成一条)
 *     `root-unusable:<path>`       取到了目录但不是带 `.git` 的签出(**只进 evidence.unusable,
 *                                  不升级为未判定**:服务指向非签出目录不等同于"这一格判不出")
 *     `dir-survey-refused(<原因>)` 通道 C 的根推导被拒(仓库根本身在夹具内)
 *     `override-root-unusable:<p>` 人工指定的根不成立 ⇒ 当场未判定,**绝不静默回落自动发现**
 *     `git-status-fail:<root>` / `ls-tree-fail:<root>:<ref>` / `ls-files-fail:<root>`
 *   结论行恒纯 ASCII(派发侧按空格切词):归因码里的非 ASCII 段在结论行折成 `_`,原文一律进
 *   JSON 的 `undet` 数组与 `[evidence]` 行。
 *   与"未判定"相区别的是 **判定面为空**(`surface=absent-surveyed`):各通道都**量到了**
 *   (枚举成功 ∧ 服务名非空 ∧ 键值解析成功 ∧ 约定目录探测完成),只是本机确实没有独立生产签出
 *   (实测 2026-10-24 本机:nssm 不在位 ∧ 无 IHUI-DEPLOYLOOP 服务 ∧ 三枚 IHUI 服务全部
 *   `cd /d G:\\IHUI-AI\\apps\\*` = 直跑本仓工作树 ⇒ self-excluded)。这一档走 exit 0,
 *   并把"凭什么判空"的证据计数一起写进结论行/JSON —— 它是**量出来的空**,不是"没量"。
 *
 * 逐路径三态 + 一个独立统计,单列绝不并桶(§0.3):
 *   duplicate          工作区/索引 blob == 远端 tip 同路径 blob 或 == 该签出 HEAD blob(内容已在仓,无丢失风险)
 *   foreign            blob 在 prod HEAD 与 origin/main 两侧都取不到 ⇒ 真存续性风险(点名路径 + blob 前 12 位 + 行数差)
 *   unjudged           问不到 git / 签出不可读 / 比不了(单列;含"工作区 blob 取不到"的删除型)
 *   staged-untracked   别人在 prod `git add` 了远端没有的新文件(一次 reset 整批蒸发型)
 *
 * 两个已知坑(本仓踩过,判据写死在实现里):
 *   ① Git Bash 的 MSYS 路径改写会把 `origin/main:路径` 这种**冒号形态**重写成反斜杠 ⇒ git 假报
 *      "不存在",尺子把"比得了"读成"取不到"整片误判 foreign。一律 `git rev-parse`/`git cat-file`/
 *      `git ls-tree` 走 argv(本器取树内 blob 只用 `ls-tree <commit> -- <path>`,从不拼 `ref:path`)。
 *   ② blob 存在性只认 `git cat-file -e <sha>` 的**退出码结论**(0=在/非0=不在),绝不解析输出文本。
 *
 * 诚实边界(立项时如实登记,不为凑绿说话):
 *   - duplicate-only 不发信:内容已在仓里,无丢失风险;但它们会挡 ff(14:27/15:5x 两枚部署冻结即此型),
 *     那一格由 auditDeployStall 的停摆判据负责,本格不重复盖一层。
 *   - 本器只读:不 fetch(远端 tip = 本地 origin/main ref 现读)、不写生产签出一字节、不代删代提交。
 *   - 判不到的型:工作区 blob 与 HEAD/origin **都**取得到但组合出别的形态(如把 HEAD 版本挪到新路径)
 *     落 duplicate/foreign 的既有格;本器不判"语义上是不是该提交",只判"内容在不在仓里"。
 *
 * 用法:node scripts/check-prod-checkout-foreign-work.mjs [--json] [--prod-root <path>]
 *   `--prod-root` / `IHUI_PROD_CHECKOUT_ROOT` = 定向复核与阳性对照出口(不给则走上面的多通道发现)。
 * 结论行(纯 ASCII,派发侧只读它不读散文):`PROBE-RESULT state=<clean|duplicate|dirty|unjudged>
 *   foreign=… duplicate=… staged=… untracked=… unjudged=… surface=<judged|absent-surveyed|none>
 *   undet=<归因码|na>`,后随 `//` 人读注记。
 * 退出码:0 = 判定面干净(或只有 duplicate,无丢失风险)/ 判定面经全通道实测为空;1 = 有 foreign /
 *   staged-untracked / unjudged 脏路径(枚举成功但存在不冒绿的项);2 = 未判定到给不出任何结论
 *   (逐型归因见上"归因档"—— 绝不回落默认目录,也绝不把"没量到"说成"量过了是空的")。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve as resolveAbs } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// §0.6 单一真相源:nssm 判读/候选路径与 UTF-16LE 解码复用 check-service-binary-paths 的出口,禁抄第二份
import { NSSM_CANDIDATES, decodeNssm, interpretNssmGet } from './check-service-binary-paths.mjs'
// §0.6 DevEnv 根的推导只有一份(项目内/盘根双形态由它自己判),本器不另数两级
import { devEnvRoot } from './seal-c-root-stray.mjs'
import { resolveGitBin } from './lib/gitdir.mjs'

const PROD_SERVICE = 'IHUI-DEPLOYLOOP'
const ORIGIN_REF = 'origin/main'
const GIT_TIMEOUT_MS = 60_000
const NSSM_TIMEOUT_MS = 5_000
const REG_TIMEOUT_MS = 8_000
/** 一次 argv 批量查树的路径上限(超了分批,防命令行截断静默丢路径)。 */
const LS_TREE_BATCH = 40
/** 服务键的注册表位置(通道 A)。盘符/系统根一律当次现读,不写死(AGENTS §0 前言七类机器事实)。 */
const REG_SERVICES_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Services'
/** 候选服务名判据:名字里带 IHUI 即入射程(不只前缀 —— 2026-10-24 归因时实测承载体名字/形态都会漂,
 *  前缀写死 + 服务改名 = 静默判空,正是本器要治的那一格)。额外名字可用 `IHUI_PROD_SERVICE_NAMES`
 *  (逗号分隔)当次现读补充,不改代码就能把新载体纳进射程。 */
const SERVICE_NAME_TOKEN = 'IHUI'
const EXTRA_SERVICE_NAMES_ENV = 'IHUI_PROD_SERVICE_NAMES'
/** 一次巡检最多读这么几枚服务键(超出如实登记 `svc-capped`,不静默截断判定面)。 */
const MAX_SERVICES_SURVEYED = 24
/** 向上找"最近带 .git 的祖先"的层数上限(防一路逃到盘根把别人的目录当签出)。 */
const ROOT_WALK_UP = 12
/** ROOT 由脚本自身位置推导(守门 70:共享工作区 cwd 不可靠)。 */
const REPO_ROOT = resolveAbs(dirname(fileURLToPath(import.meta.url)), '..')

/** 路径归一(Windows 大小写不敏感 + 分隔符两形):用于"是不是同一个根"的等值判断。 */
export function normPath(p) {
  if (typeof p !== 'string') return ''
  let s = p.trim().replace(/[\\/]+/g, '/')
  if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
  return s.toLowerCase()
}

/** 派生出口:显式 stdio + windowsHide(§12g;本器从不带 input ⇒ stdin 恒 'ignore',门 193 的
 *  input↔stdin 取值维不适用)。返回 code/stdout/stderr 的字符串形态。
 *  `opts.decode` = 按 NUL 密度解码(reg.exe 的 stdout 实测是无 BOM UTF-16LE,直接 String(buf)
 *  会被 NUL 撑成坏串);git 一律**不开**这一档 —— porcelain `-z` 的输出本身就含 NUL,
 *  按密度猜编码会把可读的 utf8 误折成 utf16le。 */
function runCapture(file, args, opts = {}) {
  try {
    const out = spawnSync(file, args, {
      cwd: opts.cwd,
      windowsHide: true,
      timeout: opts.timeoutMs ?? GIT_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const dec = opts.decode ? (b) => decodeNssm(b).text : (b) => String(b ?? '')
    if (out.error) return { code: -1, stdout: '', stderr: String(out.error.code || out.error.message || 'spawn-error') }
    return { code: out.status ?? -1, stdout: dec(out.stdout), stderr: dec(out.stderr) }
  } catch (e) {
    return { code: -1, stdout: '', stderr: String(e?.message || e) }
  }
}

const GIT_BASE = ['-c', 'safe.directory=*']

/** 通道 B(nssm get)的取值处:先 AppDirectory,取不到再从 AppParameters 的脚本路径推根。
 *  2026-10-24 归因改造两处:
 *   ① nssm.exe 的位置**先问该服务 ImagePath**(§5e:判断执行的是哪份文件按实际路径),
 *      `NSSM_CANDIDATES`(只有一枚 System32 硬路径)降为兜底候选 —— 本机实测 nssm 根本不在
 *      System32、也不在 PATH,旧写法把"nssm 不在位"和"没有这个服务"揉成同一条结论。
 *   ② 服务名由调用方传入(通道 A 的枚举结果),不再是本器顶上的单一常量。
 *  两级都落空 ⇒ 返回 unjudged 并把**逐型原因**列进 why,绝不回落默认目录。 */
export function resolveProdCheckout({ exists = existsSync, isDirectory, nssmGet, service = PROD_SERVICE, nssmBin } = {}) {
  const dirProbe = (p) => {
    try {
      if (!exists(p) || !(isDirectory ? isDirectory(p) : statSync(p).isDirectory())) return false
    } catch {
      return false
    }
    return true
  }
  const validRoot = (p) => typeof p === 'string' && p !== '' && dirProbe(p) && exists(join(p, '.git'))
  const why = []
  const read = (param) => {
    const raw = nssmGet ? nssmGet(param) : nssmGetRaw(param, { service, nssmBin, exists })
    return interpretNssmGet(raw)
  }
  const dir = read('AppDirectory')
  if (dir.kind === 'measured' && dir.value && validRoot(dir.value)) return { state: 'ok', root: dir.value, via: 'AppDirectory' }
  if (dir.kind === 'measured') why.push(`root-unusable:${dir.value || '(空)'}(AppDirectory 不是带 .git 的目录)`)
  else why.push(`svc-${service}-AppDirectory 取不到(${dir.reason})`)
  const par = read('AppParameters')
  if (par.kind === 'measured' && par.value) {
    const m = /^"([^"]+)"/.exec(par.value) || /^(\S+)/.exec(par.value)
    const tok = m ? m[1] || m[2] : ''
    const low = tok.toLowerCase()
    if (/\.(ps1|cmd|bat)$/.test(low) && low.includes('\\deploy\\')) {
      const root = tok.slice(0, low.lastIndexOf('\\deploy\\'))
      if (validRoot(root)) return { state: 'ok', root, via: 'AppParameters' }
      why.push(`root-unusable:${root}(AppParameters 推导根不是带 .git 的目录)`)
    } else why.push('AppParameters 首段不是 <root>\\deploy\\ 下的可执行脚本')
  } else why.push(`svc-${service}-AppParameters 取不到(${par.kind === 'unmeasured' ? par.reason : '空'})`)
  return { state: 'unjudged', why: why.join('; ') }
}

/** nssm get 实跑(测试注入假 nssmGet 时不会走到这里)。nssm stdout 是无 BOM 的 UTF-16LE,
 *  必须把原始 buffer 交给 interpretNssmGet 走 decodeNssm 按 NUL 密度解码,不能先按 utf8 解成坏串。
 *  候选顺序 = 该服务 ImagePath 现读到的那枚 nssm(`nssmBin`)⇒ `NSSM_CANDIDATES` 兜底;
 *  两者都不在位 ⇒ spawnError 'ENOENT',由 interpretNssmGet 折成 unmeasured 并带上原因。 */
function nssmGetRaw(param, { service = PROD_SERVICE, nssmBin, exists = existsSync } = {}) {
  const nssm = [nssmBin, ...NSSM_CANDIDATES].filter(Boolean).find((p) => exists(p))
  if (!nssm) return { spawnError: 'ENOENT', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
  try {
    const out = spawnSync(nssm, ['get', service, param], {
      windowsHide: true,
      timeout: NSSM_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'buffer',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (out.error) return { spawnError: out.error.code || 'spawn-error', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
    return { code: out.status ?? -1, stdoutBuf: out.stdout ?? Buffer.alloc(0), stderrBuf: out.stderr ?? Buffer.alloc(0) }
  } catch (e) {
    return { spawnError: String(e?.code || e?.message || 'spawn-throw'), stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }
  }
}

// ---------------------------------------------------------------------------
// 通道 A:服务注册表取材(2026-10-24 立;不依赖 nssm.exe 在位 —— 本机实测 nssm 不在 System32
// 也不在 PATH,而 nssm 把同一份数据写在服务键/其 `Parameters` 子键里,读注册表就是读它)。
// 三条实现纪律:① reg.exe 的位置由 `SystemRoot` 当次推导(不写死盘符);② 只把 `reg query` 的
// **退出码**当"键在不在"的结论(它的 stderr 是 OEM 码页的中文,解析文本必然漂),值只从 stdout 取;
// ③ stdout 是无 BOM UTF-16LE ⇒ 走 decodeNssm(`runCapture` 的 `decode` 档)。
// ---------------------------------------------------------------------------

/** reg.exe 定位:`%SystemRoot%` 现读 ⇒ System32 / SysWOW64 两个形态;都取不到返回 null(归因码
 *  `reg-not-located`),**不**回落硬编码 `C:\Windows`。 */
export function resolveRegBin(env = process.env, exists = existsSync) {
  const sys = env.SystemRoot || env.windir || ''
  if (!sys) return null
  return [join(sys, 'System32', 'reg.exe'), join(sys, 'SysWOW64', 'reg.exe')].find((p) => exists(p)) ?? null
}

/** `reg query <key>` 的输出解析:`HKEY_…` 行是子键,4 空格缩进的 `名 REG_型 值` 行是值。
 *  REG_MULTI_SZ/换行续行的后续行(8 空格缩进)一律忽略 —— 本器只取路径型单行值。 */
export function parseRegQuery(text) {
  const subkeys = []
  const values = new Map()
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/\r$/, '')
    if (line.trim() === '') continue
    if (/^HKEY_/i.test(line.trim())) {
      subkeys.push(line.trim())
      continue
    }
    const m = /^ {4}(\S+)\s+(REG_[A-Z_]+)\s+([\s\S]*)$/.exec(line)
    if (m) values.set(m[1].toUpperCase(), { type: m[2], value: m[3].trim() })
  }
  return { subkeys, values }
}

/** 目录 → 最近的"带 `.git` 的祖先"= checkout 根;找不到返回 null。
 *  必须向上折:部署环的 AppDirectory 实测写成 `<root>` **或** `<root>\deploy\prod-bundle`
 *  (ihui-monitor.ps1:121-122 注释即后一形),直接当根用会漏判整格。 */
export function nearestCheckoutRoot(p, { exists = existsSync, upLimit = ROOT_WALK_UP } = {}) {
  if (typeof p !== 'string' || p.trim() === '') return null
  let cur = p.trim().replace(/[\\/]+$/, '')
  for (let i = 0; i <= upLimit; i++) {
    if (exists(join(cur, '.git'))) return cur.replace(/[\\/]+/g, '/')
    const parent = dirname(cur)
    if (!parent || parent === cur) return null
    cur = parent
  }
  return null
}

/** 一枚服务键的值 ⇒ 候选 checkout 根集合 + (nssm 托管时)那枚 nssm.exe 的位置。
 *  三种承载形态都覆盖:① nssm 的 AppDirectory/AppParameters;② `cmd.exe /c "cd /d <dir> && …"`
 *  (2026-10-24 本机三枚 IHUI 服务全是这形);③ AppParameters 里 `<root>\deploy\…` 的旧截断规则。 */
export function rootsFromServiceValues(values, { exists = existsSync } = {}) {
  const roots = []
  const unusable = []
  let nssmBin = null
  const get = (k) => values.get(k)?.value ?? ''
  const add = (p, via) => {
    if (typeof p !== 'string' || p.trim() === '') return
    const root = nearestCheckoutRoot(p, { exists })
    if (root) {
      if (!roots.some((r) => normPath(r.value) === normPath(root))) roots.push({ value: root, via, from: p.trim() })
    } else unusable.push(`${via}:${p.trim()}`)
  }
  const img = get('IMAGEPATH')
  const nssmHit = /"?\b([^\s"]*nssm\.exe)\b"?/i.exec(img)
  if (nssmHit) nssmBin = nssmHit[1]
  add(get('APPDIRECTORY'), 'AppDirectory')
  const par = get('APPPARAMETERS')
  const scripts = [...par.matchAll(/"([^"]+\.(?:ps1|cmd|bat))"/gi)].map((m) => m[1])
  if (/^\s*\S+\.(?:ps1|cmd|bat)\s*$/i.test(par)) scripts.push(par.trim()) // 不带引号的裸脚本形
  for (const s of scripts) {
    add(s, 'AppParameters-script')
    // 旧 `<root>\deploy\…` 截断规则:对**已经剥好引号的脚本路径**做,不再对整条 AppParameters 做
    // (实跑形态是 `-File "D:\…\deploy\win\x.ps1" -Daemon`,从整条串切会把 `-File "` 前缀一起带进来)
    const di = s.toLowerCase().lastIndexOf('\\deploy\\')
    if (di > 0) add(s.slice(0, di), 'AppParameters-deploy-cut')
  }
  // `cmd.exe /c "cd /d <dir> && <exe> …"` 形态(2026-10-24 本机三枚 IHUI 服务全是这形):
  // 取 `cd /d` 之后、第一个 `&&` 之前那一段,再剥外层引号 —— 用引号反向引用会在
  // `cd /d "G:\x\apps\api && …"` 这种"闭引号落在 && 之后"的形状上整体匹配失败。
  const cdTail = /cd\s+\/d\s+([\s\S]*)$/i.exec(img)
  if (cdTail) {
    const seg = cdTail[1].split('&&')[0].trim().replace(/^"([\s\S]*)"$/, '$1').trim()
    add(seg, 'ImagePath-cd')
  }
  return { roots, unusable, nssmBin }
}

/** 判定面的发现器(通道 A 注册表 → A2 nssm 兜底 → C 约定目录 → D 人工指定)。
 *  返回 `{ state:'ok'|'absent'|'unjudged', roots, causes, evidence, via }`:
 *    ok       找到 ≥1 枚**独立于本仓工作树**的签出根(逐根判定)
 *    absent   每条通道都量到了、但判定面为空(= 本机没有独立生产签出;不是"没量")
 *    unjudged 至少一条通道量不到 ⇒ 逐型点名到 causes,绝不与 absent 同形(§0.3)
 *  依赖全部可注入(regQuery/listServiceNames/exists/env/repoRoot/overrideRoot),镜像测试用假
 *  注册表跑同一条判据,不在测试里复制判据(§22c)。 */
export function surveyProdCheckouts(deps = {}) {
  const exists = deps.exists ?? existsSync
  const env = deps.env ?? process.env
  const repoRoot = deps.repoRoot ?? REPO_ROOT
  const causes = []
  const evidence = { regBin: null, servicesEnumerated: 0, ihuiServices: [], prodServiceInstalled: false, selfExcluded: [], unusable: [], channels: [], nssmBin: null, conventionalProbe: null, conventionalRoot: null }
  const seen = new Map()
  const collect = (list) => {
    for (const r of list) {
      const norm = normPath(r.value)
      if (!norm) continue
      if (norm === normPath(repoRoot)) {
        if (!evidence.selfExcluded.some((x) => normPath(x) === norm)) evidence.selfExcluded.push(r.value)
        continue
      }
      if (!seen.has(norm)) seen.set(norm, { value: r.value, via: r.via })
    }
  }
  /** 归因码去重:同一个根因被两条通道各报一次是噪声,而它会进到人身份的去重面(§5e-1:
   *  身份 = 稳定语义,不是抖动明细)⇒ 在判据源头就去重,不留给派发侧折。 */
  const pushCause = (c) => {
    const s = String(c)
    if (!causes.includes(s)) causes.push(s)
  }

  // 通道 D:人工/复核指定 —— 给了就必须成立,不成立当场未判定(绝不静默回落到自动发现)。
  const override = deps.overrideRoot ?? env.IHUI_PROD_CHECKOUT_ROOT ?? ''
  if (override) {
    const root = nearestCheckoutRoot(override, { exists })
    if (root) {
      evidence.channels.push('override')
      return { state: 'ok', roots: [{ value: root, via: 'override' }], causes: [], evidence, via: 'override' }
    }
    pushCause(`override-root-unusable:${override}`)
    return { state: 'unjudged', roots: [], causes, evidence, why: causes.join('; ') }
  }

  // 通道 A:注册表枚举 + 逐候选服务键取值
  const reg = deps.reg ?? resolveRegBin(env, exists)
  evidence.regBin = reg
  const regQuery =
    deps.regQuery ??
    ((key) => (reg ? runCapture(reg, ['query', key], { timeoutMs: REG_TIMEOUT_MS, decode: true }) : { code: -1, stdout: '', stderr: 'reg-not-located' }))
  if (!reg) pushCause('reg-not-located')
  const enumRes = reg
    ? (deps.listServiceNames ??
      (() => {
        const r = regQuery(REG_SERVICES_KEY)
        if (r.code !== 0) return { ok: false, code: r.code, names: [], why: `svc-enum-fail(exit ${r.code})` }
        return listServiceNamesFromQuery(r.stdout, REG_SERVICES_KEY)
      }))()
    : { ok: false, names: [], why: 'reg-not-located' }
  if (!enumRes.ok) pushCause(enumRes.why || `svc-enum-fail(exit ${enumRes.code ?? '?'})`)
  else if (enumRes.names.length === 0) pushCause('svc-enum-empty')
  else {
    evidence.servicesEnumerated = enumRes.names.length
    const nameSet = new Set(enumRes.names)
    evidence.prodServiceInstalled = nameSet.has(PROD_SERVICE)
    const extras = String(env[EXTRA_SERVICE_NAMES_ENV] || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s !== '')
    const isCandidate = (n) => n.toUpperCase().includes(SERVICE_NAME_TOKEN) || extras.some((e) => e.toUpperCase() === n.toUpperCase())
    const candidates = enumRes.names.filter(isCandidate)
    if (!candidates.includes(PROD_SERVICE) && nameSet.has(PROD_SERVICE)) candidates.unshift(PROD_SERVICE)
    if (candidates.length > MAX_SERVICES_SURVEYED) pushCause(`svc-capped(${candidates.length}>${MAX_SERVICES_SURVEYED})`)
    evidence.channels.push('registry')
    for (const name of candidates.slice(0, MAX_SERVICES_SURVEYED)) {
      const values = new Map()
      let failed = null
      for (const key of [`${REG_SERVICES_KEY}\\${name}`, `${REG_SERVICES_KEY}\\${name}\\Parameters`]) {
        const r = regQuery(key)
        if (r.code !== 0) {
          // Parameters 子键可以没有(nssm 之外的服务本就没这格);服务键本身读不到才是通道坏
          if (!key.endsWith('\\Parameters')) failed = `svc-key-fail:${name}(exit ${r.code})`
          continue
        }
        for (const [k, v] of parseRegQuery(r.stdout).values) if (!values.has(k) || key.endsWith('\\Parameters')) values.set(k, v)
      }
      if (failed) {
        pushCause(failed)
        continue
      }
      const derived = rootsFromServiceValues(values, { exists })
      evidence.ihuiServices.push({ name, roots: derived.roots.map((r) => r.value), via: derived.roots.map((r) => r.via), unusable: derived.unusable })
      if (derived.nssmBin && !evidence.nssmBin) evidence.nssmBin = derived.nssmBin
      for (const u of derived.unusable) if (!evidence.unusable.includes(u)) evidence.unusable.push(u)
      collect(derived.roots)
    }
  }

  // 通道 B:nssm get 兜底(仅当注册表没给出根 ∧ 服务在位)—— 保留 §5e 那条"按实跑路径判"的通道,
  // 但不再让它当唯一入口:本机实测它就是断的(nssm 不在位),而根因是"没有这个服务"。
  if (seen.size === 0 && evidence.prodServiceInstalled) {
    evidence.channels.push('nssm-fallback')
    const nssmRes = resolveProdCheckout({ exists, nssmBin: evidence.nssmBin, service: PROD_SERVICE, nssmGet: deps.nssmGet })
    if (nssmRes.state === 'ok') collect([{ value: nssmRes.root, via: `nssm:${nssmRes.via}` }])
    else pushCause(`nssm-channel:${nssmRes.why}`)
  }

  // 通道 C:约定目录兜底(承载体被拆、签出还躺在盘上那一格)
  const conv = deps.conventionalRoots ?? conventionalProdRoots(repoRoot, { exists })
  if (conv.state === 'refused') pushCause(`dir-survey-refused(${conv.reason})`)
  else {
    // measured 含"量过但目录不存在"这一合法空集:必须落成证据,不能读成"未取"(那是把量过说成没量)。
    evidence.conventionalProbe = conv.state
    evidence.conventionalRoot = conv.roots.join('+') || null
    evidence.channels.push('conventional-dir')
    collect(conv.roots.map((v) => ({ value: v, via: 'conventional-dir' })))
  }

  const roots = [...seen.values()]
  if (roots.length > 0) return { state: 'ok', roots, causes, evidence, via: roots.map((r) => r.via).join('+') }
  if (causes.length > 0) return { state: 'unjudged', roots, causes, evidence, why: causes.join('; ') }
  return {
    state: 'absent',
    roots,
    causes: [],
    evidence,
    via: 'survey',
    why: `判定面为空(实测:服务枚举 ${evidence.servicesEnumerated} 枚 ∧ IHUI 服务 ${evidence.ihuiServices.length} 枚 ∧ 自树让路 ${evidence.selfExcluded.join('+') || '无'} ∧ 约定目录 ${evidence.conventionalRoot ?? (evidence.conventionalProbe === 'measured' ? '量过·无此目录' : '未取')})`,
  }
}

/** 注册表根缩写 → `reg query` 实际回显的全名(2026-10-24 实测踩点:传 `HKLM\…` 进去,stdout 里
 *  打印的是 `HKEY_LOCAL_MACHINE\…`;拿缩写去 startsWith 过滤 ⇒ 枚举恒 0 枚,而"0 枚"既可能是
 *  "真没服务"也可能是"解析没接上",按 §0.3 只能落 svc-enum-empty 未判定 —— 归因码把这一发抓了出来)。 */
export function expandRegRoot(key) {
  const map = { HKLM: 'HKEY_LOCAL_MACHINE', HKCU: 'HKEY_CURRENT_USER', HKCR: 'HKEY_CLASSES_ROOT', HKU: 'HKEY_USERS', HKCC: 'HKEY_CURRENT_CONFIG' }
  const m = /^([A-Za-z]+)[:\\]([\s\S]*)$/.exec(String(key ?? '').trim())
  if (!m) return String(key ?? '')
  const full = map[m[1].toUpperCase()]
  return full ? `${full}\\${m[2]}` : String(key ?? '')
}

/** 枚举服务子键名(reg query 不带 `/v` ⇒ 避开 MSYS 把 `/v` 改写成盘符路径那一坑;
 *  只取**直属**子键,孙键不当服务名)。 */
export function listServiceNamesFromQuery(text, parentKey = REG_SERVICES_KEY) {
  const full = expandRegRoot(parentKey).toUpperCase().replace(/[\\/]+/g, '\\') + '\\'
  const names = []
  for (const raw of parseRegQuery(text).subkeys) {
    const up = raw.toUpperCase().replace(/[\\/]+/g, '\\')
    if (!up.startsWith(full)) continue
    const rest = raw.slice(full.length)
    if (rest === '' || rest.includes('\\')) continue
    names.push(rest)
  }
  return { ok: true, code: 0, names }
}

/** 通道 C 的候选目录:`<devEnvRoot>/ihui-prod`(出口 = seal-c-root-stray 的 `devEnvRoot`,§0.6)。
 *  `devEnvRoot` 在"仓库根本身在夹具内"时抛错 ⇒ 显式落成 refused 归因码,不静默当"没有"。 */
export function conventionalProdRoots(repoRoot, { exists = existsSync } = {}) {
  let root
  try {
    root = devEnvRoot(repoRoot)
  } catch (e) {
    return { state: 'refused', roots: [], reason: String(e?.message || e).slice(0, 120) }
  }
  const cand = join(root, 'ihui-prod')
  if (!exists(join(cand, '.git'))) return { state: 'measured', roots: [] }
  return { state: 'measured', roots: [cand] }
}

/** `git status --porcelain=v1 -z` 解析(含重命名的双 NUL 段;目的路径为准)。 */
export function parsePorcelainZ(text) {
  const parts = String(text ?? '').split('\0')
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
    if (seg === '' || seg.length < 4) continue
    const status = seg.slice(0, 2)
    const path = seg.slice(3)
    if (status.includes('R') || status.includes('C')) i++ // rename/copy 的第二个 NUL 段是原始路径
    out.push({ status, path })
  }
  return out
}

/** `git ls-tree -z <commit> -- paths` ⇒ Map(path→blobSha)。坑①:paths 全走 argv,从不拼 `commit:path`。 */
function lsTreeMap(git, root, commitish, paths) {
  const map = new Map()
  for (let i = 0; i < paths.length; i += LS_TREE_BATCH) {
    const batch = paths.slice(i, i + LS_TREE_BATCH)
    const r = runCapture(git, [...GIT_BASE, '-C', root, 'ls-tree', '-z', commitish, '--', ...batch])
    if (r.code !== 0) return { ok: false, why: `ls-tree ${commitish} exit ${r.code}: ${r.stderr.trim().slice(0, 120)}` }
    for (const seg of r.stdout.split('\0')) {
      if (seg === '') continue
      const tab = seg.indexOf('\t')
      if (tab < 0) continue
      const meta = seg.slice(0, tab).split(' ')
      if (meta[1] === 'blob') map.set(seg.slice(tab + 1), meta[2])
    }
  }
  return { ok: true, map }
}

/**
 * 分类判据唯一实现(镜像测试 import;变异对照钉在这里):
 *   摘松(只比 origin、丢掉 HEAD 侧):`workBlob == headBlob ∧ != originBlob` 的条目会被误判 foreign
 *     —— 用例以该输入形状断言 'duplicate',摘松即翻红。
 *   摘紧(还要求索引里也有条目才算 foreign):untracked 新文件没有索引项,会被漏判
 *     —— 用例以该输入形状断言 'foreign',摘紧即漏报。
 * 注意:未暂存改动的索引 blob 恒等于 HEAD blob(索引存的是 HEAD 版),所以 duplicate 只看
 * 工作区 blob 与两侧的等值;"索引 blob == 远端 tip"在有未暂存改动时恒真,拿它判 duplicate
 * 会把每一处未暂存改动都读成安全(实测推演后废弃的写法,留注防回潮)。
 */
export function classifyEntry(e) {
  if (e.idxBlob && e.idxExists === false) return { bucket: 'unjudged', why: '索引 blob 不在对象库(cat-file -e 非零)' }
  if (!e.workBlob) return { bucket: 'unjudged', why: `工作区 blob 取不到(status=${e.status})` }
  if (e.workBlob === e.originBlob || e.workBlob === e.headBlob) return { bucket: 'duplicate' }
  if (e.idxExists && e.idxBlob && !e.inOrigin) return { bucket: 'staged-untracked' }
  return { bucket: 'foreign' } // 两侧都取不到(含全新未跟踪;§0.3:枚举到 ≠ 判死,这里判的就是死)
}

/** 退出码映射(测试 import 钉;main 用同一份,不抄第二份):unjudged=2 / dirty=1 / 其余=0。 */
export function exitFor(result) {
  if (!result || result.state === 'unjudged') return 2
  return result.state === 'dirty' ? 1 : 0
}

function lineDiffFor(git, root, e) {
  const d = runCapture(git, [...GIT_BASE, '-C', root, 'diff', '--numstat', 'HEAD', '--', e.path])
  if (d.code === 0 && d.stdout.trim() !== '') {
    const f = d.stdout.split('\n')[0].split('\t')
    const n = (x) => (Number.isInteger(Number(x)) ? Number(x) : null)
    return { added: n(f[0]), deleted: n(f[1]) }
  }
  if (!e.inHead && !e.inOrigin && !e.idxExists) {
    try {
      return { added: readFileSync(join(root, e.path), 'utf8').split('\n').length, deleted: 0 }
    } catch {
      return null
    }
  }
  return null
}

/** 主探测(同步,只读):返回 {state,counts,...,line}。 */
export function probeProdCheckout(root, { git = resolveGitBin() || 'git' } = {}) {
  const line = (state, c) =>
    `PROBE-RESULT state=${state} foreign=${c.foreign} duplicate=${c.duplicate} staged=${c.staged} untracked=${c.untracked} unjudged=${c.unjudged}`
  const empty = { foreign: 0, duplicate: 0, staged: 0, unjudged: 0, untracked: 0 }
  const st = runCapture(git, [...GIT_BASE, '-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'])
  if (st.code !== 0) {
    const r = { state: 'unjudged', prodRoot: root, why: `git-status-fail(exit ${st.code}): ${st.stderr.trim().slice(0, 160)}`, counts: { ...empty }, foreign: [], staged: [], duplicates: [], unjudged: [] }
    r.line = line('unjudged', r.counts)
    return r
  }
  const allEntries = parsePorcelainZ(st.stdout)
  // 未跟踪(`??`)条目**不进逐项判据**:它们结构上没有索引 blob(`ls-files -s` 对它们恒空返回),
  // 却会把 argv 顶穿 Windows 命令行上限、并把逐项 cat-file/hash-object 打成几万发。
  // 立项实测:生产签出出现过 23,559 条 `??`(路径字符合计约 2.3MB)⇒ 整档永久 unjudged,
  // 而这把尺子的失效方向恰恰是"安静"。所以它们改为**只计数、不判定**,计数必须出现在结论行
  // (不许被静默折成 0);真正要守的存续性风险是"已入索引/已跟踪却被改动"的那些。
  const entries = allEntries.filter((e) => e.status !== '??')
  const untrackedCount = allEntries.length - entries.length
  const result = {
    state: 'clean',
    prodRoot: root,
    counts: { ...empty, untracked: untrackedCount },
    foreign: [],
    staged: [],
    duplicates: [],
    unjudged: [],
  }
  if (entries.length === 0) {
    result.line = line('clean', result.counts)
    return result
  }
  const paths = [...new Set(entries.map((e) => e.path))]
  const head = lsTreeMap(git, root, 'HEAD', paths)
  if (!head.ok) return { ...result, state: 'unjudged', why: `ls-tree-fail:HEAD — ${head.why}`, line: line('unjudged', result.counts) }
  const origin = lsTreeMap(git, root, ORIGIN_REF, paths)
  if (!origin.ok) return { ...result, state: 'unjudged', why: `ls-tree-fail:${ORIGIN_REF} — ${origin.why}`, line: line('unjudged', result.counts) }
  const idx = new Map()
  // 分批同上两处 ls-tree(同一个 Windows argv 上限,同一把尺子不许一处修一处不修)
  for (let i = 0; i < paths.length; i += LS_TREE_BATCH) {
    const batch = paths.slice(i, i + LS_TREE_BATCH)
    const lf = runCapture(git, [...GIT_BASE, '-C', root, 'ls-files', '-s', '-z', '--', ...batch])
    if (lf.code !== 0)
      return { ...result, state: 'unjudged', why: `ls-files-fail(exit ${lf.code})`, line: line('unjudged', result.counts) }
    for (const seg of lf.stdout.split('\0')) {
      if (seg === '') continue
      const tab = seg.indexOf('\t')
      if (tab < 0) continue
      const meta = seg.slice(0, tab).split(' ')
      idx.set(seg.slice(tab + 1), meta[1])
    }
  }
  for (const entry of entries) {
    const p = entry.path
    const e = {
      path: p,
      status: entry.status,
      headBlob: head.map.get(p) ?? null,
      originBlob: origin.map.get(p) ?? null,
      inHead: head.map.has(p),
      inOrigin: origin.map.has(p),
      idxBlob: idx.get(p) ?? null,
      idxExists: undefined,
      workBlob: null,
    }
    if (e.idxBlob) {
      const ce = runCapture(git, [...GIT_BASE, '-C', root, 'cat-file', '-e', e.idxBlob]) // 坑②:只认退出码结论
      e.idxExists = ce.code === 0
    } else e.idxExists = false
    const h = runCapture(git, [...GIT_BASE, '-C', root, 'hash-object', '--', p])
    if (h.code === 0 && h.stdout.trim() !== '') e.workBlob = h.stdout.trim()
    const verdict = classifyEntry(e)
    if (verdict.bucket === 'duplicate') {
      result.duplicates.push({ path: p, blob: (e.workBlob || e.idxBlob || '').slice(0, 12) })
      result.counts.duplicate++
    } else if (verdict.bucket === 'staged-untracked') {
      result.staged.push({ path: p, blob: (e.idxBlob || e.workBlob || '').slice(0, 12) })
      result.counts.staged++
    } else if (verdict.bucket === 'foreign') {
      result.foreign.push({ path: p, blob: (e.workBlob || e.idxBlob || '').slice(0, 12), lineDiff: lineDiffFor(git, root, e) })
      result.counts.foreign++
    } else {
      result.unjudged.push({ path: p, why: verdict.why })
      result.counts.unjudged++
    }
  }
  const c = result.counts
  if (c.foreign > 0 || c.staged > 0 || c.unjudged > 0) result.state = 'dirty'
  else if (c.duplicate > 0) result.state = 'duplicate'
  result.line = line(result.state, c)
  return result
}

/** 结论行的唯一拼装处(镜像测试 import 同一份,§22c)。`undet=` 是归因码位:空格折成 `_`
 *  以保持"结论行恒纯 ASCII、可被机器按空格切词"的口径,原文一律进 JSON 的 `undet` 数组。 */
export function verdictLine(state, c, { surface = 'none', undet = [] } = {}) {
  // 结论行恒纯 ASCII(头注承诺,派发侧按空格切词):非 ASCII 段折 `_`,原文在 JSON `undet`。
  const tok = (s) => String(s).replace(/[^\x20-\x7E]/g, '_').replace(/\s+/g, '_')
  const codes = undet.length > 0 ? undet.map(tok).join('+') : 'na'
  return `PROBE-RESULT state=${state} foreign=${c.foreign} duplicate=${c.duplicate} staged=${c.staged} untracked=${c.untracked} unjudged=${c.unjudged} surface=${surface} undet=${codes}`
}

/** 多根合并判定(2026-10-24 立:发现器可能解出多枚独立签出,折成一串计数却看不出是谁 = 新盲区)。
 *  合并语义(§0.3,单列绝不并桶):
 *    任一根真出现 foreign/staged ⇒ 整轮 dirty(存续性风险的信号必须压过"另一根判不出");
 *    否则任一根整轮判不出(git 侧失败)或有逐项 unjudged ⇒ 整轮 unjudged(不冒绿也不冒红);
 *    只有全部根都判得出且无脏项 ⇒ clean/duplicate。
 *  每根的逐根结论行留在 `roots[].line`,根因点名留在 `causes`。 */
/**
 * 根是不是**本项目**签出:两个仓标记同在。
 *
 * 立因(2026-10-25 实测):服务枚举会把挂在 IHUI 名下的第三方仓一起收进来(本机
 * `D:/DevEnv/tools/rsshub/RSSHub`,其 origin 是 DIYgod/RSSHub)——拿它对本仓 origin/main
 * 跑 `ls-tree` 必然 exit 128(Not a valid object name) ⇒ 整轮 unjudged,守护连续 134 分钟
 * 报“未判定”并寄信。第三方仓不是“签出证据缺失”,是**不属于本判据的判定面**,应跳过而不是未判定。
 */
export function isProjectCheckout(root, { exists = existsSync } = {}) {
  return exists(join(root, 'apps', 'api', 'package.json')) && exists(join(root, 'packages', 'database', 'package.json'))
}

export function probeAllRoots(roots, opts = {}) {
  const empty = { foreign: 0, duplicate: 0, staged: 0, unjudged: 0, untracked: 0 }
  const counts = { ...empty }
  const merged = { state: 'clean', counts, foreign: [], staged: [], duplicates: [], unjudged: [], causes: [], roots: [], notProject: [] }
  const isProject =
    typeof opts.isProject === 'function'
      ? opts.isProject
      : (root) => isProjectCheckout(root, { exists: opts.exists ?? existsSync })
  for (const r of roots) {
    if (!isProject(r.value)) {
      merged.roots.push({
        root: r.value,
        via: r.via,
        state: 'not-project',
        counts: { ...empty },
        line: '',
        why: '不是本项目签出(缺 apps/api + packages/database 仓标记)⇒ 跳过,不参与外来工作对账',
      })
      merged.notProject.push(r.value)
      continue
    }
    const res = probeProdCheckout(r.value, opts)
    merged.roots.push({ root: r.value, via: r.via, state: res.state, counts: res.counts, line: res.line, why: res.why ?? null })
    for (const k of Object.keys(empty)) counts[k] += Number(res.counts?.[k] || 0)
    for (const it of res.foreign || []) merged.foreign.push({ ...it, root: r.value })
    for (const it of res.staged || []) merged.staged.push({ ...it, root: r.value })
    for (const it of res.duplicates || []) merged.duplicates.push({ ...it, root: r.value })
    for (const it of res.unjudged || []) merged.unjudged.push({ ...it, root: r.value })
    if (res.state === 'unjudged') merged.causes.push(`probe-unjudged:${r.value}(${String(res.why || '无原因').slice(0, 160)})`)
  }
  if (counts.foreign > 0 || counts.staged > 0) merged.state = 'dirty'
  else if (merged.causes.length > 0 || counts.unjudged > 0) merged.state = 'unjudged'
  else if (counts.duplicate > 0) merged.state = 'duplicate'
  else merged.state = 'clean'
  // 逐项判不出(删除型/blob 取不到)时,结论行也必须点名到归因码 —— "未判定却不写为什么"是
  // §0.3 禁止的那种假诚实;明细留在 merged.unjudged[].why。
  if (counts.unjudged > 0) merged.causes.push(`entry-unjudged=${counts.unjudged}`)
  merged.prodRoot = merged.roots.filter((x) => x.state !== 'not-project').map((x) => x.root).join(' + ') || null
  return merged
}

/** 整轮结论(含"判定面为空"那一档)⇒ {state, counts, surface, undet, line, ...},供 main 打印、
 *  也供镜像测试直接断言。发现器给 unjudged 时逐型点名;给 absent 时**必须**带实测证据。 */
export function verdictFromSurvey(survey, opts = {}) {
  const empty = { foreign: 0, duplicate: 0, staged: 0, unjudged: 0, untracked: 0 }
  if (survey.state === 'unjudged') {
    return {
      state: 'unjudged',
      surface: 'none',
      prodRoot: null,
      counts: { ...empty },
      foreign: [],
      staged: [],
      duplicates: [],
      unjudged: [],
      undet: survey.causes,
      why: survey.why,
      evidence: survey.evidence,
      via: survey.via ?? null,
      line: verdictLine('unjudged', empty, { surface: 'none', undet: survey.causes }),
    }
  }
  if (survey.state === 'absent') {
    const e = survey.evidence || {}
    return {
      state: 'clean',
      surface: 'absent-surveyed',
      prodRoot: null,
      counts: { ...empty },
      foreign: [],
      staged: [],
      duplicates: [],
      unjudged: [],
      undet: [],
      why: survey.why,
      evidence: e,
      via: survey.via,
      line: verdictLine('clean', empty, { surface: 'absent-surveyed', undet: [] }),
    }
  }
  const merged = probeAllRoots(survey.roots, opts)
  const surface = merged.state === 'unjudged' ? 'judged-but-unresolved' : 'judged'
  return {
    ...merged,
    surface,
    undet: merged.causes,
    evidence: survey.evidence,
    via: survey.via,
    line: verdictLine(merged.state, merged.counts, { surface, undet: merged.causes }),
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const oi = argv.indexOf('--prod-root')
  const overrideRoot = oi >= 0 ? argv[oi + 1] : undefined
  if (oi >= 0 && !overrideRoot) {
    console.error('用法错误:--prod-root 后面必须给路径(§0.8 出路必须真跑得通,不给值不当"没指定")')
    process.exit(2)
  }
  const survey = surveyProdCheckouts(overrideRoot ? { overrideRoot } : {})
  const verdict = verdictFromSurvey(survey)
  if (json) {
    console.log(JSON.stringify(verdict, null, 2))
    process.exit(exitFor(verdict))
  }
  for (const [label, list] of [
    ['foreign', verdict.foreign],
    ['staged-untracked', verdict.staged],
    ['duplicate', verdict.duplicates],
    ['unjudged', verdict.unjudged],
  ]) {
    for (const it of list) console.log(`[${label}] ${JSON.stringify(it)}`)
  }
  for (const r of verdict.roots || []) console.log(`[root] ${JSON.stringify(r)}`)
  if (verdict.why) console.log(`[${verdict.state === 'clean' ? 'surface' : 'unjudged-run'}] ${verdict.why}`)
  if (verdict.evidence) console.log(`[evidence] ${JSON.stringify(verdict.evidence)}`)
  console.log(verdict.line)
  process.exit(exitFor(verdict))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  PROD_SERVICE,
  ORIGIN_REF,
  REG_SERVICES_KEY,
  SERVICE_NAME_TOKEN,
  EXTRA_SERVICE_NAMES_ENV,
  MAX_SERVICES_SURVEYED,
  ROOT_WALK_UP,
  REPO_ROOT,
  classifyEntry,
  exitFor,
  parsePorcelainZ,
  probeProdCheckout,
  resolveProdCheckout,
  nssmGetRaw,
  // 2026-10-24 归因改造新增层的出口(镜像测试全部 import 这里,不在测试里抄第二份判据)
  normPath,
  resolveRegBin,
  parseRegQuery,
  expandRegRoot,
  listServiceNamesFromQuery,
  nearestCheckoutRoot,
  rootsFromServiceValues,
  conventionalProdRoots,
  surveyProdCheckouts,
  isProjectCheckout,
  probeAllRoots,
  verdictLine,
  verdictFromSurvey,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
