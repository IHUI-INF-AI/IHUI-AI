#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `isolated-git.mjs` 镜像测试(AGENTS §12i)。钉四件事:
 *  ① 正常提交语义不变:钩子照跑、只交声明集、共享索引不被写入;
 *  ② 两个并发进程各用独立索引,互不覆盖(钩子看到的 staged 面只有自己的文件);
 *  ③ 异常退出留下的索引由下次启动按「宿主 pid 已死」清掉,存活进程的不误删;
 *  ④ 拒绝一切绕门参数/环境(`--no-verify`、`HUSKY=0`、缺路径、缺 -m)。
 *
 * 夹具一律走 `mkScratch()`(AGENTS §15b/§15c),不落工作树、不落 C 盘。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  INDEX_DIR_NAME,
  childEnv,
  restoreIndexFromSnapshot,
  takeIndexSnapshot,
  __test__ as iso,
} from '../isolated-git.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'isolated-git.mjs')

const cleanEnv = (extra = {}) => {
  const env = { ...process.env, ...extra }
  delete env.GIT_INDEX_FILE
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  return env
}

function git(dir, args, opts = {}) {
  const r = spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...opts,
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 失败: ${r.stderr || r.stdout}`)
  return r
}

function makeRepo(prefix = 'iso-git-') {
  const dir = mkScratch(prefix)
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'iso-test@example.invalid'])
  git(dir, ['config', 'user.name', 'iso-test'])
  git(dir, ['config', 'core.hooksPath', '.git/hooks'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(dir, 'a.txt'), 'a0\n')
  writeFileSync(join(dir, 'b.txt'), 'b0\n')
  git(dir, ['add', '--', 'a.txt', 'b.txt'])
  git(dir, ['commit', '-m', 'init', '--no-verify'])
  return dir
}

function writeHook(dir, body) {
  writeFileSync(join(dir, '.git', 'hooks', 'pre-commit'), body, 'utf8')
}

const minor = (dir) => git(dir, ['rev-parse', '--short', 'HEAD']).stdout.trim()
const indexDigest = (dir) =>
  createHash('sha256')
    .update(readFileSync(join(dir, '.git', 'index')))
    .digest('hex')

/** 解析钩子日志里的每个 BLOCK…END 段(重试会产生多段)。 */
function stagedBlocks(text) {
  const blocks = []
  let cur = null
  for (const line of String(text).split(/\r?\n/)) {
    if (line === 'BLOCK') cur = []
    else if (line === 'END') {
      if (cur) blocks.push(cur)
      cur = null
    } else if (cur && line.trim()) cur.push(line.trim())
  }
  return blocks
}

function isolatedFiles(dir) {
  try {
    return readdirSync(join(dir, '.git', INDEX_DIR_NAME))
  } catch {
    return []
  }
}

test('① 正常提交语义:hook 照跑、只交声明集、共享索引收敛、私有索引已清理', () => {
  const dir = makeRepo()
  try {
    const log = join(dir, '.hook.log')
    writeHook(
      dir,
      '#!/bin/sh\n{ echo "INDEX=$GIT_INDEX_FILE"; echo BLOCK; git diff --cached --name-only; echo END; } > "$IHUI_TEST_LOG"\n',
    )
    writeFileSync(join(dir, 'a.txt'), 'a1\n')
    writeFileSync(join(dir, 'b.txt'), 'b1\n') // 故意不声明
    const beforeIndex = indexDigest(dir)

    const r = spawnSync(
      process.execPath,
      [SCRIPT, '-C', dir, 'commit', '-m', 't1', '--', 'a.txt'],
      {
        cwd: dir,
        env: cleanEnv({ IHUI_TEST_LOG: log }),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    assert.equal(r.status, 0, `提交应成功: ${r.stderr}`)

    assert.equal(
      git(dir, ['show', '--name-only', '--format=', 'HEAD']).stdout.trim(),
      'a.txt',
      '载荷只应含声明集',
    )
    assert.equal(
      git(dir, ['diff', '--cached', '--name-only']).stdout.trim(),
      '',
      '干净时共享索引应被 CAS 推进到新 HEAD',
    )
    assert.notEqual(indexDigest(dir), beforeIndex, 'CAS 刷新应真的写入了共享索引')
    assert.equal(
      git(dir, ['status', '--porcelain', '--', 'a.txt', 'b.txt']).stdout.trim(),
      'M b.txt',
      '未声明文件应保持未暂存',
    )

    assert.ok(existsSync(log), 'pre-commit 必须照常执行')
    const text = readFileSync(log, 'utf8')
    for (const b of stagedBlocks(text))
      assert.deepEqual(b, ['a.txt'], '钩子看到的 staged 面只应是声明集')
    const indexLine = text.split(/\r?\n/).find((l) => l.startsWith('INDEX='))
    const hookedIndex = indexLine.slice('INDEX='.length)
    assert.ok(
      hookedIndex.includes(INDEX_DIR_NAME),
      `钩子的 GIT_INDEX_FILE 应指向私有索引: ${hookedIndex}`,
    )
    assert.ok(iso.INDEX_NAME_RE.test(hookedIndex.split(/[\\/]/).pop()), '索引文件名应符合唯一命名')

    assert.deepEqual(isolatedFiles(dir), [], '正常结束后不得残留索引')
  } finally {
    rmScratch(dir)
  }
})

test('② 两个并发进程各用独立索引:钩子各看各的,最终两枚改动都在', async () => {
  const dir = makeRepo('iso-git-conc-')
  const sync = join(dir, '.sync')
  mkdirSync(sync)
  try {
    writeHook(
      dir,
      [
        '#!/bin/sh',
        'touch "$IHUI_TEST_SYNC/$IHUI_TEST_TAG.ready"',
        'i=0',
        'while [ ! -f "$IHUI_TEST_SYNC/go" ] && [ "$i" -lt 100 ]; do sleep 0.05; i=$((i+1)); done',
        '{ echo "INDEX=$GIT_INDEX_FILE"; echo BLOCK; git diff --cached --name-only; echo END; } >> "$IHUI_TEST_LOG"',
        '',
      ].join('\n'),
    )
    writeFileSync(join(dir, 'a.txt'), 'a-conc\n')
    writeFileSync(join(dir, 'b.txt'), 'b-conc\n')

    const runOne = (tag, other) =>
      new Promise((end) => {
        const child = spawn(
          process.execPath,
          [SCRIPT, '-C', dir, 'commit', '-m', `c-${tag}`, '--', `${tag}.txt`],
          {
            cwd: dir,
            env: cleanEnv({
              IHUI_TEST_SYNC: sync,
              IHUI_TEST_TAG: tag,
              IHUI_TEST_OTHER: other,
              IHUI_TEST_LOG: join(sync, `${tag}.log`),
            }),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          },
        )
        let out = ''
        child.stdout.on('data', (d) => (out += d))
        child.stderr.on('data', (d) => (out += d))
        child.on('close', (code) => end({ code, out }))
      })

    const a = runOne('a', 'b')
    for (let i = 0; i < 100 && !existsSync(join(sync, 'a.ready')); i += 1) {
      await new Promise((r) => setTimeout(r, 50))
    }
    const b = runOne('b', 'a')
    for (let i = 0; i < 100 && !existsSync(join(sync, 'b.ready')); i += 1) {
      await new Promise((r) => setTimeout(r, 50))
    }
    // 两个钩子都已进入并在等发令 ⇒ 此刻各自跑 git diff,HEAD 仍稳定在基线上。
    assert.ok(
      existsSync(join(sync, 'a.ready')) && existsSync(join(sync, 'b.ready')),
      '两进程必须同时进入钩子',
    )
    writeFileSync(join(sync, 'go'), '')
    const [ra, rb] = await Promise.all([a, b])

    // 一方可能在另一方提交后被 HEAD CAS 拒绝 ⇒ 本通道内部重试;两者最终都应为 0。
    assert.equal(ra.code, 0, `A 应最终成功: ${ra.out}`)
    assert.equal(rb.code, 0, `B 应最终成功: ${rb.out}`)

    const blocksOf = (p) => stagedBlocks(readFileSync(p, 'utf8'))
    const ta = blocksOf(join(sync, 'a.log'))
    const tb = blocksOf(join(sync, 'b.log'))
    assert.ok(ta.length > 0 && tb.length > 0, '两边钩子都必须执行且留下记录')
    // 真并发下钩子可能落在「对方已提交、本进程即将 CAS 失败重试」的窗口,该轮 diff 会把
    // 对方改动看成回退;能定论的是**最后一次**(即 CAS 成功那轮)的钩子视图。
    assert.deepEqual(ta.at(-1), ['a.txt'], 'A 成功那轮钩子只能看到自己的声明集')
    assert.deepEqual(tb.at(-1), ['b.txt'], 'B 成功那轮钩子只能看到自己的声明集')

    const indexLinesOf = (p) =>
      readFileSync(p, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.startsWith('INDEX='))
    const ia = indexLinesOf(join(sync, 'a.log'))[0]
    const ib = indexLinesOf(join(sync, 'b.log'))[0]
    assert.notEqual(ia, ib, '两进程必须各用一份索引')

    assert.equal(git(dir, ['show', 'HEAD:a.txt']).stdout.trim(), 'a-conc', 'A 的改动不得被 B 覆盖')
    assert.equal(git(dir, ['show', 'HEAD:b.txt']).stdout.trim(), 'b-conc', 'B 的改动不得被 A 覆盖')
    assert.equal(
      git(dir, ['diff', '--cached', '--name-only']).stdout.trim(),
      '',
      '共享索引最终应与新 HEAD 一致',
    )
    assert.equal(
      git(dir, ['status', '--porcelain', '--', 'a.txt', 'b.txt']).stdout.trim(),
      '',
      '两席声明的文件都应是干净态',
    )
    assert.deepEqual(isolatedFiles(dir), [], '并发结束后两份索引都应清理')
  } finally {
    rmScratch(dir)
  }
})

test('③ 异常退出:死进程残留被下次启动清掉,存活进程的文件不误删', () => {
  const dir = makeRepo()
  try {
    const indexDir = join(dir, '.git', INDEX_DIR_NAME)
    mkdirSync(indexDir, { recursive: true })
    const dead = 2_147_483_647
    assert.equal(iso.isPidAlive(dead), false, '夹具 pid 必须是死的')
    const stale = join(indexDir, `${dead}-${Date.now()}-deadbeef.idx`)
    const live = join(indexDir, `${process.pid}-${Date.now()}-cafebabe.idx`)
    writeFileSync(stale, 'stale')
    writeFileSync(live, 'live')
    writeFileSync(join(dir, 'a.txt'), 'a2\n')

    const r = spawnSync(
      process.execPath,
      [SCRIPT, '-C', dir, 'commit', '-m', 't3', '--', 'a.txt'],
      {
        cwd: dir,
        env: cleanEnv(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    assert.equal(r.status, 0, `提交应成功: ${r.stderr}`)
    assert.equal(existsSync(stale), false, '死进程残留必须被清掉')
    assert.equal(existsSync(live), true, '存活进程的索引不得被误删')
    assert.ok(r.stdout.includes('已清理') || r.stderr.includes('已清理'), '清理动作要可见')
  } finally {
    rmScratch(dir)
  }
})

test('④ 硬杀异常退出:索引残留,下一次运行由 sweep 清掉', async () => {
  const dir = makeRepo('iso-git-kill-')
  const sync = join(dir, '.sync')
  mkdirSync(sync)
  try {
    writeHook(
      dir,
      '#!/bin/sh\ntouch "$IHUI_TEST_SYNC/started"\necho $$ > "$IHUI_TEST_SYNC/hook.pid"\ni=0\nwhile [ ! -f "$IHUI_TEST_SYNC/stop" ] && [ "$i" -lt 100 ]; do sleep 0.1; i=$((i+1)); done\nexit 1\n',
    )
    writeFileSync(join(dir, 'a.txt'), 'a-kill\n')
    const child = spawn(
      process.execPath,
      [SCRIPT, '-C', dir, 'commit', '-m', 't-kill', '--', 'a.txt'],
      {
        cwd: dir,
        env: cleanEnv({ IHUI_TEST_SYNC: sync }),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    const closed = new Promise((r) => child.on('close', r))
    for (let i = 0; i < 200 && !existsSync(join(sync, 'started')); i += 1) {
      await new Promise((r) => setTimeout(r, 50))
    }
    assert.ok(existsSync(join(sync, 'started')), '夹具钩子必须已经跑起来')
    let residue = []
    for (let i = 0; i < 100 && !residue.length; i += 1) {
      residue = isolatedFiles(dir).filter((n) => n.endsWith('.idx'))
      if (!residue.length) await new Promise((r) => setTimeout(r, 50))
    }
    assert.ok(residue.length > 0, '硬杀前私有索引必须已落盘')

    // Windows 下 SIGKILL = TerminateProcess,node 来不及跑 exit/finally ⇒ 模拟"断电/强杀"。
    child.kill('SIGKILL')
    await closed
    assert.ok(
      isolatedFiles(dir).some((n) => n.endsWith('.idx')),
      '硬杀应留下残留,否则本测试无意义',
    )
    // 收掉被杀 node 留下的 git/sh 孤儿:放 stop 让钩子 exit 1,git 立即中止并释放目录。
    writeFileSync(join(sync, 'stop'), '')
    for (let i = 0; i < 30 && isolatedFiles(dir).some((n) => n.endsWith('.idx.lock')); i += 1) {
      await new Promise((r) => setTimeout(r, 100))
    }
    await new Promise((r) => setTimeout(r, 500))

    writeHook(dir, '#!/bin/sh\nexit 0\n')
    const r = spawnSync(
      process.execPath,
      [SCRIPT, '-C', dir, 'commit', '-m', 't-kill-2', '--', 'a.txt'],
      {
        cwd: dir,
        env: cleanEnv(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    assert.equal(r.status, 0, `下一次运行应自愈: ${r.stderr}`)
    assert.deepEqual(isolatedFiles(dir), [], '死进程残留必须被下次启动清掉')
  } finally {
    rmScratch(dir)
  }
})

test('⑤ 拒绝绕门:--no-verify / HUSKY=0 / 缺路径 / 缺 -m 一律 exit 2 且不产生提交', () => {
  const dir = makeRepo()
  try {
    const before = minor(dir)
    const cases = [
      { args: ['commit', '-m', 'x', '--no-verify', '--', 'a.txt'], env: {} },
      { args: ['commit', '-m', 'x', '--', 'a.txt'], env: { HUSKY: '0' } },
      { args: ['commit', '-m', 'x'], env: {} },
      { args: ['commit', '--', 'a.txt'], env: {} },
      { args: ['add', '--', 'a.txt'], env: {} },
    ]
    for (const c of cases) {
      const r = spawnSync(process.execPath, [SCRIPT, '-C', dir, ...c.args], {
        cwd: dir,
        env: cleanEnv(c.env),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      assert.equal(r.status, 2, `应拒绝: ${c.args.join(' ')} ⇒ ${r.stderr}`)
    }
    assert.equal(minor(dir), before, '任何拒绝都不得产生提交')
    assert.deepEqual(isolatedFiles(dir), [], '拒绝路径也不得留下索引')
  } finally {
    rmScratch(dir)
  }
})

test('⑥ 单元:命名唯一、只按死 pid/超龄 sweep、子进程 env 剥 GIT_DIR', () => {
  const dir = makeRepo('iso-git-unit-')
  try {
    const gitDir = iso.gitDirOf(dir, iso.childEnv(''))
    const one = iso.indexPathFor(gitDir, { pid: 1, now: 1000, rand: 'aaaaaaaa' })
    const two = iso.indexPathFor(gitDir, { pid: 1, now: 1001, rand: 'bbbbbbbb' })
    assert.notEqual(one, two, '同 pid 也要按时间/随机段唯一')
    assert.ok(one.endsWith('1-1000-aaaaaaaa.idx'), '落点文件名按唯一命名')
    assert.ok(one.includes(INDEX_DIR_NAME), '落点应固定在 gitdir 内的该子目录')

    mkdirSync(join(gitDir, INDEX_DIR_NAME), { recursive: true })
    const oldLive = join(gitDir, INDEX_DIR_NAME, `1-1-cccccccc.idx`)
    writeFileSync(oldLive, 'x')
    const removed = iso.sweepStale(join(gitDir, INDEX_DIR_NAME), {
      isAlive: () => true,
      now: 1 + iso.STALE_AGE_MS + 1,
    })
    assert.deepEqual(removed, ['1-1-cccccccc.idx'], '存活但超龄的也应收(防 pid 复用)')
    assert.equal(existsSync(oldLive), false)

    const env = iso.childEnv('/tmp/x.idx', {
      GIT_DIR: 'D:/bad',
      GIT_WORK_TREE: 'D:/bad',
      KEEP: '1',
    })
    assert.equal(env.GIT_INDEX_FILE, '/tmp/x.idx')
    assert.equal('GIT_DIR' in env, false)
    assert.equal('GIT_WORK_TREE' in env, false)
    assert.equal(env.KEEP, '1')
  } finally {
    rmScratch(dir)
  }
})

test('⑦ 共享索引里有别人的 staged 内容时:别人的条目一字不动,本单路径只做路径级推进(不留 MM/AD)', () => {
  const dir = makeRepo('iso-git-dirty-')
  try {
    writeFileSync(join(dir, 'c.txt'), 'c1\n')
    git(dir, ['add', '--', 'c.txt']) // 模拟另一席已 staged 的活
    const cBlobBefore = git(dir, ['rev-parse', ':c.txt']).stdout.trim()
    writeFileSync(join(dir, 'a.txt'), 'a-dirty\n')
    writeFileSync(join(dir, 'n.txt'), 'n-new\n')

    const r = spawnSync(
      process.execPath,
      [SCRIPT, '-C', dir, 'commit', '-m', 't7', '--', 'a.txt', 'n.txt'],
      {
        cwd: dir,
        env: cleanEnv(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    assert.equal(r.status, 0, `提交应成功: ${r.stderr}`)
    // 别人的 staged 必须原样保留(内容的 blob 与状态都一字不改)
    assert.equal(
      git(dir, ['rev-parse', ':c.txt']).stdout.trim(),
      cBlobBefore,
      '别人的 staged 内容不得被覆盖',
    )
    assert.equal(
      git(dir, ['status', '--short', '--', 'c.txt']).stdout.trim(),
      'A  c.txt',
      '别人的 staged 必须仍是 staged(A)',
    )
    // 本单路径只做路径级推进:提交落地后共享索引里就该是新 HEAD 的内容,不留反向暂存
    assert.equal(
      git(dir, ['status', '--short', '--', 'a.txt', 'n.txt']).stdout.trim(),
      '',
      '本单路径不得留 MM/AD 反向暂存(否则下一条裸 commit 会把本次提交改回去)',
    )
    assert.equal(
      git(dir, ['ls-files', '--stage', '--', 'n.txt']).stdout.includes('n.txt'),
      true,
      '本单新增文件必须进共享索引(否则是 AD 残留)',
    )
    assert.equal(
      git(dir, ['show', '--name-only', '--format=', 'HEAD'])
        .stdout.trim()
        .split(/\r?\n/)
        .sort()
        .join(','),
      'a.txt,n.txt',
      '载荷仍只含声明集',
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── 内容级护栏(2026-11-04 立)──────────────────────────────────────────────
// 前四条只钉路径集合;lint-staged 的 `git add` 会**同路径整份替换内容**,路径集合校验
// 看不见。下面四例钉住"钩子前快照 → 钩子跑完逐条比对 → 只动声明集内条目 → 复核"。
const ISO_SCRIPT_FWD = SCRIPT.split('\\').join('/')

/** 钩子脚本:先跑给定的污染动作,再按真实 pre-commit 钩子的契约调 restore-index。 */
function writeGuardHook(dir, actionLines, tailLines = []) {
  const body = [
    '#!/bin/sh',
    ...actionLines,
    'node "$IHUI_ISO_SCRIPT" -C "$PWD" restore-index --snapshot "$IHUI_ISOLATED_INDEX_SNAPSHOT" || exit 1',
    ...tailLines,
    '',
  ].join('\n')
  writeHook(dir, body)
}

function runIso(dir, args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, '-C', dir, ...args], {
    cwd: dir,
    env: cleanEnv({ IHUI_ISO_SCRIPT: ISO_SCRIPT_FWD, ...env }),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

test('⑧ 护栏① 钩子没动内容:提交内容不变、零复原、私有索引已清理', () => {
  const dir = makeRepo('iso-git-guard-clean-')
  try {
    const log = join(dir, '.guard.log')
    writeGuardHook(
      dir,
      ['{ echo BEFORE; git ls-files -s -- a.txt; } > "$IHUI_TEST_LOG"'],
      ['{ echo AFTER; git ls-files -s -- a.txt; } >> "$IHUI_TEST_LOG"'],
    )
    writeFileSync(join(dir, 'a.txt'), 'a1\n')
    writeFileSync(join(dir, 'b.txt'), 'b1\n')

    const r = runIso(dir, ['commit', '-m', 'guard-clean', '--', 'a.txt'], { IHUI_TEST_LOG: log })
    assert.equal(r.status, 0, `提交应成功: ${r.stderr}`)
    assert.equal(
      git(dir, ['show', 'HEAD:a.txt']).stdout.trim(),
      'a1',
      '提交内容必须等于声明时的索引内容',
    )
    assert.equal(
      git(dir, ['status', '--porcelain', '--', 'b.txt']).stdout.trim(),
      'M b.txt',
      '未声明文件仍保持未暂存',
    )
    assert.equal(r.stderr.includes('内容护栏'), false, '无漂移时不得触发复原输出')
    const text = readFileSync(log, 'utf8')
    const before = text.slice(text.indexOf('BEFORE') + 6, text.indexOf('AFTER')).trim()
    const after = text.slice(text.indexOf('AFTER') + 5).trim()
    assert.equal(before, after, '钩子前后索引条目必须逐字相等')
    assert.deepEqual(isolatedFiles(dir), [], '正常结束后不得残留索引/快照')
  } finally {
    rmScratch(dir)
  }
})

test('⑨ 护栏② 钩子整份替换声明路径内容:按快照复原后提交,工作树不动', () => {
  const dir = makeRepo('iso-git-guard-swap-')
  try {
    writeGuardHook(dir, ['printf "a-external\\n" > a.txt', 'git add -- a.txt'])
    writeFileSync(join(dir, 'a.txt'), 'a1\n')

    const r = runIso(dir, ['commit', '-m', 'guard-swap', '--', 'a.txt'])
    assert.equal(r.status, 0, `复原策略下提交应成功: ${r.stderr}`)
    assert.equal(
      git(dir, ['show', 'HEAD:a.txt']).stdout.trim(),
      'a1',
      '提交落地的必须是快照内容,不是钩子灌回的工作树内容',
    )
    assert.equal(
      readFileSync(join(dir, 'a.txt'), 'utf8').trim(),
      'a-external',
      '工作树不得被复原动作回滚',
    )
    assert.match(r.stderr, /内容护栏:钩子改动了声明路径的索引内容/, '复原动作必须可见')
    assert.match(
      r.stderr,
      /a\.txt: 快照 [0-9a-f]{40} → 钩子后 [0-9a-f]{40}/,
      '必须点名路径与两侧 blob',
    )
    assert.equal(
      git(dir, ['status', '--porcelain', '--', 'a.txt']).stdout.trim(),
      'M a.txt',
      '提交后工作树的他人内容保持为未暂存改动',
    )
  } finally {
    rmScratch(dir)
  }
})

test('⑩ 护栏③ 钩子往声明集外塞条目:拒绝提交,HEAD 不动', () => {
  const dir = makeRepo('iso-git-guard-extra-')
  try {
    writeGuardHook(dir, ['printf "x\\n" > extra.txt', 'git add -- extra.txt'])
    writeFileSync(join(dir, 'a.txt'), 'a1\n')
    const before = minor(dir)

    const r = runIso(dir, ['commit', '-m', 'guard-extra', '--', 'a.txt'])
    assert.notEqual(r.status, 0, '声明集外条目必须拒绝提交')
    assert.equal(minor(dir), before, '被拒绝时不得产生提交')
    assert.match(r.stderr, /声明集(?:\(含派生申报集\))?之外塞入了索引条目/, '拒绝理由必须可见')
    assert.match(r.stderr, /extra\.txt/, '必须点名被塞入的路径')
    assert.deepEqual(isolatedFiles(dir), [], '拒绝路径也不得留下索引/快照')
  } finally {
    rmScratch(dir)
  }
})

test('⑪ 护栏④ 复原后索引与快照逐条相等(blob/mode 断言),提交载荷逐条核对', () => {
  const dir = makeRepo('iso-git-guard-eq-')
  try {
    const log = join(dir, '.eq.log')
    writeGuardHook(
      dir,
      [
        '{ echo SNAPSHOT; cat "$IHUI_ISOLATED_INDEX_SNAPSHOT"; echo; echo AFTER; } > "$IHUI_TEST_LOG"',
        'printf "a-hook\\n" > a.txt',
        'printf "b-hook\\n" > b.txt',
        'git add -- a.txt b.txt',
      ],
      ['{ echo RESTORED; git ls-files -s -- a.txt b.txt; } >> "$IHUI_TEST_LOG"'],
    )
    writeFileSync(join(dir, 'a.txt'), 'a1\n')
    writeFileSync(join(dir, 'b.txt'), 'b1\n')

    const r = runIso(dir, ['commit', '-m', 'guard-eq', '--', 'a.txt', 'b.txt'], {
      IHUI_TEST_LOG: log,
    })
    assert.equal(r.status, 0, `提交应成功: ${r.stderr}`)

    const text = readFileSync(log, 'utf8')
    const snapshot = JSON.parse(
      text.slice(text.indexOf('SNAPSHOT') + 'SNAPSHOT'.length, text.indexOf('AFTER')),
    )
    const restoredRaw = text.slice(text.indexOf('RESTORED') + 'RESTORED'.length)
    const restored = restoredRaw
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [meta, ...pathParts] = line.split('\t')
        const [mode, blob, stage] = meta.trim().split(/\s+/)
        return { mode, blob, stage: Number(stage), path: pathParts.join('\t') }
      })
    assert.equal(restored.length, snapshot.entries.length, '复原后条目数必须与快照一致')
    for (const exp of snapshot.entries) {
      const act = restored.find((e) => e.path === exp.path)
      assert.ok(act, `快照条目 ${exp.path} 必须仍在索引里`)
      assert.equal(act.mode, exp.mode, `${exp.path} 的 mode 必须与快照逐条相等`)
      assert.equal(act.blob, exp.blob, `${exp.path} 的 blob 必须与快照逐条相等`)
      assert.equal(act.stage, exp.stage, `${exp.path} 的 stage 必须与快照逐条相等`)
    }
    assert.equal(
      git(dir, ['rev-parse', 'HEAD:a.txt']).stdout.trim(),
      snapshot.entries.find((e) => e.path === 'a.txt').blob,
      '落地提交的 a.txt blob 必须等于快照',
    )
    assert.equal(
      git(dir, ['rev-parse', 'HEAD:b.txt']).stdout.trim(),
      snapshot.entries.find((e) => e.path === 'b.txt').blob,
      '落地提交的 b.txt blob 必须等于快照',
    )
    assert.match(r.stderr, /a\.txt: 快照 .* → 钩子后 .*/s, '逐条复原必须留痕')
  } finally {
    rmScratch(dir)
  }
})

test('⑫ 空路径集不列举整个索引(私有索引护栏 ENOBUFS 回归)', () => {
  // 旧实现把空路径直接交给 `git ls-files -s -z --`;git 的空 pathspec = 列举全索引,
  // 本仓输出 >1MB ⇒ spawnSync 默认 maxBuffer 触发 ENOBUFS,无派生产物的每次提交都被
  // 私有索引护栏判成"复原失败"。空集必须在不触达 git 的情况下直接返回 []。
  assert.deepEqual(iso.lsEntries({ gitCwd: 'Z:\\__no_such_repo__', env: {} }, []), [])
})

// ─── 大索引回归(2026-11-04):ENOBUFS 的两个入口都走同一个 `lsEntries` ──────────
// 入口①:派生集为空 ⇒ `lsEntries(ctx, [])`(派生命中外层 / 复原臂复核)。
// 入口②:派生集非空但索引漂移 ⇒ 复原臂先写 index,再复核(同样落到上面的空集调用之外)。
// 旧实现把空数组直接拼成 `git ls-files -s -z --` ⇒ git 列举**整个索引** ⇒ 本仓
// 18,972 条 / 1,872,503 字节挤爆 spawnSync 默认 1MiB maxBuffer ⇒ ENOBUFS。
const BIG_ENTRIES = 20000

/** 造一个大到足以越过 spawnSync 默认 maxBuffer 的索引(20k 条 ≈ 1.3MB 输出)。 */
function makeBigRepo(prefix = 'iso-git-big-') {
  const dir = makeRepo(prefix)
  const blob = git(dir, ['rev-parse', 'HEAD:a.txt']).stdout.trim()
  const lines = []
  for (let i = 0; i < BIG_ENTRIES; i += 1) {
    lines.push(`100644 ${blob} 0\tbig/f${String(i).padStart(5, '0')}.txt`)
  }
  git(dir, ['update-index', '--index-info'], {
    input: `${lines.join('\n')}\n`,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const tree = git(dir, ['write-tree']).stdout.trim()
  const base = git(dir, ['rev-parse', 'HEAD']).stdout.trim()
  const big = git(dir, ['commit-tree', tree, '-p', base, '-m', 'big-index']).stdout.trim()
  git(dir, ['update-ref', 'refs/heads/main', big])
  return { dir, blob }
}

/** 私有索引(不碰仓的默认索引),以 HEAD 为基。 */
function bigIndexEnv(dir, name) {
  const env = childEnv(join(dir, '.git', `${name}.idx`), cleanEnv())
  git(dir, ['read-tree', 'HEAD'], { env })
  return env
}

const quietLog = { error() {} }

test('⑬ 空派生集:大索引上不列举全索引,复原复核正常返回(ENOBUFS 回归)', () => {
  const { dir } = makeBigRepo('iso-git-big-empty-')
  try {
    const env = bigIndexEnv(dir, 'iso-empty')
    const raw = spawnSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-s', '-z', '--'], {
      cwd: dir,
      env,
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    })
    assert.ok(
      raw.stdout.length > 1024 * 1024,
      `夹具索引输出必须超过 1MiB,实际 ${raw.stdout.length}`,
    )
    const snapshot = takeIndexSnapshot({ gitCwd: dir, env, paths: ['a.txt'] })
    assert.equal(snapshot.entries.length, 1, '快照只应含声明路径')
    const r = restoreIndexFromSnapshot({ gitCwd: dir, env, snapshot, derived: [], log: quietLog })
    assert.deepEqual(r.extras, [])
    assert.equal(r.still.length, 0)
    assert.equal(r.derivedViolations.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('⑭ 派生集非空 + 索引漂移:复原臂真跑一次也不 ENOBUFS,仍按快照复原', () => {
  const { dir, blob } = makeBigRepo('iso-git-big-drift-')
  try {
    const env = bigIndexEnv(dir, 'iso-drift')
    const snapshot = takeIndexSnapshot({ gitCwd: dir, env, paths: ['a.txt'] })
    const otherBlob = git(dir, ['rev-parse', 'HEAD:b.txt']).stdout.trim()
    git(dir, ['update-index', '--cacheinfo', `100644,${otherBlob},a.txt`], { env })
    const r = restoreIndexFromSnapshot({
      gitCwd: dir,
      env,
      snapshot,
      derived: [{ path: 'big/f00000.txt', blob }],
      log: quietLog,
    })
    assert.equal(r.restored, 1, '漂移必须被复原一次')
    assert.equal(r.still.length, 0)
    assert.equal(r.derivedViolations.length, 0)
    assert.deepEqual(r.extras, [])
    assert.ok(
      git(dir, ['ls-files', '-s', '--', 'a.txt'], { env })
        .stdout.trim()
        .startsWith(`100644 ${blob} 0`),
      '复原后的 a.txt 必须回到快照 blob',
    )
  } finally {
    rmScratch(dir)
  }
})

test('⑮ 空派生集 + 污染条目:语义不退化,仍拒绝并点名', () => {
  const { dir } = makeBigRepo('iso-git-big-pollute-')
  try {
    const env = bigIndexEnv(dir, 'iso-pollute')
    const snapshot = takeIndexSnapshot({ gitCwd: dir, env, paths: ['a.txt'] })
    const otherBlob = git(dir, ['rev-parse', 'HEAD:b.txt']).stdout.trim()
    git(dir, ['update-index', '--add', '--cacheinfo', `100644,${otherBlob},rogue.txt`], { env })
    const r = restoreIndexFromSnapshot({ gitCwd: dir, env, snapshot, derived: [], log: quietLog })
    assert.deepEqual(r.extras, ['rogue.txt'], '声明集外条目必须被捕获')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
