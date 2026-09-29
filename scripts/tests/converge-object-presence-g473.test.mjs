// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-473 的镜像测试:三处同族缺陷一次钉住 —— "ls-remote 拿到了 sha" ≠ "那个对象在本地"。
 * ① union-converge 的 hasCommit / resolveTargets / plan 三档必须都判"未判定 + fetch 出路";
 * ② CLI 那一支必须 exit 2 而不是抛 Node 堆栈(票面原话:读起来像工具坏了);
 * ③ 两个调用方(git-sync-converge / git-push-guard)不得把"没取回"说成内容裁决或仓库形态异常。
 * 判据全部现读构造面:每个正例配一条"当前世界应当为假/真"的反例,防止判据做成恒红闸。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as U } from '../union-converge.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const ABSENT = '0123456789012345678901234567890123456789'

function initRepo(t) {
  const dir = mkScratch('uc-g473-')
  t.after(() => rmScratch(dir))
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  writeFileSync(join(dir, 'f.txt'), 'base\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'base')
  const first = run('rev-parse', 'HEAD')
  writeFileSync(join(dir, 'g.txt'), 'second\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'second')
  return { dir, run, head: run('rev-parse', 'HEAD'), first }
}

test('hasCommit:在位为真 / 缺失为假 / 形状不合不派生 git', (t) => {
  const { dir, head } = initRepo(t)
  assert.equal(U.hasCommit(head, dir), true, 'HEAD 的对象当然在位 —— 量不到就等于把每个正常仓库判成未判定')
  assert.equal(U.hasCommit(ABSENT, dir), false, '本机没有的 sha 必须判假')
  assert.equal(U.hasCommit('', dir), false, '空值不得派生 git(形状先判)')
  assert.equal(U.hasCommit('HEAD', dir), false, '符号名不是 sha;这一维只问对象存在,不问引用可达')
})

test('resolveTargets:对象缺失 ⇒ 未判定并给出 fetch 出路,绝不伪装成 skip', (t) => {
  const { dir, head } = initRepo(t)
  const r = U.resolveTargets(ABSENT, dir)
  assert.equal(r.skip, null, '未判定不得写成 skip —— 那会被调用方读成"无事可做"')
  assert.equal(r.head, head)
  assert.match(r.undetermined, /对象不在本机/)
  assert.match(r.undetermined, new RegExp(`git fetch --no-tags origin ${ABSENT.slice(0, 11)}`))
  assert.match(r.undetermined, /不代跑 fetch/)
})

test('反向锁:两条 sha 都在本地时,这一维一字未改判(否则新判据就是恒红闸)', (t) => {
  const { dir, head, first } = initRepo(t)
  const r = U.resolveTargets(first, dir)
  assert.equal(r.undetermined, undefined, '祖先提交当然在本地,报未判定等于把正常收敛全拦住')
  assert.match(String(r.skip), /目标已被本地包含/, '在位的祖先仍须走原判据(已被本地包含),不是新分支')
  const p = U.plan(head, first, dir)
  assert.match(String(p.base), /^[0-9a-f]{40}$/, 'plan() 在两条本地 sha 上照旧算得出基底')
})

test('plan():直接走 API 也报同一句诊断,而不是 git 的 Not a valid commit name 加堆栈', (t) => {
  const { dir, head } = initRepo(t)
  assert.throws(() => U.plan(head, ABSENT, dir), /未判定:对象不在本机/)
  assert.throws(() => U.plan(ABSENT, head, dir), /git fetch --no-tags origin/)
})

test('CLI:未判定必须 exit 2、含出路、且不得以 Node 堆栈收场', (t) => {
  const { dir } = initRepo(t)
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'union-converge.mjs'), '--theirs', ABSENT], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
  })
  assert.equal(r.status, 2, `未判定档的退出码是 2(区别于 1="判了,需人工"),实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /未判定:对象不在本机/, `stdout 必须自己说清是"没判":\n${r.stdout}`)
  assert.doesNotMatch(r.stderr, /Command failed/, `取不到不得表现为堆栈(票面:读起来像工具坏了):\n${r.stderr}`)
})

test('调用方措辞锁:收敛器与推送守护都不许把"没取回"说成内容裁决/仓库形态异常', () => {
  const sync = readFileSync(join(ROOT, 'scripts', 'git-sync-converge.mjs'), 'utf8')
  // 只在**真正执行的那段**里判顺序:全文件 indexOf 会被头注里同词的散文骗到
  // (本仓记过的同型:"文本位置锁会因新分支自己含被定位 token 而误判")。
  const site = sync.indexOf('const uni = attemptUnionConverge(')
  assert.ok(site > 0, '找不到冲突分支的调用点 ⇒ 本锁对着空气判绿')
  const win = sync.slice(site, site + 1600)
  // 判据载体随 G-815406 换了形态:分流从"字面 `uni.includes('未判定:')`"收进了
  // `classifyUnionAttempt(uni)` 这一份实现(两支调用点各写一遍字符串判据必然漂移)。
  // 旧 needle 在 HEAD 上本来就命中不到(那句写的是 `uni.includes('UNDETERMINED')`)⇒ 这条锁
  // 早已恒红,只是被"本测试文件 import 不到 union-converge"的装载崩溃挡在门外没人看见。
  // 不变量一字未松:分流必须排在"亦判需人工"那句之前。
  const iDivert = win.indexOf('classifyUnionAttempt(uni)')
  const iHuman = win.indexOf('亦判需人工')
  assert.ok(iDivert > 0, '分流分支缺失 ⇒ 一次 fetch/一次依赖崩会被报成"union 判需人工"(G-473 ②的调用方那一半)')
  assert.ok(iHuman > iDivert, '分流必须排在"需人工"那句之前,否则那句先被打印,分流形同不存在')
  const guard = readFileSync(join(ROOT, 'scripts', 'git-push-guard.mjs'), 'utf8')
  const gSite = guard.indexOf('if (ahead === 0) {')
  assert.ok(gSite > 0, '找不到 ahead=0 那一支 ⇒ 本锁对着空气判绿')
  const gwin = guard.slice(gSite, gSite + 1200)
  assert.ok(
    gwin.indexOf('git cat-file -t ${remoteHead}') < gwin.indexOf('本地与 origin/${branch} HEAD 不同但无 ahead commit'),
    '异常措辞之前必须先问对象在不在,否则"shallow clone 等异常状态"仍是唯一结论',
  )
  assert.ok(
    gwin.indexOf('git fetch --no-tags origin') > gwin.indexOf('git cat-file -t') &&
      gwin.includes('未判定'),
    '未判定那一支必须自己喊出"未判定"并带 fetch 出路(只喊异常等于没给出路)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
