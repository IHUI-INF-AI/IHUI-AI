#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息(与 check-crash-report-redaction 同形) */
/**
 * 守门:ai-service 侧"取到已验证身份却一次都没用它"(认证不等于授权)的常驻对账。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,落地时取 152,blocking,
 * skipEnv = HUSKY_SKIP_PRINCIPAL_CONSUMED,stagedTriggers = apps/ai-service/,
 * 判据射程只有这个 FastAPI 应用),AGENTS.md 点名行与脚本、注册块同枚入库
 * (README 表格门那一课:注册指向不在 HEAD 里的脚本 = 干净检出上整批门炸)。
 *
 * 它**不重写判据**。判据只有一份,住在 `apps/ai-service/scripts/audit_principal_consumed.py`
 * (ast 两条:签名有身份依赖默认值而体内零引用该参数 ⇒ 未消费;体内读
 * `X.state.user_id` / getattr 同形 / 把 X 一跳传给"自己读 state.user_id"的仓内 helper ⇒
 * 判已消费)。本门只做三件事:**按被审面物化内容 → 派生那把 python 尺子 → 消费其 --json**。
 * 反向锁由镜像测试钉死:本文件不得自己解析 AST、不得建第二份身份依赖名字表、
 * 豁免沿用尺子内的 PRINCIPAL_EXEMPTIONS(本门只读尺子给出的 stale 清单,不另立清单)。
 *
 * —— 三条设计前提(为什么恰好是这三条)——
 *
 * ① 机器态不判红(AGENTS §12e 同型):解释器拿不到 / 尺子文件在被审面上不存在 / 尺子跑出
 *    非结论(rc 异常或输出不可 parse)⇒ 判"**未判定**"并打印原因,**exit 0**。
 *    理由:这是一台判"机器状态"的门 —— 提交者结构上满足不了"这台机装了 venv"。挂 blocking
 *    又因机器态恒红,唯一结局是每台每次被逼 `--no-verify`、连带全部守门对每次提交作废。
 *    **只有在尺子真跑出结论时才据其结论判红。**
 *    (与之相对:被审**内容**取材不到 —— git 问不到面、catBatch 抛 —— 是判据输入缺失,按全仓
 *    现行口径 **exit 2「无法判定」**,不冒红也不记绿;与守门 105/117/118 同族。)
 *
 * ② 两面取材口径:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅作
 *    人工逃生舱;两面旗同给 ⇒ exit 2。python 尺子按磁盘取数,所以本门先经
 *    `scripts/lib/face-reader.mjs` 的 `catBatch`(唯一取材入口;"引了层却仍按磁盘判"正是
 *    守门 118 判红的 half-wired 型)把被审面物化到 scratch 临时 git 仓,再把**那份内容**喂尺子。
 *    真仓全程只读:临时仓在 `scripts/lib/scratch-dir.mjs` 的落点里 `git init` + `add`
 *    (与 scripts/tests/* 既有做法同形),用完自删。
 *    尺子脚本本体也取被审面上的那一份(判据与被判内容同面演进,不混面)。
 *
 * ③ 棘轮锚点 = 该文件在**锚点面**自身的存量,不是手工白名单、不是常量 0:
 *    `--staged` 的锚点是 HEAD 面,全量档(HEAD 面)的锚点是 HEAD^ 面。
 *    只拦"这次改动把未消费身份的新端点带进来 / 让豁免清单腐烂"。
 *    台账对应条(G-261)现读存量为 0(判红 0 / 带理由豁免 7 / 未判定 0 / 不可审 0),所以当前
 *    等价零容忍 —— 但锚点是每次现算的:存量若因 `--no-verify` 回升,本门也只拦增量,
 *    不会把与本次提交无关的旧账变成人人跳门(G-261 登记的三条前置正是这套设计)。
 *
 * 三态绝不并桶:findings(判红,逐条点名 file:line + 函数名 + 修复出口)/
 * exempted(尺子内带理由豁免,只计数)/ undetermined + unauditable(**未判定**,逐条报名,
 * 既不冒红也绝不写成"判过了")。
 *
 * 用法:node scripts/check-principal-consumed.mjs [--staged|--worktree] [--json] [--root <dir>]
 *   --root 是**测试通道**(镜像测试用临时仓造现场);生产调用不带,仓库根由本文件位置推导。
 * 环境变量:IHUI_PRINCIPAL_AUDIT_PYTHON 覆盖解释器探测(取证/CI 用);
 *           HUSKY_SKIP_PRINCIPAL_CONSUMED=1 应急跳过。
 * 退出码:0 = 无判红(含"未判定",末行如实区分,不出具"全部已判"合格证);1 = 判红;
 *         2 = 面旗矛盾 / 被审面取材不到 / 被审面枚举 0 个候选(尺子失明不是通过)。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitBinary, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { prependPathDir } from './lib/normalize-path-env.mjs'

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const AI_DIR = 'apps/ai-service'
const AI_PREFIX = `${AI_DIR}/`
const RULER_REL = `${AI_PREFIX}scripts/audit_principal_consumed.py`
const GIT = gitBinary()
const SPAWN_TIMEOUT_MS = 300000
const MAX_BUFFER = 64 << 20

// ---------------------------------------------------------------------------
// 解释器探测(仓内既有惯例:check-mypy / release-desktop-local 都是
// apps/ai-service/.venv 优先、PATH 兜底;盘符由 ROOT 推导,不写死)
// ---------------------------------------------------------------------------
function pythonCandidates(root) {
  const env = process.env.IHUI_PRINCIPAL_AUDIT_PYTHON
  if (env) return [{ exe: env }]
  return [
    { exe: join(root, AI_DIR, '.venv', 'Scripts', 'python.exe') },
    { exe: join(root, AI_DIR, '.venv', 'bin', 'python') },
    { exe: 'python' },
    { exe: 'python3' },
  ]
}

function resolvePython(root) {
  for (const c of pythonCandidates(root)) {
    try {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      const r = spawnSync(c.exe, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 20000, stdio: 'ignore' })
      if (r.status === 0) return c.exe
    } catch {
      /* 试下一个候选;全部落空由调用方判"未判定",绝不静默 */
    }
  }
  return null
}

// 尺子内部用裸 `git` 枚举(subprocess 里跑 git ls-files),而钩子/服务账户的 PATH 与交互
// 终端不通(AGENTS §5b)—— 把 git 所在目录显式前置进那份子环境,让"尺子跑不动"不再
// 伪装成"仓里没有违规"。
// 写法必须是"归一 + 前置"一步做完(G-1105300):旧形态 `{ ...process.env, PATH: … }` 在宿主把
// PATH 写成 `Path`(Windows 原生拼写)时会在同一对象里并存两种拼写,而按"继承那份优先"的语义,
// 归一之后不再显式赋值就等于把这个目录白前置 —— 站点存在的理由静默失效。
function rulerEnv() {
  return { ...prependPathDir({ ...process.env }, dirname(GIT)), PYTHONIOENCODING: 'utf-8' }
}

// ---------------------------------------------------------------------------
// 被审面枚举 + 物化(内容一律经 face-reader 的 catBatch;枚举与内容同面同轮)
// ---------------------------------------------------------------------------
function faceSpecPrefix(face) {
  return face === 'staged' ? ':' : face === 'head^' ? 'HEAD^:' : 'HEAD:'
}

function listFaceFiles(root, face) {
  if (face === 'staged' || face === 'worktree') {
    return gitRaw(['ls-files', '--', AI_DIR], root)
      .split(/\r?\n/)
      .filter((p) => p.endsWith('.py'))
  }
  const rev = face === 'head^' ? 'HEAD^' : 'HEAD'
  return gitRaw(['ls-tree', '-r', '--name-only', rev, '--', AI_DIR], root)
    .split(/\r?\n/)
    .filter((p) => p.endsWith('.py'))
}

/**
 * 把一个面物化成临时 git 仓(内容 = 该面上的 blob),返回 { dir, files, missing }。
 * dir 里存的是 **ai-service 相对路径**(与尺子默认 root 的语义逐字同形,豁免键才对得上);
 * 尺子脚本自身也在其中 —— 跑的永远是"被审面上那一份判据",不是磁盘上的新判据审旧内容。
 */
function materializeFace(root, face) {
  const rels = listFaceFiles(root, face)
  if (rels.length === 0) return { dir: null, files: 0, missing: 0 }
  const contents = new Map()
  if (face === 'worktree') {
    for (const rel of rels) {
      const t = readWorktreeFile(root, rel)
      if (t !== null) contents.set(rel, t)
    }
  } else {
    const prefix = faceSpecPrefix(face)
    const map = catBatch(root, rels.map((r) => `${prefix}${r}`))
    for (const rel of rels) {
      const v = map.get(`${prefix}${rel}`)
      if (typeof v === 'string') contents.set(rel, v)
    }
  }
  const dir = mkScratch('principal-consumed-')
  try {
    for (const [rel, text] of contents) {
      const abs = join(dir, ...rel.slice(AI_PREFIX.length).split('/'))
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text, 'utf8')
    }
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execFileSync(GIT, ['-c', 'safe.directory=*', 'init', '-q', '.'], { cwd: dir, windowsHide: true, timeout: 60000, stdio: 'ignore' })
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', 'add', '-A', '--'], {
      cwd: dir,
      windowsHide: true,
      timeout: 120000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: 'ignore',
    })
    return { dir, files: contents.size, missing: rels.length - contents.size }
  } catch (e) {
    rmScratch(dir)
    throw e
  }
}

/** 在一个已物化的面树上跑尺子;一切"尺子没给出结论"的形态都折成 { ok:false, reason }。 */
function runRuler(faceDir, pyExe) {
  const script = join(faceDir, 'scripts', 'audit_principal_consumed.py')
  const r = spawnSync(pyExe, [script, '--json', '--root', faceDir], {
    cwd: faceDir,
    encoding: 'utf8',
    env: rulerEnv(),
    timeout: SPAWN_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: 'ignore',
  })
  if (r.error) return { ok: false, reason: `尺子派生失败:${r.error.message}` }
  if (r.status !== 0 && r.status !== 1) {
    return { ok: false, reason: `尺子以 rc=${r.status} 退出,不构成结论:${String(r.stderr || '').slice(-200).replace(/\s+/g, ' ')}` }
  }
  let parsed = null
  try {
    parsed = JSON.parse(r.stdout)
  } catch {
    /* 下面统一按"输出不可 parse ⇒ 未判定"处理,不猜 */
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.scanned !== 'number') {
    const why = parsed && parsed.error ? parsed.error : 'stdout 不是可解析的结论 payload'
    return { ok: false, reason: `尺子拒绝出具合格证/输出不可用:${why}` }
  }
  return { ok: true, payload: parsed }
}

function perFileFindings(payload) {
  const m = new Map()
  for (const f of payload.findings ?? []) m.set(f.file, (m.get(f.file) ?? 0) + 1)
  return m
}

const FIX_HINT =
  '修复出口(二选一,不得为消红削判据):① 让端点真的消费身份 —— 属主一律取令牌主体 ' +
  '(app/core/jwt_auth.py 的 require_request_user_id),归属比对走 app/services/session_store.py ' +
  '的 owner_scoped_allows,或把 request 一跳委托给"自己读 request.state.user_id"的既有 helper' +
  '(_owner_filter 形态);② 确属无归属轴的公共面 ⇒ 在 apps/ai-service/scripts/' +
  'audit_principal_consumed.py 的 PRINCIPAL_EXEMPTIONS 逐条登记 file+func+理由' +
  '(禁止按目录/前缀整片放行,禁止在本门另立清单)。'

function finish(out, wantJson, rc) {
  if (wantJson) {
    console.log(JSON.stringify({ ...out, rc }, null, 2))
    return rc
  }
  console.log(
    `principal-consumed 对账:被审面=${out.face} 锚点面=${out.anchorFace}` +
      `(扫描 ${out.scanned} / 锚点扫描 ${out.anchorScanned})—— 判红 ${out.red.length} 处 / ` +
      `未判定 ${out.undetermined} 处 / 不可审 ${out.unauditable} 个 / 带理由豁免 ${out.exempted} 处 / ` +
      `机器态未判定 ${out.machineUndetermined.length} 条`,
  )
  for (const r of out.red) console.log(`  [红] ${r.file}:${r.line} ${r.func} :: ${r.params}`)
  if (out.red.length > 0) console.log(`  ${FIX_HINT}`)
  for (const n of out.notes) console.log(`  ${n}`)
  for (const m of out.machineUndetermined) console.log(`  ${m}`)
  const tail =
    out.red.length > 0
      ? `结论:判红 ${out.red.length} 处(见上)`
      : out.machineUndetermined.length > 0 || out.undetermined > 0 || out.unauditable > 0
        ? `结论:无判红,但存在未判定(${out.machineUndetermined.length} 条机器态 + ${out.undetermined} 条委托未判定 + ${out.unauditable} 个不可审)—— 不出具"全部已判"合格证`
        : '结论:通过(被审面相对锚点面零新增,无未判定)'
  console.log(tail)
  return rc
}

function main() {
  const argv = process.argv.slice(2)
  const flags = new Set(argv)
  if (process.env.HUSKY_SKIP_PRINCIPAL_CONSUMED === '1') {
    console.log('⏭  check-principal-consumed:按 HUSKY_SKIP_PRINCIPAL_CONSUMED=1 应急跳过(跳过的那次提交未经本判据核验,请随后偿还核验)')
    return 0
  }
  const { face, error } = selectFace({ staged: flags.has('--staged'), worktree: flags.has('--worktree'), def: 'head' })
  if (error) {
    console.log(`❌ 无法判定:${error}`)
    return 2
  }
  // 测试通道:镜像测试用临时仓造现场;生产调用不带 --root(守门 70 的教训 —— 靠 cwd 定位
  // 夹具的调用会在脚本忽略 cwd 后结构失效,所以夹具必须走显式 --root)。
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 && argv[rootIdx + 1] ? resolvePath(argv[rootIdx + 1]) : ROOT
  const wantJson = flags.has('--json')
  const anchorFace = face === 'head' ? 'head^' : 'head'
  const out = {
    face,
    anchorFace,
    machineUndetermined: [],
    red: [],
    undetermined: 0,
    unauditable: 0,
    exempted: 0,
    scanned: 0,
    anchorScanned: 0,
    notes: [],
  }

  // —— 解释器(机器态:拿不到 ⇒ 未判定 exit 0,不判红也不记绿)——
  const pyExe = resolvePython(root)
  if (!pyExe) {
    out.machineUndetermined.push(
      '未判定:拿不到可用的 Python 解释器(apps/ai-service/.venv 未 materialize 且 PATH 无 python/python3;恢复:cd apps/ai-service && uv sync)。尺子没跑,本门不判红也不记绿。',
    )
    return finish(out, wantJson, 0)
  }

  let auditDir = null
  let anchorDir = null
  try {
    // —— 被审面(判据输入:取不到 = exit 2;枚举 0 = 判死,都不静默)——
    const auditFiles = listFaceFiles(root, face)
    if (auditFiles.length === 0) {
      console.log(`❌ 无法判定:被审面(${face})在 ${AI_DIR} 下枚举到 0 个 .py ⇒ 判据失明,不记为通过`)
      return 2
    }
    if (!auditFiles.includes(RULER_REL)) {
      out.machineUndetermined.push(`未判定:被审面上没有尺子 ${RULER_REL} —— 判据不在这份内容里,本门不猜它的结论。`)
      return finish(out, wantJson, 0)
    }
    const audit = materializeFace(root, face)
    auditDir = audit.dir
    const a = runRuler(audit.dir, pyExe)
    rmScratch(audit.dir)
    auditDir = null
    if (!a.ok) {
      out.machineUndetermined.push(`未判定:尺子在被审面(${face})未产出结论(${a.reason})。`)
      return finish(out, wantJson, 0)
    }
    if (audit.missing > 0) out.notes.push(`被审面有 ${audit.missing} 个 .py 取不到正文(按缺文件处理,不静默丢弃)`)

    // —— 锚点面(棘轮名额的来源;拿不到就只能"未判定",不得拿常量 0 冒充锚点)——
    let anchorPer
    let anchorStale
    let anchorScanned = 0
    const anchorFiles = listFaceFiles(root, anchorFace)
    if (anchorFiles.length === 0) {
      // 锚点面无内容(仓库无父提交 / 子树是在本次改动里新建的):此时"零新增"没有可比对象,
      // 按零存量起算,但必须把这条起算方式喊出来 —— 静默按 0 就是把没判写成判过了。
      out.machineUndetermined.push(
        `未判定(锚点):锚点面(${anchorFace})在 ${AI_DIR} 下枚举为空 ⇒ 增量无从起算,本轮按"零存量"名额判定(仅当 ${AI_DIR} 确为新建时成立)。`,
      )
      anchorPer = new Map()
      anchorStale = new Set()
    } else {
      const anchor = materializeFace(root, anchorFace)
      anchorDir = anchor.dir
      const b = runRuler(anchor.dir, pyExe)
      rmScratch(anchor.dir)
      anchorDir = null
      if (!b.ok) {
        out.machineUndetermined.push(`未判定:尺子在锚点面(${anchorFace})未产出结论(${b.reason}),增量无从起算。`)
        return finish(out, wantJson, 0)
      }
      anchorPer = perFileFindings(b.payload)
      anchorStale = new Set(b.payload.stale_exemptions ?? [])
      anchorScanned = b.payload.scanned
    }

    const payload = a.payload
    out.scanned = payload.scanned
    out.anchorScanned = anchorScanned
    out.exempted = (payload.exempted ?? []).length
    out.undetermined = (payload.undetermined ?? []).length
    out.unauditable = (payload.unauditable ?? []).length

    // 每文件名额 = 锚点面该文件的存量数;被审面按点名顺序消耗名额,
    // **超出名额的那几条**才是"本次带进来的新账"(与守门 77/83/98"锚点=该文件 HEAD 自身存量"同构)。
    const quota = new Map(anchorPer)
    for (const f of payload.findings ?? []) {
      const left = quota.get(f.file) ?? 0
      if (left > 0) {
        quota.set(f.file, left - 1)
        continue
      }
      out.red.push({ file: f.file, line: f.line, func: f.func, params: (f.params ?? []).join(',') })
    }
    for (const k of payload.stale_exemptions ?? []) {
      if (!anchorStale.has(k)) {
        out.red.push({ file: k, line: 0, func: '(清单腐烂)', params: '该豁免条目已无对应判红形态,必须删除这条登记(尺子内 PRINCIPAL_EXEMPTIONS)' })
      }
    }
    for (const u of payload.undetermined ?? []) out.notes.push(`[未判定] ${u.file}:${u.line} ${u.func} → ${u.callee}:${u.reason}`)
    for (const u of payload.unauditable ?? []) out.notes.push(`[不可审] ${u.file}:${u.reason}`)
  } catch (e) {
    for (const d of [auditDir, anchorDir]) {
      if (d) {
        try {
          rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
        } catch {
          /* scratch-dir 的退出回收兜底 */
        }
      }
    }
    if (e instanceof Undetermined) {
      console.log(`❌ 无法判定(被审内容取材失败,不冒红也不记绿):${e.message}`)
    } else {
      console.log(`❌ 本门自身异常(不冒充判据结论):${e?.stack ?? e}`)
    }
    return 2
  }
  return finish(out, wantJson, out.red.length > 0 ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

// §22c/§22d:核心函数经 __test__ 暴露给镜像测试(测试不得复制一份判据)。
export const __test__ = { pythonCandidates, resolvePython, perFileFindings, listFaceFiles, materializeFace, runRuler, FIX_HINT, RULER_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
