// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反代账号池一键导入的接线锁(2026-10-23 立)。
 *
 * 锁三件东西:
 *   ① WorkBuddy 字段解密的 AAD 必须与主进程实现同形(改一个字节 ⇒ 真实令牌解不开);
 *   ② 国际版缺少 workbuddy.ai 域声明时必须拒绝(否则会按国内域转发);
 *   ③ 编排器参数面:两种入口互斥、未知来源与缺输入必须 exit 2。
 *
 * 判据 import 自生产脚本的 `__test__`(§22c),本文件不重写判定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as W } from '../lib/workbuddy-auth-extract.mjs'
import { __test__ as C } from '../relay-account-pool.mjs'

test('① AAD 前缀与字段帧形状锁定(WB-AAD\\0 + WBEV1 + sym-v1)', () => {
  const aad = W.buildFieldAad('9127dea1b44020a7')
  assert.equal(aad.subarray(0, 7).toString('ascii'), 'WB-AAD\0')
  const hex = aad.toString('hex')
  assert.ok(hex.includes(Buffer.from('WBEV1').toString('hex')), 'AAD 必须含字段帧 WBEV1')
  assert.ok(hex.includes(Buffer.from('sym-v1').toString('hex')), 'AAD 必须含套件 sym-v1')
})

test('② 字段信封加解密往返(含嵌套与非加密字段原样)', () => {
  const { key, keyId } = W.normalizeAtRestKey('unit-test-secret')
  const wrapper = W.sealFieldForTest('智汇AI教育丨官方教务', key, keyId)
  const tree = W.decryptSessionTree(
    { account: { nickname: wrapper, uid: 'u-1' }, plain: 42 },
    key,
    keyId,
  )
  assert.equal(tree.account.nickname, '智汇AI教育丨官方教务')
  assert.equal(tree.account.uid, 'u-1')
  assert.equal(tree.plain, 42)
})

test('③ 密钥/密文任一被改 ⇒ 解密必须失败(不允许静默返回空)', () => {
  const a = W.normalizeAtRestKey('secret-a')
  const b = W.normalizeAtRestKey('secret-b')
  const wrapper = W.sealFieldForTest('token-value', a.key, a.keyId)
  assert.throws(() => W.decryptSessionTree(wrapper, b.key, b.keyId), /keyId|不匹配/)

  const envelope = JSON.parse(Buffer.from(wrapper.envelope, 'base64').toString('utf8'))
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64')
  ciphertext[0] ^= 0xff
  envelope.ciphertext = ciphertext.toString('base64')
  const tampered = {
    $wbEncrypted: 1,
    envelope: Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64'),
  }
  assert.throws(() => W.decryptSessionTree(tampered, a.key, a.keyId))
})

test('④ 版本判定:国内/国际目录必须分清,判不出返回 null', () => {
  assert.equal(W.resolveEdition('C:\\Users\\x\\.workbuddy\\app'), 'workbuddy')
  assert.equal(W.resolveEdition('C:\\Users\\x\\.workbuddy-ai\\app'), 'workbuddy-ai')
  assert.equal(W.resolveEdition('D:\\somewhere\\else'), null)
})

test('⑤ 国际版令牌没有 workbuddy.ai 域声明 ⇒ 拒绝入池', () => {
  assert.throws(
    () => W.assertRealmMatchesEdition('workbuddy-ai', { sub: 'u' }),
    /未携带 workbuddy\.ai 域声明/,
  )
  assert.throws(
    () => W.assertRealmMatchesEdition('workbuddy-ai', { domain: 'www.workbuddy.cn' }),
    /未携带 workbuddy\.ai 域声明/,
  )
  assert.doesNotThrow(() =>
    W.assertRealmMatchesEdition('workbuddy-ai', { domain: 'www.workbuddy.ai' }),
  )
  assert.doesNotThrow(() => W.assertRealmMatchesEdition('workbuddy', {}))
})

test('⑥ 指纹不得回显令牌本体', () => {
  const token = 'eyJhbGciOiJSUzI1NiJ9.SECRET-PAYLOAD.SIG'
  const fp = W.fingerprintOf(token)
  assert.equal(fp.length, 12)
  assert.ok(!fp.includes('SECRET'), '指纹必须是哈希而非截断明文')
  assert.ok(!token.includes(fp))
})

test('⑦ 编排器参数面:两入口互斥 / 未知来源 / 缺输入一律未判定', () => {
  assert.deepEqual(C.parseArgs(['--from', 'workbuddy']).error, null)
  assert.deepEqual(C.parseArgs(['--file', 'a.json', '--provider', 'trae']).error, null)
  assert.match(C.parseArgs(['--from', 'workbuddy', '--file', 'a.json']).error ?? '', /只能二选一/)
  assert.match(C.parseArgs([]).error ?? '', /缺少输入/)
  assert.match(C.parseArgs(['--from', 'codearts']).error ?? '', /暂不支持/)
  assert.match(C.parseArgs(['--bogus']).error ?? '', /未知参数/)
  assert.equal(C.parseArgs(['--help']).options.help, true)
})

test('⑧ 主进程定位:用户数据目录只挂在子进程上,须上溯到无 --type 的根进程', () => {
  const cn = 'C:\\Users\\x\\.workbuddy\\app'
  const ai = 'C:\\Users\\x\\.workbuddy-ai\\app'
  const rows = [
    {
      ProcessId: 99,
      ParentProcessId: 1,
      CommandLine: '"C:\\Apps\\WorkBuddy.exe" "app.asar\\main\\daemon.js" --stdio',
    },
    { ProcessId: 100, ParentProcessId: 99, CommandLine: '"C:\\Apps\\WorkBuddy.exe" ' },
    {
      ProcessId: 101,
      ParentProcessId: 100,
      CommandLine: `"...exe" --type=gpu-process --user-data-dir="${cn}"`,
    },
    {
      ProcessId: 102,
      ParentProcessId: 101,
      CommandLine: `"...exe" --type=renderer --user-data-dir="${cn}"`,
    },
    { ProcessId: 200, ParentProcessId: 1, CommandLine: '"C:\\Apps\\WorkBuddy.exe" ' },
    {
      ProcessId: 201,
      ParentProcessId: 200,
      CommandLine: `"...exe" --type=utility --user-data-dir="${ai}"`,
    },
    // crashpad 的参数没有引号,旧正则会吞掉后续 /prefetch 等开关,造出第二个"主进程"
    {
      ProcessId: 202,
      ParentProcessId: 200,
      CommandLine: `"...exe" --type=crashpad-handler --user-data-dir=${ai} /prefetch:4 --no-rate-limit`,
    },
  ]
  const mains = W.resolveMainProcessesFromRows(rows)
  assert.equal(mains.length, 2, '两个版本各一条,同目录多子进程必须去重')
  assert.deepEqual(
    mains.map((m) => m.pid).sort((a, b) => a - b),
    [100, 200],
    '不得越过主进程继续上溯到 daemon 包装进程(99)',
  )
  assert.ok(mains.every((m) => !String(m.userDataDir).includes('--type=')))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
