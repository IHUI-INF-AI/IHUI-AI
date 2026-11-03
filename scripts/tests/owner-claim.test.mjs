// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/owner-claim.mjs(AGENTS §22c 模式)。
//
// 为什么必须有:owner-claim 的文件名不以 check|scan|guard 开头 ⇒ 守门 89 的候选集结构上看不见它,
// 它也不会被接进任何提交链。也就是说**没有任何一道门会发现它算错了**。而它的输出是给人做
// 写盘决策用的(那行 --apply 一旦被复制执行就会改部署机上的数据文件),所以它的四条不变量
// 只能由这里钉:① 三态不并桶 ② 只读 ③ 不落第二份盘符 ④ 凭据面不出现在输出。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SRC = resolve(fileURLToPath(import.meta.url), '../../owner-claim.mjs')
const SRC_TEXT = readFileSync(SRC, 'utf8')
// Windows 裸路径不能直接喂 import()(ERR_UNSUPPORTED_ESM_URL_SCHEME)—— 必须经 file:// URL。
const { __test__ } = await import(pathToFileURL(SRC).href)
const {
  parseOwnerField,
  classifyBlob,
  inspectStoreFile,
  classifyRecords,
  buildClaimLine,
  renderReport,
  LEDGERS,
  REPO_ROOT,
} = __test__

const SECRET = 'SENTINEL-DO-NOT-RENDER-9f3c'
const rowOf = (id, inspected) => ({ ledger: LEDGERS.find((l) => l.id === id), inspected })
const report = (ledgers) =>
  renderReport({
    host: 'testhost',
    repoRoot: '/tmp/repo',
    ownerField: 'owner_user_id',
    ownerFieldSource: 'connector_store.py',
    verdict: 'judged',
    ledgers,
  }).join('\n')
const okRow = (id, records) => ({
  state: 'ok',
  path: `${id}.json`,
  bytes: 1,
  mtime: 'x',
  records,
})

test('T1 三态各自成态:缺文件 / 形态不认识 / 读到 N 条,互不冒充', () => {
  const dir = mkScratch('owner-claim-t1-')
  try {
    assert.equal(inspectStoreFile(join(dir, 'nope.json')).state, 'missing')
    // 0 字节文件(任务描述里说的"空文件")必须落 undetermined,而不是被读成"0 条记录"
    const empty = join(dir, 'empty.json')
    writeFileSync(empty, '', 'utf8')
    assert.equal(inspectStoreFile(empty).state, 'undetermined', '0 字节文件被判成 ok —— 三态并桶了')
    const bad = join(dir, 'bad.json')
    writeFileSync(bad, '[{"key":"a",', 'utf8')
    assert.equal(inspectStoreFile(bad).state, 'undetermined')
    const obj = join(dir, 'obj.json')
    writeFileSync(obj, '{"a":1}', 'utf8')
    assert.equal(inspectStoreFile(obj).state, 'undetermined')
    const good = join(dir, 'good.json')
    writeFileSync(good, '[]', 'utf8')
    const g = inspectStoreFile(good)
    assert.equal(g.state, 'ok')
    assert.equal(g.records.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T2 未判定态的输出里不得出现任何"计数为 0 / 复验通过"字样', () => {
  const t = report([
    rowOf('connector', { path: 'p', state: 'undetermined', reason: 'JSON 不可解析' }),
  ])
  assert.match(t, /未判定/)
  assert.doesNotMatch(t, /无主 0 条/)
  assert.doesNotMatch(t, /复验通过/)
  const m = report([rowOf('mcp', { path: 'p', state: 'missing' })])
  assert.match(m, /没有这个文件/)
  assert.doesNotMatch(m, /无主 0 条/)
})

test('T3 凭据面不渲染:app_secret / env / extra 任一值都不得进输出(名字必须在)', () => {
  const recs = [
    { key: 'k:one', name: '一条记录', app_secret: SECRET, extra: { a: [SECRET, SECRET] } },
    { key: 'k:two', name: '另一条', env: { X: SECRET, nested: { deep: SECRET } } },
  ]
  const t = report([rowOf('connector', okRow('connector', recs)), rowOf('mcp', okRow('mcp', recs))])
  assert.equal(t.split(SECRET).length - 1, 0, '输出含凭据值')
  assert.match(t, /一条记录/)
  assert.match(t, /k:one/)
})

test('T4 认领行形状:账①不带 --store、账②必须带;重复 key 与非安全 key 一律不出行', () => {
  const base = buildClaimLine({ storeFlag: null, key: 'yuque:docs', duplicated: false })
  assert.match(base, /^cd apps\/ai-service && PYTHONIOENCODING=utf-8 \.venv\/Scripts\/python\.exe /)
  assert.match(base, /--claim "yuque:docs=<user_id>" --apply$/)
  assert.doesNotMatch(base, /--store/)
  assert.match(
    buildClaimLine({ storeFlag: LEDGERS[1].storeFlag, key: 'filesystem', duplicated: false }),
    /--store data\/mcp_store\.json/,
  )
  assert.equal(buildClaimLine({ storeFlag: null, key: 'dup:k', duplicated: true }), null)
  assert.equal(buildClaimLine({ storeFlag: null, key: 'bad $(x)', duplicated: false }), null)
  assert.equal(buildClaimLine({ storeFlag: null, key: '', duplicated: false }), null)
  // 拒绝出行的那一条必须在报告里被点名并给出 --claims 出口,而不是静默消失
  const t = report([
    rowOf(
      'connector',
      okRow('connector', [
        { key: 'dup:k', name: '甲' },
        { key: 'dup:k', name: '乙', owner_user_id: '7' },
      ]),
    ),
  ])
  assert.match(t, /同一 key 出现多条/)
  assert.match(t, /不给/)
})

test('T5 属主键名现读 Python 侧那份定义,解析不到 ⇒ 整份判未判定且不给计数', () => {
  assert.equal(parseOwnerField('OWNER_FIELD = "owner_user_id"'), 'owner_user_id')
  assert.equal(parseOwnerField('X = 1'), null)
  const t = renderReport({
    host: 'h',
    repoRoot: 'r',
    ownerField: null,
    ownerFieldSource: 'connector_store.py',
    verdict: 'undetermined',
    ledgers: [],
  }).join('\n')
  assert.match(t, /未判定/)
  assert.doesNotMatch(t, /读到 \d+ 条/)
})

test('T6 分流口径:空串属主=无主、非对象条目单独计堆(回填器会静默丢弃)', () => {
  const c = classifyRecords(
    [
      { key: 'a:a', name: '空串主', owner_user_id: '' },
      { key: 'b:b', name: '有主', owner_user_id: '7' },
      { name: '无 key' },
      '整条不是对象',
      null,
    ],
    'owner_user_id',
  )
  assert.equal(c.ownerlessClaimable.length, 1)
  assert.equal(c.owned.length, 1)
  assert.equal(c.ownerlessUnclaimable.length, 3)
  assert.equal(c.nonObjectDropped, 2)
})

test('T7 只读性源码锁:写盘调用只允许出现在 selfTest 区之内', () => {
  const marker = SRC_TEXT.indexOf('function selfTest(')
  assert.ok(marker > 0, '找不到 selfTest 边界 ⇒ 本条锁失效')
  const writers =
    /\b(writeFileSync|appendFileSync|mkdirSync|rmSync|unlinkSync|renameSync|copyFileSync|createWriteStream|rmScratch)\s*\(/g
  let m
  let before = 0
  let after = 0
  while ((m = writers.exec(SRC_TEXT)) !== null) {
    if (m.index < marker) before += 1
    else after += 1
  }
  assert.equal(before, 0, `巡检路径里出现 ${before} 个写盘/删盘调用 ⇒ 它不再是只读工具`)
  // 反向护栏:上面那条判红若匹配不到任何东西就是恒真的空锁 —— 夹具写入与清理必须在界内被看见。
  assert.ok(after >= 2, `界内只匹配到 ${after} 个写/删调用 ⇒ 判式失效,前一条断言不成立也不算证据`)
})

test('T8 无第二落点:源码内不得出现盘符字面量,仓库根必须由 import.meta.url 推导', () => {
  assert.doesNotMatch(SRC_TEXT, /\b[A-Za-z]:[\\/]{1,2}[A-Za-z0-9_.-]/)
  assert.match(SRC_TEXT, /fileURLToPath\(import\.meta\.url\)/)
  assert.ok(REPO_ROOT && !/^[A-Za-z]:[\\/]Users/i.test(REPO_ROOT))
})

test('T9 它不是守门:源码与头注不得声称已接提交链 / CI / 守门第 N 项', () => {
  assert.doesNotMatch(
    SRC_TEXT,
    /guardian-runner|pre-commit 第|已接 pre-commit|接进提交链|守门第\s*\d+\s*项/,
  )
  assert.match(SRC_TEXT, /不是\*\*守门|它\*\*不是\*\*守门|不是守门/)
})

test('T10 端到端:真跑一次 --self-test 与 --json,且跑完数据文件字节不变', async () => {
  const dataFiles = LEDGERS.map((l) => l.file)
  const before = dataFiles.map((p) => {
    try {
      return readFileSync(p)
    } catch {
      return null
    }
  })
  const st = spawnSync(process.execPath, [SRC, '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(st.status, 0, `--self-test 退出码 ${st.status}\n${st.stdout}\n${st.stderr}`)
  assert.match(st.stdout.trim(), /pass \d+ \/ fail 0$/)
  const js = spawnSync(process.execPath, [SRC, '--json'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.ok([0, 2].includes(js.status), `--json 退出码异常:${js.status}`)
  const parsed = JSON.parse(js.stdout)
  assert.equal(parsed.readOnly, true)
  assert.equal(parsed.ledgers.length, 2)
  for (const l of parsed.ledgers) assert.ok(['ok', 'missing', 'undetermined'].includes(l.state))
  const after = dataFiles.map((p) => {
    try {
      return readFileSync(p)
    } catch {
      return null
    }
  })
  assert.deepEqual(
    after.map((b) => b && b.toString('hex')),
    before.map((b) => b && b.toString('hex')),
  )
})

test('T11 classifyBlob:合法列表 / 非列表 / 半截 JSON / 空串 四态不并桶', () => {
  assert.equal(classifyBlob('[]').state, 'ok')
  assert.equal(classifyBlob('{}').state, 'undetermined')
  assert.equal(classifyBlob('[{').state, 'undetermined')
  assert.equal(classifyBlob('').state, 'undetermined', '空文件不得被读成"没有记录"')
  assert.equal(classifyBlob('\ufeff[]').state, 'undetermined')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
