// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * workbuddy-auth-extract 的「一键切号」扩展面锁(2026-10-28 立):
 *   ① collectSealedPaths:点分 + 数组下标方括号的路径形状(与写回端 parseSealedPath 同语法)
 *   ② buildSessionTemplate:只剔两个凭证键,资料字段(含明文 nickname/phoneNumber)全保留
 *   ③ sealFieldForTest → decryptSessionTree 往返(合成密钥,离线,不碰进程/inspector)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { __test__ as W, listWorkbuddyMainProcesses } from '../lib/workbuddy-auth-extract.mjs'

test('① collectSealedPaths:点分 + accounts[0].nickname 方括号格式', () => {
  const raw = {
    auth: {
      uid: '42',
      tokenType: 'Bearer',
      accessToken: { $wbEncrypted: 1, envelope: 'A' },
      refreshToken: { $wbEncrypted: 1, envelope: 'B' },
    },
    account: {
      uid: '42',
      nickname: { $wbEncrypted: 1, envelope: 'N' },
      phoneNumber: '13800000000',
    },
    accounts: [
      {
        nickname: { $wbEncrypted: 1, envelope: 'a0n' },
        phoneNumber: { $wbEncrypted: 1, envelope: 'a0p' },
      },
      { nickname: 'plain' },
    ],
    allAccounts: [{ nickname: { $wbEncrypted: 1, envelope: 'aa0n' } }, {}],
    sessionState: 0,
  }
  assert.deepEqual(W.collectSealedPaths(raw), [
    'auth.accessToken',
    'auth.refreshToken',
    'account.nickname',
    'accounts[0].nickname',
    'accounts[0].phoneNumber',
    'allAccounts[0].nickname',
  ])
  assert.deepEqual(W.collectSealedPaths(null), [])
  assert.deepEqual(W.collectSealedPaths('str'), [])
  assert.deepEqual(W.collectSealedPaths({}), [])
  // 追加出参复用不重复(默认 out 每次新建)
  const once = W.collectSealedPaths(raw)
  assert.equal(once.length, 6)
})

test('② buildSessionTemplate:剔凭证、留资料、不动原树;非对象返回 null', () => {
  const tree = {
    auth: { uid: '42', accessToken: 'tok', refreshToken: 'rt', expiresIn: 86400 },
    account: { uid: '42', nickname: 'tester', phoneNumber: '13800000000' },
    accounts: [{ nickname: 'tester' }],
  }
  const tpl = W.buildSessionTemplate(tree)
  assert.equal('accessToken' in tpl.auth, false, 'accessToken 必须剔除')
  assert.equal('refreshToken' in tpl.auth, false, 'refreshToken 必须剔除')
  assert.equal(tpl.auth.uid, '42')
  assert.equal(tpl.auth.expiresIn, 86400, '其余明文键一律保留')
  assert.equal(tpl.account.nickname, 'tester', 'nickname 明文值留在模板(入池后随 secretsEnc 加密)')
  assert.equal(tpl.account.phoneNumber, '13800000000')
  assert.deepEqual(tpl.accounts, [{ nickname: 'tester' }])
  assert.equal(tree.auth.accessToken, 'tok', '不得回头修改原树')
  tpl.account.nickname = 'mutated'
  assert.equal(tree.account.nickname, 'tester', '模板必须是深拷贝')
  assert.equal(W.buildSessionTemplate(null), null)
  assert.equal(W.buildSessionTemplate([]), null)
  assert.equal(W.buildSessionTemplate('s'), null)
  assert.equal(W.buildSessionTemplate(42), null)
  assert.deepEqual(W.buildSessionTemplate({ account: { uid: '1' } }), { account: { uid: '1' } })
})

test('②b WB_CREDENTIAL_PATHS 常量形状', () => {
  assert.deepEqual([...W.WB_CREDENTIAL_PATHS], ['auth.accessToken', 'auth.refreshToken'])
})

test('③ sealFieldForTest → decryptSessionTree 往返还原(合成密钥离线)', () => {
  const { key, keyId } = W.normalizeAtRestKey('synthetic-at-rest-secret')
  const sealed = {
    auth: {
      uid: '42',
      accessToken: W.sealFieldForTest('tok-1', key, keyId),
      refreshToken: W.sealFieldForTest('rt-1', key, keyId),
    },
    account: { uid: '42', nickname: W.sealFieldForTest('昵称-中文', key, keyId) },
    accounts: [{ phoneNumber: W.sealFieldForTest('13800000000', key, keyId) }],
  }
  // 密封面收集与写入的路径逐字对得上
  assert.deepEqual(W.collectSealedPaths(sealed), [
    'auth.accessToken',
    'auth.refreshToken',
    'account.nickname',
    'accounts[0].phoneNumber',
  ])
  const opened = W.decryptSessionTree(sealed, key, keyId)
  assert.equal(opened.auth.accessToken, 'tok-1')
  assert.equal(opened.auth.refreshToken, 'rt-1')
  assert.equal(opened.auth.uid, '42', '明文骨架不得被递归破坏')
  assert.equal(opened.account.nickname, '昵称-中文', 'UTF-8 往返无损')
  assert.equal(opened.accounts[0].phoneNumber, '13800000000')
  assert.equal(Array.isArray(opened.accounts), true, '数组形状必须保留')

  // 换一把密钥:keyId 对不上必须拒解(不能静默出乱码)
  const other = W.normalizeAtRestKey('another-secret')
  assert.throws(
    () => W.decryptSessionTree(sealed, other.key, other.keyId),
    (e) => e.code === 'key-mismatch',
  )
})

test('④ workbuddyAuthFilePath:逐版本等于拼接结果;未知/原型键一律点名抛错', () => {
  for (const edition of Object.keys(W.AUTH_FILE_BY_EDITION)) {
    assert.equal(
      W.workbuddyAuthFilePath(edition),
      path.join(W.AUTH_DIR, W.AUTH_FILE_BY_EDITION[edition]),
    )
  }
  // 变异自证:把 lib 里那处改回自立第二份拼接 ⇒ 上面这条不红,红的是下面的形状锁
  for (const bad of ['nope', '', null, undefined, 'constructor', '__proto__', 'toString', 42]) {
    assert.throws(
      () => W.workbuddyAuthFilePath(bad),
      (e) => e.code === 'edition-undetermined',
      `未知版本必须点名抛错: ${JSON.stringify(bad)}`,
    )
  }
  // 形状锁:提取端(extractWorkbuddyAccount)不许再出现第二份 AUTH_DIR 拼接
  const src = fs.readFileSync(new URL('../lib/workbuddy-auth-extract.mjs', import.meta.url), 'utf8')
  const start = src.indexOf('export async function extractWorkbuddyAccount')
  assert.notEqual(start, -1, '提取端函数必须还在(改名了就要同步这条锁)')
  const end = src.indexOf('\n}\n', start)
  assert.notEqual(end, -1, '取不到提取端函数体边界 ⇒ 锁不得空转')
  const body = src.slice(start, end + 3)
  assert.equal(
    /path\.join\(\s*AUTH_DIR/.test(body),
    false,
    'extractWorkbuddyAccount 内不得再出现 path.join(AUTH_DIR, …) —— 必须走 workbuddyAuthFilePath 单源',
  )
  assert.match(body, /workbuddyAuthFilePath\(edition\)/, '提取端必须调用 workbuddyAuthFilePath')
})

test('⑤ getPathByJsonPath:与 collectSealedPaths 互逆对账;取不到一律 undefined 不抛', () => {
  const { key, keyId } = W.normalizeAtRestKey('path-oracle-secret')
  const tree = {
    auth: { uid: '42', accessToken: W.sealFieldForTest('AT', key, keyId), nested: { deep: 'x' } },
    account: { nickname: W.sealFieldForTest('昵称', key, keyId), phoneNumber: '13800000000' },
    accounts: [{ nickname: W.sealFieldForTest('a0', key, keyId) }, { plain: 'p1' }],
    matrix: [[W.sealFieldForTest('m00', key, keyId)]],
  }
  // 独立 oracle:按同一语法手工走一遍,不用被测函数
  const manual = (p) =>
    p
      .split(/\.|(?=\[)/)
      .filter(Boolean)
      .map((s) => (s.startsWith('[') ? Number(s.slice(1, -1)) : s))
      .reduce((acc, seg) => (acc === null || acc === undefined ? undefined : acc[seg]), tree)

  const paths = W.collectSealedPaths(tree)
  assert.ok(paths.length >= 4, `夹具必须造出足够密封面: ${paths.length}`)
  for (const p of paths) {
    assert.deepEqual(W.getPathByJsonPath(tree, p), manual(p), `互逆对账失败: ${p}`)
    assert.equal(manual(p)?.$wbEncrypted, 1, `collectSealedPaths 吐出的必须真是信封: ${p}`)
  }
  // 未命中臂:缺键 / 越界下标 / 容器类型对不上 ⇒ undefined(读侧绝不抛)
  assert.equal(W.getPathByJsonPath(tree, 'auth.nope'), undefined)
  assert.equal(W.getPathByJsonPath(tree, 'accounts[9].nickname'), undefined)
  assert.equal(W.getPathByJsonPath(tree, 'accounts.x'), undefined, '数组盒 + 字符串段 ⇒ 类型对不上')
  assert.equal(W.getPathByJsonPath(tree, 'auth[0]'), undefined, '对象盒 + 数字段 ⇒ 类型对不上')
  assert.equal(W.getPathByJsonPath(tree, 'account.phoneNumber.deeper'), undefined, '叶子后面还有段')
  assert.equal(W.getPathByJsonPath(tree, 'matrix[0][0]'), manual('matrix[0][0]'), '双层下标')
  assert.equal(
    W.getPathByJsonPath([{ a: 1 }], '[0].a'),
    1,
    '根即数组:collectSealedPaths 会吐出 `[0].a` 这一形',
  )
  assert.equal(W.getPathByJsonPath(null, 'a'), undefined)
  assert.equal(W.getPathByJsonPath('str', 'a'), undefined)
  // 读侧也不许沿原型链取(否则 '__proto__' 会摸到 Object.prototype)
  assert.equal(W.getPathByJsonPath(tree, 'auth.hasOwnProperty'), undefined)
})

test('⑥ setPathByJsonPath:写后读回全等、缺层自动建、类型不符与原型段一律拒绝且不碰节点', () => {
  const build = () => ({
    account: { nickname: 'nick' },
    accounts: [{ phoneNumber: '13800000000' }],
  })
  const tree = build()
  const r1 = W.setPathByJsonPath(tree, 'account.nickname', 'SEALED')
  assert.equal(r1, tree, '必须返回根节点(消费方按链式写法用)')
  assert.equal(W.getPathByJsonPath(tree, 'account.nickname'), 'SEALED')
  assert.equal(
    W.getPathByJsonPath(tree, 'accounts[0].phoneNumber'),
    '13800000000',
    '其余键不得受影响',
  )

  W.setPathByJsonPath(tree, 'deep.a.b[0].c', 'V')
  assert.deepEqual(
    W.getPathByJsonPath(tree, 'deep.a'),
    { b: [{ c: 'V' }] },
    '数字段 ⇒ 建数组,其余 ⇒ 建对象',
  )

  // 反向安全锁:三种原型段拒绝写入,且断言副作用没发生(不是只断言抛错)
  const snapshot = JSON.stringify(tree)
  for (const hostile of [
    '__proto__.polluted',
    'a.__proto__',
    'constructor.prototype.x',
    'prototype.y',
    'a.prototype',
  ]) {
    assert.throws(
      () => W.setPathByJsonPath(tree, hostile, 'X'),
      (e) => e.code === 'extract-failed',
      hostile,
    )
    assert.equal(JSON.stringify(tree), snapshot, `拒绝写入后节点必须逐字节不动: ${hostile}`)
  }
  assert.equal({}.polluted, undefined, 'Object.prototype 不得被污染')

  // 容器类型不符 ⇒ 抛错,且已有的那一层数据不得被悄悄清掉(变异自证:摘掉这条 throw ⇒ 本支翻红)
  const clash = { accounts: { nickname: 'keep-me' } }
  assert.throws(
    () => W.setPathByJsonPath(clash, 'accounts[0].nickname', 'X'),
    (e) => e.code === 'extract-failed',
  )
  assert.deepEqual(clash, { accounts: { nickname: 'keep-me' } }, '类型不符时不得覆盖已有子树')

  // 叶子是原始值而路径要求中间层 ⇒ 就地建层(原值本就属于这一格)
  const leaf = { a: 1 }
  W.setPathByJsonPath(leaf, 'a.b', 2)
  assert.deepEqual(leaf, { a: { b: 2 } })

  // 根节点不是对象 ⇒ 拒绝
  for (const badRoot of [null, undefined, 's', 42, []]) {
    assert.throws(
      () => W.setPathByJsonPath(badRoot, 'a.b', 1),
      (e) => e.code === 'extract-failed',
    )
  }
})

test('⑦ 路径语法两面同一条尺:坏形态在读写两侧都抛,且抛在同一处', () => {
  const badPaths = ['', '.', 'a..b', 'a.', '.a', 'a[x]', 'a[0', 'a[0]x', 'accounts[0]..nickname']
  const tree = { a: { b: 1 } }
  for (const p of badPaths) {
    assert.throws(
      () => W.getPathByJsonPath(tree, p),
      (e) => e.message.includes('路径形态不合法'),
      `读侧必须拒: ${JSON.stringify(p)}`,
    )
    assert.throws(
      () => W.setPathByJsonPath(tree, p, 1),
      (e) => e.message.includes('路径形态不合法'),
      `写侧必须拒: ${JSON.stringify(p)}`,
    )
  }
  // 变异自证:parseSealedPath 一旦被绕过(比如给读侧另写一份 split),这条即红
  assert.equal(W.getPathByJsonPath(tree, 'a.b'), 1)
})

test(
  '⑧ 主进程探测三态:量不到 ≠ 确实 0 个,数组消费形态逐字不变',
  { skip: process.platform !== 'win32' && 'CIM 探测通道只在 win32 成立' },
  () => {
    const okJson = JSON.stringify([
      {
        ProcessId: 100,
        ParentProcessId: 10,
        CommandLine: 'WorkBuddy.exe --type=renderer --user-data-dir=C:\\wb\\app',
      },
      {
        ProcessId: 10,
        ParentProcessId: 1,
        CommandLine: 'C:\\Program Files\\WorkBuddy\\WorkBuddy.exe',
      },
    ])
    const ok = listWorkbuddyMainProcesses(() => okJson)
    assert.ok(Array.isArray(ok), '仍须是数组,既有调用方按 length/遍历消费')
    assert.equal(ok.probe.ok, true, '成功臂必须标 ok:true')
    assert.equal(typeof ok.length, 'number')

    const bad = [
      listWorkbuddyMainProcesses(() => {
        throw Object.assign(new Error('boom'), { code: 'ETIMEDOUT' })
      }),
      listWorkbuddyMainProcesses(() => ''),
      listWorkbuddyMainProcesses(() => 'not-json'),
    ]
    for (const r of bad) {
      assert.equal(r.length, 0, '探测失败仍是空数组(数组消费形态不变)')
      assert.equal(r.probe.ok, false, '但必须标未判定,不得读成"未发现主进程"')
      assert.ok(r.probe.reason.length > 0, '必须带得出原因,下游才喊得出口')
    }
  },
)

// —— ⑨–⑪ 双版进程面(2026-11-11 立):国际版 exe=WorkBuddyAI.exe 曾被过滤器整个漏掉 ——

test('⑨ chooseWorkbuddyMain 三臂:空=not-running / 单=直取 / 双未点名=ambiguous(文案含两版清单)', () => {
  const stable = { pid: 111, userDataDir: 'C:/Users/U/.workbuddy/app' }
  const ai = { pid: 222, userDataDir: 'C:/Users/U/.workbuddy-ai/app' }
  assert.throws(
    () => W.chooseWorkbuddyMain([]),
    (e) => e.code === 'not-running',
  )
  assert.deepEqual(W.chooseWorkbuddyMain([stable]), stable)
  assert.deepEqual(W.chooseWorkbuddyMain([ai], 'workbuddy-ai'), ai)
  assert.deepEqual(W.chooseWorkbuddyMain([stable, ai], 'workbuddy'), stable)
  assert.throws(
    () => W.chooseWorkbuddyMain([stable, ai]),
    (e) => {
      assert.equal(e.code, 'ambiguous-process')
      assert.match(e.message, /workbuddy-ai/, '歧义文案必须点名撞上的版本,调用方才看得见')
      return true
    },
  )
  // 点名点空(只跑稳定版却点名 ai):本函数把"单候选直取"留给调用方 ⇒ 返回那唯一枚，
  // 一致性由 extractWorkbuddyAccount 的 edition-mismatch 臂判(2026-11-11 定档:
  // 只有一个根时"点名点错"是提问侧的问题,不是歧义,不得吞成 ambiguous 文案)
  assert.deepEqual(W.chooseWorkbuddyMain([stable], 'workbuddy-ai'), stable)
  // 变异自证:判定若退化为 mains[0] 优先(忽略点名),本条即红
  assert.equal(W.chooseWorkbuddyMain([stable, ai], 'workbuddy-ai').pid, 222)
})

test('⑩ CIM 探测面由 WB_EXE_BY_EDITION 派生:两版进程名都进 Filter,旧单名硬编码不得回潮', () => {
  let seenScript = ''
  const fakeExec = (_cmd, args) => {
    seenScript = args[args.length - 1]
    return '[]'
  }
  listWorkbuddyMainProcesses(fakeExec)
  for (const exe of Object.values(W.WB_EXE_BY_EDITION)) {
    assert.ok(seenScript.includes(exe), `Filter 必须含 ${exe}(派生自登记表,不是手写清单)`)
  }
  assert.ok(/OR/.test(seenScript), '多版本必须拼进同一条 Filter')
  // 形状锁:探测面只许从 WB_EXE_BY_EDITION 取值拼,不许再出现手写的单进程名 Filter
  const src = fs.readFileSync(new URL('../lib/workbuddy-auth-extract.mjs', import.meta.url), 'utf8')
  assert.equal(
    /Name='WorkBuddy\.exe'/.test(src),
    false,
    '旧版硬编码 Name=…WorkBuddy.exe 单名过滤器已废,回潮即红',
  )
  assert.match(src, /Object\.values\(WB_EXE_BY_EDITION\)/, 'Filter 必须由登记表派生(§0.6)')
})

test('⑪ 登记表成套性:版本表与进程名表键集互为镜像,缺一边即红', () => {
  assert.deepEqual(
    Object.keys(W.WB_EXE_BY_EDITION).sort(),
    Object.keys(W.AUTH_FILE_BY_EDITION).sort(),
  )
  for (const [k, v] of Object.entries(W.WB_EXE_BY_EDITION)) {
    assert.match(v, /^[A-Za-z0-9_-]+\.exe$/, `${k} 的进程名必须是裸 exe 名(WQL 拼接形状): ${v}`)
  }
})

test('⑫ assertRealmMatchesEdition 双臂:claims 域优先,auth.domain 明文兜底,两臂皆空照旧拒', () => {
  // 2026-11-11 本机取证:AI 版 5.9.3 的 accessToken/refreshToken envelope 是密封包装不是 JWT,
  // claims 臂恒空;域的真正载体 = 解密树明文 auth.domain="www.workbuddy.ai"
  W.assertRealmMatchesEdition('workbuddy', { domain: 'whatever' }) // 国内版直接放行,不看域
  W.assertRealmMatchesEdition('workbuddy-ai', { domain: 'www.workbuddy.ai' })
  W.assertRealmMatchesEdition('workbuddy-ai', null, 'www.workbuddy.ai')
  W.assertRealmMatchesEdition('workbuddy-ai', { data: { domain: 'cn.workbuddy.ai' } })
  assert.throws(
    () => W.assertRealmMatchesEdition('workbuddy-ai', null, null),
    (e) => e.code === 'realm-undetermined',
  )
  assert.throws(
    () => W.assertRealmMatchesEdition('workbuddy-ai', {}, 'copilot.tencent.com'),
    (e) => e.code === 'realm-undetermined',
  )
  // 变异自证:fallback 若被拼到 claims 之前(错域照收),这条即红
  assert.throws(
    () =>
      W.assertRealmMatchesEdition(
        'workbuddy-ai',
        { domain: 'evil.example.com' },
        'www.workbuddy.ai',
      ),
    (e) => e.code === 'realm-undetermined',
    'claims 臂优先判否时不得被 fallback 臂洗白',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
