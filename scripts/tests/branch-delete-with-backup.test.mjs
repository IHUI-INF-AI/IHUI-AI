// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:branch-delete-with-backup.mjs 的"删前必备份"判据。
// 判定口径一律 import 生产实现的 __test__,不复制第二份;行为面用临时真仓端到端跑。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as Bdb } from '../branch-delete-with-backup.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'branch-delete-with-backup.mjs')

function sh(cmd, cwd) {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function createTempRepo() {
  const dir = mkScratch('ihui-bdb-')
  sh('git init -b main', dir)
  sh('git config user.email test@test.com', dir)
  sh('git config user.name test', dir)
  sh('git config commit.gpgsign false', dir)
  writeFileSync(join(dir, 'README.md'), '# init\n')
  sh('git add README.md', dir)
  sh('git commit -m init', dir)
  return dir
}

function runScript(args, cwd) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

test('sanitizeBranchForTag:ref 非法字符净化 + 空名兜底', () => {
  assert.equal(Bdb.sanitizeBranchForTag('feature/x.1'), 'feature-x.1')
  assert.equal(Bdb.sanitizeBranchForTag('release-chunks-assistant'), 'release-chunks-assistant')
  assert.equal(Bdb.sanitizeBranchForTag('///'), 'unnamed')
  assert.equal(Bdb.sanitizeBranchForTag(''), 'unnamed')
  assert.equal(Bdb.sanitizeBranchForTag(null), 'unnamed')
})

test('buildBackupTagName:lost-commit/ 命名空间 + 短 sha 进名字(唯一、幂等、30a 覆盖)', () => {
  const sha = '1234567890abcdef1234567890abcdef12345678'
  const name = Bdb.buildBackupTagName('release-chunks-assistant', sha)
  assert.ok(name.startsWith('lost-commit/branch-release-chunks-assistant-1234567'))
  // 同参同结果 ⇒ 重跑不撞名、可审计
  assert.equal(name, Bdb.buildBackupTagName('release-chunks-assistant', sha))
})

test('端到端(--force):未合并的发布分支删前必有 lost-commit 备份 tag,且分支真的没了', () => {
  const dir = createTempRepo()
  try {
    // 造一条带独立 commit 的分支(未合并回 main,与 release-chunks 事故同形)
    sh('git checkout -q -b release-chunks-assistant', dir)
    writeFileSync(join(dir, 'chunk.txt'), 'chunk base (orphan)\n')
    sh('git add chunk.txt', dir)
    sh('git commit -m "chunk: msi.part01"', dir)
    const tip = sh('git rev-parse HEAD', dir).trim()
    sh('git checkout -q main', dir)
    const r = runScript(['release-chunks-assistant', '--force'], dir)
    assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`)
    // ① tag 在,且指向原分支尖(annotated tag 须 peel 到 commit;尖端仍可达 ⇒ 30a 不会钉红)
    const tagName = Bdb.buildBackupTagName('release-chunks-assistant', tip)
    const tagged = sh(`git rev-list -n 1 ${tagName}`, dir).trim()
    assert.equal(tagged, tip)
    // ② 分支没了(未合并分支须 --force;默认 -d 的拒绝形态由下一例钉住)
    assert.throws(() => sh('git rev-parse --verify --quiet refs/heads/release-chunks-assistant', dir))
  } finally {
    rmScratch(dir)
  }
})

test('fail-closed:tag 打不上 ⇒ 分支必须原样保留(exit 1)', () => {
  const dir = createTempRepo()
  try {
    sh('git checkout -q -b victim', dir)
    writeFileSync(join(dir, 'x.txt'), 'x\n')
    sh('git add x.txt', dir)
    sh('git commit -m c1', dir)
    sh('git checkout -q main', dir)
    // 让 refs/tags/lost-commit/branch-victim-<sha7> 这个路径**写不进**:
    // 在它前面预置一个同名目录,git 写松散 ref 时会被文件系统顶住 ⇒ tag 必败。
    const tip = sh('git rev-parse refs/heads/victim', dir).trim()
    const prefix = Bdb.buildBackupTagName('victim', tip)
    mkdirSync(join(dir, '.git', 'refs', 'tags', prefix), { recursive: true })
    const r = runScript(['victim'], dir)
    assert.equal(r.status, 1, `备份失败必须 exit 1,实测 ${r.status}\n${r.stdout}\n${r.stderr}`)
    // 分支还在 ⇒ 绝不带"没备份"往下删
    sh('git rev-parse --verify refs/heads/victim', dir)
  } finally {
    rmScratch(dir)
  }
})

test('已合并分支默认 -d 可删;未合并分支被 -d 拒时 tag 已在(exit 1,分支保留)', () => {
  const dir = createTempRepo()
  try {
    // 未合并:tag 应已落地,分支保留
    sh('git checkout -q -b unmerged', dir)
    writeFileSync(join(dir, 'y.txt'), 'y\n')
    sh('git add y.txt', dir)
    sh('git commit -m c2', dir)
    sh('git checkout -q main', dir)
    const r1 = runScript(['unmerged'], dir)
    assert.equal(r1.status, 1, `未合并分支 -d 必须被拒,实测 ${r1.status}`)
    sh('git rev-parse --verify refs/heads/unmerged', dir)
    const tip = sh('git rev-parse refs/heads/unmerged', dir).trim()
    const tagged = sh(`git rev-list -n 1 ${Bdb.buildBackupTagName('unmerged', tip)}`, dir).trim()
    assert.equal(tagged, tip, '拒绝删除之前备份 tag 必须已在')
    // --force 才允许删未合并
    const r2 = runScript(['unmerged', '--force'], dir)
    assert.equal(r2.status, 0)
    // 已合并:指向 main 同一 commit 的分支,默认 -d 直接成功
    sh('git checkout -q -b merged2', dir)
    sh('git checkout -q main', dir)
    const r3 = runScript(['merged2'], dir)
    assert.equal(r3.status, 0)
  } finally {
    rmScratch(dir)
  }
})

test('幂等:备份 tag 已存在时照常删(不当作失败);未知参数与缺参 exit 2', () => {
  const dir = createTempRepo()
  try {
    sh('git checkout -q -b dup', dir)
    writeFileSync(join(dir, 'd.txt'), 'd\n')
    sh('git add d.txt', dir)
    sh('git commit -m c4', dir)
    const tip = sh('git rev-parse refs/heads/dup', dir).trim()
    sh(`git tag ${Bdb.buildBackupTagName('dup', tip)} ${tip}`, dir)
    sh('git checkout -q main', dir)
    const r = runScript(['dup', '--force'], dir)
    assert.equal(r.status, 0, `已有备份应幂等放行,实测 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.throws(() => sh('git rev-parse --verify refs/heads/dup', dir))

    assert.equal(runScript(['--bogus'], dir).status, 2)
    assert.equal(runScript([], dir).status, 2)
    assert.equal(runScript(['a', 'b'], dir).status, 2)
    assert.equal(runScript(['--help'], dir).status, 0)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
