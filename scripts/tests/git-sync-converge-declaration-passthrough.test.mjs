// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):声明透传 —— 「人的声明有没有送达 union-converge / 索引层自证」这一格。
//
// 立因:本器派生 union-converge 时此前一条声明都不转发,索引层那条路更是连表达口都没有,
// 于是 `--take-theirs-doc` 这类**只能由人做**的判断在通道里根本不存在 —— 通道每轮复读
// 同一句判红,人只能绕开本器直接跑收敛器(把 CAS/fetch/推送链一起绕过)。失效形态是
// **安静**的:日志里只看到"又红了一次",看不出"声明压根没送到",所以必须逐条钉行为。
//
// 实测两例(2026-10-28 同一小时内):①对侧 d75e178e26b 结清 O68 删掉登记行;②对侧删
// AGENTS.md 两行 R4 补记。两例本侧对该文件与基线**逐字相同**(零丢失可证),而零丢失自证
// 仍判"本侧已提交内容被吞" ⇒ 整仓同步停摆。D 组用例就是这两例的构造面。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DECLARATION_FLAGS,
  declarationArgs,
  declaredTheirsDocs,
  preAdvanceLocalPreserved,
  localPreservedVerdict,
  ensureUnionModule,
} from '../git-sync-converge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// CLI 入口先 ensureUnionModule() 再 main();测试直接 import 时必须照同一顺序装载闸门尺子,
// 否则默认 union 恒为 null ⇒ 每条用例只会走到"未判定"(与兄弟测试同一前置)。
await ensureUnionModule()

const argv = (...rest) => ['node', 'scripts/git-sync-converge.mjs', ...rest]

test('① 六种声明旗号都转发,且保留原值', () => {
  for (const flag of DECLARATION_FLAGS) {
    assert.deepEqual(declarationArgs(argv(flag, 'PROJECT_PLAN.md')), [flag, 'PROJECT_PLAN.md'], `${flag} 未转发`)
  }
  // 反证:声明旗号与值必须成对出现,缺一不可(只转发旗号 = 子进程拿不到路径)。
  assert.deepEqual(declarationArgs(argv('--take-theirs-doc')), [], '只有旗号没有值时必须不转发')
})

test('② 多条声明保持命令行顺序(顺序变了会改变 pending 声明的命中面)', () => {
  const out = declarationArgs(
    argv('--take-theirs-doc', 'AGENTS.md', '--take-ours', 'README.md', '--supersede', 'PROJECT_PLAN.md=x.json'),
  )
  assert.deepEqual(out, [
    '--take-theirs-doc',
    'AGENTS.md',
    '--take-ours',
    'README.md',
    '--supersede',
    'PROJECT_PLAN.md=x.json',
  ])
})

test('③ 缺值不代猜:后面紧跟另一个旗号 ⇒ 该条丢弃,不编默认路径', () => {
  // 实测形态:`--take-theirs-doc --branch main` —— 人的笔误,不得被读成"声明了 --branch"。
  assert.deepEqual(declarationArgs(argv('--take-theirs-doc', '--branch', 'main')), [])
  // 且不得因此吞掉后面那条合法声明。
  assert.deepEqual(declarationArgs(argv('--take-theirs-doc', '--take-ours', 'README.md')), [
    '--take-ours',
    'README.md',
  ])
})

test('④ 非声明旗号与裸位置参数一律不转发(含本器自己的 --dry-run/--status/--no-proxy)', () => {
  const out = declarationArgs(argv('--dry-run', '--status', '--no-proxy', '--rounds', '3', 'main'))
  assert.deepEqual(out, [], `非声明旗号被误转发:${JSON.stringify(out)}`)
})

test('⑤ 重复声明逐条保留(去重会把"声明两次"读成"声明一次")', () => {
  const out = declarationArgs(argv('--take-theirs-doc', 'AGENTS.md', '--take-theirs-doc', 'AGENTS.md'))
  assert.deepEqual(out, ['--take-theirs-doc', 'AGENTS.md', '--take-theirs-doc', 'AGENTS.md'])
})

test('⑥ 值与旗号同形的边界:值以 -- 开头一律当旗号(不接受),普通值照收', () => {
  assert.deepEqual(declarationArgs(argv('--resolve', '--x=y')), [], '值以 -- 开头必须不转发')
  assert.deepEqual(declarationArgs(argv('--resolve', 'a.mjs=b.txt')), ['--resolve', 'a.mjs=b.txt'])
  // argv 前两位(mode/script)不参与判定:即便里面混进旗号字样也不得被读成声明。
  assert.deepEqual(declarationArgs(['--take-theirs-doc', 'PROJECT_PLAN.md', '--take-ours', 'README.md']), [
    '--take-ours',
    'README.md',
  ])
})

test('⑦ declarationArgs 对非数组入参不抛(派生点可能被注入 undefined)', () => {
  for (const bad of [undefined, null, 'string', 0, {}]) {
    assert.deepEqual(declarationArgs(bad), [], `入参 ${String(bad)} 抛了或不返回空数组`)
  }
})

test('⑧ declaredTheirsDocs:无声明返回 null(不是空 Set),有声明返回路径 Set', () => {
  assert.equal(declaredTheirsDocs(argv('--take-ours', 'README.md')), null, '没声明 take-theirs-doc 时必须 null')
  assert.equal(declaredTheirsDocs(argv()), null)
  const got = declaredTheirsDocs(argv('--take-theirs-doc', 'AGENTS.md', '--take-theirs-doc', 'PROJECT_PLAN.md'))
  assert.deepEqual([...got].sort(), ['AGENTS.md', 'PROJECT_PLAN.md'])
})

// ── D 组:索引层这条路必须能接收声明(2026-10-28 的两次真停摆) ──────────────────
const GIT = 'C:/Program Files/Git/cmd/git.exe'
const DOC = 'AGENTS.md'
const BASE_DOC = '# 规程\n- [ ] 甲 基底行\n- [ ] 乙 对侧后来删掉的行\n'

/**
 * 夹具形状刻意复刻事故:**本侧对这份文档一字未动**(local 面 == base 面),对侧删掉一行,
 * 合并结果 = 对侧那一版。这正是"三方合并的正确行为",零丢失可证 —— 而零丢失自证原先
 * 会判"本侧已提交内容被吞"。
 */
function makeDocRepo() {
  const dir = mkScratch('gsc-declare-')
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...a], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    }).trim()
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  const write = (rel, text) => writeFileSync(join(dir, rel), text, 'utf8')
  const commit = (msg) => {
    g('add', '-A')
    g('commit', '-qm', msg)
    return g('rev-parse', 'HEAD')
  }
  write(DOC, BASE_DOC)
  const base = commit('base')
  // 本侧:只动一个无关文件,文档一字未动(这就是"零丢失可证"的前提)
  write('.keep', 'local\n')
  const local = commit('local: untouched doc')
  // 对侧:从基底分叉,删掉第二行(合法结清)
  g('checkout', '-q', base)
  g('checkout', '-q', '-b', 'remote-side')
  write(DOC, '# 规程\n- [ ] 甲 基底行\n')
  const remote = commit('remote: settle one row')
  // 合并结果 = 对侧那一版(三方合并的正确答案:本侧没改 ⇒ 取对侧)
  g('checkout', '-q', 'main')
  write(DOC, '# 规程\n- [ ] 甲 基底行\n')
  const merged = commit('merge result')
  return { dir, base, local, remote, merged, cleanup: () => rmScratch(dir) }
}

test('D1 反证:本侧对该文档零改动、对侧合法删行 ⇒ 不声明时必须照旧判红(这条牙不许松)', () => {
  const r = makeDocRepo()
  try {
    const got = preAdvanceLocalPreserved({
      local: r.local,
      remote: r.remote,
      tree: r.merged,
      base: r.base,
      cwd: r.dir,
    })
    const reds = got.bad.join(' | ')
    assert.match(reds, /未存活行/, `不声明时必须点名未存活行,实测:${reds || '(无红)'}`)
    assert.equal(localPreservedVerdict(got).status, 'lost', '不声明时不得判绿')
  } finally {
    r.cleanup()
  }
})

test('D2 正证:同一夹具加 --take-theirs-doc 声明 ⇒ 判绿(声明送进去了,不是被吞)', () => {
  const r = makeDocRepo()
  try {
    const got = preAdvanceLocalPreserved({
      local: r.local,
      remote: r.remote,
      tree: r.merged,
      base: r.base,
      cwd: r.dir,
      takeTheirsDocs: declaredTheirsDocs(argv('--take-theirs-doc', DOC)),
    })
    assert.deepEqual(got.bad, [], `声明后仍判红:${got.bad.join(' | ')}`)
    assert.deepEqual(got.undetermined, [], `声明后未判定:${got.undetermined.join(' | ')}`)
    assert.equal(localPreservedVerdict(got).status, 'ok')
  } finally {
    r.cleanup()
  }
})

test('D3 反证:声明了但合并结果并不等于对侧那一份 ⇒ 不得借声明洗白', () => {
  const r = makeDocRepo()
  try {
    // 合并结果改成"连本侧独有行也没了"的形态 ⇒ 整 blob 不等于对侧 ⇒ 声明不能放行。
    const g = (...a) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', '-C', r.dir, ...a], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
      }).trim()
    writeFileSync(join(r.dir, DOC), '# 规程\n', 'utf8')
    g('add', '-A')
    g('commit', '-qm', 'merge result diverges from theirs')
    const diverge = g('rev-parse', 'HEAD')
    const got = preAdvanceLocalPreserved({
      local: r.local,
      remote: r.remote,
      tree: diverge,
      base: r.base,
      cwd: r.dir,
      takeTheirsDocs: declaredTheirsDocs(argv('--take-theirs-doc', DOC)),
    })
    const all = [...got.bad, ...got.undetermined].join(' | ')
    assert.ok(all.length > 0, '合并结果与对侧不同形时,声明不得让它变绿')
    assert.equal(
      localPreservedVerdict(got).status,
      'lost',
      `应判 lost,实测 ${localPreservedVerdict(got).status}:${all}`,
    )
  } finally {
    r.cleanup()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
