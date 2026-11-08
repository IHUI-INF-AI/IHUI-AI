// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/i18n-top-level-case-conflict.test.mjs
//
// 票 B 的镜像测试:顶层键「只差大小写」冲突必须能被识别,且本仓当前语言包必须干净。
// 夹具用原文文本(与门的判定面一致:JSON.parse 之后大小写不同的键是合法的两个键,
// 只有字节级原文才能看出它们撞在一起)。
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describeCaseConflict, findCaseConflictsInText } from '../lib/i18n-top-level-keys.mjs'

const CASES = [
  {
    name: '命中:checkIn / checkin 只差大小写',
    text: `{
  "checkIn": { "title": "每日签到" },
  "checkin": { "title": "签到助手" }
}
`,
    expect: ['"checkIn"@L2 / "checkin"@L3'],
  },
  {
    name: '命中:businessCard / businesscard(嵌套值不影响判定)',
    text: `{
  "businessCard": { "title": "名片" },
  "businesscard": { "loadFailed": { "msg": "失败" } }
}
`,
    expect: ['"businessCard"@L2 / "businesscard"@L3'],
  },
  {
    name: '不命中:大小写不同但名字不同(checkIn vs checkinAssistant)',
    text: `{
  "checkIn": "每日签到",
  "checkinAssistant": "签到助手"
}
`,
    expect: [],
  },
  {
    name: '不命中:差异只在嵌套层(顶层命名空间不同)',
    text: `{
  "a": {
    "businessCard": 1,
    "businesscard": 2
  }
}
`,
    expect: [],
  },
]

describe('顶层键大小写冲突', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const conflicts = findCaseConflictsInText(c.text)
      assert.deepEqual(conflicts.map(describeCaseConflict), c.expect, c.name)
    })
  }

  it('本仓 packages/i18n/messages 下全部语言包无大小写冲突', () => {
    const messagesDir = join(process.cwd(), 'packages/i18n/messages')
    const findings = []
    for (const end of readdirSync(messagesDir)) {
      const dir = join(messagesDir, end)
      if (!statSync(dir).isDirectory()) continue
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) continue
        const rel = `${end}/${file}`
        for (const conflict of findCaseConflictsInText(readFileSync(join(dir, file), 'utf8'))) {
          findings.push(`${rel}: ${describeCaseConflict(conflict)}`)
        }
      }
    }
    assert.deepEqual(findings, [])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
