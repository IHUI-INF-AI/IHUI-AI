// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-mobile-tabbar-icon-data.mjs --check 的镜像测试。钉三件事:
 * ① 一致 ⇒ rc 0 且不写盘;② 漂移 ⇒ rc 1 且打印差异;③ 输入面取不到 ⇒ rc 2 未判定。
 * 另钉幂等:连跑两次 --check 读数与退出码完全一致。
 * 另钉 payload 清单:手改 base64(仍合法)与只改清单自身都判红,清单不允许自证。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'gen-mobile-tabbar-icon-data.mjs')
const OUT_REL = join('apps', 'mobile-rn', 'src', 'components', 'tabbarIconData.ts')
const SRC_REL = join('apps', 'mobile-rn', 'assets', 'images', 'tabbar')

/** 把真产物与真源图复制到临时根,避免测试碰到工作树。 */
function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'tabbar-check-'))
  mkdirSync(dirname(join(dir, OUT_REL)), { recursive: true })
  cpSync(join(ROOT, SRC_REL), join(dir, SRC_REL), { recursive: true })
  cpSync(join(ROOT, OUT_REL), join(dir, OUT_REL))
  return dir
}

function runCheck(dir) {
  return spawnSync(process.execPath, [SCRIPT, '--check', '--root', dir], { encoding: 'utf8' })
}

test('① 一致 ⇒ rc 0 且不写盘', () => {
  const dir = makeFixture()
  try {
    const outAbs = join(dir, OUT_REL)
    const before = readFileSync(outAbs)
    const r = runCheck(dir)
    assert.equal(r.status, 0, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stdout, /产物与数据源一致/)
    assert.deepEqual(readFileSync(outAbs), before, '--check 不许写盘')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('② 产物缺键 ⇒ rc 1 且打印差异', () => {
  const dir = makeFixture()
  try {
    const outAbs = join(dir, OUT_REL)
    const text = readFileSync(outAbs, 'utf8')
    writeFileSync(outAbs, text.replace(/^  HOME_ACTIVE:\n    '[^']*',\n/m, ''))
    const r = runCheck(dir)
    assert.equal(r.status, 1, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stderr, /HOME_ACTIVE/)
    assert.match(r.stderr, /产物缺键/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('②b 源图变了但产物未重生成 ⇒ rc 1 且点名 sha256', () => {
  const dir = makeFixture()
  try {
    appendFileSync(join(dir, SRC_REL, 'tabbar_3.png'), Buffer.from([0x00]))
    const r = runCheck(dir)
    assert.equal(r.status, 1, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stderr, /tabbar_3\.png/)
    assert.match(r.stderr, /sha256/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('②c 手改 base64(形态仍合法)⇒ rc 1 且点名该 key', () => {
  const dir = makeFixture()
  try {
    const outAbs = join(dir, OUT_REL)
    const text = readFileSync(outAbs, 'utf8')
    const m = text.match(/^  HOME_ACTIVE:\n    '(data:image\/png;base64,)([^']*)',$/m)
    assert.ok(m, '夹具里应能找到 HOME_ACTIVE 条目')
    const b64 = m[2]
    const pos = Math.floor(b64.length * 0.6)
    const mutated = b64.slice(0, pos) + (b64[pos] === 'A' ? 'B' : 'A') + b64.slice(pos + 1)
    writeFileSync(outAbs, text.replace(m[0], `  HOME_ACTIVE:\n    '${m[1]}${mutated}',`))
    const r = runCheck(dir)
    assert.equal(r.status, 1, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stderr, /HOME_ACTIVE/)
    assert.match(r.stderr, /payload sha256/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('②d 只改 payload 清单自身 ⇒ 仍 rc 1(清单不是自证真源)', () => {
  const dir = makeFixture()
  try {
    const outAbs = join(dir, OUT_REL)
    const text = readFileSync(outAbs, 'utf8')
    const m = text.match(/^ \*   (HOME_ACTIVE)=([0-9a-f]{64})$/m)
    assert.ok(m, '夹具里应能找到 HOME_ACTIVE 的 payload 清单行')
    const flipped = `${m[2][0] === 'a' ? 'b' : 'a'}${m[2].slice(1)}`
    writeFileSync(outAbs, text.replace(m[0], ` *   ${m[1]}=${flipped}`))
    const r = runCheck(dir)
    assert.equal(r.status, 1, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stderr, /HOME_ACTIVE/)
    assert.match(r.stderr, /payload sha256/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('③ 输入面取不到 ⇒ rc 2 未判定', () => {
  const dir = makeFixture()
  try {
    unlinkSync(join(dir, SRC_REL, 'tabbar_5.png'))
    let r = runCheck(dir)
    assert.equal(r.status, 2, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stderr, /未判定:输入面取不到/)

    rmSync(join(dir, OUT_REL))
    r = runCheck(dir)
    assert.equal(r.status, 2, `stdout=${r.stdout}\nstderr=${r.stderr}`)
    assert.match(r.stderr, /未判定:产物读不到/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('④ 幂等:连跑两次读数与退出码一致', () => {
  const dir = makeFixture()
  try {
    const a = runCheck(dir)
    const b = runCheck(dir)
    assert.equal(a.status, 0, `stdout=${a.stdout}\nstderr=${a.stderr}`)
    assert.equal(a.status, b.status)
    assert.equal(a.stdout + a.stderr, b.stdout + b.stderr)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
