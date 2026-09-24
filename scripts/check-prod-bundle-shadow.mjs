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
 *   S1 入库源必须被 git 跟踪(否则对账没有意义)
 *   S2 运行副本必须确实被忽略(否则登记过期 —— 它已在版本树里,不需要本门)
 *   S3 两侧 sha1 必须全等;不等即红并给出 diff 行数
 * 三类取不到(文件缺失 / 不是普通文件 / 读失败)一律 exit 2 显式"无法判定",绝不记绿。
 *
 * 用法:node scripts/check-prod-bundle-shadow.mjs [--self-test]
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

/** 登记对:tracked = 入库源(必须跟踪),runner = 生产实际执行的那份(被忽略) */
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
]

const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

function isTracked(root, rel) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', rel], {
      stdio: 'ignore',
      timeout: 20000,
      windowsHide: true,
    })
    return true
  } catch {
    return false
  }
}

function isIgnored(root, rel) {
  try {
    execFileSync('git', ['-C', root, 'check-ignore', '-q', '--', rel], {
      stdio: 'pipe',
      timeout: 20000,
      windowsHide: true,
    })
    return true
  } catch (e) {
    return e.status === 1 // 1 = 未被忽略;>1 = git 自己出错,按"无法判定"处理
  }
}

/** 返回 { ok, undetermined, lines } —— 不在判据内直接 exit,便于 self-test 复用 */
export function audit(root, pairs) {
  const lines = []
  let ok = true
  let undetermined = 0
  for (const p of pairs) {
    const tAbs = join(root, p.tracked)
    const rAbs = join(root, p.runner)
    if (!existsSync(tAbs) || !existsSync(rAbs)) {
      lines.push(`  ⚠ 无法判定 ${p.tracked} ↔ ${p.runner}:有一侧不存在`)
      undetermined += 1
      ok = false
      continue
    }
    let tb
    let rb
    try {
      tb = readFileSync(tAbs)
      rb = readFileSync(rAbs)
    } catch (e) {
      lines.push(`  ⚠ 无法判定 ${p.tracked}:读取失败(${e.message})`)
      undetermined += 1
      ok = false
      continue
    }
    const tracked = isTracked(root, p.tracked)
    const ignored = isIgnored(root, p.runner)
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
  return { ok, undetermined, lines }
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
  try {
    g('init', '-q', '-b', 'main')
  } catch {}
  const T = 'deploy/win/x.ps1'
  const R = 'deploy/prod-bundle/x.ps1'
  writeFileSync(join(root, T), "Write-Host 'one'\n")
  writeFileSync(join(root, R), "Write-Host 'one'\n")
  g('add', '-f', '--', '.gitignore', T)
  g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init')
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
  // 把入库源从跟踪集里摘掉 ⇒ S1 必须判红(而不是"看不见就算过")
  g('rm', '--cached', '-q', '--', T)
  g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'untrack')
  check('入库源不再被跟踪 ⇒ S1 判红', audit(root, pairs).ok === false)
  g('add', '-f', '--', T)
  g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'retrack')
  check('恢复跟踪后回到绿', audit(root, pairs).ok === true)
  const missing = audit(root, [{ tracked: T, runner: 'deploy/prod-bundle/nope.ps1', why: 't' }])
  check('缺一侧 ⇒ 计为无法判定(不记绿)', missing.ok === false && missing.undetermined === 1)
  console.log(fails === 0 ? 'self-test 全绿' : `self-test 失败 ${fails} 条`)
  process.exit(fails === 0 ? 0 : 1)
}

function main() {
  if (process.argv.includes('--self-test')) selfTest()
  const res = audit(REPO, PAIRS)
  console.log(`[prod-bundle-shadow] 登记对 ${PAIRS.length} 个`)
  for (const l of res.lines) console.log(l)
  if (res.undetermined > 0) {
    console.log(`❌ 有 ${res.undetermined} 对无法判定 —— 不记为通过`)
    process.exit(2)
  }
  if (!res.ok) {
    console.log('❌ 对账未通过 —— 逐条原因见上(漂移与登记失效是两类问题,不混为一谈)')
    console.log('   同步方向:生产执行的是被忽略的那一份,改任何一侧都要把另一侧改成逐字节相同')
    process.exit(1)
  }
  console.log('✅ 所有登记对逐字节等值')
  process.exit(0)
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
