// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-public-admin-default.mjs`(G-875 守门,2026-10-24 立)
 *
 * 判据一律从源脚本 `import { __test__ }`,本文件不复制第二份判据常量。
 *
 * 锁六组:
 *  ① 真仓 HEAD 面通过(判据锚点与允许清单必须落在当前事实上,不能只靠构造面自嗨);
 *  ② 明文反例有牙 —— 非历史落点出现公开口令 ⇒ 红,且点名该文件;
 *  ③ 散列反例有牙 —— 已知散列出现在运行时面 ⇒ 红;失效迁移漏覆盖历史散列 ⇒ 红;
 *  ④ 取值面锁 —— fixtures 必须是 requireEnv、seed 必须绑定 process.env,出现 ?? 字面量回落 ⇒ 红;
 *  ⑤ 空扫描面判死 —— grep 不到任何明文不得当成"通过"(§0.3:没判 ≠ 判过);
 *  ⑥ 源文件自身不含明文字面量(这样守门不需要给自己开豁免口子,豁免面越窄越难腐烂)。
 *
 * 夹具落点:本文件不写盘,全部在内存构造。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate, analyze, selfTest } from '../check-public-admin-default.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SOURCE_REL = join('scripts', 'check-public-admin-default.mjs')

const PLAINTEXT = 'admin' + '123'
const H1 = '$2a$10$' + 'a'.repeat(53)
const H2 = '$2a$10$' + 'b'.repeat(53)
const CLEAN_FIXTURE =
  "const ADMIN_USER = {\n  account: 'e2e_admin',\n  password: requireEnv('E2E_ADMIN_PASSWORD'),\n}"
const CLEAN_SEED = 'const e2eAdminPassword = process.env.E2E_ADMIN_PASSWORD'

function base(overrides = {}) {
  return {
    plaintextPaths: gate.HISTORICAL_MIGRATIONS,
    hashPaths: [...gate.HISTORICAL_MIGRATIONS, gate.INVALIDATION_MIGRATION],
    historicalHashes: [H1],
    invalidationHashes: [H1],
    fixtureText: CLEAN_FIXTURE,
    seedText: CLEAN_SEED,
    journalText: '20261022234000_invalidate_public_admin_password',
    ...overrides,
  }
}

test('① 真仓 HEAD 面:无公开 admin 默认口令的明文/散列落点', () => {
  const r = analyze({ face: 'head' })
  assert.deepEqual(r.findings, [], `真仓当前形态被判红:\n${r.findings.join('\n')}`)
  assert.equal(r.exitCode, 0)
})

test('② 明文反例:非历史落点出现公开口令 ⇒ 红并点名该文件', () => {
  const f = gate.judge(base({ plaintextPaths: [...gate.HISTORICAL_MIGRATIONS, 'apps/web/e2e/some.spec.ts'] }))
  assert.equal(f.length, 1)
  assert.match(f[0], /apps\/web\/e2e\/some\.spec\.ts/)
  // 历史落点本身不得被判红(允许清单按精确路径生效)
  assert.deepEqual(gate.judge(base()), [])
})

test('③ 散列反例:运行时面出现已知散列 ⇒ 红;失效迁移漏覆盖 ⇒ 红', () => {
  const leaked = gate.judge(
    base({ hashPaths: [...gate.HISTORICAL_MIGRATIONS, 'apps/api/src/routes/auth.ts'] }),
  )
  assert.ok(leaked.some((x) => x.includes('apps/api/src/routes/auth.ts')), leaked.join(' | '))

  const uncovered = gate.judge(base({ invalidationHashes: [H2] }))
  assert.ok(uncovered.some((x) => x.includes('失效迁移未覆盖')), uncovered.join(' | '))

  assert.deepEqual(gate.extractBcryptHashes(`x ${H1} y ${H1}`), [H1], '散列枚举必须去重')
})

test('④ 取值面锁:fixtures 必须是 requireEnv;seed 必须绑定 process.env;?? 回落 ⇒ 红', () => {
  assert.deepEqual(gate.judgeFixture(CLEAN_FIXTURE), [])
  assert.ok(
    gate.judgeFixture(
      "const ADMIN_USER = {\n  password: process.env.E2E_ADMIN_PASSWORD ?? '" + PLAINTEXT + "',\n}",
    ).length > 0,
  )
  assert.ok(
    gate.judgeFixture("const ADMIN_USER = {\n  password: '" + PLAINTEXT + "',\n}").length > 0,
  )
  assert.deepEqual(gate.judgeSeed(CLEAN_SEED), [])
  assert.ok(gate.judgeSeed("const e2eAdminPassword = '" + PLAINTEXT + "'").length > 0)
  assert.ok(gate.judgeSeed('const e2eAdminPassword = process.env.E2E_ADMIN_PASSWORD ?? "x"').length > 0)
})

test('⑤ 空扫描面判死:grep 不到任何明文不得记绿(没判 ≠ 判过)', () => {
  const f = gate.judge(base({ plaintextPaths: [] }))
  assert.ok(f.some((x) => x.includes('判据失去输入')), f.join(' | '))
})

test('⑥ 源文件自身不含明文字面量 + 体内 --self-test 全绿', () => {
  const src = readFileSync(join(ROOT, SOURCE_REL), 'utf8')
  assert.ok(!src.includes(PLAINTEXT), '守门源文件自己含明文 ⇒ 必须开自豁免口子,豁免面会腐烂')
  assert.equal(selfTest(), 0, '体内 --self-test 有失败用例')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
