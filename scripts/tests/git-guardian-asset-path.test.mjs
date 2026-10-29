// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 资产路径可达性腿(尺子 = check-asset-path-health.mjs)的接线锁(2026-10-28 立,§22c 直接 import 源模块)。
//
// 立因:生产 .env 四条支付宝证书路径指向已不存在的 F: 盘,SDK 静默读不到、全仓零门喊过。
// 本文件钉住四件事:
//   ① breach ⇒ 必发信一次,身份按「断链数 + 证书错误数 + 持续档」折叠(具体路径不进身份);
//   ② ok ⇒ 不发信、清持续档;
//   ③ 结论不可解析 ⇒ 判"未判定",既不发信也不记账(§0.3);
//   ④ 节流窗口内第二次调用直接让路(尺子 6h 一趟,不能每 2 分钟 spawn 一次)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { auditAssetPathHealth } from '../git-guardian.mjs'

function scratchPaths() {
  const dir = mkScratch('asset-path-leg-')
  return {
    dir,
    tickFile: join(dir, 'tick.ts'),
    firstFile: join(dir, 'first.json'),
    lastFile: join(dir, 'last.json'),
    // 宿主 safe-delete 守卫会拦 trash 批量删除 ⇒ 清理失败只留一个 gitignored 空目录,
    // 不得让"环境拦删"冒充"用例失败"(否则这条腿的断言永远红,等于没测)。
    clean: () => {
      try {
        rmScratch(dir)
      } catch {
        /* 残留临时目录无害 */
      }
    },
  }
}

const breachPayload = {
  verdict: 'breach',
  env: {
    scanned: [{ file: 'apps/api/.env', keys: 4 }],
    missing: [
      { file: 'apps/api/.env', line: 215, key: 'ALIPAY_APP_CERT_PATH', path: 'F:/x.crt' },
      { file: 'apps/api/.env', line: 217, key: 'ALIPAY_ROOT_CERT_PATH', path: 'F:/y.crt' },
    ],
    inputs: 1,
  },
  certs: { ok: 4, warning: 0, error: 0 },
}

test('breach: 发信一次,身份折叠到断链档而不是具体路径', () => {
  const p = scratchPaths()
  const mails = []
  try {
    const r = auditAssetPathHealth({
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: (title, body, opts) => mails.push({ title, body, opts }),
      runner: () => ({ status: 1, stdout: JSON.stringify(breachPayload) }),
    })
    assert.equal(r.ran, true)
    assert.equal(r.breaches, 1)
    assert.equal(r.missing, 2)
    assert.equal(mails.length, 1)
    assert.match(mails[0].title, /资产断链/)
    assert.match(mails[0].body, /ALIPAY_APP_CERT_PATH/)
    assert.doesNotMatch(mails[0].opts.dedupKey, /F:\//, '路径不得进身份(位移即风暴)')
    assert.match(mails[0].opts.dedupKey, /missing=/)
  } finally {
    p.clean()
  }
})

test('ok: 不发信,持续档被清掉', () => {
  const p = scratchPaths()
  const mails = []
  try {
    const r = auditAssetPathHealth({
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: () => mails.push('x'),
      runner: () => ({ status: 0, stdout: JSON.stringify({ verdict: 'ok', env: { scanned: [{ file: '.env', keys: 2 }] }, certs: { ok: 4, warning: 0, error: 0 } }) }),
    })
    assert.equal(r.breaches, 0)
    assert.equal(mails.length, 0)
  } finally {
    p.clean()
  }
})

test('结论不可解析: 判未判定,不发信不记绿', () => {
  const p = scratchPaths()
  const mails = []
  try {
    const r = auditAssetPathHealth({
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: () => mails.push('x'),
      runner: () => ({ status: 2, stdout: 'not json at all', stderr: 'boom' }),
    })
    assert.equal(r.ran, true)
    assert.equal(r.judged, false)
    assert.equal(mails.length, 0)
  } finally {
    p.clean()
  }
})

test('节流: 窗口内第二次直接让路(不重复 spawn 尺子)', () => {
  const p = scratchPaths()
  let calls = 0
  try {
    const opts = {
      now: 1_700_000_000_000,
      intervalMs: 6 * 60 * 60 * 1000,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: () => {},
      runner: () => {
        calls += 1
        return { status: 0, stdout: JSON.stringify({ verdict: 'ok', env: { scanned: [], inputs: 0 }, certs: { ok: 1, warning: 0, error: 0 } }) }
      },
    }
    auditAssetPathHealth(opts)
    const second = auditAssetPathHealth({ ...opts, now: opts.now + 60_000 })
    assert.equal(calls, 1)
    assert.equal(second.ran, false)
  } finally {
    p.clean()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
