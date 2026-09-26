#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * check-env-drift.mjs — 受管 `.env` 的「键值被悄悄清空」对账(2026-09-26 立,G-223 第三格)
 *
 * 事故(2026-09-26 03:08,成因已取证):`apps/api/.env` 被一次整体替换清空 55 个键值 —— 03:06 起的
 * 一个 IDE 会话把**根目录 `./.env`** 按时间戳复制过去,而那份根 `.env` 的内容 = 同步盘里 09-19 的
 * 过期镜像 + 4 行 GitHub 相关键。症状形态是**什么都不响**:应用没崩(DATABASE_URL / JWT_SECRET
 * 恰好非空),而唯一到人通道(邮件)静默寄不出去 —— 只在 `deploy/win/deploy-loop.log` 每轮写
 * `MAIL 两条通道均未送达`,只有去翻日志的人才知道。本工具的存在理由就是把这一格变成主动喊人。
 *
 * 为什么它**不在提交链**(设计前提,不得回退):
 *   它判的是**机器状态**(这台机上的 .env 此刻有没有被清空),不是提交内容。挂进 pre-commit
 *   blocking 就是一台"与任何提交都无关的恒红门",唯一结局是逼人 `--no-verify`,连带把其余
 *   150+ 道守门一起作废(AGENTS §12e / §4 / 守门 77·78·110 各记过一次同型);挂 warn 也没人看。
 *   正确落点 = `scripts/git-guardian.mjs` 的巡检 tick(每 2 分钟一趟,且必须挂在 `!CHECK_ONLY`
 *   分支、健康轮次早退之前 —— 挂错位置等于永不执行,该文件已踩过两次),复用它今天已有的派发
 *   出口(§5e 唯一邮件通道 `apps/api/scripts/notify-deploy-failure.ts`:按 alert 身份 + 内容指纹
 *   4h 去重、未送达退避、无每日总量封顶)。
 *
 * 判据三条(全部现读磁盘,零副作用):
 *   E1 对照面 = `.ihui-agent/env-backup/` 里**该目标最新一份同目标备份**(mtime 最新;同 mtime 按名字倒序)
 *   E2 漂移   = 备份中「值非空」的键,在现文件里「整键缺失」或「值为空/仅空白」⇒ 逐条点名**键名**
 *   E3 三态   = ① 无现文件 / 无备份可比 ⇒ **未判定**(打印原因,既不记为通过也不记为漂移)
 *               ② 有漂移 ⇒ 判红并计数 ③ 全部可判且零漂移 ⇒ 绿
 *
 * 阈值(刻意为零):任何一条"历史上非空、现在为空"都要喊,不设"N 条以内忽略"的模糊档 ——
 * 节流只交给守护侧的 alert 身份 + 内容指纹(修好了自然不再喊,没修好也不会被静默吞掉)。
 *
 * 输出纪律(硬性,AGENTS §5d):任何情况下**不打印值**,只打印键名;值长度只在 `--verbose` 下出现,
 * 且只报长度这一个数(回填脚本那套 `前6位***后2位` 在这里也不适用 —— 本工具的读者可能是日志文件,
 * 而日志会被贴进工单)。默认连长度都不出:JSON 面在非 verbose 档把 `backupLen` 整字段抹掉。
 *
 * 判定面:**磁盘运行态**,结论行明写。`.env` 与 `.ihui-agent/env-backup/` 都在 .gitignore 覆盖内
 * (§5d:".env 由 .gitignore 忽略,永不入库"),任何检出上都不存在 ⇒ 本工具结构上没有"HEAD/索引面"
 * 可判:它按磁盘判的恰恰是**被审对象本身**。这与守门 118 守的那一型("判仓库内容却按磁盘")不是
 * 同一件事,该门自己的修复提示就写着:"若这道门判的**不是仓库内容**(纯计算/外部输入),改成不读
 * ROOT 锚点即可"。因此本文件的仓库根常量刻意叫 `STATE_ROOT`,不叫 `ROOT`。
 *
 * 用法:
 *   node scripts/check-env-drift.mjs                 # 巡检(只读)
 *   node scripts/check-env-drift.mjs --check         # 同一结论的显式"零副作用"档(守护用的旗标)
 *   node scripts/check-env-drift.mjs --json          # 单个 JSON 对象(必须可 JSON.parse)
 *   node scripts/check-env-drift.mjs --verbose       # 追加每个漂移键在备份里的值长度
 *   node scripts/check-env-drift.mjs --self-test     # 逻辑自检(mkScratch 真造临时盘,零真盘副作用)
 *   node scripts/check-env-drift.mjs --root <dir>    # 测试/取证通道:换根目录
 *
 * 退出码:0 = 全部可判且零漂移 / 1 = 检出漂移(优先于未判定)/ 2 = 无法判定(不出合格证)
 *   ⚠ 红优先于未判定,是刻意的:某个目标不可判,绝不能替其余目标的真漂移消音。
 * 静音:本工具只读、跑它没有代价,故**不自设跳过旗**;要停派发只有守护侧
 *   `GIT_GUARDIAN_NOTIFY_DISABLED=1`(只关"要不要发",不关"发几封",§5e 同一条禁令)。
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

/** 仓库根(磁盘运行态之根)。命名刻意避开大写 ROOT,理由见头注"判定面"一段。 */
const STATE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 备份目录(§5d:回填脚本 apply 前自动落这里,已被 .gitignore 覆盖) */
const BACKUP_REL = join('.ihui-agent', 'env-backup')

/**
 * 受管目标表。每条的 `backupPatterns` 就是"同目标"的判据 —— **备份文件名里不带目标标识**,
 * 所以只能靠命名前缀归属;前缀来源都写在注释里,不得在别处再抄一份。
 *
 * 备份命名约定(写侧新生产者一律照此,别再有第三种):
 *   `<target-slug>.env.before-<事由>.<时间戳>`  —— 例如 `api.env.before-key-restore.1790433640782`
 *
 * ⚠ 一条已知且如实登记的误归属风险:`env-backup-*.env` 之所以算**根 .env** 的备份,唯一依据是
 *   `scripts/env-backfill-model-keys.mjs` 的默认目标就是根 `.env`(其 `--env` 可覆盖,而备份名
 *   不记录实际目标)。若有人用 `--env apps/api/.env` 跑回填又没改 `--backup-dir`,那份文件会被
 *   认成根 .env 的对照面。后果不是崩,而是**读错基准**;因此输出里一律点名"所用备份文件名 + mtime",
 *   让人一眼验得出。要根除这一格,得让写侧把目标标识落进备份名或旁挂清单 —— 那是写侧的改动。
 */
export const MANAGED_TARGETS = [
  {
    id: 'apps/api/.env',
    rel: join('apps', 'api', '.env'),
    // `api.env.before-*`:手工/会话恢复时落的名(取证见 PROJECT_PLAN 的 ALERT_EMAIL_TO 登记行与今日 03:08/13:23 两份)
    backupPatterns: [/^api\.env\./],
    judge: true,
    why: 'API 运行时凭据面;2026-09-26 那次受损的正是它(被根 .env 整体覆盖)',
  },
  {
    id: '.env(仓库根)',
    rel: '.env',
    // `root.env.before-*` = 同日按新约定落的根备份;`env-backup-*` = 回填脚本自带的名(其默认目标即根)
    backupPatterns: [/^root\.env\./, /^env-backup-/],
    judge: true,
    why: '它自己就是那次事故的上游件(过期镜像 + 4 行 GitHub 键),且是 env-backfill 的默认目标',
  },
  {
    id: 'apps/ai-service/.env',
    rel: join('apps', 'ai-service', '.env'),
    backupPatterns: [/^ai-service\.env\./, /^aiservice\.env\./],
    judge: false,
    // 为什么"只登记不判"而不是"判它":**没有任何生产者按约定为它写过备份**(回填脚本默认目标是
    // 根 .env,api.* 是手工件)。判它 = 每轮固定产出一行"未判定",那与"这一条根本不存在"的差别
    // 只是账面好看。所以把它登记在案(覆盖面如实可见)而裁决关掉。
    // 要开始判:先让写侧落第一份 `ai-service.env.before-<事由>.<ts>`,再把 judge 翻 true。
    why: '登记但不判:尚无同目标备份生产者(翻 judge 的前置条件见上一行注释)',
  },
]

/**
 * 确认废弃清单(按目标隔离)。这是"备份里有、今文件里已消失"的**唯一**人工出口。
 *
 * 纪律:加一条必须带可核验依据(哪枚提交删了它、消费方已摘干净),且**禁止**用它把一次真漂移
 * 遮成绿。与守门 107 对 `RN_ONLY_BRAND_KEYS` 的教训同一条:豁免清单会腐烂 —— 所以这里保持为空,
 * 只有"确实被删掉的键"才进来。现表为空 = 零豁免(自检 ⑧ 钉死)。
 */
export const RETIRED_KEYS = {
  'apps/api/.env': [],
  '.env(仓库根)': [],
  'apps/ai-service/.env': [],
}

/** 值判空:仅空白视为空(与 §5d 回填脚本"只写值为空的键"同一条口径,不得比它更宽) */
export function isBlankValue(v) {
  return !/[^\s]/.test(String(v ?? ''))
}

/**
 * 解析 .env 文本 → {values: Map<键, 值串>, duplicates: 重复键次数}。
 * 只认 `KEY=` 行(注释/空行/无 `=` 的行忽略);`export ` 前缀与成对引号剥掉;同名键后出现的覆盖
 * 前面的(与 dotenv 的 last-wins 同形,并把重复次数如实报出来 —— 不静默)。
 * 刻意**不**剥行尾内联注释:那要理解值;判"空/非空"不需要。
 */
export function parseEnvText(text) {
  const values = new Map()
  let duplicates = 0
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line)
    if (!m) continue
    const key = m[1]
    if (values.has(key)) duplicates += 1
    values.set(key, stripQuotes(m[2]))
  }
  return { values, duplicates }
}

function stripQuotes(raw) {
  const v = String(raw).trim()
  if (v.length >= 2) {
    const a = v[0]
    const b = v[v.length - 1]
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return v.slice(1, -1)
  }
  return v
}

/**
 * E1 对照面:取"该目标最新一份同目标备份"。mtime 最新;同 mtime 按文件名倒序。
 * 目录不存在 / 无匹配 / 是目录不是文件 ⇒ 一律 null(由 judgeTarget 翻成"未判定",不冒充绿)。
 */
export function pickLatestBackup(
  dirPath,
  patterns,
  fsImpl = { existsSync, readdirSync, statSync },
) {
  if (!fsImpl.existsSync(dirPath)) return null
  let entries = []
  try {
    entries = fsImpl.readdirSync(dirPath)
  } catch {
    return null
  }
  let best = null
  for (const name of entries) {
    if (!patterns.some((re) => re.test(name))) continue
    const full = join(dirPath, name)
    let st = null
    try {
      st = fsImpl.statSync(full)
    } catch {
      continue // 读不到 stat(坏链/竞态)⇒ 跳过这一份,不判死整轮
    }
    if (!st.isFile()) continue
    const cand = { name, path: full, mtimeMs: st.mtimeMs }
    if (!best) {
      best = cand
      continue
    }
    if (cand.mtimeMs > best.mtimeMs || (cand.mtimeMs === best.mtimeMs && cand.name > best.name)) {
      best = cand
    }
  }
  return best
}

/**
 * E2 判据本体(纯函数):备份非空 ∧ 现值为空或整键缺失 ⇒ 记一条。
 * `backupLen` 只服务 --verbose 渲染;默认输出与默认 JSON 都会把它抹掉(见 stripLens)。
 */
export function diffAgainstBackup({ backupValues, currentValues, retired = [] }) {
  const retiredSet = new Set(retired)
  const drift = []
  for (const [key, bv] of backupValues) {
    if (isBlankValue(bv)) continue // 备份里本就空 ⇒ 不存在"历史上非空"
    if (retiredSet.has(key)) continue
    if (!currentValues.has(key)) {
      drift.push({ key, kind: 'missing', backupLen: String(bv).length })
    } else if (isBlankValue(currentValues.get(key))) {
      drift.push({ key, kind: 'empty', backupLen: String(bv).length })
    }
  }
  drift.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  return drift
}

/** 目标现文件的绝对路径 */
function currentPathOf(target, root) {
  return join(root || STATE_ROOT, target.rel)
}

/** 备份目录的绝对路径 */
export function backupDirOf(root) {
  return join(root || STATE_ROOT, BACKUP_REL)
}

/**
 * 单目标裁决(纯函数,IO 由调用方喂进来 —— 自检与真盘走**同一条**判据,不得另写一份)。
 * @returns {{id:string, state:'clean'|'drift'|'undetermined'|'registered-only', reason:string,
 *            currentPath:string, backup?:{name:string,mtimeMs:number}, drift:Array, counts:Object}}
 */
export function judgeTarget(target, io) {
  const { currentText, currentExists, backup, backupText, root } = io
  const retiredCount = (RETIRED_KEYS[target.id] || []).length
  if (!target.judge) {
    return {
      id: target.id,
      state: 'registered-only',
      reason: target.why,
      currentPath: currentPathOf(target, root),
      drift: [],
      counts: { targets: 0, backupKeys: 0, currentKeys: 0, drift: 0, retired: retiredCount },
    }
  }
  if (!currentExists) {
    return {
      id: target.id,
      state: 'undetermined',
      reason: '现文件不存在 ⇒ 无法判漂移(可能已被删除,也可能尚未配置)。不记为通过,也不记为漂移。',
      currentPath: currentPathOf(target, root),
      drift: [],
      counts: { backupKeys: 0, currentKeys: 0, drift: 0, retired: retiredCount },
    }
  }
  if (!backup) {
    return {
      id: target.id,
      state: 'undetermined',
      reason:
        '备份目录里没有该目标的任何一份同目标备份 ⇒ 无对照面。不记为通过(写侧尚未按约定落过备份)。',
      currentPath: currentPathOf(target, root),
      drift: [],
      counts: {
        backupKeys: 0,
        currentKeys: parseEnvText(currentText).values.size,
        drift: 0,
        retired: retiredCount,
      },
    }
  }
  const backupParsed = parseEnvText(backupText)
  const currentParsed = parseEnvText(currentText)
  const drift = diffAgainstBackup({
    backupValues: backupParsed.values,
    currentValues: currentParsed.values,
    retired: RETIRED_KEYS[target.id] || [],
  })
  return {
    id: target.id,
    state: drift.length ? 'drift' : 'clean',
    reason: drift.length
      ? `备份中值非空而现值为空/缺失的键 ${drift.length} 个`
      : '备份中每个非空键在现文件里仍非空',
    currentPath: currentPathOf(target, root),
    backup: { name: backup.name, mtimeMs: backup.mtimeMs },
    drift,
    counts: {
      backupKeys: backupParsed.values.size,
      currentKeys: currentParsed.values.size,
      backupDuplicates: backupParsed.duplicates,
      currentDuplicates: currentParsed.duplicates,
      drift: drift.length,
      retired: retiredCount,
    },
  }
}

/**
 * 真 IO 编排:逐目标读盘(只读)→ judgeTarget → 聚合。fsImpl 是取证注入缝
 * (自检走 mkScratch 的真临时盘 + 默认实现,不造 mock)。
 */
export function analyze({
  root = STATE_ROOT,
  targets = MANAGED_TARGETS,
  fsImpl = { existsSync, readFileSync },
} = {}) {
  const dir = backupDirOf(root)
  const verdicts = []
  for (const target of targets) {
    const path = join(root, target.rel)
    let exists = false
    try {
      exists = fsImpl.existsSync(path)
    } catch (e) {
      exists = false
      verdicts.push(undetermined(target, path, `现文件存在性问不到(${String((e && e.code) || e)})`))
      continue
    }
    let currentText = ''
    if (exists) {
      try {
        currentText = fsImpl.readFileSync(path, 'utf8')
      } catch (e) {
        verdicts.push(
          undetermined(target, path, `现文件存在但读不到(${String((e && e.code) || e)})`),
        )
        continue
      }
    }
    const backup = pickLatestBackup(dir, target.backupPatterns)
    let backupText = null
    if (backup) {
      try {
        backupText = fsImpl.readFileSync(backup.path, 'utf8')
      } catch (e) {
        verdicts.push(
          undetermined(
            target,
            path,
            `所用备份读不到(${String((e && e.code) || e)}):${backup.name}`,
          ),
        )
        continue
      }
    }
    verdicts.push(
      judgeTarget(target, { root, currentText, currentExists: exists, backup, backupText }),
    )
  }
  const agg = aggregate(verdicts)
  return {
    ...agg,
    verdicts,
    backupDir: dir,
    face: '磁盘运行态(本机实况;非 HEAD/索引面 —— .env 与备份均不入库)',
  }
}

function undetermined(target, path, reason) {
  return {
    id: target.id,
    state: 'undetermined',
    reason: `${reason} ⇒ 无法判定,不记为通过`,
    currentPath: path,
    drift: [],
    counts: { backupKeys: 0, currentKeys: 0, drift: 0, retired: 0 },
  }
}

/** 聚合(纯函数):未判定与漂移**分开**计数,谁都不许顶掉谁;红优先于未判定。 */
export function aggregate(verdicts) {
  const counts = {
    targets: verdicts.length,
    clean: 0,
    drift: 0,
    undetermined: 0,
    registeredOnly: 0,
    driftKeys: 0,
  }
  for (const v of verdicts) {
    if (v.state === 'clean') counts.clean += 1
    else if (v.state === 'drift') {
      counts.drift += 1
      counts.driftKeys += (v.drift || []).length
    } else if (v.state === 'undetermined') counts.undetermined += 1
    else if (v.state === 'registered-only') counts.registeredOnly += 1
    else counts.undetermined += 1 // 未知状态一律归"未判定",绝不静默算通过
  }
  const exit = counts.drift > 0 ? 1 : counts.undetermined > 0 ? 2 : 0
  return { exit, counts }
}

/** 非 verbose 档把长度整字段抹掉(默认输出连"某个键的值有多长"都不给)。 */
export function stripLens(out) {
  return {
    ...out,
    verdicts: out.verdicts.map((v) => ({
      ...v,
      drift: (v.drift || []).map(({ key, kind }) => ({ key, kind })),
    })),
  }
}

/** 人读输出(默认不含任何值,也不含长度;--verbose 才追加长度)。 */
export function render(out, { verbose = false } = {}) {
  const lines = []
  lines.push(`判定面:${out.face}`)
  lines.push(`备份目录:${out.backupDir}`)
  for (const v of out.verdicts) {
    if (v.state === 'registered-only') {
      lines.push(`⏸  ${v.id} —— 登记不判(原因:${v.reason})`)
      continue
    }
    if (v.state === 'undetermined') {
      lines.push(`❓ ${v.id} —— 未判定:${v.reason}`)
      lines.push(`    现文件:${v.currentPath}`)
      continue
    }
    const tag = v.state === 'drift' ? '❌' : '✅'
    const b = v.backup ? ` 对照=${v.backup.name}@${new Date(v.backup.mtimeMs).toISOString()}` : ''
    lines.push(
      `${tag} ${v.id} —— ${v.state === 'drift' ? `漂移 ${v.drift.length} 个键` : '无漂移'}(备份键 ${v.counts.backupKeys} / 现键 ${v.counts.currentKeys})${b}`,
    )
    if (v.counts.backupDuplicates || v.counts.currentDuplicates) {
      lines.push(
        `    ℹ 同名重复键:备份 ${v.counts.backupDuplicates || 0} / 现文件 ${v.counts.currentDuplicates || 0}(解析按"后出现的覆盖前面的",与 dotenv 同形,只报数不判红)`,
      )
    }
    if (v.counts.retired) lines.push(`    ℹ 已登记废弃键 ${v.counts.retired} 个(不参与 E2 计数)`)
    for (const d of v.drift) {
      const len = verbose ? ` (备份长度 ${d.backupLen})` : ''
      lines.push(`    · ${d.key} —— ${d.kind === 'missing' ? '整键缺失' : '值为空'}${len}`)
    }
  }
  const c = out.counts
  lines.push(
    `合计:目标 ${c.targets} | 绿 ${c.clean} | 漂移 ${c.drift}(键 ${c.driftKeys})| 未判定 ${c.undetermined} | 登记不判 ${c.registeredOnly}`,
  )
  return lines.join('\n')
}

/**
 * 装车证明的**判据本体**(为什么住在被审工具自己这里而不是测试里:§22c 禁止测试再抄一份实现,
 * 抄了就两套真相 —— 判据漂了测试跟着漂绿)。它只回答一句话:
 * "守护有没有在 `!CHECK_ONLY` 分支里调我,并且判红时走 notifyGuardRed"。
 * 入参是纯文本 ⇒ 真仓现读与"摘线变异构造面"跑的是同一条判据,这正是有牙证明需要的形状。
 */
export function verifyGuardianWiring(sourceText) {
  const src = String(sourceText ?? '')
  const checks = {
    referencesTool: /check-env-drift\.mjs/.test(src),
    hookedInTick: /if\s*\(!CHECK_ONLY\)\s*auditEnvDrift\s*\(\s*\)/.test(src),
    asksReadOnlyFace: /--check/.test(src) && /--json/.test(src),
    // 到人面的形状:默认派发出口必须是守护那封唯一邮件 `notifyGuardRed`,且真有以 `.env` 起头的
    // alert 身份经由它发出。只看 `notifyGuardRed(` 字面量已经不够 —— 这一层把派发做成了可注入
    // 形参(与同文件 checkConvergeAlignStall 同形,为的是离线取证不真发信),所以判据要同时认
    // "默认值指向唯一出口"与"调用点用的是那个形参"。
    alertsOnRed: /notify\s*=\s*notifyGuardRed/.test(src) && /notify\(\s*['"`]\.env/.test(src),
    hidesConsoleWindow: /windowsHide:\s*true/.test(src),
    boundsTimeout: /timeout:\s*\d+/.test(src),
  }
  const wired = Object.values(checks).every(Boolean)
  return { wired, checks }
}

// ─── 自检(§26:临时夹具唯一落点 = scripts/lib/scratch-dir.mjs;禁 os.tmpdir / 裸 mkdtempSync)──
export function selfTest() {
  const cases = []
  const assert = (name, cond, detail = '') => cases.push({ name, ok: !!cond, detail })
  const api = MANAGED_TARGETS[0]
  const rootTarget = MANAGED_TARGETS[1]
  const aiTarget = MANAGED_TARGETS[2]

  /** 造一份假仓库:返回 root,调用方负责 rmScratch */
  const mkRepo = (files) => {
    const root = mkScratch('env-drift-')
    for (const [rel, text] of Object.entries(files)) {
      const p = join(root, rel)
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, text, 'utf8')
    }
    return root
  }
  const setMtimes = (root, pairs) => {
    for (const [rel, epochSec] of pairs) utimesSync(join(root, rel), epochSec, epochSec)
  }

  // ①/② 成对:备份非空而现值空 ⇒ 必报;现值非空 ⇒ 不得报。mtime 显式定值,不靠写入顺序。
  const b1 = join('.ihui-agent', 'env-backup', 'api.env.before-unit.1000')
  const b0 = join('.ihui-agent', 'env-backup', 'api.env.before-unit.900')
  const r1 = mkRepo({
    [b1]: 'SMTP_HOST=smtp.example.test\nSMTP_PASS=older-but-nonempty\nRESEND_API_KEY=nonempty\nDATABASE_URL=postgres-look-alike\nJWT_SECRET=nonempty\n',
    [b0]: 'SMTP_PASS=this-is-the-older-backup\n',
    [join('apps', 'api', '.env')]:
      'SMTP_HOST=smtp.example.test\nSMTP_PASS=\nDATABASE_URL=postgres-look-alike\nJWT_SECRET=nonempty\n',
    [join('apps', 'ai-service', '.env')]: 'X=1\n',
  })
  try {
    setMtimes(r1, [
      [b1, 1700],
      [b0, 1600],
    ])
    const out = analyze({ root: r1 })
    const v = out.verdicts.find((x) => x.id === api.id)
    assert(
      '①备份非空而现值为空 ⇒ 必报(键名点名)',
      v.state === 'drift' && v.drift.some((d) => d.key === 'SMTP_PASS' && d.kind === 'empty'),
      JSON.stringify(v.drift),
    )
    assert(
      '①整键缺失同样必报',
      v.drift.some((d) => d.key === 'RESEND_API_KEY' && d.kind === 'missing'),
    )
    assert('①exit 1(漂移优先)', out.exit === 1, String(out.exit))
    assert(
      '②现值非空的键不得报',
      !v.drift.some(
        (d) => d.key === 'SMTP_HOST' || d.key === 'DATABASE_URL' || d.key === 'JWT_SECRET',
      ),
    )
    assert(
      '①所用对照 = mtime 最新那份(旧备份不得当基准)',
      (v.backup || {}).name === 'api.env.before-unit.1000',
      JSON.stringify(v.backup),
    )
    assert(
      '②默认输出不含任何值内容',
      !/older-but-nonempty|this-is-the-older-backup|postgres-look-alike|nonempty/.test(render(out)),
    )
    assert('②默认 JSON 连长度字段都不给', !JSON.stringify(stripLens(out)).includes('backupLen'))
    assert(
      '②verbose 才给长度,且仍不含值',
      /备份长度 \d+/.test(render(out, { verbose: true })) &&
        !/nonempty/.test(render(out, { verbose: true })),
    )

    // 同 mtime 的 tie-break:它**只服务确定性**(mtime 才是新旧的判据,名字里那段时间戳与字典序
    // 并不同形 —— `before-<事由>.<ts>` 的 ts 在最后一段),而选定结果必须在输出里点名所用备份,
    // 否则"读错基准"会表现为一堆无法解释的漂移。
    const root2 = mkRepo({
      [join('.ihui-agent', 'env-backup', 'api.env.before-unit.aaa')]: 'AAA_ONLY=from-aaa\n',
      [join('.ihui-agent', 'env-backup', 'api.env.before-unit.zzz')]: 'ZZZ_ONLY=from-zzz\n',
      [join('apps', 'api', '.env')]: 'X=1\n',
    })
    try {
      setMtimes(root2, [
        [join('.ihui-agent', 'env-backup', 'api.env.before-unit.aaa'), 1500],
        [join('.ihui-agent', 'env-backup', 'api.env.before-unit.zzz'), 1500],
      ])
      const v2 = analyze({ root: root2, targets: [api] }).verdicts[0]
      assert(
        '同 mtime ⇒ 取名字大者(确定性,不是因为"它更新")',
        v2.backup.name === 'api.env.before-unit.zzz',
        v2.backup.name,
      )
      assert(
        '所用基准只算一份:另一份独有的键不得混进漂移',
        v2.drift.length === 1 && v2.drift[0].key === 'ZZZ_ONLY',
        JSON.stringify(v2.drift),
      )
      assert(
        '重跑同结果(基准选定不随 readdir 顺序漂)',
        analyze({ root: root2, targets: [api] }).verdicts[0].backup.name === v2.backup.name,
      )
    } finally {
      rmScratch(root2)
    }

    // ③ 无备份可比 ⇒ 未判定(不得记为通过)
    const root3 = mkRepo({ [join('apps', 'api', '.env')]: 'A=1\n' })
    try {
      const out3 = analyze({ root: root3, targets: [api] })
      assert(
        '③无备份可比 ⇒ 未判定(不是通过)',
        out3.verdicts[0].state === 'undetermined' && out3.exit === 2,
        `${out3.verdicts[0].state}/${out3.exit}`,
      )
      assert('③未判定必须带原因文本', out3.verdicts[0].reason.length > 8)
    } finally {
      rmScratch(root3)
    }

    // ④ 现文件整个不见 ⇒ 也是未判定(不冒充漂移,更不绿)
    const root4 = mkRepo({ [join('.ihui-agent', 'env-backup', 'api.env.before-x.5')]: 'A=1\n' })
    try {
      const out4 = analyze({ root: root4, targets: [api] })
      assert(
        '④现文件缺失 ⇒ 未判定且 exit 2',
        out4.verdicts[0].state === 'undetermined' && out4.exit === 2,
        `${out4.verdicts[0].state}/${out4.exit}`,
      )
    } finally {
      rmScratch(root4)
    }

    // ⑤ 登记不判的目标永不影响退出码
    const out5 = analyze({ root: r1, targets: [aiTarget] })
    assert(
      '⑤register-only 不改退出码',
      out5.exit === 0 && out5.verdicts[0].state === 'registered-only',
      `${out5.exit}/${out5.verdicts[0].state}`,
    )

    // ⑥ 红优先于未判定(构造面,不依赖仓库瞬时状态)
    const mixed = aggregate([
      {
        id: 'a',
        state: 'drift',
        drift: [{ key: 'K', kind: 'empty', backupLen: 1 }],
        reason: '',
        currentPath: '',
        counts: {},
      },
      {
        id: 'b',
        state: 'undetermined',
        drift: [],
        reason: 'no backup',
        currentPath: '',
        counts: {},
      },
    ])
    assert(
      '⑥红优先于未判定(exit 1 不被 2 顶掉)',
      mixed.exit === 1 && mixed.counts.drift === 1 && mixed.counts.undetermined === 1,
      JSON.stringify(mixed),
    )

    // ⑦ 未知状态不得静默算通过
    const weird = aggregate([
      { id: 'x', state: 'what', drift: [], reason: '', currentPath: '', counts: {} },
    ])
    assert(
      '⑦未知状态归未判定(绝不记绿)',
      weird.exit === 2 && weird.counts.undetermined === 1,
      JSON.stringify(weird),
    )

    // ⑧ JSON 面必须可 parse,且三态与退出码同形
    const json = JSON.parse(JSON.stringify(stripLens(out)))
    assert(
      '⑧--json 可 JSON.parse 且 counts 在位',
      json.counts && json.counts.drift === 1 && json.exit === 1,
    )

    // ⑨ 废弃清单:默认空;非空时只让"整键缺失"这一类消音,值为空不得被遮
    assert(
      '⑨废弃清单默认全空(现表为空 = 零豁免)',
      Object.values(RETIRED_KEYS).every((a) => a.length === 0),
    )
    const d9 = diffAgainstBackup({
      backupValues: parseEnvText('GONE=1\nBLANK_ME=2\n').values,
      currentValues: parseEnvText('GONE=\nBLANK_ME=\n').values,
      retired: ['GONE'],
    })
    assert('⑨废弃键消音,其余照报', d9.length === 1 && d9[0].key === 'BLANK_ME', JSON.stringify(d9))

    // ⑩ 根 .env 与 api 各走各的对照面(前缀归属正确)
    const root5 = mkRepo({
      [join('.ihui-agent', 'env-backup', 'root.env.before-x.10')]: 'ROOT_ONLY=1\n',
      [join('.ihui-agent', 'env-backup', 'api.env.before-x.9')]: 'API_ONLY=1\n',
      [join('.ihui-agent', 'env-backup', 'env-backup-8.env')]: 'BACKFILL_ONLY=1\n',
      [join('apps', 'api', '.env')]: 'X=1\n',
      '.env': 'X=1\n',
    })
    try {
      setMtimes(root5, [
        [join('.ihui-agent', 'env-backup', 'root.env.before-x.10'), 1300],
        [join('.ihui-agent', 'env-backup', 'api.env.before-x.9'), 1200],
        [join('.ihui-agent', 'env-backup', 'env-backup-8.env'), 1100],
      ])
      const outA = analyze({ root: root5, targets: [api] })
      const outR = analyze({ root: root5, targets: [rootTarget] })
      assert(
        '⑩api 只吃 api.env.* 前缀',
        outA.verdicts[0].backup.name === 'api.env.before-x.9' &&
          outA.verdicts[0].drift.some((d) => d.key === 'API_ONLY'),
        JSON.stringify(outA.verdicts[0].drift),
      )
      assert(
        '⑩根 .env 吃 root.env.* 与 env-backup-*(取最新)',
        outR.verdicts[0].backup.name === 'root.env.before-x.10' &&
          outR.verdicts[0].drift.some((d) => d.key === 'ROOT_ONLY'),
        JSON.stringify(outR.verdicts[0].drift),
      )
    } finally {
      rmScratch(root5)
    }

    // ⑪ 判据不靠豁免也能命中(夹具未登记任何退役键)
    assert(
      '⑪同名判据在两个目标上一致(一份实现)',
      v.drift.every((d) => ['empty', 'missing'].includes(d.kind)),
    )

    // ⑫ 装车证明判据本身有牙:合规形态判绿,摘线构造面必须判"未接线"
    //    夹具形状逐字对齐 git-guardian 的落地形态(派发是注入形参 + 默认值指向唯一出口)
    const good = [
      'const CHECK_ONLY = process.argv.includes("--check")',
      'function auditEnvDrift(opts = {}) {',
      '  const { notify = notifyGuardRed, run = runEnvDriftProbe } = opts',
      "  execFileSync(process.execPath, [script, '--check', '--json'], { windowsHide: true, timeout: 60000 })",
      "  notify('.env 键值漂移(有键从非空变成空/整键缺失)', detail)",
      '}',
      'if (!CHECK_ONLY) auditEnvDrift()',
      '/* check-env-drift.mjs */',
    ].join('\n')
    assert(
      '⑫装车判据:合规形态判绿',
      verifyGuardianWiring(good).wired === true,
      JSON.stringify(verifyGuardianWiring(good).checks),
    )
    assert(
      '⑫装车判据:摘线形态必红',
      verifyGuardianWiring(good.replace('if (!CHECK_ONLY) auditEnvDrift()', '')).wired === false,
    )
    assert(
      '⑫装车判据:挂错分支(CHECK_ONLY 侧)必红',
      verifyGuardianWiring(good.replace('if (!CHECK_ONLY)', 'if (CHECK_ONLY)')).wired === false,
    )
    assert(
      '⑫装车判据:只判不发信必红',
      verifyGuardianWiring(
        good.replace("notify('.env 键值漂移(有键从非空变成空/整键缺失)', detail)", "log('看日志')"),
      ).wired === false,
    )
    assert(
      '⑫装车判据:派发出口被换成别的(绕开唯一邮件层)必红',
      verifyGuardianWiring(good.replace('notify = notifyGuardRed', 'notify = console.log'))
        .wired === false,
    )
    assert(
      '⑫装车判据:漏 windowsHide 必红',
      verifyGuardianWiring(good.replace('windowsHide: true, ', '')).wired === false,
    )
    assert(
      '⑫装车判据:漏 timeout 必红',
      verifyGuardianWiring(good.replace('timeout: 60000', 'maxBuffer: 1')).wired === false,
    )
    assert(
      '⑫装车判据:不再调用这把尺子必红',
      verifyGuardianWiring(good.replace('check-env-drift.mjs', 'other-tool.mjs')).wired === false,
    )
  } finally {
    rmScratch(r1)
  }

  const failed = cases.filter((c) => !c.ok)
  for (const c of cases)
    console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ''}`)
  console.log(
    `\n--self-test:${failed.length ? '有失败' : '全部通过'} 共 ${cases.length} 条,失败 ${failed.length} 条`,
  )
  return failed.length ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      '用法: node scripts/check-env-drift.mjs [--check] [--json] [--verbose] [--self-test] [--root <dir>]',
    )
    console.log('判定面:磁盘运行态;只读,不写任何文件;输出只含键名,不含值。')
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  const rootIdx = argv.indexOf('--root')
  const root = rootIdx >= 0 ? resolve(argv[rootIdx + 1] || '.') : STATE_ROOT
  let out
  try {
    out = analyze({ root })
  } catch (e) {
    // 整轮读盘异常一律走"无法判定"(exit 2):不冒红,也不记绿
    console.error(`❌ 无法判定:整轮巡检异常(exit 2):${String((e && e.message) || e)}`)
    return 2
  }
  const verbose = argv.includes('--verbose')
  if (argv.includes('--json')) {
    console.log(JSON.stringify(verbose ? out : stripLens(out)))
    return out.exit
  }
  console.log(render(out, { verbose }))
  return out.exit
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(
      `❌ 脚本自身异常(exit 2,不冒充判据结论):${String((e && e.message) || e)}\n${e?.stack ?? ''}`,
    )
    process.exit(2)
  }
}

// §22c:测试直接 import 判据本体,禁止在测试里再抄一份实现。
export const __test__ = {
  MANAGED_TARGETS,
  RETIRED_KEYS,
  parseEnvText,
  isBlankValue,
  pickLatestBackup,
  diffAgainstBackup,
  judgeTarget,
  aggregate,
  analyze,
  render,
  stripLens,
  backupDirOf,
  verifyGuardianWiring,
  selfTest,
  BACKUP_REL,
  STATE_ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
