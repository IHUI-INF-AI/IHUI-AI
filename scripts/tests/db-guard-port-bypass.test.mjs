// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/db-probe-client.mjs` 的 `guardDbDsn` 端口黑名单防绕过锁。
 *
 * 立此锁的缺陷(2026-11-04 实测复现,不是推断):
 *  ① DSN 不写端口 ⇒ 旧实现 `port === '8810'` 直接放行,实际端口由 psql 默认值 / PGPORT 决定,
 *     实测「免端口 DSN + PGPORT=8810」真连上 8810;
 *  ② 端口写 `08810` ⇒ 字符串不相等,放行;
 *  ③ `PGPORT` 改写实际端口,守卫完全不知情。
 *
 * 锁的是**有效端口**而不是字面量:DSN 写明端口用 DSN 值(数值归一),不写则取 PGPORT,再缺则 5432;
 * 任一处非法(<1 / >65535 / 非数字)一律拒("不猜")。host 白名单与不猜原则不变。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { FORBIDDEN_PROD_PORT, guardDbDsn } from '../lib/db-probe-client.mjs'

const NO_ENV = {}

test('① DSN 写明 :8810 ⇒ 拒', () => {
  const r = guardDbDsn(`postgres://u:p@127.0.0.1:${FORBIDDEN_PROD_PORT}/db`, NO_ENV)
  assert.equal(r.ok, false)
  assert.match(r.why, /8810/)
  assert.match(r.why, /生产 SSH 隧道口/)
})

test('② 端口写成 08810 ⇒ 归一后仍拒(数值比较,不是字串比较)', () => {
  const r = guardDbDsn('postgres://u:p@localhost:08810/db', NO_ENV)
  assert.equal(r.ok, false)
  assert.match(r.why, /有效端口=8810/)
  assert.match(r.why, /DSN 写明端口 08810/)
})

test('③ DSN 不写端口 + PGPORT=8810 ⇒ 拒,理由点名端口缺失/PGPORT', () => {
  const r = guardDbDsn('postgres://u:p@localhost/db', { PGPORT: FORBIDDEN_PROD_PORT })
  assert.equal(r.ok, false)
  assert.match(r.why, /有效端口=8810/)
  assert.match(r.why, /PGPORT=8810/)
})

test('④ DSN 不写端口 + 无 PGPORT ⇒ 有效端口 5432,放行', () => {
  const r = guardDbDsn('postgres://u:p@localhost/db', NO_ENV)
  assert.equal(r.ok, true)
  assert.equal(r.dsn, 'postgres://u:p@localhost/db')
})

test('⑤ PGPORT 非法(not-a-number)⇒ 拒,不回落默认 5432', () => {
  const r = guardDbDsn('postgres://u:p@localhost/db', { PGPORT: 'not-a-number' })
  assert.equal(r.ok, false)
  assert.match(r.why, /PGPORT=not-a-number/)
  assert.match(r.why, /不猜/)
})

test('⑥ host 非回环 ⇒ 仍拒(白名单未被放宽)', () => {
  const r = guardDbDsn('postgres://u:p@db.internal:5432/db', NO_ENV)
  assert.equal(r.ok, false)
  assert.match(r.why, /不在本机回环白名单/)
})

test('⑦ 合法 :5432 ⇒ 放行', () => {
  const r = guardDbDsn('postgres://u:p@127.0.0.1:5432/db', NO_ENV)
  assert.equal(r.ok, true)
  assert.equal(r.dsn, 'postgres://u:p@127.0.0.1:5432/db')
})

test('⑧ 端口非法(0 / 70000 / 8810.0)⇒ 一律拒,不猜', () => {
  for (const dsn of [
    'postgres://u:p@localhost:0/db',
    'postgres://u:p@localhost:70000/db',
    'postgres://u:p@localhost:8810.0/db',
  ]) {
    const r = guardDbDsn(dsn, NO_ENV)
    assert.equal(r.ok, false, `${dsn} 竟被放行`)
    assert.match(r.why, /不猜/, `${dsn} 的拒绝理由未写明不猜`)
  }
})

test('⑨ DSN 写明端口时 PGPORT 不再参与有效端口(libpq 语义:显式端口优先)', () => {
  const r = guardDbDsn('postgres://u:p@localhost:5432/db', { PGPORT: FORBIDDEN_PROD_PORT })
  assert.equal(r.ok, true, '显式 5432 被环境变量 PGPORT 越权改写 ⇒ 判据面出错')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
