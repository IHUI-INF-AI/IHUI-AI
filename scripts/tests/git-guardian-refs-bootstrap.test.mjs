// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 嵌套 ref 存续层的"空清单失明"镜像测试(2026-10-05 夜间巡检立)。
 *
 * 现场(不是假想):`D:/IHUI-AI-git-repo/refs-manifest.json` 实测是 `{}`(2 字节),
 * 而旧 `refsOk()` 写的是 `if (Object.keys(m).length === 0) return true`,注释称
 * "未 bootstrap 时不算异常(healRefs 会补)" —— 但 `healRefs()` 唯一的调用点在
 * `remediate()` 里,而 `remediate()` 只在健康判据**不通过**时才进(`if (coreOk && before.refsOk)`
 * 直接早退并打印"✅ … 嵌套 ref 完整")。两句话合起来是一个死锁:
 * 空清单 ⇒ 判健康 ⇒ 不跑 heal ⇒ 清单永不再被学习。
 * 账面每轮绿,实际 5143 个 depth>=2 的 ref(含 §22 明令禁删的 backup/lost-commit tag)
 * 一旦再被宿主清理层删掉就没有任何离线重建依据。
 *
 * 本文件钉五件事:
 *  ① 纯函数四态(未 bootstrap / 无东西可守 / 齐备 / 缺失)+ 取不到落未判定;
 *  ② 方向锁:旧那句"清单为空即 return true"不得回来;
 *  ③ 装车锁:`refsOk()` 真委托给 `refsVerdict()`、status 真带 refsReason、
 *     anomalyLine 真点名 unbootstrapped、remediate 仍用 `!refsOk()` 作闸门
 *     (判据改了而调用点没改 = 提交链上生效 0 次,本文件所在仓记过多次);
 *  ④ 端到端有牙:临时仓里"盘上有嵌套 ref 而清单缺席"必须被真子进程判成
 *     `refsOk:false / refsReason:'unbootstrapped'`,写回清单后同一面必须翻成 `ok`
 *     —— 两条同时成立才证明它既不是恒假也不是恒真;
 *  ⑤ 反向对照(防恒红):"盘上没有嵌套 ref 且清单为空"必须判 ok,否则就是在给
 *     干净机器造一台与任何提交都无关的恒红门(§12e)。
 *
 * 变异归属(2026-10-05 实测,不是叙述):把 `refsOk()` 逐字改回旧实现
 * (`if (Object.keys(m).length === 0) return true` + 自己调 missingRefs)后重跑本文件 ⇒
 * **T2 红**(两条断言各命中:空清单那句回来了 + refsOk 绕过 refsVerdict 自己取材),
 * 其余五臂保持绿;还原后 6/6 绿,还原件与变更前备份 `cmp` 逐字节一致。
 * T4/T5 为什么不红是**有用的事实**:status() 读的是 refsVerdict 那一份,与 refsOk 的
 * 函数体无关 —— 这恰好说明"判据改一处、调用点各有一份"能长成什么样,所以 T2 的第二条
 * 锁(单实现)才是真正兜住这一型的那条,而不是端到端那条。
 *
 * 全程只在 mkScratch 临时仓里跑,绝不碰活 gitdir / 活恢复源(有专门断言兜这条)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitdir } from '../lib/gitdir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GUARDIAN = join(HERE, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

function git(args, cwd) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 60_000,
  }).trim()
}

/**
 * 临时仓夹具:.git 是**目录**形态(与本机 separate-git-dir 形态不同,但 resolveGitdir
 * 两条都认);创建后立即验证 gitdir 解析落在夹具里,绝不落生产 gitdir —— 缺这条断言时,
 * 任何一次"顺手写清单"都会写到 D:/IHUI-AI-git-repo 上(§5b 禁改区)。
 */
function makeRepo({ withNestedTag }) {
  const dir = mkScratch('ihui-refsboot-')
  const wt = join(dir, `wt-${basename(dir)}`)
  mkdirSync(wt, { recursive: true })
  git(['init', '-q', '-b', 'main'], wt)
  writeFileSync(join(wt, 'a.txt'), 'v1\n')
  git(['add', 'a.txt'], wt)
  git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v1'], wt)
  const sha = git(['rev-parse', 'HEAD'], wt)
  if (withNestedTag) {
    // refs/tags/<ns>/<name> 是 depth>=4 的嵌套命名空间,正是宿主清理层的目标形态
    git(['tag', 'nightly-fixture/one', sha], wt)
    // 回读验证:§12d「假成功」那一型 —— update-ref/tag 可能返回 0 却不落盘
    assert.equal(git(['rev-parse', '--verify', 'refs/tags/nightly-fixture/one'], wt), sha)
  }
  const gitdir = resolveGitdir(wt)
  assert.ok(
    gitdir.replace(/\\/g, '/').startsWith(dir.replace(/\\/g, '/')),
    `夹具 gitdir 解析到了夹具之外:${gitdir} —— 测试会碰生产 gitdir,立即修夹具`,
  )
  return { dir, wt, gitdir, sha }
}

/** 跑真子进程 `--status`(只读、零副作用),解析 JSON 拿 refs 那一维 */
function runStatus(wt) {
  const r = spawnSync(process.execPath, [GUARDIAN, '--status'], {
    cwd: wt,
    encoding: 'utf8',
    env: { ...process.env, IHUI_WORKTREE: wt },
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `--status 子进程退出码非 0:${String(r.stderr).slice(0, 400)}`)
  return JSON.parse(r.stdout)
}

test('T1 纯函数四态 + 未判定:只有"没东西可守"才允许 ok', () => {
  const j = G.judgeRefsHealth
  assert.equal(typeof j, 'function', 'judgeRefsHealth 必须导出(否则下面全是空测试)')
  // 空清单而盘上有嵌套 ref ⇒ 未 bootstrap ⇒ 不健康(本次立因那一格)
  assert.deepEqual(
    j({ manifestCount: 0, visibleNestedCount: 5143 }),
    { ok: false, reason: 'unbootstrapped', manifestCount: 0, visibleNestedCount: 5143, missingCount: 0 },
    '空清单 + 盘上有嵌套 ref 必须判不健康,否则 healRefs 的 bootstrap 分支永不触发',
  )
  // 空清单且盘上也没有 ⇒ 真没事,不得判红(§12e:恒红门唯一结局是逼人跳门)
  assert.equal(j({ manifestCount: 0, visibleNestedCount: 0 }).ok, true)
  assert.equal(j({ manifestCount: 0, visibleNestedCount: 0 }).reason, 'nothing-to-guard')
  // 有清单:齐备 ⇒ ok;缺 3 ⇒ missing
  assert.deepEqual(
    j({ manifestCount: 10, visibleNestedCount: 10, missingCount: 0 }),
    { ok: true, reason: 'ok', manifestCount: 10, visibleNestedCount: 10, missingCount: 0 },
  )
  assert.equal(j({ manifestCount: 10, visibleNestedCount: 10, missingCount: 3 }).ok, false)
  assert.equal(j({ manifestCount: 10, visibleNestedCount: 10, missingCount: 3 }).reason, 'missing')
  // 取不到清单 ⇒ 未判定,既不记绿也不冒红成"缺失 0"
  assert.equal(j({}).ok, false)
  assert.equal(j({}).reason, 'undetermined')
  assert.equal(j({ manifestCount: -1, visibleNestedCount: 0 }).reason, 'undetermined')
})

/**
 * 取某个函数的**函数体**文本(从 `function <name>(` 到第一个顶格 `}`)。
 * 为什么必须按函数体切、不能拿整文件做形状锁:本文件自己的头注与 judgeRefsHealth 的
 * 说明里逐字引用了被废除的旧写法(`if (Object.keys(m).length === 0) return true`)作为
 * 立因记录 —— 整文件正则会把这段**说明文字**读成"旧代码复活",第一版就是这么红的。
 * 说明性文字会带执行性字符,这是本仓记过的那一型(守门 103 的 stripJsonc 同族)。
 */
function fnBody(name) {
  const start = SRC.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `${name} 不见了 —— 判据被整体删除也是这一型,必须喊出来`)
  const rest = SRC.slice(start)
  const end = rest.indexOf('\n}')
  assert.ok(end >= 0, `${name} 的函数体闭合形态解不出`)
  return rest.slice(0, end + 2)
}

test('T2 方向锁:空清单规则只许住在一处 —— refsOk 不得自己另算一遍', () => {
  const body = fnBody('refsOk')
  assert.ok(
    !/length === 0\) return true/.test(body),
    `refsOk 里再现"空清单直接算健康"—— 本测试立因那一型复活,bootstrap 又将永不触发。实得函数体:\n${body}`,
  )
  assert.ok(/refsVerdict\(\)/.test(body), 'refsOk 必须走 refsVerdict 那一份取材(否则判据与报告分叉)')
  // 单实现锁:refsOk 若自己 readRefsManifest/missingRefs,它就与 status() 那份 verdict 变成
  // 两把尺子 —— 本仓"两处算同一件事必漂移"记过最多次的一型。变异自证见文件头"变异归属"段。
  assert.ok(
    !/readRefsManifest\(\)|missingRefs\(\)/.test(body),
    `refsOk 不得绕过 refsVerdict 直接取材(会得到与 status.refsReason 不同形的结论):\n${body}`,
  )
})

test('T3 装车锁:判据改了而调用点没改 = 提交链上生效 0 次', () => {
  assert.ok(/if \(!refsOk\(\)\) healRefs\(\)/.test(SRC), 'remediate 的 refs 闸门必须是 !refsOk()(改判据后它才带得动 bootstrap)')
  assert.ok(
    /refsOk: rv\.ok,[\s\S]{0,400}refsReason: rv\.reason/.test(SRC),
    'status() 必须把 refsReason 一起报出 —— 只报 ok 就还是"把没判写成判过了"',
  )
  assert.ok(SRC.includes("h.refsReason === 'unbootstrapped'"), 'anomalyLine 必须把"未 bootstrap"与"缺失 N 个"分开点名')
  assert.ok(SRC.includes('before.refsReason === '), '--check 的不健康措辞必须按 reason 分流')
})

test('T4 端到端有牙:临时仓"盘上有嵌套 ref 而清单缺席"被真子进程判成未 bootstrap', () => {
  const f = makeRepo({ withNestedTag: true })
  try {
    assert.equal(existsSync(join(f.gitdir, 'refs-manifest.json')), false, '夹具前提:清单必须缺席')
    const s = runStatus(f.wt)
    assert.equal(s.refsOk, false, '空清单 + 有嵌套 ref ⇒ 不得判健康(判健康即本次立因的复活)')
    assert.equal(s.refsReason, 'unbootstrapped', `reason 应为 unbootstrapped,实得 ${s.refsReason}`)
    assert.ok(Number(s.refsNestedVisible) >= 1, '未 bootstrap 时必须量出"盘上有几个无人看守"')
  } finally {
    rmScratch(f.dir)
  }
})

test('T5 同一面写回清单后翻成 ok:证明 T4 不是恒假', () => {
  const f = makeRepo({ withNestedTag: true })
  try {
    const sha = git(['rev-parse', '--verify', 'refs/tags/nightly-fixture/one'], f.wt)
    writeFileSync(
      join(f.gitdir, 'refs-manifest.json'),
      JSON.stringify({ 'refs/tags/nightly-fixture/one': sha }, null, 1) + '\n',
      'utf8',
    )
    const s = runStatus(f.wt)
    assert.equal(s.refsOk, true, '清单补齐后必须判健康,否则这一维变成恒红门')
    assert.equal(s.refsReason, 'ok')
    assert.equal(s.refsManifestCount, 1)
  } finally {
    rmScratch(f.dir)
  }
})

test('T6 反向对照:盘上无嵌套 ref 且清单缺席 ⇒ ok(不得给干净机器造恒红)', () => {
  const f = makeRepo({ withNestedTag: false })
  try {
    const s = runStatus(f.wt)
    assert.equal(s.refsOk, true, '没有东西要守时判红 = 与任何提交都无关的恒红门(§12e)')
    assert.equal(s.refsReason, 'nothing-to-guard')
  } finally {
    rmScratch(f.dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
