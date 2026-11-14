// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-35 回归锁(2026-11-14):发票抬头 PII 与后台实名 idCard 加密。
 *
 * 病灶:
 *  - learn_invoice_titles / edu_invoice_titles 的税号、开户行、银行账号、地址、电话明文落库;
 *  - user_auth_info.id_card 在用户端已加密,但后台两个 CRUD 路由仍明文写入/原样返回,
 *    且对密文列做 ilike(永远搜不到)。
 *
 * 本用例只做两件事:
 *  1) 纯函数锁:encryptPiiText/decryptPiiText 的空值透传、往返、幂等、存量明文兼容、篡改抛错;
 *  2) 源码形状锁:三处发票抬头读写必须经过统一字段组加解密;三个实名路由不得再对
 *     idCard 密文列做 ilike;两张发票抬头表的列宽迁移只能放宽。
 * 不连真实 DB/Redis。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/config/index.js', () => ({
  config: {
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

import {
  INVOICE_PII_KEYS,
  decryptInvoiceTitleFields,
  decryptPiiText,
  encryptInvoiceTitleFields,
  encryptPiiText,
  type InvoicePiiFields,
} from '../src/utils/pii-field.js'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (rel: string): string => readFileSync(resolve(REPO_ROOT, rel), 'utf8')

const CREDENTIAL_FORMAT =
  /^enc:v1:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}:[A-Za-z0-9+/]+={0,2}$/

describe('DB-35 PII 文本收口', () => {
  it('null/undefined/空串原样透传', () => {
    expect(encryptPiiText(null)).toBeNull()
    expect(encryptPiiText(undefined)).toBeUndefined()
    expect(encryptPiiText('')).toBe('')
    expect(decryptPiiText(null)).toBeNull()
    expect(decryptPiiText(undefined)).toBeUndefined()
    expect(decryptPiiText('')).toBe('')
  })

  it('密文带 enc:v1: 前缀且往返一致', () => {
    const stored = encryptPiiText('91310000MA1K35Q123') as string
    expect(stored).toMatch(CREDENTIAL_FORMAT)
    expect(stored).not.toContain('91310000MA1K35Q123')
    expect(decryptPiiText(stored)).toBe('91310000MA1K35Q123')
  })

  it('已加密值重复加密幂等', () => {
    const once = encryptPiiText('13800138000') as string
    expect(encryptPiiText(once)).toBe(once)
  })

  it('存量明文无前缀时原样返回', () => {
    expect(decryptPiiText('招商银行上海分行')).toBe('招商银行上海分行')
  })

  it('篡改密文必须抛错,不得回落成明文', () => {
    const stored = encryptPiiText('6225888888888888') as string
    const parts = stored.split(':')
    const last = parts.length - 1
    const ciphertext = Buffer.from(parts[last]!, 'base64')
    ciphertext[0] = (ciphertext[0] ?? 0) ^ 0xff
    parts[last] = ciphertext.toString('base64')
    expect(() => decryptPiiText(parts.join(':'))).toThrow()
  })
})

describe('DB-35 发票抬头字段组', () => {
  const plain = {
    taxNo: '91310000MA1K35Q123',
    bank: '招商银行上海分行',
    bankAccount: '6225888888888888',
    address: '上海市浦东新区世纪大道 100 号',
    phone: '13800138000',
  }

  it('五个敏感字段全部加密且可还原', () => {
    const stored = encryptInvoiceTitleFields(plain)
    for (const key of INVOICE_PII_KEYS) expect(stored[key]).toMatch(CREDENTIAL_FORMAT)
    expect(decryptInvoiceTitleFields(stored)).toEqual(plain)
  })

  it('未提供的字段保持 undefined,不会被补成 null', () => {
    const input: InvoicePiiFields = { taxNo: plain.taxNo }
    const stored = encryptInvoiceTitleFields(input)
    expect(stored.taxNo).toMatch(CREDENTIAL_FORMAT)
    for (const key of ['bank', 'bankAccount', 'address', 'phone'] as const) {
      expect(stored[key]).toBeUndefined()
      expect(Object.prototype.hasOwnProperty.call(stored, key)).toBe(false)
    }
  })

  it('可空字段 null 保持 null', () => {
    const stored = encryptInvoiceTitleFields({ taxNo: plain.taxNo, bank: null })
    expect(stored.bank).toBeNull()
    expect(decryptInvoiceTitleFields(stored).bank).toBeNull()
  })
})

describe('DB-35 生产写读路径源码锁', () => {
  const invoiceFiles = [
    'apps/api/src/db/learn-extended-queries.ts',
    'apps/api/src/db/order-queries.ts',
    'apps/api/src/routes/admin-invoices.ts',
  ]

  it.each(invoiceFiles)('%s 同时调用发票字段加解密', (rel) => {
    const text = read(rel)
    expect(text).toContain('encryptInvoiceTitleFields')
    expect(text).toContain('decryptInvoiceTitleFields')
    expect(text).toContain("from '../utils/pii-field.js'")
  })

  const realnameFiles = [
    'apps/api/src/routes/admin/auth-info.ts',
    'apps/api/src/routes/admin-auth-edu-routes.ts',
    'apps/api/src/routes/auth-identity.ts',
  ]

  it.each(realnameFiles)('%s 不再对 idCard 密文列做 ilike', (rel) => {
    expect(read(rel)).not.toContain('ilike(userAuthInfo.idCard')
  })

  it('两个后台实名 CRUD 路由写读都经过 encryptField/decryptField', () => {
    for (const rel of [
      'apps/api/src/routes/admin/auth-info.ts',
      'apps/api/src/routes/admin-auth-edu-routes.ts',
    ]) {
      const text = read(rel)
      expect(text).toContain('encryptField')
      expect(text).toContain('decryptField')
    }
  })
})

describe('DB-35 发票抬头列宽迁移', () => {
  const sql = read('packages/database/drizzle/20261114180000_pii_invoice_title_widen.sql')

  it('两张表的五个敏感字段全部放宽', () => {
    for (const table of ['learn_invoice_titles', 'edu_invoice_titles']) {
      expect(sql).toContain(`ALTER TABLE "${table}"`)
    }
    for (const column of ['tax_no', 'bank', 'bank_account', 'address']) {
      expect(sql.match(new RegExp(`"${column}" TYPE text`, 'g'))?.length).toBe(2)
    }
    expect(sql.match(/"phone" TYPE varchar\(255\)/g)?.length).toBe(2)
  })

  it('只放宽,不删列,不收紧到旧宽度', () => {
    // 头注/回滚说明里会提到旧宽度 varchar(50),判据只看真正会被执行的 DDL 行。
    const ddl = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
    expect(ddl).not.toMatch(/DROP\s+(COLUMN|TABLE)/i)
    expect(ddl).not.toMatch(/TYPE\s+varchar\((20|50|100|200)\)/i)
  })
})
