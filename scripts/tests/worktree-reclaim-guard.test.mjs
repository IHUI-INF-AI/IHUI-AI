// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * worktree-reclaim-guard 的 DBG-92 / DBG-96 证明面。
 *
 * 只调用导出的判据函数，并用 onBeforeDelete 挡在 rmSync 之前。
 * 禁止以 --apply / --reclaim 启动脚本本体，也不对真实主仓调用删除。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as guard } from '../worktree-reclaim-guard.mjs'

const QUIET = { quiet: true, recentWrites: 0, processes: [], newest: 0, fileCount: 0 }

function forbidDelete() {
  throw new Error('测试禁止落到删除')
}

function anchorsFor(main) {
  return {
    repoRoot: main,
    mainWorktree: main,
    gitDir: join(main, '.git'),
    worktreesDir: join(main, '.worktrees'),
  }
}

function layout() {
  const base = mkScratch('wt-reclaim-')
  const main = join(base, 'main')
  mkdirSync(join(main, '.worktrees'), { recursive: true })
  mkdirSync(join(main, '.git'), { recursive: true })
  writeFileSync(join(main, 'KEEP'), 'keep\n')
  writeFileSync(join(main, '.git', 'HEAD'), 'ref: refs/heads/main\n')
  return { base, main, anchors: anchorsFor(main) }
}

function gitAt(cwd, args) {
  const r = spawnSync(gitBinary(), ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) {
    throw new Error(`${args.join(' ')} → ${r.status}\n${r.stderr || r.stdout}`)
  }
  return r
}

function initRepo(dir, gitignore) {
  mkdirSync(dir, { recursive: true })
  gitAt(dir, ['init', '-b', 'main'])
  gitAt(dir, ['config', 'core.autocrlf', 'false'])
  writeFileSync(join(dir, 'README'), 'ok\n')
  writeFileSync(join(dir, '.gitignore'), gitignore)
  gitAt(dir, ['add', 'README', '.gitignore'])
  gitAt(dir, [
    '-c',
    'user.email=wt-reclaim@example.com',
    '-c',
    'user.name=wt-reclaim',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'init',
  ])
}

function forced(extra = {}) {
  return {
    apply: true,
    assumeMerged: true,
    assumeClean: true,
    assumeActivity: QUIET,
    onBeforeDelete: forbidDelete,
    ...extra,
  }
}

test('敏感文件名：.env、私钥、证书命中，普通文件与公钥不命中', () => {
  for (const name of [
    '.env',
    '.env.local',
    '.envrc',
    'prod.env',
    'id_rsa',
    'id_ed25519',
    'server.crt',
    'client.pem',
    'api.key',
    'store.p12',
    'a.cer',
  ]) {
    assert.equal(guard.isSensitiveName(name), true, name)
  }
  for (const name of ['.environment', 'README', 'noise.log', 'id_rsa.pub', 'notes.txt']) {
    assert.equal(guard.isSensitiveName(name), false, name)
  }
})

test('DBG-92 主仓、gitdir、.worktrees 自身与逃逸路径直接拒绝（只判路径）', () => {
  const root = guard.ROOT
  const main = guard.classifyReclaimTarget(root)
  assert.equal(main.ok, false)
  assert.match(main.reason, /主仓/)

  const lower = guard.classifyReclaimTarget(`${root.toLowerCase()}\\`)
  assert.equal(lower.ok, false)
  assert.match(lower.reason, /主仓/)

  const dotted = guard.classifyReclaimTarget(join(root, '.worktrees', 'foo', '..', '..'))
  assert.equal(dotted.ok, false)
  assert.match(dotted.reason, /主仓/)

  const viaName = guard.classifyReclaimTarget('foo/../..')
  assert.equal(viaName.ok, false)
  assert.match(viaName.reason, /主仓/)

  const gitdir = guard.classifyReclaimTarget(join(root, '.git'))
  assert.equal(gitdir.ok, false)
  assert.match(gitdir.reason, /gitdir/)

  const gitChild = guard.classifyReclaimTarget(join(root, '.git', 'config'))
  assert.equal(gitChild.ok, false)
  assert.match(gitChild.reason, /gitdir/)

  const self = guard.classifyReclaimTarget(join(root, '.worktrees'))
  assert.equal(self.ok, false)
  assert.match(self.reason, /\.worktrees/)

  const dot = guard.classifyReclaimTarget('.')
  assert.equal(dot.ok, false)
  assert.match(dot.reason, /\.worktrees/)

  const sibling = guard.classifyReclaimTarget(join(root, '.worktrees-evil'))
  assert.equal(sibling.ok, false)
  assert.match(sibling.reason, /\.worktrees/)

  const parent = guard.classifyReclaimTarget('foo/../../..')
  assert.equal(parent.ok, false)
  assert.match(parent.reason, /\.worktrees/)

  const ok = guard.classifyReclaimTarget('dbg92-slot')
  assert.equal(ok.ok, true)
  assert.equal(ok.target, resolve(root, '.worktrees', 'dbg92-slot'))
})

test('DBG-92 apply 打到主工作树、junction 或 gitdir 时删除点不可达', () => {
  const fx = layout()
  const links = []
  try {
    const asMain = guard.reapOne(fx.main, forced({ anchors: fx.anchors }))
    assert.equal(asMain.action, 'refuse')
    assert.match(asMain.reason, /主仓/)
    assert.equal(existsSync(join(fx.main, 'KEEP')), true)

    const escape = join(fx.anchors.worktreesDir, 'escape')
    symlinkSync(fx.main, escape, 'junction')
    links.push(escape)
    const viaLink = guard.reapOne(escape, forced({ anchors: fx.anchors }))
    assert.equal(viaLink.action, 'refuse')
    assert.match(viaLink.reason, /主仓/)
    assert.equal(existsSync(join(fx.main, 'KEEP')), true)

    const outside = join(fx.base, 'outside')
    mkdirSync(outside)
    writeFileSync(join(outside, '.env'), 'TOKEN=fixture\n')
    const outLink = join(fx.anchors.worktreesDir, 'out')
    symlinkSync(outside, outLink, 'junction')
    links.push(outLink)
    const viaOut = guard.reapOne(outLink, forced({ anchors: fx.anchors }))
    assert.equal(viaOut.action, 'refuse')
    assert.match(viaOut.reason, /\.worktrees/)
    assert.equal(existsSync(join(outside, '.env')), true)

    const gitLink = join(fx.anchors.worktreesDir, 'gitlink')
    symlinkSync(fx.anchors.gitDir, gitLink, 'junction')
    links.push(gitLink)
    const viaGit = guard.reapOne(gitLink, forced({ anchors: fx.anchors }))
    assert.equal(viaGit.action, 'refuse')
    assert.match(viaGit.reason, /gitdir/)
    assert.equal(existsSync(join(fx.main, '.git', 'HEAD')), true)

    const stray = join(fx.base, 'stray')
    mkdirSync(stray)
    writeFileSync(join(stray, 'KEEP'), 'x\n')
    const outsideTree = guard.reapOne(stray, forced({ anchors: fx.anchors }))
    assert.equal(outsideTree.action, 'refuse')
    assert.match(outsideTree.reason, /\.worktrees/)
    assert.equal(existsSync(join(stray, 'KEEP')), true)
  } finally {
    for (const link of links) {
      try {
        unlinkSync(link)
      } catch {
        /* 链接未建成时无需摘 */
      }
    }
    rmScratch(fx.base)
  }
})

test('DBG-96 status 干净仍拒绝被忽略的 .env、私钥、证书，并点名', () => {
  const fx = layout()
  const slot = join(fx.anchors.worktreesDir, 'slot')
  const expected = [
    '.env',
    '.env.local',
    'apps/api/.env',
    'certs/api.key',
    'certs/client.pem',
    'certs/server.crt',
    'secrets/id_ed25519',
    'secrets/id_rsa',
  ]
  try {
    initRepo(
      slot,
      ['.env', '.env.*', '*.pem', '*.key', '*.crt', '*.cer', '*.p12', '*.pfx', 'id_rsa', 'id_ed25519', '*.log', ''].join(
        '\n',
      ),
    )
    mkdirSync(join(slot, 'apps', 'api'), { recursive: true })
    mkdirSync(join(slot, 'secrets'), { recursive: true })
    mkdirSync(join(slot, 'certs'), { recursive: true })
    writeFileSync(join(slot, '.env'), 'TOKEN=fixture\n')
    writeFileSync(join(slot, '.env.local'), 'LOCAL=fixture\n')
    writeFileSync(join(slot, 'apps', 'api', '.env'), 'API=fixture\n')
    writeFileSync(join(slot, 'secrets', 'id_rsa'), 'not-a-real-key\n')
    writeFileSync(join(slot, 'secrets', 'id_ed25519'), 'not-a-real-key\n')
    writeFileSync(join(slot, 'certs', 'server.crt'), 'not-a-real-cert\n')
    writeFileSync(join(slot, 'certs', 'client.pem'), 'not-a-real-pem\n')
    writeFileSync(join(slot, 'certs', 'api.key'), 'not-a-real-key\n')
    writeFileSync(join(slot, 'noise.log'), 'log\n')

    assert.equal(guard.isClean(slot), true, 'porcelain 看不见忽略文件，这正是 DBG-96')
    const found = guard.findSensitiveIgnored(slot)
    assert.equal(found.blocked, true)
    assert.deepEqual(found.files, expected)
    assert.equal(found.files.includes('noise.log'), false)
    assert.match(found.reason, /拒绝删除/)
    assert.match(found.reason, /\.env/)
    assert.match(found.reason, /id_rsa/)
    assert.match(found.reason, /server\.crt/)

    for (const apply of [false, true]) {
      let result
      try {
        result = guard.reapOne(slot, forced({ apply, anchors: fx.anchors }))
      } catch (e) {
        assert.fail(`apply=${apply} 走到了删除：${e.message}`)
      }
      assert.equal(result.action, 'refuse')
      assert.doesNotMatch(result.reason, /可删/)
      assert.deepEqual(result.files, expected)
      assert.match(result.reason, /apps\/api\/\.env/)
    }
    assert.equal(existsSync(join(slot, '.env')), true)
    assert.equal(existsSync(join(slot, 'secrets', 'id_rsa')), true)
    assert.equal(existsSync(join(slot, 'certs', 'server.crt')), true)
    assert.equal(existsSync(join(slot, 'noise.log')), true)
  } finally {
    rmScratch(fx.base)
  }
})

test('DBG-96 只有被忽略的普通文件时不因敏感物拒绝，删除点仍在最后', () => {
  const fx = layout()
  const slot = join(fx.anchors.worktreesDir, 'plain')
  try {
    initRepo(slot, '*.log\n')
    writeFileSync(join(slot, 'noise.log'), 'log\n')
    assert.equal(guard.isClean(slot), true)
    const found = guard.findSensitiveIgnored(slot)
    assert.equal(found.blocked, false)
    assert.deepEqual(found.files, [])
    assert.throws(
      () => guard.reapOne(slot, forced({ anchors: fx.anchors })),
      /测试禁止落到删除/,
    )
    assert.equal(existsSync(join(slot, 'noise.log')), true)
    assert.equal(existsSync(join(slot, 'README')), true)
  } finally {
    rmScratch(fx.base)
  }
})

test('DBG-96 check-ignore 未判定时默认拒绝并点名，不删除', () => {
  const fx = layout()
  const slot = join(fx.anchors.worktreesDir, 'nogit')
  try {
    mkdirSync(slot, { recursive: true })
    writeFileSync(join(slot, '.env'), 'TOKEN=fixture\n')
    writeFileSync(join(slot, 'certs.key'), 'not-a-real-key\n')
    let result
    try {
      result = guard.reapOne(slot, forced({ anchors: fx.anchors }))
    } catch (e) {
      assert.fail(`未判定却走到了删除：${e.message}`)
    }
    assert.equal(result.action, 'refuse')
    assert.match(result.reason, /未判定/)
    assert.ok(result.files.includes('.env'))
    assert.ok(result.files.includes('certs.key'))
    assert.equal(existsSync(join(slot, '.env')), true)
    assert.equal(existsSync(join(slot, 'certs.key')), true)
  } finally {
    rmScratch(fx.base)
  }
})

test('命令行 --reclaim 只经 reapOne，拒绝时退出 1，分支内不直接 rmSync', () => {
  const src = readFileSync(fileURLToPath(new URL('../worktree-reclaim-guard.mjs', import.meta.url)), 'utf8')
  const cli = src.slice(src.indexOf('async function main'), src.indexOf('export const __test__'))
  assert.match(cli, /const result = reapOne\(raw, \{ apply \}\)/)
  assert.match(cli, /if \(result\.action === 'refuse'\) process\.exit\(1\)/)
  assert.equal(cli.includes('rmSync'), false)
})
