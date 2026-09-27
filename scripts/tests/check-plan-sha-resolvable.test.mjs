// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-plan-sha-resolvable.mjs` 的 §22c 镜像测试。
 *
 * 判据不被复制一份到这里（红线：镜像常量只复读实现就是复读机）—— 全部通过源脚本 export 的
 * `__test__` 直接调用；端到端那几例则**真起临时 git 仓**跑 CLI，因为"取哪个面""枚举 0 条判死"
 * 这类行为是 main() 的分支，只能用真进程证明。
 *
 * 夹具落点走 `scripts/lib/scratch-dir.mjs`（§26：不落 os.tmpdir()、不落仓库树内）。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { __test__ as R } from '../check-plan-sha-resolvable.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'check-plan-sha-resolvable.mjs')
// 与门本身同一把 git：绝对路径由 face-reader 解析（§5b：不得依赖调用者的 PATH）
const GIT = gitBinary()

function gitAt(repo, args, opts = {}) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', repo, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  })
}

/** 造一个真 git 仓：一次 commit，返回 {dir, sha, cleanup} */
function scratchRepo(planText) {
  const dir = mkScratch('plan-sha')
  gitAt(dir, ['init', '-q', '--initial-branch=main'])
  gitAt(dir, ['config', 'user.email', 't@local'])
  gitAt(dir, ['config', 'user.name', 't'])
  fs.writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), planText, 'utf8')
  gitAt(dir, ['add', '--', 'PROJECT_PLAN.md'])
  gitAt(dir, ['commit', '-q', '-m', 'init'])
  const sha = gitAt(dir, ['rev-parse', 'HEAD']).trim()
  return {
    dir,
    sha,
    write(text, { stage = true } = {}) {
      fs.writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), text, 'utf8')
      if (stage) gitAt(dir, ['add', '--', 'PROJECT_PLAN.md'])
    },
    cleanup: () => rmScratch(dir),
  }
}

function runCli(root, extra = []) {
  const out = []
  let status = 0
  try {
    out.push(
      execFileSync(process.execPath, [SCRIPT, '--root', root, ...extra], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    )
  } catch (e) {
    status = typeof e?.status === 'number' ? e.status : 2
    if (e?.stdout) out.push(e.stdout)
    if (e?.stderr) out.push(e.stderr)
  }
  const text = out.join('')
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* 非 --json 档 */
  }
  return { text, status, json }
}

const FAKE = 'deadbeefcafe1234' // 16 位：长度档之外
const MISSING = 'ff00ff00f1' // 10 位、含字母：形状像 sha，对象库里没有

test('T1 真 sha（临时仓现算）必须判可解析', () => {
  const r = scratchRepo(`落点:commit \`${r0(MISSING)}\`\n`)
  try {
    const st = R.probeTokens(r.dir, [r.sha, r.sha.slice(0, 7), r.sha.slice(0, 10), MISSING])
    assert.equal(st.get(r.sha), 'resolvable', '全量 40 位必须可解析')
    assert.equal(st.get(r.sha.slice(0, 7)), 'resolvable', '7 位缩写被 git 展开后必须可解析')
    assert.equal(st.get(r.sha.slice(0, 10)), 'resolvable', '10 位缩写同上')
  } finally {
    r.cleanup()
  }
})

function r0(x) {
  return x
}

test('T2 对象库里没有的 sha ⇒ 判"取不到"，并被 CLI 点名（含行原文与探测原话）', () => {
  const r = scratchRepo(`- [x] 承载它的提交 \`${MISSING}\` 是出处\n`)
  try {
    const got = runCli(r.dir, ['--json'])
    assert.ok(got.json, 'CLI --json 必须可 parse：' + got.text.slice(0, 200))
    assert.equal(got.json.unresolvable.length, 1, '腐烂应恰好 1 枚')
    assert.equal(got.json.unresolvable[0].token, MISSING)
    assert.equal(got.json.unresolvable[0].occurrences[0].line, 1)
    assert.match(got.json.unresolvable[0].occurrences[0].text, /承载它的提交/)
    // 默认档 warn：有腐烂也 exit 0
    assert.equal(runCli(r.dir).status, 0, 'warn 级默认档不得因存量腐烂非零退出')
    // --strict 才问责
    assert.equal(runCli(r.dir, ['--strict']).status, 1, '--strict 下有腐烂必须 exit 1')
  } finally {
    r.cleanup()
  }
})

test('T3 形状歧义那一族落"判不出"，绝不进腐烂清单，也绝不算通过', () => {
  const r = scratchRepo(
    [
      `integrity sha512-${FAKE}`, // 16 位：长度不属于缩写档/全量档
      '锚定块指纹 `83386845` 与 20260926', // 全数字：日期/计数/run id 同形
      '色板 #a3c4d6ff', // 紧跟 #
    ].join('\n') + '\n',
  )
  try {
    const got = runCli(r.dir, ['--json'])
    assert.equal(got.json.unresolvable.length, 0, '形状歧义不得被写成腐烂')
    assert.ok(got.json.undetermined.length >= 3, '三族都须计入未判定：' + JSON.stringify(got.json.undetermined))
    assert.ok(got.json.undetermined.every((x) => x.kind === '形状歧义'))
    // 未判定不阻塞 warn 档，但 --strict 拒绝出合格证（exit 2）
    assert.equal(runCli(r.dir).status, 0)
    assert.equal(runCli(r.dir, ['--strict']).status, 2, '--strict 下有未判定必须 exit 2（不出合格证）')
  } finally {
    r.cleanup()
  }
})

test('T4 空台账 / 枚举 0 条判死，不记绿', () => {
  const r = scratchRepo('# 计划\n\n这一页没有任何 sha 形态引用。\n')
  try {
    const got = runCli(r.dir)
    assert.equal(got.status, 2, '抽不到任何候选必须 exit 2，而不是"0 违规通过"')
    assert.match(got.text, /末行读数：面=.*候选=0/)
  } finally {
    r.cleanup()
  }
})

test('T5 取材面：--staged 判索引、缺省判 HEAD，两面同轮且互不回落', () => {
  const headText = `- [x] 出处 \`${MISSING}\`\n` // HEAD 里这一枚本来就取不到
  // 建仓时 HEAD 版本含 1 枚腐烂；再把索引改成"只剩真 sha"⇒ 两面结论必须不同形
  const r = scratchRepo(headText)
  try {
    const before = runCli(r.dir, ['--json'])
    assert.equal(before.json.unresolvable.length, 1, 'HEAD 面：1 枚取不到')
    const beforeStaged = runCli(r.dir, ['--staged', '--json'])
    assert.equal(beforeStaged.json.unresolvable.length, 1, '索引未变时 staged 面与 HEAD 面同结论')

    r.write(`- [x] 出处 \`${r.sha}\`\n`) // 索引换成干净版（工作树同）
    const nowHead = runCli(r.dir, ['--json'])
    const nowStaged = runCli(r.dir, ['--staged', '--json'])
    assert.equal(nowHead.json.unresolvable.length, 1, 'HEAD 档必须仍读 HEAD 那版（不受索引影响）')
    assert.equal(nowStaged.json.unresolvable.length, 0, '--staged 档必须读索引那版（不回落 HEAD）')

    // 索引里根本没有该路径 ⇒ 只能判"无法判定"，禁止借 HEAD 内容凑数
    gitAt(r.dir, ['rm', '--cached', '-q', '--', 'PROJECT_PLAN.md'])
    const gone = runCli(r.dir, ['--staged'])
    assert.equal(gone.status, 2, '索引取不到 ⇒ exit 2，绝不冒绿')
    assert.match(gone.text, /无法判定/)
  } finally {
    r.cleanup()
  }
})

test('T6 两面旗同给 ⇒ 判死（不得默认选一个面）', () => {
  const r = scratchRepo(`出处 \`${MISSING}\`\n`)
  try {
    assert.equal(runCli(r.dir, ['--staged', '--worktree']).status, 2)
  } finally {
    r.cleanup()
  }
})

test('T7 源码形状锁：正文必须走 face-reader 的读取入口，索引规格必须带前导冒号', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '未复用取材层 = 守门 118 的半接线红')
  assert.match(src, /catBatch\(/, '正文必须经层里的 catBatch 读（只 import 不调用就是半接线）')
  assert.match(src, /readWorktreeFile\(/, '--worktree 面必须走层里的工作树出口')
  // 这条锁住本票真实踩过的一处假死：`cat-file --batch` 对裸路径回答 missing
  assert.match(src, /face === 'staged' \? `:\$\{PLAN_PATH\}`/, '索引档规格漏了前导冒号 ⇒ --staged 永远取不到')
  // 不得自己拼 git show / 直接 readFileSync 台账正文
  assert.doesNotMatch(src, /execSync\(/, '禁止自派生 git 读正文')
  assert.doesNotMatch(src, /readFileSync\(path\.join\(\s*(ROOT|DEFAULT_ROOT)/, '禁止按磁盘读被审正文')
  // selectFace 返回 {face,error}；当字符串用会让三面悄悄同读 HEAD
  assert.match(src, /got\.face/, '选面必须取 selectFace 结果里的 .face')
})

test('T8 真仓阳性对照：判据对真实台账有牙（看不见存量不算通过）', () => {
  const { text } = R.loadPlan(R.ROOT, 'head')
  const cands = R.extractCandidates(text)
  assert.ok(cands.length > 500, `真台账应抽出成百枚候选，实得 ${cands.length}`)
  const st = R.probeTokens(
    R.ROOT,
    cands.filter((c) => c.shape.kind === 'candidate').map((c) => c.token),
  )
  const sum = R.summarize(cands, st)
  assert.ok(sum.resolvable.length > 100, `真台账必须有大量可解析指针，实得 ${sum.resolvable.length}`)
  assert.ok(sum.unresolvable.length > 0, '真台账确有腐烂（若为 0 说明判据瞎了，不是仓库干净了）')
  // 形态标签必须在登记表内 —— 漂了就是"匹配式与真实形态互不相认"那一型
  const known = new Set(Object.keys(R.FORM_SAMPLES))
  for (const f of new Set(cands.map((c) => c.form))) assert.ok(known.has(f), `未登记的形态标签：${f}`)
})

test('T9 三态永不互相顶替（summarize 层的构造面证明）', () => {
  const mk = (token, shapeKind = 'candidate') => ({
    token,
    line: 1,
    form: 'bare',
    shape: shapeKind === 'candidate' ? { kind: 'candidate' } : R.classifyShape(token),
    lineText: '',
  })
  const st = new Map([
    ['aaaaaaa11', 'resolvable'],
    ['bbbbbbb11', 'unresolvable'],
    ['ccccccc11', 'undetermined'],
  ])
  const r = R.summarize(
    [mk('aaaaaaa11'), mk('bbbbbbb11'), mk('ccccccc11'), mk('202609260', 'ambiguous')],
    st,
  )
  assert.deepEqual([r.resolvable.length, r.unresolvable.length, r.undetermined.length], [1, 1, 2])
  assert.equal(r.shapeAmbiguous.length + r.probeAmbiguous.length, 2)
  assert.equal(r.unresolvable.length, 1, '腐烂数里不得混进未判定')
})

test('T10 决定表：同一份三态读数在 warn / strict 下必须给出不同退出码', () => {
  const d = (strict) => R.decideExit({ scanned: 9000, found: 10, unresolvable: 0, undetermined: 3, strict })
  assert.equal(d(false), 0, 'warn 档：未判定不拦')
  assert.equal(d(true), 2, 'strict 档：有未判定就拒绝出合格证')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
