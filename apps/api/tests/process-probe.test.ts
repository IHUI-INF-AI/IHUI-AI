// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  PROC_READ_BATCH_SIZE,
  PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES,
  PROCESS_PROBE_SAMPLE_TIMEOUT_MS,
  PROBE_EXTERNAL_COMMANDS,
  ProcessProbeFailure,
  createProcessProbe,
  isProbeCommandAllowed,
  parseLinuxStat,
  readProcInBatches,
} from '../src/utils/process-probe.js'

describe('b75-4#3 进程探针性能红线成文', () => {
  it('红线常量与外部进程白名单逐字成文', () => {
    expect(PROCESS_PROBE_SAMPLE_TIMEOUT_MS).toBe(1000)
    expect(PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES).toBe(3)
    expect(PROC_READ_BATCH_SIZE).toBe(64)
    expect(PROBE_EXTERNAL_COMMANDS).toEqual(['ps', 'tasklist'])
    expect(isProbeCommandAllowed('ps')).toBe(true)
    expect(isProbeCommandAllowed('tasklist')).toBe(true)
    expect(isProbeCommandAllowed('curl')).toBe(false)
    expect(isProbeCommandAllowed('powershell')).toBe(false)
  })
})

describe('parseLinuxStat:comm 以 lastIndexOf(")") 切分(防空格崩解析)', () => {
  it('comm 含空格与括号时解析不崩,ppid/pgrp/cpu 正确', () => {
    // comm = "my (weird) proc";切分后 fields[0]=state,ppid=fields[1],pgrp=fields[2],utime=11,stime=12
    const stat = '4711 (my (weird) proc) R 1 2 0 0 0 0 0 0 0 0 5 7 0 0 0'
    const parsed = parseLinuxStat(stat)
    expect(parsed).toBeDefined()
    expect(parsed!.parentPid).toBe(1)
    expect(parsed!.processGroupId).toBe(2)
    expect(parsed!.cpuTimeMs).toBe(120) // (5+7) ticks / 100 * 1000ms
  })

  it('畸形输入返回 undefined(无右括号 / ppid 非数字 / utime 非数字)', () => {
    expect(parseLinuxStat('4711 no-paren R 1 2')).toBeUndefined()
    expect(parseLinuxStat('4711 (proc) R x 2 0 0 0 0 0 0 0 0 0 5 7')).toBeUndefined()
    expect(parseLinuxStat('4711 (proc) R 1 2 0 0 0 0 0 0 0 0 y 7')).toBeUndefined()
  })
})

describe('readProcInBatches:分批 64 条 + isExpired 中止', () => {
  const makeReaders = (overrides: Partial<{
    isExpired: () => boolean
    readProcFile: (path: string) => Promise<string>
  }> = {}) => ({
    isExpired: overrides.isExpired ?? (() => false),
    listProcDirectory: async () => ['1', '2', '3'],
    readProcFile: overrides.readProcFile ?? (async () => 'x'),
  })

  it('150 个 pid → isExpired 每批一次(3 批:64+64+22)', async () => {
    let expiredChecks = 0
    const readers = {
      ...makeReaders(),
      isExpired: () => {
        expiredChecks += 1
        return false
      },
      listProcDirectory: async () => Array.from({ length: 150 }, (_, i) => String(i + 1)),
    }
    let reads = 0
    const collected = await readProcInBatches(
      readers,
      (await readers.listProcDirectory()).map(Number),
      async () => {
        reads += 1
        return reads
      },
    )
    expect(collected).toHaveLength(150)
    expect(expiredChecks).toBe(3)
  })

  it('第一批后 isExpired → 抛 ProcessProbeFailure 中止,不再读后续批次', async () => {
    let expiredChecks = 0
    const readers = {
      isExpired: () => ++expiredChecks >= 2, // 第 2 批前(即第 3 次检查?否:每批 1 次)→ 第 2 批前过期
      listProcDirectory: async () => Array.from({ length: 200 }, (_, i) => String(i + 1)),
      readProcFile: async () => 'x',
    }
    let reads = 0
    await expect(
      readProcInBatches(readers, Array.from({ length: 200 }, (_, i) => i + 1), async () => {
        reads += 1
        return reads
      }),
    ).rejects.toBeInstanceOf(ProcessProbeFailure)
    expect(reads).toBe(64) // 只有第一批被读完
  })
})

describe('createProcessProbe:1s 硬超时 / 失败=无样本 / 连续 3 次停用+复位', () => {
  it('采样 ≥ 硬超时即弃样本,reason 带超时说明', async () => {
    const failures: string[] = []
    const probe = createProcessProbe({
      platform: 'linux',
      sampleTimeoutMs: 10,
      onSampleFailed: (r) => failures.push(r),
      listProcDirectory: async () => {
        await new Promise((resolve) => setTimeout(resolve, 60))
        return ['1']
      },
      readProcFile: async () => '1 (a) R 0 0 0 0 0 0 0 0 0 0 1 1',
    })
    const result = await probe.sampleProcessTrees([1])
    expect(result).toBeUndefined()
    expect(failures[0]).toBe('采样超过 10 毫秒')
  })

  it('连续 3 次失败后停用(不再发起采样),reset() 复位后恢复', async () => {
    let listCalls = 0
    let listBroken = true
    const failures: string[] = []
    const probe = createProcessProbe({
      platform: 'linux',
      sampleTimeoutMs: 500,
      onSampleFailed: (r) => failures.push(r),
      listProcDirectory: async () => {
        listCalls += 1
        if (listBroken) throw new Error('proc 不可读')
        return ['42']
      },
      readProcFile: async (path) => (path === '/proc/42/stat' ? '42 (worker) S 1 1 0 0 0 0 0 0 0 0 3 4' : 'nope'),
    })

    // 前 3 次:失败=无样本不重试,每次只发起一次采样
    for (let i = 0; i < PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES; i += 1) {
      expect(await probe.sampleProcessTrees([42])).toBeUndefined()
    }
    expect(failures).toHaveLength(3)
    expect(failures.every((f) => f.includes('proc 不可读'))).toBe(true)
    expect(probe.isDisabled()).toBe(true)

    // 第 4 次:已停用 → 直接无样本,连 listProcDirectory 都不再碰
    const before = listCalls
    expect(await probe.sampleProcessTrees([42])).toBeUndefined()
    expect(listCalls).toBe(before)

    // reset() 复位 + 数据源恢复 → 重新可用,树内含根
    probe.reset()
    expect(probe.isDisabled()).toBe(false)
    listBroken = false
    const tree = await probe.sampleProcessTrees([42])
    expect(tree).toBeDefined()
    expect(tree!.get(42)?.[0]?.comm).toBe('worker')
  })

  it('失败后成功会把连续计数清零(不累计历史失败)', async () => {
    let failFirst = true
    const probe = createProcessProbe({
      platform: 'linux',
      sampleTimeoutMs: 500,
      listProcDirectory: async () => {
        if (failFirst) {
          failFirst = false
          throw new Error('抖动一次')
        }
        return []
      },
      readProcFile: async () => 'x',
    })
    expect(await probe.sampleProcessTrees([1])).toBeUndefined() // 失败 1 次
    expect(await probe.sampleProcessTrees([1])).toBeDefined() // 成功清零
    expect(probe.isDisabled()).toBe(false)
  })

  it('linux 采样成功路径:构建进程树,已消失的根不出现在结果里', async () => {
    const statOf: Record<string, string> = {
      '10': '10 (root-proc) S 1 100 0 0 0 0 0 0 0 0 9 1',
      '11': '11 (child (with) spaces) S 10 100 0 0 0 0 0 0 0 0 2 2',
    }
    const probe = createProcessProbe({
      platform: 'linux',
      sampleTimeoutMs: 500,
      listProcDirectory: async () => ['10', '11', '99'],
      readProcFile: async (path) => {
        const pid = path.split('/')[2]!
        const stat = statOf[pid]
        if (!stat) throw new Error('ENOENT') // 扫描途中退出 → 无该样本,不重试
        return stat
      },
    })
    const tree = await probe.sampleProcessTrees([10])
    expect(tree).toBeDefined()
    const samples = tree!.get(10)!
    expect(samples).toHaveLength(2)
    expect(samples[0]!.comm).toBe('root-proc')
    expect(samples[1]!.comm).toBe('child (with) spaces')
    expect(samples[1]!.parentPid).toBe(10)
    // 根不存在 → 不出现在结果里
    const missing = await probe.sampleProcessTrees([777])
    expect(missing).toBeDefined()
    expect(missing!.has(777)).toBe(false)
  })
})

describe('createProcessProbe:外部进程白名单红线', () => {
  it('白名单外命令:拒绝执行并计一次失败(不 spawn)', async () => {
    let execCalls = 0
    const failures: string[] = []
    const probe = createProcessProbe({
      platform: 'win32',
      execFile: async () => {
        execCalls += 1
        return ''
      },
      onSampleFailed: (r) => failures.push(r),
    })
    expect(await probe.sampleExternalCommand('curl', ['https://evil.example'])).toBeUndefined()
    expect(execCalls).toBe(0)
    expect(failures[0]).toContain('白名单')
  })

  it('白名单内命令走红线预算:成功返回输出并清零失败计数', async () => {
    const probe = createProcessProbe({
      platform: 'win32',
      execFile: async (file, args) => {
        expect(['ps', 'tasklist']).toContain(file)
        expect(args).toEqual(['/FO', 'CSV', '/NH'])
        return 'tasklist-output'
      },
      sampleTimeoutMs: 500,
    })
    expect(await probe.sampleExternalCommand('tasklist', ['/FO', 'CSV', '/NH'])).toBe(
      'tasklist-output',
    )
    expect(probe.treeScope).toBe('direct_process')
  })

  it('win32 sampleProcessTrees 走外部命令红线:超时弃样本,成功返回空映射(结构化解析由消费方注入)', async () => {
    const probe = createProcessProbe({
      platform: 'win32',
      sampleTimeoutMs: 10,
      execFile: async () => {
        await new Promise((resolve) => setTimeout(resolve, 60))
        return 'slow'
      },
    })
    expect(await probe.sampleProcessTrees([1])).toBeUndefined()

    const okProbe = createProcessProbe({
      platform: 'win32',
      sampleTimeoutMs: 500,
      execFile: async () => 'csv-lines',
    })
    const result = await okProbe.sampleProcessTrees([1, 2])
    expect(result).toBeDefined()
    expect(result!.size).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
