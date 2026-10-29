// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 __test__,零复制判据。
// 立因(2026-10-29):机主删除任何文件都弹「回收站」模态错误框 —— 两盘的
// `\$Recycle.Bin\<本机SID>` 上挂着三条显式 Deny(DC/LC/RP/DT/CR/SD 给 WD/AU/LA),
// 而 Deny 恒压 Allow ⇒ 登录账号对自己的回收站目录不可写。卷策略腿与条目分类腿都判不出
// 这一格,所以坏了没人知道。本文件钉住新增存续腿的射程边界与三态判定。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as src } from '../recycle-junk-purge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'recycle-junk-purge.mjs')

const MY_SID = 'S-1-5-21-2945910849-4211772035-520136427-500'
const BIN_DIR = 'D:\\$Recycle.Bin\\' + MY_SID
// 2026-10-29 真盘读数(S-1-1-0 / S-1-5-11 / 本机 Administrator 三枚显式 Deny,继承到子项)
const BAD_RIGHTS = 'DeleteSubdirectoriesAndFiles, Write, Delete'
const LIVE_ACCESS = [
  {
    type: 'Deny',
    sid: 'S-1-1-0',
    name: 'Everyone',
    rights: BAD_RIGHTS,
    flags: 'ContainerInherit, ObjectInherit',
    inherited: false,
  },
  {
    type: 'Deny',
    sid: 'S-1-5-11',
    name: 'NT AUTHORITY\\Authenticated Users',
    rights: BAD_RIGHTS,
    flags: 'ContainerInherit, ObjectInherit',
    inherited: false,
  },
  {
    type: 'Deny',
    sid: MY_SID,
    name: 'MACHINE\\Administrator',
    rights: BAD_RIGHTS,
    flags: 'ContainerInherit, ObjectInherit',
    inherited: false,
  },
  {
    type: 'Allow',
    sid: 'S-1-5-18',
    name: 'NT AUTHORITY\\SYSTEM',
    rights: 'FullControl',
    flags: 'ContainerInherit, ObjectInherit',
    inherited: false,
  },
  {
    type: 'Allow',
    sid: 'S-1-5-32-544',
    name: 'BUILTIN\\Administrators',
    rights: 'FullControl',
    flags: 'ContainerInherit, ObjectInherit',
    inherited: false,
  },
]

test('① 显式 Deny 抽取:真盘三枚全命中,Allow/继承/坏 SID 一律不进清单', () => {
  assert.equal(src.explicitDenies(LIVE_ACCESS).length, 3)
  assert.deepEqual(
    src.explicitDenies(LIVE_ACCESS).map((d) => d.sid),
    ['S-1-1-0', 'S-1-5-11', MY_SID],
  )
  assert.equal(
    src.explicitDenies([{ type: 'Deny', sid: 'S-1-1-0', inherited: true }]).length,
    0,
    'icacls /remove:d 摘不掉继承来的 ACE',
  )
  assert.equal(src.explicitDenies([{ type: 'Allow', sid: 'S-1-1-0' }]).length, 0)
  assert.equal(src.explicitDenies([{ type: 'Deny', sid: 'O:PAI<L>' }]).length, 0)
  assert.equal(src.explicitDenies(undefined).length, 0)
})

test('② 射程边界:只有本 SID 名下的回收站目录算数', () => {
  assert.equal(src.isBinSidDir(BIN_DIR, MY_SID), true)
  assert.equal(
    src.isBinSidDir('D:\\$RECYCLE.BIN\\' + MY_SID.toUpperCase(), MY_SID),
    true,
    'Windows 路径不区分大小写',
  )
  for (const bad of [
    'C:\\$Recycle.Bin',
    'D:\\$Recycle.Bin\\S-1-5-18',
    'D:\\$Recycle.Bin\\S-1-5-21-1-1-1-500',
    'D:\\IHUI-AI\\' + MY_SID,
    'D:\\$Recycle.Bin\\' + MY_SID + '\\sub',
    '',
  ]) {
    assert.equal(src.isBinSidDir(bad, MY_SID), false, '不该被认成射程:' + bad)
  }
  assert.equal(src.isBinSidDir(BIN_DIR, null), false, '拿不到自己的 SID 时不得认定射程')
})

test('③ 修法参数:三枚 Deny + 一枚本 SID 完全控制,坏受托人被剔出下发集', () => {
  const plan = src.planAclRepair(
    BIN_DIR,
    src.explicitDenies(LIVE_ACCESS).map((d) => d.sid),
    MY_SID,
  )
  assert.deepEqual(plan.remove, ['*S-1-1-0', '*S-1-5-11', '*' + MY_SID])
  assert.equal(plan.grant, '*' + MY_SID + ':(OI)(CI)F')
  const dirty = src.planAclRepair(BIN_DIR, ['<bogus>', 'S-1-1-0'], MY_SID)
  assert.deepEqual(dirty.remove, ['*S-1-1-0'])
  assert.deepEqual(dirty.skipped, ['<bogus>'])
  assert.equal(src.planAclRepair(BIN_DIR, [], null).grant, null, '拿不到 SID 不得下发授权')
})

test('④ 执行面在调用 icacls 之前就拒掉越界与非形参数(未判定即不动手)', () => {
  for (const hostile of [
    { dir: 'D:\\IHUI-AI', remove: ['*S-1-1-0'], grant: null },
    { dir: 'C:\\Windows', remove: [], grant: '*S-1-1-0:(OI)(CI)F' },
    { dir: BIN_DIR, remove: ['S-1-1-0'], grant: null },
    { dir: BIN_DIR, remove: [], grant: null },
  ]) {
    const r = src.runAclRepair(hostile, MY_SID)
    assert.equal(r.attempted, 0, '越界计划不得下发:' + JSON.stringify(hostile))
    assert.ok(r.refused, '拒绝必须点名原因:' + JSON.stringify(hostile))
    assert.equal(r.steps, undefined, '拒掉的那一支结构上不得有执行步骤')
  }
})

test('⑤ 探针有牙:可写目录通过且不留残留,读不到目录报失败不静默 ok', () => {
  const dir = mkScratch('rbaccess-probe')
  try {
    const ok = src.probeBinDir(dir)
    assert.equal(ok.canWrite, true)
    assert.equal(ok.canDelete, true)
    assert.deepEqual(readdirSync(dir), [], '探针必须自己清掉,不得在目录里留文件')
    const dead = src.probeBinDir(join(dir, 'no-such-dir'))
    assert.equal(dead.canWrite, false)
    assert.equal(dead.step, 'create')
    assert.ok(dead.error, '失败必须带原因')
  } finally {
    rmScratch(dir)
  }
})

test('⑥ 三态判定:空集不记绿,修好算绿,修完仍不可写才红,dry-run 不把任务顶红', () => {
  assert.deepEqual(src.judgeAccess([{ state: 'ok' }, { state: 'ok' }]).status, 'ok')
  assert.equal(src.judgeAccess([{ state: 'ok' }, { state: 'self-healed' }]).code, 0)
  assert.equal(src.judgeAccess([{ state: 'self-healed' }]).status, 'self-healed')
  const breach = src.judgeAccess([{ state: 'ok' }, { state: 'breach' }])
  assert.equal(breach.status, 'breach')
  assert.equal(breach.code, 1)
  const dry = src.judgeAccess([{ state: 'breach-unrepaired' }])
  assert.equal(dry.code, 0, 'dry-run 结构上修不了,不得把小时任务顶红')
  assert.equal(src.judgeAccess([]).code, 2, '枚举到 0 个目录不得记绿')
  for (const st of ['undetermined', 'refused']) {
    const j = src.judgeAccess([{ state: 'ok' }, { state: st }])
    assert.equal(j.status, 'undetermined', st + ' 不得记绿')
    assert.equal(j.code, 2, st + ' 也不得冒红')
  }
})

test('⑦ 形状锁:存续腿只准走 icacls 一个写动作,且退出码真传出去', () => {
  const body = src.runAclRepair.toString()
  for (const forbidden of ['rmSync', 'unlinkSync', 'writeFileSync', 'renameSync', 'mkdirSync']) {
    assert.ok(!body.includes(forbidden), '执行面不得出现别的写动作:' + forbidden)
  }
  const calls = body.match(/execFileSync\(\s*'([^']+)'/g) || []
  assert.ok(calls.length > 0, '执行面必须真的调用外部件')
  for (const c of calls) assert.ok(c.includes("'icacls.exe'"), '只准调 icacls.exe:' + c)

  const text = readFileSync(SRC_FILE, 'utf8')
  assert.match(
    text,
    /\.then\(\(c\) => process\.exit\(c\)\)/,
    'main() 的返回码必须真传出去(否则小时任务的 LastTaskResult 恒 0)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
