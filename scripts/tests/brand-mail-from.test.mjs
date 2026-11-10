// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发件人显示名归一化 —— 全仓最后一个未归一的真实发信出口(APKPure 提交函件)。
 *
 * 背景(2026-11-10 机主定案):收件箱里曾同时出现「智汇AI」「智汇AI官方」「502319984」三种
 * 发件人显示名。根子是每个发信口各自拼 From,而显示名又能被配置决定。本文件钉住
 * `scripts/submit-store-apkpure.mjs` 这一支:
 *
 *   · 它免的是「版式层」(对外业务函件是纯文本字段表,套告警模板反而错);
 *   · **不豁免身份层** —— 发件人同样代表品牌对外形象,必须归一成品牌名。
 *
 * 为什么单独成文件而不并入 `submit-store-family.test.mjs`:后者要读
 * `scripts/data/app-store-credentials.json`(gitignored 的本地密钥矩阵),在干净 checkout /
 * CI 上跑不起来;本文件只依赖零依赖的提审模块本身,任何机器都能跑。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { __test__ as AP } from '../submit-store-apkpure.mjs'

const ROOT = join(import.meta.dirname, '..', '..')

test('F17 brandFrom 只保留地址段,显示名恒为品牌名', () => {
  assert.equal(AP.brandFrom('bare@aizhs.top'), '智汇AI <bare@aizhs.top>', '裸地址也必须补品牌显示名')
  assert.equal(
    AP.brandFrom('智汇AI官方 <noreply@aizhs.top>'),
    '智汇AI <noreply@aizhs.top>',
    '旧显示名不得生效',
  )
  assert.equal(AP.brandFrom('"某人" <x@aizhs.top>'), '智汇AI <x@aizhs.top>', '带引号的名字同样被剥掉')
  assert.equal(AP.brandFrom('  spaced@aizhs.top  '), '智汇AI <spaced@aizhs.top>', '两侧空白不进入地址段')
  assert.equal(AP.brandFrom(''), '', '空串仍是空串(调用方据此判"凭据不到位",零调用)')
  assert.equal(AP.brandFrom('显示名 < >'), '', '括里没地址时不得产出 "智汇AI <>" 这种非法 From')
})

test('F18 品牌名与 email-templates 的单一真相源同值(两处字面量不得漂开)', () => {
  const src = readFileSync(join(ROOT, 'apps', 'api', 'src', 'services', 'email-templates.ts'), 'utf8')
  const m = /export const BRAND_MAIL_DISPLAY_NAME = '([^']+)'/.exec(src)
  assert.ok(m, '必须在 email-templates.ts 里找到 BRAND_MAIL_DISPLAY_NAME 声明')
  assert.equal(
    AP.BRAND_FROM_NAME,
    m[1],
    '两处品牌名必须逐字相等,否则收件箱会再次出现多种显示名',
  )
})

test('F19 postSubmissionMail 投出的 from 是品牌身份,不是配置原串', async () => {
  const sent = []
  const r = await AP.postSubmissionMail({
    transport: {
      status: AP.STATUS.FOUND,
      detail: '',
      value: { apiKey: 're_x', from: '智汇AI官方 <noreply@aizhs.top>' },
    },
    subject: 's',
    text: 't',
    fetchImpl: async (_url, init) => {
      sent.push(JSON.parse(init.body))
      // 被测实现走 r.text() 再 JSON.parse(兼容非 JSON 的网关错误页),不是 r.json()
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'mail-1' }) }
    },
  })
  assert.equal(r.id, 'mail-1', '2xx+id 应判为已发')
  assert.equal(sent.length, 1, '只应投递一次')
  assert.equal(sent[0].from, '智汇AI <noreply@aizhs.top>', '显示名必须被改写成品牌名')
  assert.ok(!JSON.stringify(sent[0]).includes('智汇AI官方'), '请求体里不得残留旧显示名')
})

test('F20 地址解析不出时零调用(不把 "智汇AI <>" 寄出去)', async () => {
  let called = 0
  const r = await AP.postSubmissionMail({
    transport: { status: AP.STATUS.FOUND, detail: '', value: { apiKey: 're_x', from: '名字 < >' } },
    subject: 's',
    text: 't',
    fetchImpl: async () => {
      called += 1
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'never' }) }
    },
  })
  assert.equal(called, 0, '解析不出地址必须零调用')
  assert.notEqual(r.status, 'sent', '不得判为已发')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
