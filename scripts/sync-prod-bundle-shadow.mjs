#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prod-bundle 运行副本同步器(门 104 的**配套修复通道**,2026-11-04 立)
 *
 * 门 104(`scripts/check-prod-bundle-shadow.mjs`)只能**发现**漂移,不能修:它接在提交链上,
 * 必须保持只读。实测缺口(a279d8986e / bcdec109c9 / e9ff3fa881 三次提交更新了入库源,
 * 运行副本停在旧字节,门判红后只能人工逐字节覆盖)。本工具把那次人工动作工具化:
 *
 *   · 登记表的唯一事实源 = 门 104 export 的 `PAIRS`(本文件**不**再抄一份清单);
 *   · 默认只读(dry-run),`--apply` 才写盘,写前备份、写后逐字节复验;
 *   · 「运行副本有入库源没有的内容」= 丢内容风险,**拒绝自动覆盖**并 exit 2;
 *   · 未登记的运行副本一律不动(本工具只遍历 PAIRS,不枚举目录);
 *   · 退出码三态:0 = 全等值/no-op、1 = 存在待同步(仅 dry-run)、2 = 拒绝/无法判定。
 *
 * ⚠ 服务影响:`deploy/prod-bundle/` 里的脚本在服务**启动时**读取,`--apply` 写完后
 * 要等下一次服务重启才生效;本工具**不做**重启、不部署(见 docs/prod-bundle-shadow-sync.md)。
 *
 * 用法:
 *   node scripts/sync-prod-bundle-shadow.mjs            # dry-run(只读,列出将写哪些文件)
 *   node scripts/sync-prod-bundle-shadow.mjs --apply    # 备份 + 写盘 + 逐字节复验
 *   node scripts/sync-prod-bundle-shadow.mjs --self-test# 临时夹具自检(不碰真实 deploy/prod-bundle/)
 *   node scripts/sync-prod-bundle-shadow.mjs --apply --allow-drop-runner-only <runner 相对路径>
 *        # 人工放行:仅对 ALLOW_DROP_RUNNER_ONLY 里已登记"旧行可丢"理由的文件生效,可重复传入;
 *        # 不传该参数时语义完全不变(运行副本独有内容仍然整批拒绝)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { __test__ as GATE } from './check-prod-bundle-shadow.mjs'
import { gitBinary } from './lib/face-reader.mjs'
import { mkScratch } from './lib/scratch-dir.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT = gitBinary()

/**
 * 备份落点:**被忽略目录**下的备份子目录(`.ihui-agent/*` 在 .gitignore:209 在册)。
 * 刻意不放进 `deploy/prod-bundle/` 自己 —— 门 104 的 E1 会递归枚举该目录,备份里同扩展名
 * 的脚本副本会被读成"未登记运行副本"(只报数,但把账面搅浑);`.ihui-agent/` 不在 E1 射程内。
 */
export const BACKUP_ROOT_REL = '.ihui-agent/backups/prod-bundle-shadow'

/**
 * 人工放行登记表 —— `--allow-drop-runner-only` 只接受**登记在此**的 runner。
 * 每条必须写清理由:为什么运行副本里的独有行可以丢。没有这条理由,放行就等于给判据开后门。
 *
 * 现登记(2026-11-06,唯一一条):
 *   · deploy/prod-bundle/deploy.sh —— 运行副本独有 5 行是 2026-08-17 的旧硬编码 APK 下载配置
 *     (`NEXT_PUBLIC_DOWNLOAD_APK_URL=/apk/ihui-ai-latest.apk`、VERSION=1.0.0、
 *     RELEASE_DATE=2026-08-17,及两行注释/成功提示)。入库源已改为单源:地址从
 *     `scripts/data/mobile-download-leg.json` 读出并替换 `__MOBILE_DOWNLOAD_URL__`,
 *     读不出即 exit 1 拒绝写空地址。旧值已被入库源有意取代,不含运行副本独有信息。
 */
export const ALLOW_DROP_RUNNER_ONLY = new Map([
  ['deploy/prod-bundle/deploy.sh', '入库源已取代:2026-08-17 旧硬编码 APK 下载配置(5 行)'],
])

/**
 * 解析 CLI 白名单参数。`--allow-drop-runner-only <rel>` 可重复;也接受 `=<rel>` 形式。
 * 缺值即抛 —— 不把"参数写坏了"吞成"没传"。
 */
export function parseAllowArgs(argv) {
  const out = []
  const PREFIX = '--allow-drop-runner-only='
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--allow-drop-runner-only') {
      const v = argv[i + 1]
      if (typeof v !== 'string' || v === '' || v.startsWith('--')) {
        throw new Error('--allow-drop-runner-only 缺少 <runner 相对路径> 参数')
      }
      out.push(v)
      i += 1
    } else if (a.startsWith(PREFIX)) {
      const v = a.slice(PREFIX.length)
      if (v === '') throw new Error('--allow-drop-runner-only= 后缺少 <runner 相对路径>')
      out.push(v)
    }
  }
  return out
}

/** 未登记路径一律拒绝(抛错 ⇒ 主流程 exit 2),不允许"传了就当放行"。 */
export function assertAllowRegistered(paths) {
  for (const p of paths) {
    if (!ALLOW_DROP_RUNNER_ONLY.has(p)) {
      throw new Error(
        `--allow-drop-runner-only 拒绝:${p} 不在人工放行登记表(ALLOW_DROP_RUNNER_ONLY)中 —— ` +
          '先在代码里写明"为什么可以丢"的理由,再传入',
      )
    }
  }
  return new Set(paths)
}

const sha1 = GATE.sha1

/** 时间戳目录名(本地时间,给人看的备份序号;ISO 形态在本仓台账里另有用途,这里不复用)。 */
export function timestampOf(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  )
}

/**
 * a 相对 b 的**多重集**差,返回 a 里有而 b 里没有的行(重复行按份数算)。
 * 与门 104 的 `multisetCountDiff` 同一口径:它只数份数,这里要逐行报名(拒绝覆盖时的证据)。
 */
export function linesOnlyIn(aLines, bLines) {
  const pool = new Map()
  for (const l of bLines) pool.set(l, (pool.get(l) ?? 0) + 1)
  const out = []
  for (const l of aLines) {
    const c = pool.get(l) ?? 0
    if (c > 0) pool.set(l, c - 1)
    else out.push(l)
  }
  return out
}

/**
 * 逐对判定(纯读,不写盘)。返回 { items, counts, undetermined }。
 *
 * status 五态:
 *   equal         两侧逐字节相同 ⇒ 无需动作
 *   pending       运行副本是入库源的**子集**(单向滞后)⇒ 可用入库源整份覆盖
 *                 (allowDropRunnerOnly 命中时:运行副本独有行已被人工判定为旧值 ⇒ 同样按 pending 处理)
 *   refuse        运行副本存在入库源没有的行 ⇒ 丢内容风险,**拒绝覆盖**
 *   runner-absent 运行副本不在本机(非部署机 / CI)⇒ no-op,不是错误
 *   undetermined  入库源缺失或读取失败 ⇒ 无法判定
 */
export function planSync(root, pairs, { allowDropRunnerOnly = new Set() } = {}) {
  const items = []
  let undetermined = 0
  for (const pair of pairs) {
    const tAbs = join(root, pair.tracked)
    const rAbs = join(root, pair.runner)
    if (!existsSync(tAbs)) {
      undetermined += 1
      items.push({ pair, status: 'undetermined', reason: `入库源 ${pair.tracked} 不存在` })
      continue
    }
    if (!existsSync(rAbs)) {
      items.push({ pair, status: 'runner-absent' })
      continue
    }
    let tb
    let rb
    try {
      tb = readFileSync(tAbs)
      rb = readFileSync(rAbs)
    } catch (e) {
      undetermined += 1
      items.push({ pair, status: 'undetermined', reason: `读取失败:${e.message}` })
      continue
    }
    if (sha1(tb) === sha1(rb)) {
      items.push({ pair, status: 'equal', bytes: tb.length })
      continue
    }
    const tl = tb.toString('utf8').split('\n')
    const rl = rb.toString('utf8').split('\n')
    const extraInRunner = linesOnlyIn(rl, tl)
    const extraInSource = linesOnlyIn(tl, rl)
    if (extraInRunner.length > 0) {
      // 人工放行:仅当该 runner 已登记(CLI 入口已校验)且本对被显式点名时,才把独有行
      // 当作"入库源已取代的旧值"放下;其余一切判据不变(同批其它对仍按 refuse 拒批)。
      if (allowDropRunnerOnly.has(pair.runner)) {
        items.push({
          pair,
          status: 'pending',
          onlySource: extraInSource.length,
          sourceLines: extraInSource,
          onlyRunner: extraInRunner.length,
          droppedLines: extraInRunner,
          allowDropped: true,
          bytes: tb.length,
        })
        continue
      }
      items.push({
        pair,
        status: 'refuse',
        onlyRunner: extraInRunner.length,
        onlySource: extraInSource.length,
        extraLines: extraInRunner,
      })
      continue
    }
    items.push({
      pair,
      status: 'pending',
      onlySource: extraInSource.length,
      sourceLines: extraInSource,
      bytes: tb.length,
    })
  }
  const counts = { equal: 0, pending: 0, refuse: 0, runnerAbsent: 0, undetermined: 0 }
  for (const it of items) {
    if (it.status === 'equal') counts.equal += 1
    else if (it.status === 'pending') counts.pending += 1
    else if (it.status === 'refuse') counts.refuse += 1
    else if (it.status === 'runner-absent') counts.runnerAbsent += 1
  }
  counts.undetermined = undetermined
  return { items, counts, undetermined }
}

/**
 * 退出码聚合(纯函数):2 优先(拒绝/未判定既不记绿也不冒红),其次 1(有待同步),最后 0。
 * 「runner-absent」只算 no-op 不计红 —— 与门 104 的机器态分流同一条理由。
 */
export function decidePlan(plan) {
  if (plan.undetermined > 0) return { code: 2, kind: 'undetermined' }
  if (plan.items.some((it) => it.status === 'refuse')) return { code: 2, kind: 'refuse' }
  if (plan.items.some((it) => it.status === 'pending')) return { code: 1, kind: 'pending' }
  return { code: 0, kind: 'clean' }
}

/** 运行副本在 BUNDLE_REL 内的相对路径(备份按这个层级落,便于人工回填对照)。 */
function relFromBundle(runner) {
  const prefix = `${GATE.BUNDLE_REL}/`
  return runner.startsWith(prefix) ? runner.slice(prefix.length) : runner
}

/**
 * 备份落点是否**真的**被 git 忽略 —— 三态,取不到按 refuse 处理(fail-closed)。
 * 备份写进跟踪面等于把运行副本的内容漏进版本树,这是本工具唯一会新增写盘路径的判据。
 */
export function assertBackupIgnored(root, backupRootRel = BACKUP_ROOT_REL) {
  const probe = `${backupRootRel}/.probe`
  const state = GATE.isIgnored(root, probe)
  if (state !== true) {
    throw new Error(
      `备份目录未被 git 忽略(或无法判定 check-ignore):${probe} —— 拒绝把运行副本写进跟踪面`,
    )
  }
  return true
}

/**
 * 执行同步。**整批 fail-closed**:任一对 refuse/undetermined 时一个文件都不写
 * (部分同步会让"跑了一半"的现场比原状更难判)。
 * 逐文件顺序:先备份(旧字节)→ 覆盖(入库源字节)→ 立即逐字节复验 → 收尾整批复验。
 */
export function applySync(root, pairs, { backupRootRel = BACKUP_ROOT_REL, now = new Date(), allowDropRunnerOnly = new Set() } = {}) {
  const before = planSync(root, pairs, { allowDropRunnerOnly })
  const verdict = decidePlan(before)
  if (verdict.code === 2) {
    return { before, after: null, verdict, refused: true, wrote: [], backups: [] }
  }
  const pending = before.items.filter((it) => it.status === 'pending')
  if (pending.length === 0) {
    return { before, after: before, verdict: { code: 0, kind: 'clean' }, refused: false, wrote: [], backups: [] }
  }
  assertBackupIgnored(root, backupRootRel)
  const stamp = timestampOf(now)
  const wrote = []
  const backups = []
  for (const it of pending) {
    const { pair } = it
    const tAbs = join(root, pair.tracked)
    const rAbs = join(root, pair.runner)
    const backupAbs = join(root, backupRootRel, stamp, ...relFromBundle(pair.runner).split('/'))
    mkdirSync(dirname(backupAbs), { recursive: true })
    writeFileSync(backupAbs, readFileSync(rAbs))
    backups.push(backupAbs)
    writeFileSync(rAbs, readFileSync(tAbs))
    const verified = sha1(readFileSync(tAbs)) === sha1(readFileSync(rAbs))
    wrote.push({ pair, backupAbs, verified })
  }
  const after = planSync(root, pairs, { allowDropRunnerOnly })
  return { before, after, verdict: decidePlan(after), refused: false, wrote, backups, stamp }
}

function printPlan(plan, applyMode, allowDropRunnerOnly = new Set()) {
  const allowNote =
    allowDropRunnerOnly.size > 0 ? ` · 人工放行=${[...allowDropRunnerOnly].join(',')}` : ''
  console.log(
    `[prod-bundle-sync] 登记对 ${plan.items.length} 个 · 模式=${applyMode ? '--apply(写盘)' : 'dry-run(只读)'}${allowNote}`,
  )
  const CAP = 20
  for (const it of plan.items) {
    const p = it.pair
    if (it.status === 'equal') {
      console.log(`  ✅ 已等值 ${p.runner} == ${p.tracked}(${it.bytes} 字节)`)
    } else if (it.status === 'pending') {
      const tail = it.allowDropped
        ? `;⚠ 白名单放行:运行副本独有 ${it.onlyRunner} 行将被丢弃(理由见登记表)`
        : ';运行副本无独有内容'
      console.log(`  ⏳ 待同步 ${p.runner} ← ${p.tracked}(入库源独有 ${it.onlySource} 行${tail})`)
      if (it.allowDropped) {
        for (const l of it.droppedLines.slice(0, CAP)) console.log(`       - ${l}`)
        if (it.droppedLines.length > CAP) {
          console.log(`       … 另有 ${it.droppedLines.length - CAP} 行被丢弃内容未列出(逐条见备份)`)
        }
      }
    } else if (it.status === 'refuse') {
      console.log(
        `  ⛔ 拒绝覆盖 ${p.runner} —— 运行副本独有 ${it.onlyRunner} 行、入库源独有 ${it.onlySource} 行(丢内容风险)`,
      )
      for (const l of it.extraLines.slice(0, CAP)) console.log(`       + ${l}`)
      if (it.extraLines.length > CAP) {
        console.log(`       … 另有 ${it.extraLines.length - CAP} 行独有内容未列出(逐条见 diff)`)
      }
    } else if (it.status === 'runner-absent') {
      console.log(`  ⚠ 运行副本不在本机 ${p.runner} —— no-op(非部署机 / CI / 干净检出)`)
    } else {
      console.log(`  ⚠ 无法判定 ${p.tracked} ↔ ${p.runner}:${it.reason}`)
    }
  }
  const c = plan.counts
  console.log(
    `小结: 等值 ${c.equal} / 待同步 ${c.pending} / 拒绝 ${c.refuse} / 运行副本缺失 ${c.runnerAbsent} / 未判定 ${c.undetermined}`,
  )
}

function main() {
  if (process.argv.includes('--self-test')) {
    selfTest()
    return
  }
  const applyMode = process.argv.includes('--apply')
  let allowDropRunnerOnly
  try {
    allowDropRunnerOnly = assertAllowRegistered(parseAllowArgs(process.argv.slice(2)))
  } catch (e) {
    // 白名单参数写坏/未登记 ⇒ 直接 exit 2:不静默降级成"没传",也不冒充判据结论
    console.error(`❌ 参数拒绝:${e.message}`)
    process.exit(2)
  }
  const plan = planSync(REPO, GATE.PAIRS, { allowDropRunnerOnly })
  printPlan(plan, applyMode, allowDropRunnerOnly)
  const verdict = decidePlan(plan)

  if (verdict.code === 2) {
    console.log(
      verdict.kind === 'refuse'
        ? '❌ 拒绝:存在「运行副本有入库源没有的内容」—— 这是丢内容风险,不是同步能治的。' +
            '请人工核对上游来源,把该内容补进入库源后再重跑(本工具不覆盖这类文件)。'
        : '❌ 无法判定:入库源缺失或读取失败 —— 既不记绿也不冒充漂移红。',
    )
    process.exit(2)
  }
  if (verdict.code === 1) {
    const pend = plan.items.filter((it) => it.status === 'pending')
    if (applyMode) {
      const res = applySync(REPO, GATE.PAIRS, { allowDropRunnerOnly })
      if (res.refused) {
        console.log('❌ 写入前复核出现拒绝态 —— 一个文件都没有写,原因见上')
        process.exit(2)
      }
      console.log(`备份落点:${BACKUP_ROOT_REL}/${res.stamp}/(${res.backups.length} 个文件)`)
      for (const w of res.wrote) {
        const it = res.before.items.find((x) => x.pair === w.pair)
        const dropNote =
          it && it.allowDropped ? `;白名单放行丢弃运行副本独有 ${it.onlyRunner} 行(旧值已在备份)` : ''
        console.log(
          `  ${w.verified ? '✅' : '❌'} 已写 ${w.pair.runner} ← ${w.pair.tracked};` +
            `备份 ${BACKUP_ROOT_REL}/${res.stamp}/${relFromBundle(w.pair.runner)};` +
            `逐字节复验 ${w.verified ? '通过' : '不通过(现场已偏离,请人工介入)'}${dropNote}`,
        )
      }
      const after = res.verdict
      if (after.code === 0) {
        console.log('✅ 写后整批复验:全部登记对逐字节等值(服务重启后生效,本工具不重启)')
        process.exit(0)
      }
      console.log(`❌ 写后整批复验未通过(kind=${after.kind})—— 逐条原因见上`)
      process.exit(2)
    }
    console.log('ℹ 将写入以下文件(仅列名,尚未写盘):')
    for (const it of pend) console.log(`   · ${it.pair.runner} ← ${it.pair.tracked}`)
    console.log('   (确认后用 `node scripts/sync-prod-bundle-shadow.mjs --apply` 执行)')
    process.exit(1)
  }
  console.log('✅ 全部可判定的登记对均逐字节等值 —— no-op(dry-run 与 --apply 同结论)')
  process.exit(0)
}

// ── 自检:临时夹具覆盖 ①等值 ②单向滞后(可同步) ③运行副本独有(exit 2)────────
//    ④未登记文件(不动) ⑤备份确实生成。夹具经 §15b 唯一出口 mkScratch,
//    绝不碰真实 deploy/prod-bundle/。
function selfTest() {
  const root = mkScratch('prod-bundle-sync-selftest-')
  mkdirSync(join(root, 'deploy/win'), { recursive: true })
  mkdirSync(join(root, 'deploy/prod-bundle'), { recursive: true })
  writeFileSync(join(root, '.gitignore'), 'deploy/prod-bundle/\n.ihui-agent/\n')
  const g = (...a) =>
    execFileSync(GIT, ['-C', root, '-c', 'safe.directory=*', ...a], {
      stdio: 'ignore',
      timeout: 60_000,
      windowsHide: true,
    })
  try {
    g('init', '-q', '-b', 'main')
  } catch {}
  const T = 'deploy/win/x.ps1'
  const R = 'deploy/prod-bundle/x.ps1'
  const BASE = "Write-Host 'one'\nWrite-Host 'two'\n"
  writeFileSync(join(root, T), BASE)
  writeFileSync(join(root, R), BASE)
  g('add', '-f', '--', '.gitignore', T)
  g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init')

  let fails = 0
  const check = (name, cond) => {
    console.log(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) fails += 1
  }
  const pairs = [{ tracked: T, runner: R, why: 't' }]
  const unregistered = join(root, 'deploy/prod-bundle', 'unregistered.ps1')
  writeFileSync(unregistered, "Write-Host 'unregistered'\n")
  const unregisteredBytes = () => readFileSync(unregistered, 'utf8')

  // ① 等值
  const p1 = planSync(root, pairs)
  check('① 等值 ⇒ status=equal', p1.items[0].status === 'equal')
  check('① 等值 ⇒ exit 0', decidePlan(p1).code === 0)
  check('① 等值 ⇒ apply 是 no-op(零写入)', applySync(root, pairs).wrote.length === 0)

  // ② 单向滞后:运行副本少一行(入库源有、副本没有)⇒ 可同步
  writeFileSync(join(root, R), "Write-Host 'one'\n")
  const p2 = planSync(root, pairs)
  check('② 单向滞后 ⇒ status=pending', p2.items[0].status === 'pending' && p2.counts.pending === 1)
  check('② dry-run 退出码 = 1', decidePlan(p2).code === 1)
  const res2 = applySync(root, pairs)
  check('② --apply 写入 1 个文件', res2.wrote.length === 1 && res2.wrote[0].verified === true)
  check('② 写后逐字节复验等值 ⇒ exit 0', res2.verdict.code === 0)
  const p2b = planSync(root, pairs)
  check('② 写后重扫 ⇒ 全等值', p2b.items[0].status === 'equal')

  // ⑤ 备份确实生成(内容 = 覆盖前的旧字节)
  const backupAbs = res2.backups[0]
  check(
    '⑤ 备份文件生成于被忽略目录 + 内容为旧字节',
    Boolean(backupAbs) &&
      existsSync(backupAbs) &&
      backupAbs.startsWith(join(root, BACKUP_ROOT_REL)) &&
      readFileSync(backupAbs, 'utf8') === "Write-Host 'one'\n",
  )
  check('⑤ 备份目录名带时间戳', typeof res2.stamp === 'string' && /^\d{8}-\d{6}$/.test(res2.stamp))

  // ③ 运行副本独有内容 ⇒ 拒绝覆盖、exit 2、且一个字节都不写
  const withExtra = `${BASE}Write-Host 'runner-only'\n`
  writeFileSync(join(root, R), withExtra)
  const p3 = planSync(root, pairs)
  check('③ 运行副本独有 ⇒ status=refuse', p3.items[0].status === 'refuse' && p3.items[0].onlyRunner === 1)
  check('③ 拒绝态 ⇒ exit 2', decidePlan(p3).code === 2)
  const res3 = applySync(root, pairs)
  check(
    '③ --apply 拒绝写入(运行副本字节原样保留)',
    res3.refused === true &&
      res3.wrote.length === 0 &&
      readFileSync(join(root, R), 'utf8') === withExtra,
  )

  // ④ 未登记文件不受影响
  writeFileSync(join(root, R), "Write-Host 'one'\n")
  const res4 = applySync(root, pairs)
  check(
    '④ 未登记运行副本一个字节都没动',
    res4.wrote.length === 1 && unregisteredBytes() === "Write-Host 'unregistered'\n",
  )

  // 附带:运行副本不在本机 = no-op(0,不判红);入库源缺失 = 未判定(2)
  const absent = planSync(root, [{ tracked: T, runner: 'deploy/prod-bundle/nope.ps1', why: 't' }])
  check(
    '运行副本不在本机 ⇒ no-op、exit 0',
    absent.items[0].status === 'runner-absent' && decidePlan(absent).code === 0,
  )
  const noSrc = planSync(root, [{ tracked: 'deploy/win/nope.ps1', runner: R, why: 't' }])
  check(
    '入库源缺失 ⇒ 未判定、exit 2',
    noSrc.items[0].status === 'undetermined' && decidePlan(noSrc).code === 2,
  )

  // ── 人工放行白名单(⑥–⑩)────────────────────────────────────────────────
  //  ⑥ 默认语义不变:不传白名单 ⇒ refuse/exit 2/零写入
  //  ⑦ 传白名单(已登记路径)⇒ 仅该对转 pending,写入 1 个,备份保存被丢弃的旧行
  //  ⑧ 未登记路径 ⇒ 拒绝(不生效,不放行)
  //  ⑨ 已登记但该对不在 refuse 集(已等值)⇒ 白名单不改变任何判定
  //  ⑩ 白名单只影响被点名的那一对:同批另一对仍 refuse ⇒ 整批仍拒绝、零写入
  const RD = 'deploy/prod-bundle/deploy.sh' // 登记表里唯一允许放行的 runner
  const ALLOW = assertAllowRegistered([RD])
  const OLD = `${BASE}Write-Host 'runner-only-old'\n`
  writeFileSync(join(root, RD), OLD)

  // ⑥
  const pairsD = [{ tracked: T, runner: RD, why: 't' }]
  const p6 = planSync(root, pairsD)
  check('⑥ 不传白名单 ⇒ refuse', p6.items[0].status === 'refuse' && p6.items[0].onlyRunner === 1)
  check('⑥ 不传白名单 ⇒ exit 2', decidePlan(p6).code === 2)
  const r6 = applySync(root, pairsD)
  check(
    '⑥ 不传白名单 ⇒ 零写入(运行副本字节原样)',
    r6.refused === true && r6.wrote.length === 0 && readFileSync(join(root, RD), 'utf8') === OLD,
  )

  // ⑦
  const p7 = planSync(root, pairsD, { allowDropRunnerOnly: ALLOW })
  check(
    '⑦ 白名单 ⇒ 该对转 pending 且记录被丢弃行',
    p7.items[0].status === 'pending' && p7.items[0].allowDropped === true && p7.items[0].onlyRunner === 1,
  )
  const r7 = applySync(root, pairsD, { allowDropRunnerOnly: ALLOW })
  check('⑦ 白名单 ⇒ 写入 1 个且逐字节复验通过', r7.wrote.length === 1 && r7.wrote[0].verified === true)
  check('⑦ 白名单 ⇒ 写后整批 exit 0', r7.verdict.code === 0)
  check(
    '⑦ 白名单 ⇒ 备份内容=含独有行的旧字节',
    Boolean(r7.backups[0]) && readFileSync(r7.backups[0], 'utf8') === OLD,
  )

  // ⑧
  let rejected = false
  try {
    assertAllowRegistered(['deploy/prod-bundle/x.ps1'])
  } catch {
    rejected = true
  }
  check('⑧ 未登记路径 ⇒ 拒绝(exit 2 语义),不放行', rejected === true)

  // ⑨
  writeFileSync(join(root, RD), BASE)
  const p9 = planSync(root, pairsD, { allowDropRunnerOnly: ALLOW })
  check('⑨ 已等值 + 白名单 ⇒ 仍 equal(不放宽判据)', p9.items[0].status === 'equal' && decidePlan(p9).code === 0)
  check(
    '⑨ 已等值 + 白名单 ⇒ apply 零写入',
    applySync(root, pairsD, { allowDropRunnerOnly: ALLOW }).wrote.length === 0,
  )

  // ⑩
  const R_REFUSE = `${BASE}Write-Host 'runner-only-b'\n`
  writeFileSync(join(root, R), R_REFUSE)
  writeFileSync(join(root, RD), OLD)
  const twoPairs = [
    { tracked: T, runner: R, why: 't' },
    { tracked: T, runner: RD, why: 't' },
  ]
  const p10 = planSync(root, twoPairs, { allowDropRunnerOnly: ALLOW })
  check('⑩ 白名单只放行一对,另一对仍 refuse', p10.counts.pending === 1 && p10.counts.refuse === 1)
  check('⑩ 整批仍 exit 2', decidePlan(p10).code === 2)
  const r10 = applySync(root, twoPairs, { allowDropRunnerOnly: ALLOW })
  check(
    '⑩ 整批零写入(两对字节均未变)',
    r10.refused === true &&
      r10.wrote.length === 0 &&
      readFileSync(join(root, R), 'utf8') === R_REFUSE &&
      readFileSync(join(root, RD), 'utf8') === OLD,
  )

  console.log(fails === 0 ? 'self-test 全绿' : `self-test 失败 ${fails} 条`)
  process.exit(fails === 0 ? 0 : 1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ 本工具自身异常(不是结论):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  BACKUP_ROOT_REL,
  ALLOW_DROP_RUNNER_ONLY,
  parseAllowArgs,
  assertAllowRegistered,
  planSync,
  decidePlan,
  applySync,
  linesOnlyIn,
  timestampOf,
  assertBackupIgnored,
  relFromBundle,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
