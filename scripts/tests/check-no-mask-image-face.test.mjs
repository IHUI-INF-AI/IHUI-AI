// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 渐变遮罩守门:取材面(G-880)与判据窄化(只判渐变遮罩)的镜像锁
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-no-mask-image.mjs')
const GIT = gitBinary()

function git(cwd, args) {
  return spawnSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function writeRepoFile(dir, rel, content) {
  const full = join(dir, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

function createRepo(files) {
  const dir = mkScratch('ihui-mask-git-')
  assert.equal(git(dir, ['init', '-q']).status, 0)
  git(dir, ['config', 'user.email', 'test@ihui.local'])
  git(dir, ['config', 'user.name', 'Test'])
  git(dir, ['config', 'commit.gpgsign', 'false'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  for (const [rel, content] of Object.entries(files)) writeRepoFile(dir, rel, content)
  git(dir, ['add', '-A'])
  assert.equal(git(dir, ['commit', '-q', '-m', 'baseline']).status, 0)
  return dir
}

function runScript(cwd, extraArgs = []) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...extraArgs], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

const MASK_GRADIENT =
  'export const s = {\n  x: { maskImage: "linear-gradient(to right, transparent, black)" },\n}\n'

test('M01 全量档判 HEAD blob:盘上已改好但没提交 ⇒ 仍按已入库那一份报红', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': MASK_GRADIENT })
  try {
    // 盘上改成干净版(未提交)—— 旧实现读磁盘,会在这里报绿
    writeRepoFile(dir, 'apps/web/app/x/page.tsx', 'export const s = {}\n')
    const r = runScript(dir)
    assert.match(r.stdout, /\[mask-image\]/, `必须按 HEAD 面报数\n${r.stdout}`)
    assert.match(git(dir, ['status', '--porcelain']).stdout, /^ M /m, '夹具本身:盘上确实改了没提交')
  } finally {
    rmScratch(dir)
  }
})

test('M02 staged 档:camel 的渐变遮罩新增即拦(旧判据只认 kebab)', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': 'export const s = {}\n' })
  try {
    writeRepoFile(dir, 'apps/web/app/x/page.tsx', MASK_GRADIENT)
    git(dir, ['add', '-A'])
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 1, `camel 形态必须进射程\n${r.stdout}`)
    assert.match(r.stdout, /\[mask-image\]/, r.stdout)
  } finally {
    rmScratch(dir)
  }
})

test('M03 反向对照:url() 图标着色不是渐变遮罩,不许判红(§4 禁的是边缘淡出)', () => {
  const dir = createRepo({
    'apps/miniapp-taro/src/components/Icon/index.tsx':
      'export const s = {\n  icon: { maskImage: `url("${uri}")`, WebkitMaskImage: `url("${uri}")` },\n}\n',
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.doesNotMatch(r.stdout, /\[mask-image\]/, `图标着色不许被读成渐变遮罩\n${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('M04 staged 档判索引 blob:只删掉违规那一行并暂存 ⇒ 放行(清存量不被自己的基线顶住)', () => {
  const dir = createRepo({ 'apps/web/app/x/page.tsx': MASK_GRADIENT })
  try {
    writeRepoFile(dir, 'apps/web/app/x/page.tsx', 'export const s = {}\n')
    git(dir, ['add', '-A'])
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `删掉违规行必须能通过\n${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
