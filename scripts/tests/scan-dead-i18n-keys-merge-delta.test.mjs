// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 70b(`scan-dead-i18n-keys`)的合并面基准单测。
 *
 * case① 上游分支带进一枚无人引用的死 key,合并把它摊进索引:
 *        旧算法(基线 0、只看总死键数)判红;新算法把"父面已死"的部分归因给父提交 ⇒ 0 新增。
 * case② 合并结果里真新增一枚死 key(两父都没有):新算法仍然判红,且只点名这一枚。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts/scan-dead-i18n-keys.mjs')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const LOCALE_DIR = 'packages/i18n/messages/web'

function git(dir, ...args) {
  const r = spawnSync(process.env.IHUI_GIT_BIN || 'git', args, {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${String(r.stderr || '').trim()}`)
  return String(r.stdout || '').trim()
}

function write(dir, rel, text) {
  const p = join(dir, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text)
}

const json = (obj) => `${JSON.stringify(obj, null, 2)}\n`

/** 写全 5 份语言包(只由调用方给出额外键,其余三端共用同一份结构)。 */
function locales(dir, extra = {}) {
  const base = { keep: { key: '保持' }, ...extra }
  for (const l of LOCALES) write(dir, `${LOCALE_DIR}/${l}.json`, json(base))
}

function commitAll(dir, msg) {
  git(dir, 'add', '--', '.')
  git(dir, 'commit', '-q', '-m', msg)
}

function scene() {
  const dir = mkScratch('dead-i18n-merge-')
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 'test@example.com')
  git(dir, 'config', 'user.name', 'ihui-test')
  git(dir, 'checkout', '-q', '-b', 'main')
  locales(dir)
  write(dir, 'apps/web/src/a.ts', "export const x = t('keep.key')\n")
  commitAll(dir, 'base')

  // 上游:新增一枚无人引用的死 key
  git(dir, 'checkout', '-q', '-b', 'theirs')
  locales(dir, { dead: { fromUpstream: '上游死键' } })
  commitAll(dir, 'theirs-dead-key')

  // 我方:只改代码,不碰语言包
  git(dir, 'checkout', '-q', 'main')
  write(dir, 'apps/web/src/a.ts', "export const x = t('keep.key')\nexport const y = t('keep.key')\n")
  commitAll(dir, 'ours-code')

  git(dir, 'merge', '--no-commit', 'theirs')
  return dir
}

function run(dir, { naive = false } = {}) {
  const mh = join(dir, '.git', 'MERGE_HEAD')
  let saved = null
  if (naive) {
    saved = readFileSync(mh, 'utf8')
    rmSync(mh)
  }
  try {
    const r = spawnSync(
      process.execPath,
      [GATE, '--root', dir, '--target', 'web', '--staged', '--exit', '1'],
      { cwd: REPO, encoding: 'utf8', windowsHide: true, timeout: 180000 },
    )
    return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
  } finally {
    if (naive && saved !== null) writeFileSync(mh, saved)
  }
}

test('门 70b · case① 上游带进的死 key:旧算法计 1 / 新算法计 0', () => {
  const dir = scene()
  try {
    const naive = run(dir, { naive: true })
    const fixed = run(dir)
    assert.equal(naive.status, 1, `旧算法应判红,实际:${naive.out}`)
    assert.match(naive.out, /死 key: 1/)
    assert.equal(fixed.status, 0, `新算法应放行,实际:${fixed.out}`)
    assert.match(fixed.out, /合并面死键 1 · 归因父提交 1 · 本次新增 0/)
  } finally {
    rmScratch(dir)
  }
})

test('门 70b · case② 合并结果真新增死 key 仍然判红', () => {
  const dir = scene()
  try {
    // 结果面再塞一枚两父都没有的死 key(上游那枚仍在)
    locales(dir, { dead: { fromUpstream: '上游死键', brandNew: '本次新增死键' } })
    git(dir, 'add', '--', `${LOCALE_DIR}/zh-CN.json`)
    const fixed = run(dir)
    assert.equal(fixed.status, 1, `真新增应判红,实际:${fixed.out}`)
    assert.match(fixed.out, /合并面死键 2 · 归因父提交 1 · 本次新增 1/)
    assert.match(fixed.out, /dead\.brandNew/)
    assert.doesNotMatch(fixed.out, /dead\.fromUpstream/)
  } finally {
    rmScratch(dir)
  }
})
