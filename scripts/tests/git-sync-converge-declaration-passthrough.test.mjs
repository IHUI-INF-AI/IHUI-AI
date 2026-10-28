// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):声明透传 —— 「人的声明有没有送达 union-converge」这一格。
//
// 立因:本器派生 union-converge 时此前一条声明都不转发,于是 `--take-theirs-doc` 这类
// **只能由人做**的判断在通道里根本表达不了 —— 通道每轮复读同一句判红,人只能绕开本器
// 直接跑收敛器(把 CAS/fetch/推送链一起绕过)。失效形态是**安静**的:日志里只看到
// "又红了一次",看不出"声明压根没送到",所以必须逐条钉行为,不能只读源码字符串。
//
// 钉的五件事:①命中转发 ②相对顺序保持 ③缺值不代猜 ④非声明旗号一律不转发
//             ⑤重复声明逐条保留(去重会把"人声明了两次"读成"只声明了一次")
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DECLARATION_FLAGS, declarationArgs } from '../git-sync-converge.mjs'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
