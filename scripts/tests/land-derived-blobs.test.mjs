// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/lib/land-derived-blobs.mjs —— 「派生产物落 HEAD」的唯一出口。
 *
 * 立因(2026-10-27 实测):LAND_PATHS 的分隔符写成 comma,落地器把整串当**一条**路径,
 * 报一句「清单里缺这些声明路径」整轮拒落 —— 在守护日志里只是一行 ⚠️(静默失效那一型)。
 * 所以本文件的核心是 **拿落地器自己的 parseArgs 做 round-trip**,而不是在测试里再抄一遍分隔符约定。
 *
 * 跑法:node --test scripts/tests/land-derived-blobs.test.mjs
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { __test__ as L } from '../lib/land-derived-blobs.mjs'
import { parseArgs as parseLandArgs } from '../object-space-land.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
const ONE = 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts'

const git = (args, cwd) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-C', cwd ?? ROOT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 1 << 24,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

test('L1 LAND_PATHS 经落地器自己的解析器 round-trip:几条进去就要几条出来', () => {
  const paths = [ONE, 'apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts']
  const dir = mkScratch('ldc-env-')
  try {
    const manifest = join(dir, 'blobs.json')
    // blob 取真仓 HEAD 上在位的对象:落地器的空内容守卫要能量到字节数
    writeFileSync(
      manifest,
      JSON.stringify({
        files: paths.map((p) => ({ path: p, blob: git(['rev-parse', `HEAD:${p}`]).trim() })),
      }),
      'utf8',
    )
    const env = L.landEnv({ paths, manifest, msg: 'MSG', proof: 'P' })
    assert.equal(
      env.LAND_PATHS,
      paths.join(';'),
      '分隔符只认落地器契约那一个(逗号=整串被当一条路径)',
    )
    const parsed = parseLandArgs({ ...env, LAND_ROOT: ROOT })
    assert.equal(parsed.error, undefined, `落地器解析面拒了:${parsed.error}`)
    assert.deepEqual(parsed.paths, paths)
    assert.equal(parsed.msg, 'MSG')
  } finally {
    rmScratch(dir)
  }
})

test('L2 清单为空 / blob 不是 40 位 oid ⇒ 拒绝,且一次都不派生落地器(空清单会把 undefined 当路径)', () => {
  let spawned = 0
  const run = () => {
    spawned += 1
    return ''
  }
  const dir = mkScratch('ldc-bad-')
  try {
    const r1 = L.landBlobs({ root: dir, files: [], msg: 'm', proof: 'p' })
    assert.equal(r1.ok, false)
    assert.match(r1.why, /files 为空/)
    const r2 = L.landBlobs({
      root: dir,
      files: [{ path: 'a', blob: 'abc123' }],
      msg: 'm',
      proof: 'p',
    })
    assert.equal(r2.ok, false)
    assert.match(r2.why, /40 位/)
    assert.equal(spawned, 0, '坏清单不该派生落地器(它自己也会拒,但留痕形态不同、且白烧一次 git)')
  } finally {
    rmScratch(dir)
  }
})

test('L3 hashText 走 stdin 且归一可比:同一段文本两次得到同一个 oid', () => {
  const dir = mkScratch('ldc-hash-')
  try {
    git(['init', '-q', '-b', 'main'], dir)
    mkdirSync(join(dir, 'd'), { recursive: true })
    const text = 'export const A = 1\n'
    const a = L.hashText(dir, text)
    const b = L.hashText(dir, text)
    assert.match(a, /^[0-9a-f]{40}$/, `oid 形态不对:${a}`)
    assert.equal(a, b, '同内容必须同 oid(否则钉与落地清单会互不相认)')
    // 反向对照:换一个字符就得换 oid
    assert.notEqual(a, L.hashText(dir, 'export const A = 2\n'))
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
