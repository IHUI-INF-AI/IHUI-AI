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
import { INDEX_DIR_NAME, __test__ as iso } from '../isolated-git.mjs'

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

test('⑦ 共享索引里有别人的 staged 内容时,本通道一个字节都不覆盖', () => {
  const dir = makeRepo('iso-git-dirty-')
  try {
    writeFileSync(join(dir, 'c.txt'), 'c1\n')
    git(dir, ['add', '--', 'c.txt']) // 模拟另一席已 staged 的活
    const before = indexDigest(dir)
    writeFileSync(join(dir, 'a.txt'), 'a-dirty\n')

    const r = spawnSync(
      process.execPath,
      [SCRIPT, '-C', dir, 'commit', '-m', 't7', '--', 'a.txt'],
      {
        cwd: dir,
        env: cleanEnv(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    assert.equal(r.status, 0, `提交应成功: ${r.stderr}`)
    assert.equal(indexDigest(dir), before, '共享索引不干净时不得 CAS 覆盖别人的 staged')
    assert.equal(
      git(dir, ['ls-files', '--stage', '--', 'c.txt']).stdout.includes('c.txt'),
      true,
      '别人的 staged 必须原样保留',
    )
    assert.equal(
      git(dir, ['show', '--name-only', '--format=', 'HEAD']).stdout.trim(),
      'a.txt',
      '载荷仍只含声明集',
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
