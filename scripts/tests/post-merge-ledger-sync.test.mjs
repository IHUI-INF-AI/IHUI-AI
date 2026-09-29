// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/post-merge-ledger-sync.test.mjs —— §22c 镜像:旁路合并落地后自愈唯一出口的判据。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maskComments } from '../lib/code-mask.mjs'
import { postMergeLedgerSync } from '../lib/post-merge-ledger-sync.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = (rel) => readFileSync(join(HERE, '..', rel), 'utf8')
const CODE = (rel) => maskComments(SRC(rel))

test('L1 形状锁:派生必须走 process.execPath + 绝对路径 + windowsHide + timeout,裸 node 不得回来', () => {
  const code = CODE('lib/post-merge-ledger-sync.mjs')
  assert.match(code, /process\.execPath/, '必须用 process.execPath(裸 node 依赖 PATH,守护/服务上下文里不通)')
  assert.doesNotMatch(code, /execFileSync\(\s*'node'/, "不得再写裸 'node' 派生")
  assert.doesNotMatch(code, /spawnSync\(\s*'node'/, "不得再写裸 'node' 派生")
  assert.match(code, /windowsHide:\s*true/, '派生控制台程序漏 windowsHide = 用户桌面反复弹窗(§5b)')
  assert.match(code, /timeout:\s*\d+/, '无 timeout 的只读派生可以在共享工作区里挂死整轮收敛(守门 80 那一型)')
  assert.match(code, /resolve\(/, '脚本路径必须由调用方传入的 root 拼绝对路径,不得依赖 cwd')
})

test('L2 装车锁:两条旁路合并落地路径都必须调本出口 —— 只有一条补跑等于该型缺陷一半从未被兜住', () => {
  for (const rel of ['union-converge.mjs', 'git-sync-converge.mjs']) {
    const code = CODE(rel)
    assert.match(
      code,
      /post-merge-ledger-sync\.mjs/,
      `${rel} 没有 import 本出口 ⇒ 旁路合并落地后守门 71 的登记行自愈永不触发`,
    )
    assert.match(code, /postMergeLedgerSync\(/, `${rel} import 了却没调用(判据存在而永不调用 = 没有)`)
  }
})

test('L3 失败臂:自愈没跑成只喊一行,绝不抛、绝不把零丢失自证通过的合并判成失败', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'D:/IHUI-AI',
    log: (s) => heard.push(s),
    spawnFn: () => ({ status: 1, stderr: 'boom', stdout: '' }),
  })
  assert.equal(r.ok, false, 'rc!=0 必须如实报 ok:false')
  assert.equal(r.ran, true, "'派生成了但脚本失败' 与 '根本没派生' 是两件事,不得并桶")
  assert.equal(heard.length, 1, `必须喊出来(静默的自愈等于没有自愈),实测 ${JSON.stringify(heard)}`)
  assert.match(heard[0], /不阻断/, '措辞必须写明它不改本轮成败')
})

test('L4 成功臂:点名登记行的那些行必须原样交回调用方,不得吞声', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'D:/IHUI-AI',
    log: (s) => heard.push(s),
    spawnFn: () => ({
      status: 0,
      stdout: '无关行\n✅ 回补 2 条计划登记行\n尾行',
      stderr: '',
    }),
  })
  assert.equal(r.ok, true)
  assert.equal(r.lines.length, 1, `只回读点名登记行的那些行,实测 ${JSON.stringify(r.lines)}`)
  assert.equal(heard.length, 1)
})

test('L5 派生抛错臂:与"跑过而失败"分开计,且同样不抛', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'D:/IHUI-AI',
    log: (s) => heard.push(s),
    spawnFn: () => {
      throw new Error('ENOENT')
    },
  })
  assert.equal(r.ok, false)
  assert.equal(r.ran, false, "'没派生成' 不得被读成 '派生过且没问题'")
  assert.equal(heard.length, 1)
})

test('L6 跳门留痕:union-converge 落合并提交必须写进同一本台账(commit-tree 不跑钩子 ⇒ 不写就永远落进 unknown)', () => {
  const code = CODE('union-converge.mjs')
  assert.match(code, /commit-attestation\.mjs/, '留痕只许用 lib/commit-attestation.mjs 那一份实现')
  assert.match(code, /recordBypassLanding\(/, '必须真调用(注释里提一句不算装车)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
