// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { planReleaseManifest, verifyReleaseManifest } from '../lib/release-manifest.mjs'

const GENERATED_AT = '2026-11-07T02:38:00.000Z'

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function input(files, arch = 'win32-x64') {
  return { appVersion: '1.2.3', generatedAt: GENERATED_AT, arch, files }
}

const original = Buffer.from('release-payload-v1')
const flipped = Buffer.from(original)
flipped[0] = flipped[0] ^ 0x01
const asar = Buffer.from('asar-body')

const appFile = { path: 'app.exe', sha256: sha256(original), bytes: original.length }
const asarFile = { path: 'resources/app.asar', sha256: sha256(asar), bytes: asar.length }

test('合法清单能对上', () => {
  const planned = planReleaseManifest(input([asarFile, appFile]))
  assert.equal(planned.ok, true)
  assert.equal(planned.reason, 'planned')
  assert.deepEqual(planned.manifest, {
    appVersion: '1.2.3',
    generatedAt: GENERATED_AT,
    arch: 'win32-x64',
    files: [
      { path: 'resources/app.asar', sha256: asarFile.sha256, bytes: asarFile.bytes },
      { path: 'app.exe', sha256: appFile.sha256, bytes: appFile.bytes },
    ],
  })
  const verdict = verifyReleaseManifest(planned.manifest, {
    arch: 'win32-x64',
    files: [appFile, asarFile],
  })
  assert.equal(verdict.verdict, 'ok')
  assert.equal(verdict.reason, 'matched')
})

test('改一个字节的哈希是 content-mismatch', () => {
  assert.equal(original.length, flipped.length)
  assert.notEqual(sha256(original), sha256(flipped))
  const planned = planReleaseManifest(input([appFile]))
  const verdict = verifyReleaseManifest(planned.manifest, {
    arch: 'win32-x64',
    files: [{ path: 'app.exe', sha256: sha256(flipped), bytes: flipped.length }],
  })
  assert.equal(verdict.verdict, 'breach')
  assert.equal(verdict.reason, 'content-mismatch')
  assert.equal(verdict.path, 'app.exe')
})

test('同路径体积不同也是 content-mismatch', () => {
  const planned = planReleaseManifest(input([appFile]))
  const verdict = verifyReleaseManifest(planned.manifest, {
    arch: 'win32-x64',
    files: [{ path: 'app.exe', sha256: appFile.sha256, bytes: appFile.bytes + 1 }],
  })
  assert.equal(verdict.verdict, 'breach')
  assert.equal(verdict.reason, 'content-mismatch')
  assert.equal(verdict.path, 'app.exe')
})

test('缺 sha256 是 hash-unmeasured 且 manifest 为 null', () => {
  const planned = planReleaseManifest(input([{ path: 'app.exe', bytes: original.length }]))
  assert.equal(planned.ok, false)
  assert.equal(planned.reason, 'hash-unmeasured')
  assert.equal(planned.manifest, null)
  const verdict = verifyReleaseManifest(
    { appVersion: '1.2.3', generatedAt: GENERATED_AT, arch: 'win32-x64', files: [{ path: 'app.exe', bytes: 1 }] },
    { arch: 'win32-x64', files: [appFile] },
  )
  assert.equal(verdict.verdict, 'unjudged')
  assert.equal(verdict.reason, 'hash-unmeasured')
})

test('大写哈希整份失败，不写成空串', () => {
  const planned = planReleaseManifest(
    input([{ path: 'app.exe', sha256: appFile.sha256.toUpperCase(), bytes: appFile.bytes }]),
  )
  assert.equal(planned.ok, false)
  assert.equal(planned.reason, 'hash-unmeasured')
  assert.equal(planned.manifest, null)
})

test('measured 为 null 是未判定，不当成空目录通过', () => {
  const planned = planReleaseManifest(input([appFile]))
  const verdict = verifyReleaseManifest(planned.manifest, null)
  assert.equal(verdict.verdict, 'unjudged')
  assert.equal(verdict.reason, 'measure-absent')
  const empty = planReleaseManifest(input([]))
  assert.equal(verifyReleaseManifest(empty.manifest, null).reason, 'measure-absent')
  assert.notEqual(verifyReleaseManifest(empty.manifest, null).verdict, 'ok')
})

test('架构不同是 arch-mismatch', () => {
  const planned = planReleaseManifest(input([appFile], 'win32-x64'))
  const verdict = verifyReleaseManifest(planned.manifest, {
    arch: 'darwin-arm64',
    files: [appFile],
  })
  assert.equal(verdict.verdict, 'breach')
  assert.equal(verdict.reason, 'arch-mismatch')
})

test('多出一个文件是 extra-file', () => {
  const planned = planReleaseManifest(input([appFile]))
  const verdict = verifyReleaseManifest(planned.manifest, {
    arch: 'win32-x64',
    files: [appFile, { path: 'extra.dll', sha256: sha256(Buffer.from('x')), bytes: 1 }],
  })
  assert.equal(verdict.verdict, 'breach')
  assert.equal(verdict.reason, 'extra-file')
  assert.equal(verdict.path, 'extra.dll')
})

test('清单有而实测没有是 missing-file', () => {
  const planned = planReleaseManifest(input([appFile, asarFile]))
  const verdict = verifyReleaseManifest(planned.manifest, {
    arch: 'win32-x64',
    files: [appFile],
  })
  assert.equal(verdict.verdict, 'breach')
  assert.equal(verdict.reason, 'missing-file')
  assert.equal(verdict.path, 'resources/app.asar')
})

test('重复路径整份失败', () => {
  const planned = planReleaseManifest(input([appFile, { ...appFile }]))
  assert.equal(planned.ok, false)
  assert.equal(planned.reason, 'duplicate-path')
  assert.equal(planned.manifest, null)
})

test('boolean 体积和穿越路径都不入清单', () => {
  const boolBytes = planReleaseManifest(input([{ path: 'app.exe', sha256: appFile.sha256, bytes: true }]))
  assert.equal(boolBytes.reason, 'bytes-unmeasured')
  assert.equal(boolBytes.manifest, null)
  assert.equal(planReleaseManifest(input([{ ...appFile, path: '../app.exe' }])).reason, 'path-invalid')
  assert.equal(planReleaseManifest(input([{ ...appFile, path: 'dir\\app.exe' }])).reason, 'path-invalid')
  assert.equal(planReleaseManifest(input([{ ...appFile, path: '/abs/app.exe' }])).reason, 'path-invalid')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
