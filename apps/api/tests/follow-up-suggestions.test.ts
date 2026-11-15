// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  parseFollowUpSuggestions,
  MAX_FOLLOW_UP_SUGGESTIONS,
  MAX_FOLLOW_UP_CHARS,
} from '../src/utils/follow-up-suggestions.js'

describe('parseFollowUpSuggestions(环境建议条:模型产出的一键发送指令)', () => {
  it('标准 JSON 数组原样解析', () => {
    expect(
      parseFollowUpSuggestions(
        '["检查 src/auth.ts 的登录校验并补齐单元测试","运行 pnpm test 验证本次改动"]',
      ),
    ).toEqual(['检查 src/auth.ts 的登录校验并补齐单元测试', '运行 pnpm test 验证本次改动'])
  })

  it('容忍 ```json 代码块与前后解释文本', () => {
    const raw = [
      '以下是建议:',
      '```json',
      '["把登录页的错误提示改成中文", "补充 Session 过期的回归测试"]',
      '```',
      '希望有帮助。',
    ].join('\n')
    expect(parseFollowUpSuggestions(raw)).toEqual([
      '把登录页的错误提示改成中文',
      '补充 Session 过期的回归测试',
    ])
  })

  it('模型没按 JSON 输出时按行兜底,并去掉编号前缀', () => {
    const raw = ['1. 定位登录接口 401 的具体分支', '2) 为 refreshToken 补一条重试测试'].join('\n')
    expect(parseFollowUpSuggestions(raw)).toEqual([
      '定位登录接口 401 的具体分支',
      '为 refreshToken 补一条重试测试',
    ])
  })

  it('剥离成对引号与列表符号', () => {
    expect(parseFollowUpSuggestions('["「整理本次改动清单」", "- “汇总剩余风险”"]')).toEqual([
      '整理本次改动清单',
      '汇总剩余风险',
    ])
  })

  it('大小写不敏感去重,且最多 4 条', () => {
    const raw = JSON.stringify([
      'Fix the Login bug',
      'fix the login bug',
      '补充测试 A',
      '补充测试 B',
      '补充测试 C',
    ])
    const out = parseFollowUpSuggestions(raw)
    expect(out).toHaveLength(MAX_FOLLOW_UP_SUGGESTIONS)
    expect(out[0]).toBe('Fix the Login bug')
    expect(out.filter((s) => s.toLowerCase() === 'fix the login bug')).toHaveLength(1)
  })

  it('超长指令硬截断到 MAX_FOLLOW_UP_CHARS', () => {
    const long = `检查文件${'很长的描述'.repeat(40)}`
    const out = parseFollowUpSuggestions(JSON.stringify([long]))
    expect(out).toHaveLength(1)
    expect(out[0]!.length).toBe(MAX_FOLLOW_UP_CHARS)
  })

  it('空输入 / 垃圾输入返回空数组(调用方不渲染建议条)', () => {
    expect(parseFollowUpSuggestions('')).toEqual([])
    expect(parseFollowUpSuggestions('   \n  ')).toEqual([])
    expect(parseFollowUpSuggestions('[]')).toEqual([])
    expect(parseFollowUpSuggestions('{"suggestions": []}')).toEqual([])
    // 过短的行不算建议(避免 "OK" / "..." 这类噪声)
    expect(parseFollowUpSuggestions('好\n嗯\n')).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
