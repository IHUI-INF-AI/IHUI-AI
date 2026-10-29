// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-pool-policy 只读视图镜像测试(2026-10-29 立,票 O93 的「面板看不到生效档位」面)。
 * §22c 纪律:判据一律 import 源模块 __test__(relayPoolPolicyView / readRelayPoolPolicy /
 * RELAY_POOL_ENV_KEYS / DEFAULT_RELAY_POOL_POLICY),本文件零复制第二份 env 解析实现;
 * 用例里写的 env 取值(如 '0.9'、'maybe')是夹具,不是档位表副本。
 * 每项能力成对写:正向(改值即偏离默认并被点名)+ 反向(脏值回落默认、空白视为未设置)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  __test__ as P,
  type RelayPoolKnobView,
  type RelayPoolPolicyView,
} from '../src/services/relay-pool-policy.js'

type KnobName = keyof typeof P.DEFAULT_RELAY_POOL_POLICY

/** 每枚钮的「合法且非默认」env 原文(取自源模块的取值域,不新造档位) */
const NON_DEFAULT: Record<KnobName, string> = {
  strategy: 'weighted_random',
  idleWeightPerHour: '0.9',
  idleWeightMax: '9',
  preferExpiring: 'true',
  expiringSoonMs: '1000',
  creditFloor: '50',
  maxInFlightGlobal: '3',
  crossDomainFallback: '1',
}

/** 每种类别的「非空但代码认不出」脏值(按 view 自报的 kind 取,零复算判据) */
const INVALID_BY_KIND = {
  number: 'abc',
  boolean: 'maybe',
  strategy: 'random_pick',
} as const

const POLICY_KEYS = Object.keys(P.DEFAULT_RELAY_POOL_POLICY) as KnobName[]

function knobOf(view: RelayPoolPolicyView, name: KnobName): RelayPoolKnobView {
  const found = view.knobs.find((k) => k.name === name)
  if (!found) throw new Error(`视图里没有钮 ${name}(登记表与策略键集分叉)`)
  return found
}

describe('默认档全绿(未开任何新能力)', () => {
  it('空 env ⇒ 八枚钮逐一等于 DEFAULT_RELAY_POOL_POLICY,零偏离、零脏值、登记表完整', () => {
    const view = P.relayPoolPolicyView({})
    expect(view.knobs.length).toBe(POLICY_KEYS.length)
    expect(view.knobs.length).toBeGreaterThan(0) // 枚举到 0 个候选 = 判死,不得记绿
    expect(view.registryComplete).toBe(true)
    expect(view.missingKnobs).toEqual([])
    expect(view.orphanKnobs).toEqual([])
    expect(view.deviatedKnobs).toBe(0)
    expect(view.invalidEnvKnobs).toBe(0)
    expect(view.allDefault).toBe(true)
    expect(view.policy).toEqual(P.DEFAULT_RELAY_POOL_POLICY)
    for (const name of POLICY_KEYS) {
      const knob = knobOf(view, name)
      expect(knob.effective).toBe(P.DEFAULT_RELAY_POOL_POLICY[name])
      expect(knob.defaultValue).toBe(P.DEFAULT_RELAY_POOL_POLICY[name])
      expect(knob.differsFromDefault).toBe(false)
      expect(knob.invalidEnv).toBe(false)
      expect(knob.rawEnv).toBeUndefined()
    }
  })

  it('登记表三方对账:视图钮名集 == 策略键集,envKey 集 == RELAY_POOL_ENV_KEYS 值集', () => {
    const view = P.relayPoolPolicyView({})
    expect([...view.knobs.map((k) => k.name)].sort()).toEqual([...POLICY_KEYS].sort())
    expect([...view.knobs.map((k) => k.envKey)].sort()).toEqual(
      [...Object.values(P.RELAY_POOL_ENV_KEYS)].sort(),
    )
    // 可发现性前提:钮名族前缀统一,模板里按同一族前缀登记才对得上(§0.6)
    for (const knob of view.knobs) expect(knob.envKey.startsWith('IHUI_RELAY_POOL_')).toBe(true)
  })

  it('每枚钮自带一句话语义(面板 tooltip 单源,空描述 = 视图不可读)', () => {
    for (const knob of P.relayPoolPolicyView({}).knobs) {
      expect(knob.description.trim().length).toBeGreaterThan(4)
    }
  })
})

describe('逐枚 env 改值 ⇒ 视图反映偏离', () => {
  it('正向:八枚逐一改值,每次只偏离一枚、生效值与消费方读出的同一档', () => {
    for (const name of POLICY_KEYS) {
      const envKey = P.RELAY_POOL_ENV_KEYS[name]
      const view = P.relayPoolPolicyView({ [envKey]: NON_DEFAULT[name] })
      const knob = knobOf(view, name)
      expect(knob.rawEnv).toBe(NON_DEFAULT[name])
      expect(knob.invalidEnv).toBe(false)
      expect(knob.differsFromDefault).toBe(true)
      expect(knob.effective).not.toBe(knob.defaultValue)
      expect(view.deviatedKnobs).toBe(1)
      expect(view.allDefault).toBe(false)
      expect(view.invalidEnvKnobs).toBe(0)
      // 视图与选号消费方结构上不可能分叉:effective 逐键 == readRelayPoolPolicy
      expect(view.policy).toEqual(P.readRelayPoolPolicy({ [envKey]: NON_DEFAULT[name] }))
      expect(knob.effective).toBe(view.policy[name])
    }
  })

  it('正向:八枚同时改值 ⇒ 全部偏离、偏离计数 == 钮数', () => {
    const env: Record<string, string> = {}
    for (const name of POLICY_KEYS) env[P.RELAY_POOL_ENV_KEYS[name]] = NON_DEFAULT[name]
    const view = P.relayPoolPolicyView(env)
    expect(view.deviatedKnobs).toBe(POLICY_KEYS.length)
    expect(view.knobs.every((k) => k.differsFromDefault)).toBe(true)
    expect(view.allDefault).toBe(false)
  })

  it('反向:合法但等于默认档的显式写法 ⇒ 不算偏离、不算脏值(0 = 关闭档是合法值)', () => {
    const view = P.relayPoolPolicyView({
      [P.RELAY_POOL_ENV_KEYS.creditFloor]: '0',
      [P.RELAY_POOL_ENV_KEYS.strategy]: 'deterministic',
      [P.RELAY_POOL_ENV_KEYS.preferExpiring]: 'false',
    })
    expect(view.deviatedKnobs).toBe(0)
    expect(view.invalidEnvKnobs).toBe(0)
    expect(view.allDefault).toBe(true)
    for (const name of POLICY_KEYS) expect(knobOf(view, name).invalidEnv).toBe(false)
  })
})

describe('非法 env 值:回落默认且不崩,且必须被点名', () => {
  it('正向:八枚逐一喂脏值 ⇒ 不抛异常、生效值仍是默认档', () => {
    for (const name of POLICY_KEYS) {
      const envKey = P.RELAY_POOL_ENV_KEYS[name]
      const kind = knobOf(P.relayPoolPolicyView({}), name).kind
      const view = P.relayPoolPolicyView({ [envKey]: INVALID_BY_KIND[kind] })
      const knob = knobOf(view, name)
      expect(knob.effective).toBe(P.DEFAULT_RELAY_POOL_POLICY[name])
      expect(knob.differsFromDefault).toBe(false)
      expect(view.policy).toEqual(P.DEFAULT_RELAY_POOL_POLICY)
    }
  })

  it('脏值不被静默当成合法档:invalidEnv=true + rawEnv 留原文可追责', () => {
    const env: Record<string, string> = {}
    for (const name of POLICY_KEYS) {
      const kind = knobOf(P.relayPoolPolicyView({}), name).kind
      env[P.RELAY_POOL_ENV_KEYS[name]] = INVALID_BY_KIND[kind]
    }
    const view = P.relayPoolPolicyView(env)
    expect(view.invalidEnvKnobs).toBe(POLICY_KEYS.length)
    for (const name of POLICY_KEYS) {
      const knob = knobOf(view, name)
      expect(knob.invalidEnv).toBe(true)
      expect(knob.rawEnv).toBe(env[P.RELAY_POOL_ENV_KEYS[name]])
    }
    // 成对反向对照:同批钮换成合法值 ⇒ invalidEnvKnobs 归 0(判据不是恒真计数器)
    const clean: Record<string, string> = {}
    for (const name of POLICY_KEYS) clean[P.RELAY_POOL_ENV_KEYS[name]] = NON_DEFAULT[name]
    expect(P.relayPoolPolicyView(clean).invalidEnvKnobs).toBe(0)
  })

  it('空串/纯空白 = 「设了但没设值」⇒ 走默认档且不算脏值(与未设置同档不同痕)', () => {
    const view = P.relayPoolPolicyView({
      [P.RELAY_POOL_ENV_KEYS.creditFloor]: '',
      [P.RELAY_POOL_ENV_KEYS.idleWeightMax]: '   ',
    })
    expect(view.policy).toEqual(P.DEFAULT_RELAY_POOL_POLICY)
    expect(view.deviatedKnobs).toBe(0)
    expect(view.invalidEnvKnobs).toBe(0)
    expect(knobOf(view, 'creditFloor').rawEnv).toBe('')
    expect(knobOf(view, 'idleWeightMax').rawEnv).toBe('   ')
  })

  it('脏值与合法值混写 ⇒ 只点名脏的那枚,合法那枚照常生效(互不吞)', () => {
    const view = P.relayPoolPolicyView({
      [P.RELAY_POOL_ENV_KEYS.maxInFlightGlobal]: '3',
      [P.RELAY_POOL_ENV_KEYS.expiringSoonMs]: 'twelve-hours',
    })
    expect(knobOf(view, 'maxInFlightGlobal').differsFromDefault).toBe(true)
    expect(knobOf(view, 'maxInFlightGlobal').invalidEnv).toBe(false)
    expect(knobOf(view, 'expiringSoonMs').differsFromDefault).toBe(false)
    expect(knobOf(view, 'expiringSoonMs').invalidEnv).toBe(true)
    expect(view.deviatedKnobs).toBe(1)
    expect(view.invalidEnvKnobs).toBe(1)
    expect(view.registryComplete).toBe(true)
  })
})

describe('零 IO / 可注入(视图不得自己摸全局)', () => {
  it('视图只认传入 env:同批钮在注入 env 与空 env 下读出不同档', () => {
    const injected = P.relayPoolPolicyView({ [P.RELAY_POOL_ENV_KEYS.preferExpiring]: 'on' })
    const empty = P.relayPoolPolicyView({})
    expect(knobOf(injected, 'preferExpiring').effective).toBe(true)
    expect(knobOf(empty, 'preferExpiring').effective).toBe(false)
    // 默认参数指向 process.env(源码形状锁:函数长度 0 ⇒ 有默认值,不新读其它 IO)
    expect(P.relayPoolPolicyView.length).toBe(0)
  })
})

// 立因锁(本票的原始缺陷就是这一格):八枚钮此前只活在代码里,受管模板零命中 ⇒
// 换机/排障无从发现。这里把"钮必须在 .env.example 可被发现"钉成机器判据:
// 新增钮忘了登记模板 ⇒ 本用例直接红,而不是等下次排障时才发现"钮无人知晓"。
describe('受管模板可发现性(env 钮必须在 apps/api/.env.example 登记)', () => {
  const templatePath = fileURLToPath(new URL('../../../apps/api/.env.example', import.meta.url))
  let template = ''
  try {
    template = readFileSync(templatePath, 'utf8')
  } catch {
    template = ''
  }

  it('模板读得到(读不到 = 未判定,不得当成通过)', () => {
    expect(template.length).toBeGreaterThan(0)
  })

  it('八枚钮名逐枚在模板里成行登记(注释形态或显式赋值都算命中)', () => {
    const lines = template.split(/\r?\n/)
    for (const envKey of Object.values(P.RELAY_POOL_ENV_KEYS)) {
      expect(lines.some((l) => new RegExp(`^\\s*#?\\s*${envKey}\\s*=`).test(l))).toBe(true)
    }
  })

  it('默认档纪律:模板里若有非注释赋值,其值必须等于默认值(照抄 .env 不得改行为)', () => {
    const lines = template.split(/\r?\n/)
    for (const knob of P.relayPoolPolicyView({}).knobs) {
      const live = lines.find((l) => new RegExp(`^${knob.envKey}\\s*=`).test(l))
      if (!live) continue // 全注释形态 ⇒ 走默认档,合法
      const value = live.slice(live.indexOf('=') + 1).trim()
      expect(value).toBe(String(knob.defaultValue))
    }
  })

  it('模板写明"改完需重启进程生效"(env 是进程级,不许留成热载的口头预期)', () => {
    expect(/重启\s*apps\/api\s*进程|重启 api 进程/.test(template)).toBe(true)
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
