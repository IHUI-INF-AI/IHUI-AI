// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * budget 帧档位的单源对账用例(2026-11-06 收口)。
 *
 * 要钉住的两件事:
 *  ① 三档(warning / critical / stopped)每一档都能被本解析器产出并原样透传 —— `stopped`
 *    有真实生产者(apps/ai-service/app/routers/agents.py 的预算硬停分支),
 *    少一档的表现是"因预算停止"在共享解析器消费端被静默丢弃,不是报错而是安静;
 *  ② 档位合法值只有一份:@ihui/types/orchestration.ts 的 BUDGET_LEVELS。解析器不得再
 *    自持一份 `=== 'warning' || === 'critical' || …` 字面量副本(§0.6 第二份必然漂移,
 *    2026-11-06 的实测后果就是同一闭集五处手抄、两侧落到不同代际)。
 *
 * 反向锁写法:`REQUIRED_LEVELS` 在本文件里写死三档,**不从 BUDGET_LEVELS 推导** ——
 * 否则谁把枚举改回两档,用例跟着一起变瘦,变异就抓不住(现读取证:改回两档 ⇒ ①②两条同时翻红)。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { BUDGET_LEVELS, isBudgetLevel, type BudgetLevel } from '@ihui/types'

import { parseSSEChunk } from '../sse-parse'

function one(line: string) {
  const { events } = parseSSEChunk(`data: ${line}\n`)
  return events[0]
}

/** 需求侧要求的三档封闭集(证据见 @ihui/types/orchestration.ts 头注;刻意硬编码,见文件头②) */
const REQUIRED_LEVELS = ['warning', 'critical', 'stopped'] as const

describe('budget 帧档位单源(2026-11-06 收口)', () => {
  it('BUDGET_LEVELS 与需求侧三档逐字同集(把枚举改回两档 ⇒ 本条翻红)', () => {
    expect([...BUDGET_LEVELS].sort()).toEqual([...REQUIRED_LEVELS].sort())
    // 枚举与守卫必须同源:守卫认得的档位,枚举里必须有(反之亦然)
    for (const level of REQUIRED_LEVELS) expect(isBudgetLevel(level)).toBe(true)
  })

  it.each(REQUIRED_LEVELS)('三档每一档都能解析且 level 原样透传:%s', (level) => {
    const evt = one(`{"type":"budget","level":"${level}","percent":90}`)
    expect(evt?.type).toBe('budget')
    expect(evt?.budget?.level).toBe(level)
    expect(isBudgetLevel(evt?.budget?.level)).toBe(true)
  })

  it('stopped 终态帧把停止明细原样交代出去(不猜档、不折成 critical)', () => {
    const evt = one(
      '{"type":"budget","level":"stopped","reasonCode":"daily_token_limit","scope":"daily",' +
        '"pillar":"chat","usagePercent":118.5,"remainingTokens":0,"stoppedAtIteration":7}',
    )
    expect(evt?.budget?.level).toBe<BudgetLevel>('stopped')
    expect(evt?.budget?.reasonCode).toBe('daily_token_limit')
    expect(evt?.budget?.scope).toBe('daily')
    expect(evt?.budget?.pillar).toBe('chat')
    expect(evt?.budget?.usagePercent).toBe(118.5)
    expect(evt?.budget?.remainingTokens).toBe(0)
    expect(evt?.budget?.stoppedAtIteration).toBe(7)
    // 硬停帧没有 percent 键 ⇒ 保持 undefined,不许由 usagePercent 反推一个出来
    expect(evt?.budget?.percent).toBeUndefined()
  })

  it('表外档位整帧不产出(认不出就不说,与 tryParseInjection 同判据)', () => {
    expect(one('{"type":"budget","level":"whatever"}')).toBeUndefined()
    expect(one('{"type":"budget","level":"WARNING"}')).toBeUndefined()
    expect(one('{"type":"budget"}')).toBeUndefined()
    expect(one('{"type":"budget","level":3}')).toBeUndefined()
    // 表外档位也不得被兜底链当成正文增量喷出去
    expect(
      one('{"type":"budget","level":"whatever","content":"泄漏正文"}')?.content,
    ).toBeUndefined()
  })

  it('解析器不再自持档位字面量副本(§0.6 反向锁:判据必须来自单源守卫)', () => {
    const src = readFileSync(fileURLToPath(new URL('../sse-parse.ts', import.meta.url)), 'utf8')
    expect(src).toContain('isBudgetLevel(json.level)')
    expect(src).not.toMatch(/json\.level === 'warning'/)
    expect(src).not.toMatch(/json\.level === 'stopped'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
