// gitdir 归档落点回归测试(§15b 项目外落点唯一制)。
//
// 成因:git-guardian 与 git-rebuild-local 曾各自写 `${GITDIR}.broken-<ts>`,而 GITDIR 在工作树
// 之外 ⇒ **每次现场归档都在盘根长一个新目录**(实测累计 3 个 / 1.94GB);同时 resolveBackupDir
// 只认写死的 `D:/IHUI-AI.git-backup-20260912`,备份迁入 §15b 目录后它会解析到不存在的路径,
// 使 git-guardian 报 `backupOk:false`(本地恢复源形同失效,却无人察觉)。
// 本测试钉住三件事:①归档根的推导契约;②归档出口不再落盘根;③两个调用点确实接上了出口。
import { readFileSync, existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { gitArchiveDir, gitdirArchivePath, resolveBackupDir, resolveWorktree } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

test('gitArchiveDir:要么为 null,要么落在 <盘>/DevEnv/backups/git', () => {
  const dir = gitArchiveDir()
  if (dir === null) return // 只读/换机环境允许退化,但不得抛异常
  assert.match(dir.replace(/\\/g, '/'), /\/DevEnv\/backups\/git$/)
  assert.ok(existsSync(dir), '返回的归档根必须真实存在')
})

test('gitdirArchivePath:现场归档不再落在 gitdir 同级的盘根', () => {
  const root = gitArchiveDir()
  if (!root) return
  const dst = gitdirArchivePath('IHUI-AI-git-repo.broken-TEST')
  assert.equal(dst.replace(/\\/g, '/'), `${root.replace(/\\/g, '/')}/IHUI-AI-git-repo.broken-TEST`)
  // 反向对照:旧写法会得到 `D:/IHUI-AI-git-repo.broken-TEST`(盘根),必须已被排除
  const old = `${resolveWorktree().replace(/\/$/, '')}-git-repo.broken-TEST`
  assert.notEqual(dst, old)
  assert.ok(dirname(dst.replace(/\\/g, '/')).endsWith('/backups/git'))
})

test('resolveBackupDir:备份在归档根下时必须解析到那里(而非已迁走的旧盘根路径)', () => {
  const root = gitArchiveDir()
  if (!root) return
  const name = `${basename(resolveWorktree().replace(/[\\/]+$/, ''))}.git-backup-20260912`
  if (!existsSync(join(root, name, 'HEAD'))) return // 该机未迁移,允许走兜底
  assert.equal(resolveBackupDir().replace(/\\/g, '/'), `${root.replace(/\\/g, '/')}/${name}`)
})

// —— 「装车」证明:出口若被并发旧基线写回删掉,这里必须红 ——
test('两个调用点必须真的使用 gitdirArchivePath(防"造好没装车")', () => {
  for (const f of ['../git-guardian.mjs', '../git-rebuild-local.mjs']) {
    const src = readFileSync(join(HERE, f), 'utf8')
    assert.ok(/gitdirArchivePath\(/.test(src), `${f} 未接归档出口`)
    assert.ok(/import \{[^}]*basename[^}]*\} from 'node:path'/.test(src), `${f} 缺 basename 导入`)
  }
  const g = readFileSync(join(HERE, '../git-guardian.mjs'), 'utf8')
  assert.ok(/from '\/lib\/gitdir\.mjs'|\.\/lib\/gitdir\.mjs/.test(g) && /gitdirArchivePath,/.test(g), 'guardian 未 import 出口')
})
