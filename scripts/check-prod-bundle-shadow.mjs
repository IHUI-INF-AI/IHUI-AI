#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:prod-bundle 影子副本对账(2026-09-24 立)
 *
 * 堵的是 §5e 那条口径的另一半:`deploy/prod-bundle/` 被 .gitignore 整目录忽略,
 * 落在里面的运维脚本**可以完全没有入库源** —— 对跟踪文件做的 grep/审计对它零覆盖,
 * "生产到底在跑哪份代码"无人可查。当天实测到的正是数据库备份这一对:
 * 服务 IHUI-PG-BACKUP 的 AppParameters 指向 deploy/prod-bundle/pg-backup-scheduler.ps1,
 * 而全仓没有任何跟踪文件写着它的逻辑。
 *
 * 采用的形态是**入库源 + 逐字节等值断言**(不是转发壳):
 * 转发壳要改生产实际执行的文件,而当天一次改道试跑里 pg_dump 出现 3.5 分钟零输出挂死
 * (旧 runner 每天 03:00 用 34 秒跑完),在解释清楚之前不把生产备份改道。
 * 所以这里只钉一件事:**两份必须逐字节相同**;谁改了其中一份忘了另一份,当场判红。
 *
 * 判据:
 *   S0 入库源必须在本机存在(登记表里有配对而仓内没源 —— 内容态真缺陷)
 *   S1 入库源必须被 git 跟踪(否则对账没有意义)
 *   S2 运行副本必须确实被忽略(否则登记过期 —— 它已在版本树里,不需要本门)
 *   S3 两侧 sha1 必须全等;不等即红并给出 diff 行数
 *
 * 2026-09-25 扩面:compose 链的 deploy.sh / health-check.sh 整份运行副本此前全仓零入库源
 * (与蓝绿链同名不同物),按本门既定形态补了入库源并登记;同时把已在
 * deploy/tests/prod-bundle-diagnose.test.mjs 里逐字节等值、却没进本门表的
 * deploy-diagnose.sh / ai-diagnose.mjs 一并登记 —— 登记表腐烂正是"门在但看不见"的成因。
 *
 * 退出码语义(2026-09-25 定,本门已进提交链 ⇒ 这一档决定它会不会变成恒红门):
 *   0 = 可判定的登记对全部等值,**或**只剩"运行副本不在本机"这一类未判定
 *   1 = 内容态缺陷(S0 / S1 / S2 / S3)—— 在所有机器上都该判红
 *   2 = 无法判定(git 判定失败 / 文件读取失败)—— 既不记绿,也不冒充判据红
 *
 * ⚠ 为什么"运行副本不在本机"必须是 0 而不是 1(接进提交链的前提,不得回退):
 *   `deploy/prod-bundle/` 整目录被 .gitignore 忽略 ⇒ **它只存在于部署机上**。若在
 *   别的机器 / 干净 clone / CI 上因"对账对象不在"判红,后果是每一次提交都被拦,而
 *   恒红的门唯一结局是逼人 `--no-verify`,连带把其余 130+ 道守门一起作废(AGENTS §4 /
 *   §12e / 守门 77·78 各记过一次同型)。所以按**机器态 vs 内容态**分流:机器态缺失只
 *   如实打印、不改退出码;内容态缺失照判红。未判定**绝不允许静默**——原因与落点必须
 *   出现在输出里,否则这道门在非部署机上看起来"通过",而它其实什么都没看。
 *
 * 用法:node scripts/check-prod-bundle-shadow.mjs [--self-test]
 * 接线(2026-09-25 起):guardian-runner 提交链(blocking)+ 根 package.json `check:all`。
 *   刻意**不挂 stagedTriggers**:漂移的那一侧是被忽略的运行副本,它永远不会出现在
 *   暂存区里,按 staged 收窄等于把本门立门的那一型整个放过。
 * 镜像测试:node --test scripts/tests/check-prod-bundle-shadow.test.mjs
 * 紧急跳过:HUSKY_SKIP_PROD_BUNDLE_SHADOW=1
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

if (process.env.HUSKY_SKIP_PROD_BUNDLE_SHADOW === '1') {
  console.log('⏭  HUSKY_SKIP_PROD_BUNDLE_SHADOW=1 — 跳过 prod-bundle 影子副本对账')
  process.exit(0)
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 登记对:tracked = 入库源(必须跟踪),runner = 生产实际执行的那份(被忽略)
 *
 * 入库源落点规则(2026-09-25 收口,不得自创第二套):
 *   · runner 在 `deploy/prod-bundle/<name>` 且 `<name>` 与既有入库源同名不同物时
 *     (蓝绿链 `deploy/scripts/deploy.sh` ≠ compose 链 `deploy/prod-bundle/deploy.sh`),
 *     入库源写 `deploy/scripts/prod-bundle/<name>` —— 镜像运行副本的目录名,
 *     于是 basename 保持 1:1,grep 一个名字就能同时命中两侧。
 *   · 不冲突时直接复用既有入库源路径(如 deploy-diagnose.sh / ai-diagnose.mjs)。
 * 新增运行副本必须同时在这里登记一行:镜像测试
 * `scripts/tests/check-prod-bundle-shadow.test.mjs` 会反查"prod-bundle 里存在逐字节
 * 相同的跟踪文件却没登记"这一型(登记表腐烂正是本门此前漏掉 deploy-diagnose.sh 的成因)。
 */
export const PAIRS = [
  {
    tracked: 'deploy/win/ihui-pg-backup.ps1',
    runner: 'deploy/prod-bundle/pg-backup.ps1',
    why: '服务 IHUI-PG-BACKUP 每天 03:00 跑的 pg_dump 全库备份',
  },
  {
    tracked: 'deploy/win/ihui-pg-backup-scheduler.ps1',
    runner: 'deploy/prod-bundle/pg-backup-scheduler.ps1',
    why: '同服务的轮询壳(启动即备份 + 每日 03:00 + WAL 归档清理)',
  },
  {
    tracked: 'deploy/scripts/prod-bundle/deploy.sh',
    runner: 'deploy/prod-bundle/deploy.sh',
    why: 'compose 链一键部署(Linux/macOS);与蓝绿链 deploy/scripts/deploy.sh 是两个不同脚本',
  },
  {
    tracked: 'deploy/scripts/prod-bundle/health-check.sh',
    runner: 'deploy/prod-bundle/health-check.sh',
    why: 'compose 链部署后健康检查(带 --json,是 deploy-diagnose 的输入)',
  },
  {
    tracked: 'deploy/scripts/deploy-diagnose.sh',
    runner: 'deploy/prod-bundle/deploy-diagnose.sh',
    why: 'P2-13 诊断采集库,被 bundle deploy.sh source;此前只在 deploy/tests 自检里等值,门看不到',
  },
  {
    tracked: 'deploy/scripts/ai-diagnose.mjs',
    runner: 'deploy/prod-bundle/ai-diagnose.mjs',
    why: '部署失败时的 AI 诊断调用器(同上,与 deploy-diagnose.sh 同批接线)',
  },
]

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

/**
 * 三态:跟踪 / 未跟踪 / null = git 自己出错(无法判定)。
 * 旧实现把"任何异常"都当成"未跟踪",于是 git 抖动会产出与真实状态相反的 S1 红。
 */
function isTracked(root, rel) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', rel], {
      stdio: 'ignore',
      timeout: 20000,
      windowsHide: true,
    })
    return true
  } catch (e) {
    return e.status === 1 ? false : null // 1 = 确实未跟踪;其余 = 无法判定
  }
}

/**
 * 三态:被忽略 / 未被忽略 / null = 无法判定。
 * ⚠ 这里曾有一处判据失效:`catch` 里写的是 `return e.status === 1`,而 check-ignore 的
 * 退出码 0=被忽略、1=未被忽略 —— 抛进 catch 的恰恰是 1,于是本函数对"未被忽略"也返回
 * true,S2 自上线起从未生效(镜像测试 T5 用 git add -f 把运行副本纳入版本树才逼出来)。
 * 教训同守门 77/98:**判据必须覆盖门自己产出的形态**,恒绿的门比没有门更坏。
 */
function isIgnored(root, rel) {
  try {
    execFileSync('git', ['-C', root, 'check-ignore', '-q', '--', rel], {
      stdio: 'pipe',
      timeout: 20000,
      windowsHide: true,
    })
    return true
  } catch (e) {
    return e.status === 1 ? false : null // 1 = 确实未被忽略;其余 = 无法判定
  }
}

/**
 * 返回 { ok, undetermined, unverifiable, lines } —— 不在判据内直接 exit,便于 self-test 复用
 *
 * 两个"未判定"计数器**必须分开**,因为它们对应两件不同的事:
 *   undetermined  = 机器态(运行副本不在本机)⇒ 不改退出码,只如实打印
 *   unverifiable  = 问不到 git / 读不到文件   ⇒ exit 2,既不记绿也不冒充判据红
 * 把它们合成一个数,就等于在"非部署机"和"git 坏了"之间选一个错法:前者会让每次提交被拦,
 * 后者会让一道门在什么都没看到时宣布通过。
 */
export function audit(root, pairs) {
  const lines = []
  let ok = true
  let undetermined = 0
  let unverifiable = 0
  for (const p of pairs) {
    const tAbs = join(root, p.tracked)
    const rAbs = join(root, p.runner)
    // 入库源不在 = 内容态真缺陷(它是跟踪文件,任何机器上检出都该在)⇒ 照判红,
    // 绝不折进"未判定" —— 那正是"把登记表里的空条目读成已通过"的那一型。
    if (!existsSync(tAbs)) {
      lines.push(
        `  ❌ S0 入库源 ${p.tracked} 不存在 —— 登记表有配对而仓内没有源,对账无从成立`,
      )
      ok = false
      continue
    }
    // 运行副本不在 = 这台机不是部署机 ⇒ 未判定。把"整目录不在"与"目录在而这一份缺"
    // 分开说,因为后者在部署机上恰恰意味着"备份/部署脚本被人删了",读的人需要知道。
    if (!existsSync(rAbs)) {
      const bundleDir = existsSync(join(root, 'deploy', 'prod-bundle'))
      lines.push(
        `  ⚠ 未判定 ${p.runner} 不在本机 —— ` +
          (bundleDir
            ? 'deploy/prod-bundle/ 在而这一份缺(部署机上出现此形态 = 运行副本被删过,须人工核)'
            : 'deploy/prod-bundle/ 整目录不在 ⇒ 非部署机 / CI / 干净检出') +
          `;入库源侧 ${p.tracked} 未参与本轮比对`,
      )
      undetermined += 1
      continue
    }
    let tb
    let rb
    try {
      tb = readFileSync(tAbs)
      rb = readFileSync(rAbs)
    } catch (e) {
      lines.push(`  ⚠ 无法判定 ${p.tracked}:读取失败(${e.message})`)
      unverifiable += 1
      ok = false
      continue
    }
    const tracked = isTracked(root, p.tracked)
    const ignored = isIgnored(root, p.runner)
    if (tracked === null || ignored === null) {
      const which = tracked === null ? `ls-files ${p.tracked}` : `check-ignore ${p.runner}`
      lines.push(`  ⚠ 无法判定 ${p.tracked} ↔ ${p.runner}:git 判定失败(${which})`)
      unverifiable += 1
      ok = false
      continue
    }
    if (!tracked) {
      lines.push(`  ❌ S1 ${p.tracked} 未被 git 跟踪 —— 入库源不成立,对账没有意义`)
      ok = false
      continue
    }
    if (!ignored) {
      lines.push(`  ❌ S2 ${p.runner} 竟在版本树里 —— 登记表过期,请删掉这条登记`)
      ok = false
      continue
    }
    if (sha1(tb) !== sha1(rb)) {
      const tl = tb.toString('utf8').split('\n')
      const rl = rb.toString('utf8').split('\n')
      let diff = 0
      for (let i = 0; i < Math.max(tl.length, rl.length); i += 1) if (tl[i] !== rl[i]) diff += 1
      lines.push(`  ❌ S3 影子漂移 ${p.runner}(${diff} 行与入库源不同)`)
      lines.push(`        入库源: ${p.tracked}`)
      lines.push(`        生产跑的是被忽略的那一份 ⇒ 二者不一致时,线上行为与仓内代码无关`)
      ok = false
      continue
    }
    lines.push(`  ✅ ${p.runner} == ${p.tracked}(逐字节,${tb.length} 字节)`)
  }
  return { ok, undetermined, unverifiable, lines }
}

/**
 * 退出码聚合(纯函数 + 构造输入即可验,不依赖本机有没有 deploy/prod-bundle)。
 * 次序是有意的:问不到 git 时,任何"红/绿"结论都不成立 ⇒ 先 2;
 * 有内容态缺陷 ⇒ 1;只剩机器态未判定 ⇒ 0(但输出里必须已把它打印出来)。
 */
export function decide(res) {
  if (res.unverifiable > 0) return { code: 2, kind: 'unverifiable' }
  if (!res.ok) return { code: 1, kind: 'violation' }
  if (res.undetermined > 0) return { code: 0, kind: 'undetermined' }
  return { code: 0, kind: 'clean' }
}

function selfTest() {
  const root = join(REPO, '.ihui-agent', 'tmp', 'prod-bundle-shadow-selftest')
  mkdirSync(join(root, 'deploy/win'), { recursive: true })
  mkdirSync(join(root, 'deploy/prod-bundle'), { recursive: true })
  writeFileSync(join(root, '.gitignore'), 'deploy/prod-bundle/\n')
  const g = (...a) =>
    execFileSync('git', ['-C', root, '-c', 'safe.directory=*', ...a], {
      stdio: 'ignore',
      timeout: 60000,
      windowsHide: true,
    })
  // 提交步必须跨轮次可重跑:夹具目录被复用,第二次跑时内容已是上一轮终态 ⇒ git 回
  // "nothing to commit",而旧写法把它当异常抛出 ⇒ 本自检从第二次运行起恒 exit 2
  // (2026-09-25 实测:同日连跑两次即复现,一道只能跑一次的取证等于没有取证)。
  // 用 --allow-empty 而不是解析 git 文案 —— 文案随 locale / 版本变,判据不能靠猜。
  const gc = (msg) =>
    g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', msg)
  try {
    g('init', '-q', '-b', 'main')
  } catch {}
  const T = 'deploy/win/x.ps1'
  const R = 'deploy/prod-bundle/x.ps1'
  writeFileSync(join(root, T), "Write-Host 'one'\n")
  writeFileSync(join(root, R), "Write-Host 'one'\n")
  g('add', '-f', '--', '.gitignore', T)
  gc('init')
  const pairs = [{ tracked: T, runner: R, why: 't' }]
  let fails = 0
  const check = (name, cond) => {
    console.log(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) fails += 1
  }
  check('等值 ⇒ 通过', audit(root, pairs).ok === true)
  writeFileSync(join(root, R), "Write-Host 'two'\n")
  const drift = audit(root, pairs)
  check('漂移 ⇒ 判红且点名 S3', drift.ok === false && drift.lines.join('\n').includes('S3'))
  writeFileSync(join(root, R), "Write-Host 'one'\n")
  // 反方向变异:只改入库源、运行副本不动 ⇒ 同一条 S3 仍必须判红并点名 runner
  writeFileSync(join(root, T), "Write-Host 'three'\n")
  const drift2 = audit(root, pairs)
  const d2 = drift2.lines.join('\n')
  check(
    '只改入库源 ⇒ S3 仍判红且点名运行副本',
    drift2.ok === false && d2.includes('S3') && d2.includes(R),
  )
  writeFileSync(join(root, T), "Write-Host 'one'\n")
  // 把入库源从跟踪集里摘掉 ⇒ S1 必须判红(而不是"看不见就算过")
  g('rm', '--cached', '-q', '--', T)
  gc('untrack')
  check('入库源不再被跟踪 ⇒ S1 判红', audit(root, pairs).ok === false)
  g('add', '-f', '--', T)
  gc('retrack')
  check('恢复跟踪后回到绿', audit(root, pairs).ok === true)
  const missing = audit(root, [{ tracked: T, runner: 'deploy/prod-bundle/nope.ps1', why: 't' }])
  // 机器态:运行副本不在 ⇒ 未判定**且不得判红**(判红 = 非部署机每次提交被拦)
  check(
    '缺运行副本 ⇒ 未判定、不判红、打印原因',
    missing.ok === true &&
      missing.undetermined === 1 &&
      missing.unverifiable === 0 &&
      missing.lines.join('\n').includes('未判定'),
  )
  check('未判定的退出码是 0(不是 2)', decide(missing).code === 0)
  // 内容态:入库源不在 ⇒ 真缺陷,照判红(这一侧在所有机器上检出都该存在)
  const noSrc = audit(root, [{ tracked: 'deploy/win/nope.ps1', runner: R, why: 't' }])
  const ns = noSrc.lines.join('\n')
  check(
    '缺入库源 ⇒ S0 判红且不记成未判定',
    noSrc.ok === false &&
      noSrc.undetermined === 0 &&
      ns.includes('S0') &&
      ns.includes('deploy/win/nope.ps1'),
  )
  check('S0 的退出码是 1', decide(noSrc).code === 1)
  // decide 的三条分支各自独立成立(构造输入,不依赖本机形态)
  check(
    'decide:git 判不动 ⇒ 2 且优先于判红',
    decide({ ok: false, undetermined: 1, unverifiable: 1 }).code === 2,
  )
  check('decide:全等值 ⇒ 0', decide({ ok: true, undetermined: 0, unverifiable: 0 }).code === 0)
  console.log(fails === 0 ? 'self-test 全绿' : `self-test 失败 ${fails} 条`)
  process.exit(fails === 0 ? 0 : 1)
}

async function main() {
  if (process.argv.includes('--self-test')) selfTest()
  const res = audit(REPO, PAIRS)
  console.log(`[prod-bundle-shadow] 登记对 ${PAIRS.length} 个`)
  for (const l of res.lines) console.log(l)
  const verdict = decide(res)
  // 机器态未判定:不改退出码,但必须喊出来 —— 沉默的"未判定"与"通过"在提交链里长得一样
  if (res.undetermined > 0) {
    console.log(
      `⚠ ${res.undetermined}/${PAIRS.length} 对**未判定**(运行副本不在本机,见上)。` +
        ' 本门只存在于部署机才有对账对象(deploy/prod-bundle/ 整目录被 .gitignore 忽略),' +
        ' 因此这一型刻意不判红 —— 按现状判红会让每一次提交被拦,连带逼掉全部守门。',
    )
    console.log('   代价是:在非部署机上本门等于没看。请在部署机(或 CI 的部署镜像)上手动跑一次。')
  }
  if (verdict.code === 2) {
    console.log(`❌ 有 ${res.unverifiable} 对无法判定 —— 不记为通过`)
    process.exit(2)
  }
  if (verdict.code === 1) {
    console.log('❌ 对账未通过 —— 逐条原因见上(漂移与登记失效是两类问题,不混为一谈)')
    console.log('   同步方向:生产执行的是被忽略的那一份,改任何一侧都要把另一侧改成逐字节相同')
    process.exit(1)
  }
  console.log(
    res.undetermined > 0
      ? `✅ 本机可判定的 ${PAIRS.length - res.undetermined} 对逐字节等值(另 ${res.undetermined} 对未判定)`
      : '✅ 所有登记对逐字节等值',
  )
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
// §22d:脚本自身异常一律 exit 2(无法判定),不得以 uncaught 异常冒充判据红/绿
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ 本门自身异常(不是判据结论):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

// §22c / §22d:测试直接 import 这份实现,不再抄第二份判据(镜像常量漂移即假绿)
export const __test__ = { PAIRS, audit, decide, isTracked, isIgnored, sha1 }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
