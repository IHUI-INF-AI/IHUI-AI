// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收敛器"远端在哪"的唯一取法 —— `resolveRemoteHead` 的镜像测试(§22c/§22d:直接 import 源导出,无镜像常量)。
 *
 * 立因(两条现场,都不是推断):
 *  ① AGENTS §5b 实测:本机宿主清理层会删掉 depth≥2 的 remote-tracking ref,而 `packed-refs`
 *    里的旧值照样被 `rev-parse origin/main` 读回来 —— 那一刻它是**上一次同步时**的答案。
 *    收敛器全部决策(已收敛/已被包含/分叉/合并输入新鲜度/推送后回读)都建在这个值上,
 *    拿残值落槌有两种错向且都不报错:残值==本地 ⇒ 报"已收敛"根本不推(提交堆在本地);
 *    残值落后 ⇒ 去合一个早已不存在的分叉。
 *  ② 本仓实测到 `git-sync-converge` 一次以 node 栈退出(fetch/rev-parse 抛而未分类)——
 *    收敛器停摆的代价是各会话在 main 上越堆越深,所以"取不到"必须是分类过的无法判定。
 *
 * 判据分支不可构造 = 判据未被验证 ⇒ 三态用**注入的 run** 构造,再用真临时裸仓证明
 * "残值确实存在且确实错"(只测注入会退化成把自己的假设写成断言)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as src } from '../git-sync-converge.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { resolveRemoteHead, alignFailureNote, ensureCommitObjectPresent } = src
const SHA = /^[0-9a-f]{40}$/

/** 按命令前缀应答的假 git(只用来构造"ls-remote 通/不通、FETCH_HEAD 有没有"这几态) */
const fakeRun = (table) => (args) => {
  const key = args[0]
  const v = table[key]
  if (v instanceof Error) throw v
  if (v === undefined) throw new Error(`fake git:没编这条命令 ${args.join(' ')}`)
  return v
}

test('三态之一:ls-remote 可达时用服务器当次真值(不再回头看本地指针)', () => {
  const r = resolveRemoteHead('main', {
    run: fakeRun({ 'ls-remote': `${'a'.repeat(40)}\trefs/heads/main` }),
  })
  assert.equal(r.sha, 'a'.repeat(40))
  assert.match(r.source, /ls-remote/)
})

test('三态之二:ls-remote 不可达但本轮 fetch 成功 ⇒ 用 FETCH_HEAD 并**如实标注来源**', () => {
  const r = resolveRemoteHead('main', {
    fetchedNow: true,
    run: fakeRun({ 'ls-remote': new Error('offline'), 'rev-parse': 'b'.repeat(40) }),
  })
  assert.equal(r.sha, 'b'.repeat(40))
  assert.match(r.source, /FETCH_HEAD/)
})

test('三态之三:只剩跟踪 ref 残值 ⇒ 判"无法判定",绝不拿它落槌(且不得抛异常)', () => {
  const r = resolveRemoteHead('main', {
    fetchedNow: false,
    run: fakeRun({ 'ls-remote': new Error('offline'), 'rev-parse': 'c'.repeat(40) }),
  })
  assert.equal(r.sha, null)
  assert.equal(r.stale, 'c'.repeat(40), '残值要随结论一起报出来(供诊断),但不能变成结论')
  assert.match(r.reason, /不足以判定/)
})

test('反向对照:三档全空 ⇒ 无法判定,reason 说清是"远端无此分支"还是"不可达"', () => {
  const a = resolveRemoteHead('main', { run: fakeRun({ 'ls-remote': '' }) })
  assert.equal(a.sha, null)
  assert.match(a.reason, /无该分支输出|不可达/)
  const b = resolveRemoteHead('main', { run: fakeRun({ 'ls-remote': new Error('proxy down') }) })
  assert.equal(b.sha, null)
  assert.match(b.reason, /proxy down/)
})

test('真临时仓:跟踪 ref 落后时,旧取法拿到的是过期值而 resolveRemoteHead 拿到服务器真值', () => {
  const dir = mkScratch('converge-rhead')
  try {
    const bare = join(dir, 'origin.git')
    const work = join(dir, 'work')
    const other = join(dir, 'other')
    const g = (cwd, args) =>
      execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
        cwd,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
    mkdirSync(bare, { recursive: true })
    // 裸仓必须把 HEAD 指到 main:否则 clone 端会因"远程 HEAD 指向不存在的分支"检出空树,
    // 第二台机的提交没有共同祖先,推送被拒成 non-fast-forward(夹具自伤,不是被测判据)
    g(dir, ['init', '-q', '--bare', '-b', 'main', bare])
    mkdirSync(work, { recursive: true })
    g(work, ['clone', '-q', bare, 'w'])
    const w = join(work, 'w')
    g(w, ['config', 'user.email', 't@t.local'])
    g(w, ['config', 'user.name', 't'])
    writeFileSync(join(w, 'a.txt'), 'one\n')
    g(w, ['add', '-A'])
    g(w, ['commit', '-qm', 'one'])
    g(w, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])
    // 另一台机推了一枚新提交,而 w 这份**没有 fetch** ⇒ w 的 refs/remotes/origin/main 是旧值
    mkdirSync(other, { recursive: true })
    // 两处 clone 都显式 `-b main`:裸仓 HEAD 与推送目标分支不同名时,clone 会检出空树,
    // 第二枚提交没有共同祖先 ⇒ 推送被拒成 non-fast-forward。那是**夹具自伤**,不是判据(踩过)。
    g(other, ['clone', '-q', '-b', 'main', bare, 'o'])
    const o = join(other, 'o')
    g(o, ['config', 'user.email', 't@t.local'])
    g(o, ['config', 'user.name', 't'])
    writeFileSync(join(o, 'b.txt'), 'two\n')
    g(o, ['add', '-A'])
    g(o, ['commit', '-qm', 'two'])
    g(o, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])
    const serverTip = g(dir, ['ls-remote', bare, 'refs/heads/main']).split('\t')[0]
    const staleTracking = g(w, ['rev-parse', 'refs/remotes/origin/main'])
    assert.match(serverTip, SHA)
    assert.match(staleTracking, SHA)
    // 这就是那条会被 §5b 清理层留下的"看起来还在、其实过期"的值
    assert.notEqual(serverTip, staleTracking, '夹具必须真造出"服务器已前移而本地指针未动"')
    const run = (args) => g(w, args)
    const got = resolveRemoteHead('main', { run })
    assert.equal(got.sha, serverTip, '必须答对"远端现在在哪",而不是上一次同步时在哪')
    assert.notEqual(got.sha, staleTracking)
    // §5b 现场:松散跟踪 ref 被清掉 ⇒ 旧取法(`rev-parse origin/main`)当场抛异常/回残值
    g(w, ['update-ref', '-d', 'refs/remotes/origin/main'])
    const after = resolveRemoteHead('main', { run })
    assert.equal(after.sha, serverTip, 'ref 被清也不得影响判定(真值在服务器上)')
  } finally {
    rmScratch(dir)
  }
})

test('装车证明:收敛器不再用 `rev-parse origin/<branch>` 做决策(三处取值点全换)', () => {
  // 读**同目录那份源文件**:本用例钉的是"取法已经收口"。等这枚提交入库后它与 HEAD 逐字等值,
  // 而在此之前按 HEAD 读会永远看不到刚改的那三处(= 证明一件还没发生的事)。
  const s = readFileSync(new URL('../git-sync-converge.mjs', import.meta.url), 'utf8')
  const staleUses = (s.match(/rev-parse['"]?\s*,\s*['"`]origin\$\{branch\}/g) || []).length
  assert.equal(staleUses, 0, `还有 ${staleUses} 处拿跟踪 ref 当决策输入 ⇒ 换面没收口完`)
  const uses = (s.match(/resolveRemoteHead\(/g) || []).length
  assert.ok(uses >= 4, `决策点应有 ≥4 处用唯一取法(含定义),实得 ${uses}`)
  assert.ok(
    /const freshR = resolveRemoteHead\(branch/.test(s),
    '合并前的"输入新鲜度复核"必须走唯一取法 —— 残值在这一处最伤(会合掉别人刚推的东西)',
  )
  // 收尾用的子进程也必须封顶:并行会话持有 index.lock 时对齐器会等/失败,无界等待会把
  // "收敛成功后的收尾"变成整条链的挂起点(守门 80 立的正是这一族)
  assert.match(
    s.slice(
      s.indexOf('function alignWorktreeAfterHeadMove'),
      s.indexOf('function alignWorktreeAfterHeadMove') + 1400,
    ),
    /timeout:\s*90_000/,
    'alignWorktreeAfterHeadMove 的子进程必须有 timeout',
  )
})

test('对齐器失败必须报"为什么",不是只剩一行 Command failed', () => {
  // 真实现场:并发会话占着 index.lock ⇒ 子进程 rc=1 + stderr 带 "Unable to create ... index.lock"。
  // 旧写法只打 e.message("Command failed: <argv>"),等于让下一个人重新猜"是被锁还是真坏了"。
  const locked = alignFailureNote({
    status: 1,
    stderr:
      "fatal: Unable to create 'G:/x/.git/index.lock': File exists.\nAnother git process...\n",
  })
  assert.match(locked, /rc=1/, '必须带退出码')
  assert.match(locked, /index\.lock/, '必须带子进程给的真因')
  assert.ok(!/^Command failed/.test(locked), '不得把 argv 那行当结论')
  // 反向对照:没有 stderr 时也要给出原因(rc 未知 + message),不得返回空串
  const bare = alignFailureNote({ message: 'ENOENT: node not found' })
  assert.match(bare, /ENOENT/)
  const empty = alignFailureNote(undefined)
  assert.ok(empty.trim().length > 0, '连异常都没有时也必须留下一句可诊断的话')
  // 超时是独立一态(与"被锁"处置动作不同),必须标出来
  assert.match(alignFailureNote({ timedOut: true, stderr: '' }), /超时/)
})

test(
  '对象存在性核验(功能三态,注入构造):缺失⇒fetch 后仍缺判"无法判定"且不抛;' +
    '在位⇒不多发 fetch;fetch 补回⇒必须带 recoveredByFetch',
  () => {
    const missing = 'd'.repeat(40)
    const calls = []
    const r = ensureCommitObjectPresent(missing, 'main', {
      run: (args) => {
        calls.push(args[0])
        return args[0] === 'cat-file' ? null : ''
      },
    })
    assert.equal(r.ok, false, '补不到必须判无法判定,绝不静默通过(把"没判"写成"判过了")')
    assert.ok(r.reason.includes('d'.repeat(11)), '原因必须点名是哪个 sha')
    assert.ok(/fetch origin main/.test(r.reason), '原因必须写清已试过哪条自愈路径')
    assert.deepEqual(calls, ['cat-file', 'fetch', 'cat-file'], '次序:核验→自愈 fetch→复核')

    let fetches = 0
    const inPlace = ensureCommitObjectPresent('a'.repeat(40), 'main', {
      run: (args) => {
        if (args[0] === 'fetch') fetches++
        return ''
      },
    })
    assert.equal(inPlace.ok, true)
    assert.equal(fetches, 0, '对象在位时不得发多余 fetch(每轮都白跑一次网络)')
    assert.ok(!inPlace.recoveredByFetch)

    let probes = 0
    const recovered = ensureCommitObjectPresent('b'.repeat(40), 'main', {
      run: (args) => (args[0] === 'cat-file' ? (probes++ === 0 ? null : '') : ''),
    })
    assert.equal(recovered.ok, true)
    assert.equal(recovered.recoveredByFetch, true, '自愈成功必须可被调用方区分并留痕')
  },
)

test(
  '装车证明:对象核验在 main 循环里是唯一一处,且在任何需要对象的消费者(isAncestor/merge-base)之前;' +
    '未预期异常出口不得再打裸栈',
  () => {
    // 与上一条"装车证明"同理读同目录源文件:钉的是"收口已经发生"。
    const s = readFileSync(new URL('../git-sync-converge.mjs', import.meta.url), 'utf8')
    const body = s.slice(s.indexOf('function main()'))
    const calls = body.match(/ensureCommitObjectPresent\(/g) || []
    assert.equal(calls.length, 1, `核验必须唯一一处,实得 ${calls.length} 处(各调用点各写一份必然漂移)`)
    const at = body.indexOf('ensureCommitObjectPresent(remoteHead, branch)')
    assert.ok(at > -1, 'main 循环必须核的是当轮解析出的 remoteHead(而非某个下游别名)')
    assert.ok(
      at < body.indexOf('isAncestor(localHead, remoteHead)'),
      '必须在 isAncestor 之前 —— 它对缺对象静默返回 false,会把"本地纯领先"判错方向',
    )
    assert.ok(
      at < body.indexOf("git(['merge-base', freshLocal, freshRemote])"),
      '必须在 merge-base 之前 —— 它就是 2026-09-27 两处裸栈崩溃的爆点',
    )
    // 核验失败必须 continue(转下一轮重取),不得 exit(0) 冒充收敛完成
    const guardBlock = body.slice(at, at + 600)
    assert.match(guardBlock, /continue/, '补不到要跳过本轮')
    assert.ok(!/if \(!obj\.ok\)[\s\S]{0,200}process\.exit\(0\)/.test(guardBlock), '绝不记绿')
    // 收尾 catch 只打可读原因(alignFailureNote),不再打 e.stack
    const tail = s.slice(s.indexOf('if (isDirectRun)'))
    assert.match(tail, /alignFailureNote\(e\)/, '未预期异常必须给一行可诊断原因')
    assert.ok(!/e\?\.stack/.test(tail), '裸栈退出就是本次要根治的形态')
  },
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
