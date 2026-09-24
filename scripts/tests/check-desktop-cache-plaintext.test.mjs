// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-desktop-cache-plaintext.mjs(§22c 直 import __test__,零镜像常量)
// 运行: node --test scripts/tests/check-desktop-cache-plaintext.test.mjs
// 注意:本仓 `node --test <目录>` 会 MODULE_NOT_FOUND,必须给单个文件路径。

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-desktop-cache-plaintext.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const vaultSrc = read('apps/web/src/lib/local-vault.ts')
const consts = gate.parseVaultConstants(vaultSrc)

test('判据1-常量确从 local-vault.ts 源码解析,且随源漂移(无第二份字面量)', () => {
  assert.equal(typeof consts.envelopeField, 'string')
  assert.deepEqual(consts.envelopeFieldsSorted, [...consts.envelopeFields].sort())
  assert.equal(consts.envelopeFieldsSorted.length, 4)
  assert.ok(vaultSrc.includes(`'${consts.envelopeField}'`), '解析值必须真在源文件里')
  assert.ok(vaultSrc.includes(`'${consts.vaultStoreFile}'`))
  // 变异对照:改源字面量 ⇒ 解析结果必须跟着变(证明没有写死)
  const mutated = vaultSrc.replace(
    `const ENVELOPE_FIELD = '${consts.envelopeField}'`,
    "const ENVELOPE_FIELD = 'zzzOtherField'",
  )
  assert.equal(gate.parseVaultConstants(mutated).envelopeField, 'zzzOtherField')
  // 缺常量必须抛,不得静默给默认值
  assert.throws(() => gate.parseVaultConstants('const X = 1'), /解析失败/)
})

test('persist 键名从 chat.ts / goal.ts 源码解析', () => {
  assert.match(gate.parsePersistKey(read('apps/web/src/stores/chat.ts')), /^ihui-/)
  assert.match(gate.parsePersistKey(read('apps/web/src/stores/goal.ts')), /^ihui-/)
  assert.throws(() => gate.parsePersistKey('no name here'), /解析失败/)
  assert.ok(gate.parseAppIdentifier(read('apps/desktop/src-tauri/tauri.conf.json')).includes('.'))
})

test('判据0-阳性对照:明文形态可扫、信封形态不可扫(核心尺子)', () => {
  const nonce = '唯一中文标记串'
  const plain = `{"state":{"m":[{"c":"${nonce}"}]}}`
  const envelope = JSON.stringify({
    [consts.envelopeField]: {
      alg: consts.alg,
      kid: 'aa'.repeat(8),
      iv: 'aWk',
      ct: Buffer.from(plain, 'utf8').toString('base64url'),
    },
  })
  assert.ok(!envelope.includes(nonce), '信封文本本身不得含明文')
  const plainHits = gate.classifyPersistRecords(`k ${'ihui-x'}\u0001${plain}`, 'ihui-x', consts)
  const sealedHits = gate.classifyPersistRecords(`k ${'ihui-x'}\u0001${envelope}`, 'ihui-x', consts)
  assert.equal(plainHits[0].kind, 'plain', '未加密形态必须被认作 plain')
  assert.equal(sealedHits[0].kind, 'sealed-ok', '合规信封必须被认作 sealed-ok')
  // 加密形态即使含中文 nonce 的 base64,也不得出现明文串
  assert.ok(!sealedHits[0].kind.startsWith('plain'))
})

test('判据0-噪声反例:纯 ASCII 与 base64 不得触发 CJK 判据', () => {
  const ascii = '{"access_token":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc-_12"}'
  const hits = gate.cjkHitsInBuffer(Buffer.from(ascii, 'utf8'))
  assert.deepEqual(hits, { utf8: 0, utf16: 0 })
  const b64 = Buffer.from(ascii.repeat(4)).toString('base64')
  assert.deepEqual(gate.cjkHitsInBuffer(Buffer.from(b64, 'utf8')), { utf8: 0, utf16: 0 })
})

test('判据0-UTF-16LE 中文正文必须被 utf16 判据抓到', () => {
  const text = 'keycontent":"这是一段真实中文会话正文'
  const buf = Buffer.from(text, 'utf16le')
  const hits = gate.cjkHitsInBuffer(buf)
  assert.ok(hits.utf16 >= 1, `utf16 命中应 ≥1,实为 ${hits.utf16}`)
})

test('判据1-信封结构位:多字段/少字段/错顶层 必判坏', () => {
  const good = JSON.stringify({
    [consts.envelopeField]: { alg: consts.alg, kid: 'k', iv: 'i', ct: 'c' },
  })
  assert.equal(gate.checkEnvelopeStructure(good, consts).ok, true)
  const extraInner = JSON.stringify({
    [consts.envelopeField]: { alg: consts.alg, kid: 'k', iv: 'i', ct: 'c', v: 1 },
  })
  assert.equal(gate.checkEnvelopeStructure(extraInner, consts).ok, false)
  const extraOuter = JSON.stringify({
    [consts.envelopeField]: { alg: consts.alg, kid: 'k', iv: 'i', ct: 'c' },
    other: 1,
  })
  assert.equal(gate.checkEnvelopeStructure(extraOuter, consts).ok, false)
  const wrongAlg = JSON.stringify({
    [consts.envelopeField]: { alg: 'OTHER', kid: 'k', iv: 'i', ct: 'c' },
  })
  assert.equal(gate.checkEnvelopeStructure(wrongAlg, consts).ok, false)
})

test('判据2-扫描面严格限定 Local Storage + roaming json,且不跟随重解析点', () => {
  const id = 'com.test.app'
  const scratch = mkScratch('dcp-scanface')
  try {
    const local = path.join(scratch, 'Local', id)
    const roam = path.join(scratch, 'Roaming', id)
    const ldb = path.join(local, 'EBWebView', 'Default', 'Local Storage', 'leveldb')
    const cache = path.join(local, 'EBWebView', 'Default', 'Cache_Data')
    const gpu = path.join(local, 'EBWebView', 'Default', 'GPUCache')
    const code = path.join(local, 'EBWebView', 'Default', 'Code Cache', 'js')
    for (const d of [ldb, cache, gpu, code, roam]) fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(ldb, '000003.log'), 'ls-record')
    fs.writeFileSync(path.join(ldb, 'LOCK'), '')
    fs.writeFileSync(path.join(cache, 'f_1'), 'CACHESECRETcache-token')
    fs.writeFileSync(path.join(gpu, 'g_1'), 'GPUSECRETgpu-token')
    fs.writeFileSync(path.join(code, 'c_1'), 'CODESECRETcode-token')
    fs.writeFileSync(path.join(roam, 'auth.json'), '{"refresh_token":"x"}')
    fs.writeFileSync(path.join(roam, 'notjson.txt'), 'ignore-me')

    const list = gate.listScanFiles(local, roam)
    const files = list.map((s) => path.basename(s.file)).sort()
    assert.deepEqual(files, ['000003.log', 'LOCK', 'auth.json'], `实际扫描面: ${files}`)
    assert.ok(!list.some((s) => /Cache_Data|GPUCache|Code Cache/.test(s.file)))
    assert.ok(list.every((s) => s.face === 'local-storage' || s.face === 'roaming-json'))

    // 重解析点:能建符号链接就验证"跳过",建不了(Windows 非特权)则退而验证 lstat 判定函数存在
    const link = path.join(local, 'EBWebView', 'LinkProfile')
    try {
      fs.symlinkSync(path.join(local, 'EBWebView', 'Default'), link, 'junction')
      const escaped = path.join(link, 'Local Storage', 'leveldb', '000003.log')
      assert.ok(fs.existsSync(escaped), '前置:经链接可达')
      const list2 = gate.listScanFiles(local, roam)
      const names = list2.map((s) => s.file)
      assert.ok(
        !names.some((n) => n.includes('LinkProfile')),
        '枚举不得穿透重解析点(§26 防清空真实目标)',
      )
      fs.rmSync(link, { recursive: false, force: true })
    } catch (e) {
      if (e.code !== 'EPERM' && e.code !== 'ENOTSUP' && e.code !== 'EINVAL') throw e
      console.log(`  (符号链接创建受限,重解析点跳过改由 collectFilesNoFollow 单测覆盖: ${e.code})`)
      assert.ok(gate.collectFilesNoFollow(ldb, 3).length >= 1)
    }
  } finally {
    rmScratch(scratch)
  }
})

test('evaluateFiles:真把明文记录判成违规、把信封判成合规,并给出文件清单', () => {
  const id = 'com.test.app2'
  const scratch = mkScratch('dcp-eval')
  try {
    const local = path.join(scratch, 'Local', id)
    const roam = path.join(scratch, 'Roaming', id)
    const ldb = path.join(local, 'EBWebView', 'Default', 'Local Storage', 'leveldb')
    fs.mkdirSync(ldb, { recursive: true })
    fs.mkdirSync(roam, { recursive: true })
    const key = 'ihui-evalkey'
    const envelope = JSON.stringify({
      [consts.envelopeField]: { alg: consts.alg, kid: 'k1', iv: 'aWk', ct: 'YWJj' },
    })
    fs.writeFileSync(path.join(ldb, 'sealed.log'), `k ${key}\u0001${envelope}`)
    fs.writeFileSync(path.join(ldb, 'plain.log'), `k ${key}\u0001{"state":{"a":1}}`)
    const list = gate.listScanFiles(local, roam)
    const ev = gate.evaluateFiles(list, { ...consts }, [key])
    const sealed = ev.perFile.find((f) => f.file.endsWith('sealed.log'))
    const plainF = ev.perFile.find((f) => f.file.endsWith('plain.log'))
    assert.ok(sealed.recordKinds.some((k) => k.includes('sealed-ok')))
    assert.ok(plainF.recordKinds.some((k) => k.includes(':plain')))
    assert.ok(ev.violations.some((v) => v.includes('明文 persist 记录')))
    assert.equal(ev.violations.filter((v) => v.includes('sealed.log')).length, 0)
  } finally {
    rmScratch(scratch)
  }
})

test('判据3-密钥不入仓在真仓为绿,且"第二处源码"必判红(变异自证)', () => {
  const h = gate.checkKeyHygiene(consts)
  assert.ok(!h.undetermined, `git 面不可用: ${h.undetermined}`)
  assert.deepEqual(h.violations, [], `真仓不该有卫生违规: ${h.violations.join(' | ')}`)
  assert.ok(h.trackedCount > 100, `ls-files 拿到 ${h.trackedCount} 项,尺子疑似空跑`)
  assert.deepEqual(h.refFiles, ['apps/web/src/lib/local-vault.ts'])
  // 变异:换一个几乎不可能出现在源码里的"文件名",反向确认判据真的在看单源那一条
  const h2 = gate.checkKeyHygiene({ ...consts, vaultStoreFile: 'zzz-no-such-file.json' })
  assert.ok(
    h2.violations.some((v) => v.includes('反而找不到')),
    `变异未触发预期红点: ${JSON.stringify(h2)}`,
  )
})

test('接线方向:warn-only 门**必须不在** guardian-runner / pre-commit 提交链里', () => {
  const runner = read('scripts/guardian-runner.mjs')
  assert.ok(
    !runner.includes('check-desktop-cache-plaintext'),
    '本门按设计只允许手动/巡检触发;被挂进 blocking 提交链即交付事故',
  )
  const hook = (() => {
    try {
      return read('.husky/pre-commit')
    } catch {
      return ''
    }
  })()
  assert.ok(!hook.includes('check-desktop-cache-plaintext'))
})

test('反假绿:数据目录取不到 ⇒ runInspection 判 undetermined,绝不记 clean', async () => {
  const mod = await import('../check-desktop-cache-plaintext.mjs')
  const r = mod.runInspection('com.definitely-not-installed-app-xyz')
  if (process.platform !== 'win32') {
    assert.equal(r.status, 'undetermined')
    return
  }
  assert.equal(r.status, 'undetermined', `目录不存在却给出 ${r.status} —— 未判定被洗成通过?`)
  assert.ok(r.reasons.some((x) => /不存在|未判定/.test(x)))
})

test('派生纪律:源脚本的 git 调用必须带 timeout + windowsHide(守门 52/80)', () => {
  const src = read('scripts/check-desktop-cache-plaintext.mjs')
  assert.match(src, /timeout:\s*timeoutMs|timeout:\s*GIT_TIMEOUT_MS/)
  assert.match(src, /windowsHide:\s*true/)
  assert.ok(!/execSync\s*\(/.test(src), '禁用无 options 通道的 execSync')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
