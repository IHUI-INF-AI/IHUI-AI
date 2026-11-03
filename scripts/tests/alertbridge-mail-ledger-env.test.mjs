// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 沙箱台账隔离(2026-11-03):bridge 的 STATE_FILE 一被指走,派发器台账必须跟着走。
// 判据实现住在 monitoring/alertbridge/mail-ledger-env.js(生产代码),本测试不抄第二份。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_STATE_FILE,
  maskMailRecipient,
  resolveMailSendLedgerEnv,
} from '../../monitoring/alertbridge/mail-ledger-env.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const BRIDGE_REL = 'monitoring/alertbridge/alert-webhook-bridge.cjs'
const BRIDGE_SRC = readFileSync(join(ROOT, BRIDGE_REL), 'utf8')
const SANDBOX_STATE = join(tmpdir(), 'ihui-bridge-sandbox-test', 'alert-bridge-state.json')

test('T1 STATE_FILE 为生产默认 ⇒ 不注入台账变量(生产默认路径保持)', () => {
  assert.equal(resolveMailSendLedgerEnv({}, DEFAULT_STATE_FILE), null)
  assert.equal(
    resolveMailSendLedgerEnv({ STATE_FILE: DEFAULT_STATE_FILE }, DEFAULT_STATE_FILE),
    null,
  )
})

test('T2 STATE_FILE 指向临时目录 ⇒ 台账跟随到该目录下的 mail-send-ledger.jsonl', () => {
  assert.equal(
    resolveMailSendLedgerEnv({}, SANDBOX_STATE),
    join(dirname(SANDBOX_STATE), 'mail-send-ledger.jsonl'),
  )
})

test('T3 显式 IHUI_MAIL_SEND_LEDGER 优先:STATE_FILE 为临时值时也不被覆盖', () => {
  const explicit = join(tmpdir(), 'ihui-explicit-ledger', 'my-ledger.jsonl')
  assert.equal(
    resolveMailSendLedgerEnv({ IHUI_MAIL_SEND_LEDGER: explicit }, SANDBOX_STATE),
    explicit,
  )
})

test('空白值的覆盖变量按未设置处理(与派发器的 trim 口径一致)', () => {
  assert.equal(resolveMailSendLedgerEnv({ IHUI_MAIL_SEND_LEDGER: '   ' }, SANDBOX_STATE), join(dirname(SANDBOX_STATE), 'mail-send-ledger.jsonl'))
  assert.equal(resolveMailSendLedgerEnv({ IHUI_MAIL_SEND_LEDGER: '   ' }, DEFAULT_STATE_FILE), null)
})

test('收件人横幅只出掩码:前 2 位 + 域名,绝不回显完整地址', () => {
  assert.equal(maskMailRecipient('502319984@qq.com'), '50***@qq.com')
  assert.equal(maskMailRecipient('a@x.com'), 'a***@x.com')
  assert.equal(maskMailRecipient('not-an-email'), '***')
  assert.equal(maskMailRecipient(''), '')
})

test('接线锁:bridge 真用该判据,且在 spawn 派发器之前注入环境变量', () => {
  assert.match(BRIDGE_SRC, /require\('\.\/mail-ledger-env\.js'\)/)
  assert.match(BRIDGE_SRC, /resolveMailSendLedgerEnv\(process\.env, STATE_FILE\)/)
  assert.match(BRIDGE_SRC, /process\.env\.IHUI_MAIL_SEND_LEDGER = LEDGER_ENV_OVERRIDE/)
  const injectAt = BRIDGE_SRC.indexOf('process.env.IHUI_MAIL_SEND_LEDGER = LEDGER_ENV_OVERRIDE')
  const spawnAt = BRIDGE_SRC.indexOf('spawn(process.execPath')
  assert.ok(injectAt > 0 && spawnAt > injectAt, 'IHUI_MAIL_SEND_LEDGER 必须在 spawn 之前注入')
  // 启动横幅必须带运行身份,且 mailTo 走掩码(不得直接打印 MAIL_TO 原文)
  assert.match(BRIDGE_SRC, /运行身份: state=\$\{STATE_FILE\} log=\$\{LOG_FILE\} mailTo=\$\{bannerMailTo\(\)\} mailEnabled=\$\{MAIL_ENABLED\}/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
