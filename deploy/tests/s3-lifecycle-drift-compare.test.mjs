#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * S3 生命周期漂移判据夹具(对应 P2-2)。
 *
 * 钉三件事:
 * ① 读取失败(非 NoSuchLifecycleConfiguration)不得伪装成「线上无规则」—— 静态断言 workflow 分支;
 * ② 比较必须看**内容**:条数相同但 Expiration.Days 变了 ⇒ 必须 drift(exit 1);
 * ③ 不可判定(非法 JSON / 声明无 Rules / 声明为空)⇒ exit 2,绝不当「无漂移」。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const SCRIPT = join(ROOT, 'deploy', 'aws', 's3-lifecycle-compare.py')
const WORKFLOW = join(ROOT, '.github', 'workflows', 's3-lifecycle-drift.yml')

/** 找可用的 python 解释器;找不到就点名 skip(机器态 ≠ 代码缺陷)。 */
function findPython() {
  for (const exe of ['python3', 'python']) {
    try {
      execFileSync(exe, ['--version'], { stdio: 'ignore' })
      return exe
    } catch {
      // 继续试下一个
    }
  }
  return null
}

const PY = findPython()

function run(py, declared, current) {
  const dir = mkdtempSync(join(tmpdir(), 's3-lifecycle-fixture-'))
  const dPath = join(dir, 'declared.json')
  const cPath = join(dir, 'current.json')
  writeFileSync(dPath, typeof declared === 'string' ? declared : JSON.stringify(declared))
  writeFileSync(cPath, typeof current === 'string' ? current : JSON.stringify(current))
  try {
    const out = execFileSync(py, [SCRIPT, dPath, cPath], { encoding: 'utf8' })
    return { code: 0, out }
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

const RULE = { ID: 'LogsPrefixPolicy', Status: 'Enabled', Filter: { Prefix: 'logs/' }, Expiration: { Days: 90 } }
const GENERAL = { ID: 'GeneralLifecycleTiering', Status: 'Enabled', Filter: { Prefix: '' }, Transitions: [{ StorageClass: 'GLACIER_IR', Days: 30 }] }
const DECL = { Rules: [GENERAL, RULE] }

test('T1 静态:Fetch 步骤不得用 || echo 把读取失败伪装成「无规则」', () => {
  const wf = readFileSync(WORKFLOW, 'utf8')
  assert.ok(
    !/get-bucket-lifecycle-configuration[\s\S]{0,200}?\|\| echo/.test(wf),
    '读取失败仍被 `|| echo {"Rules":[]}` 吞掉 ⇒ 凭据/网络错误会被当成线上无规则',
  )
  assert.ok(
    /grep -q 'NoSuchLifecycleConfiguration'/.test(wf),
    '缺少「只有 NoSuchLifecycleConfiguration 才算真无规则」的分支',
  )
  assert.ok(/读取生命周期配置失败[\s\S]{0,120}?exit 1/.test(wf), '其它读取错误必须 ::error + 非 0')
})

test('T2 内容一致 ⇒ exit 0', { skip: !PY && '本机无 python3/python' }, () => {
  const r = run(PY, DECL, DECL)
  assert.equal(r.code, 0, r.out)
  assert.match(r.out, /无漂移/)
})

test('T3 条数相同但 Expiration.Days 变了 ⇒ 必须 drift(exit 1)', { skip: !PY && '本机无 python3/python' }, () => {
  const drifted = { Rules: [GENERAL, { ...RULE, Expiration: { Days: 91 } }] }
  const r = run(PY, DECL, drifted)
  assert.equal(r.code, 1, `条数相同内容不同被判无漂移(旧判据 len 比较失明): ${r.out}`)
  assert.match(r.out, /内容不一致: LogsPrefixPolicy/)
  assert.match(r.out, /Days/)
})

test('T4 线上多出一条规则 ⇒ drift(exit 1)', { skip: !PY && '本机无 python3/python' }, () => {
  const extra = { Rules: [GENERAL, RULE, { ID: 'Extra', Status: 'Enabled', Expiration: { Days: 1 } }] }
  const r = run(PY, DECL, extra)
  assert.equal(r.code, 1, r.out)
  assert.match(r.out, /线上有、声明缺: Extra/)
})

test('T5 非法 JSON ⇒ 不可判定(exit 2),不得判无漂移', { skip: !PY && '本机无 python3/python' }, () => {
  const r = run(PY, DECL, '{not json')
  assert.equal(r.code, 2, r.out)
  assert.match(r.out, /读取\/解析生命周期配置失败/)
})

test('T6 声明 Rules 为空 ⇒ 判据失明(exit 2)', { skip: !PY && '本机无 python3/python' }, () => {
  const r = run(PY, { Rules: [] }, DECL)
  assert.equal(r.code, 2, r.out)
  assert.match(r.out, /声明 Rules 为空/)
})

test('T7 线上缺 Rules 数组 ⇒ 不可判定(exit 2)', { skip: !PY && '本机无 python3/python' }, () => {
  const r = run(PY, DECL, {})
  assert.equal(r.code, 2, r.out)
  assert.match(r.out, /线上配置缺少 Rules 数组/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
