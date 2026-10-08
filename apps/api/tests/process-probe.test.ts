// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import type { ProcessProbeSample } from '../src/utils/process-probe.js'

import {
  PROC_READ_BATCH_SIZE,
  PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES,
  PROCESS_PROBE_SAMPLE_TIMEOUT_MS,
  PROBE_EXTERNAL_COMMANDS,
  ProcessProbeFailure,
  createProcessProbe,
  cimTicksToEpochMs,
  isProbeCommandAllowed,
  parseCimProcessList,
  parseCimProcessRow,
  parseLinuxStat,
  readProcInBatches,
} from '../src/utils/process-probe.js'

describe('b75-4#3 进程探针性能红线成文', () => {
  it('红线常量与外部进程白名单逐字成文', () => {
    expect(PROCESS_PROBE_SAMPLE_TIMEOUT_MS).toBe(1000)
    expect(PROCESS_PROBE_MAX_CONSECUTIVE_FAILURES).toBe(3)
    expect(PROC_READ_BATCH_SIZE).toBe(64)
    expect(PROBE_EXTERNAL_COMMANDS).toEqual(['ps', 'tasklist', 'powershell'])
    expect(isProbeCommandAllowed('ps')).toBe(true)
    expect(isProbeCommandAllowed('tasklist')).toBe(true)
    expect(isProbeCommandAllowed('powershell')).toBe(true)
    expect(isProbeCommandAllowed('curl')).toBe(false)
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
    // b76-09a 票2:win32 走 CIM 全表建树,direct_process 死角已解
    expect(probe.treeScope).toBe('process_tree')
  })

  it('win32 sampleProcessTrees 走 CIM 全表红线:超时弃样本;成功按 pid/ppid/创建时间建整棵树', async () => {
    const probe = createProcessProbe({
      platform: 'win32',
      sampleTimeoutMs: 10,
      execFile: async () => {
        await new Promise((resolve) => setTimeout(resolve, 60))
        return 'slow'
      },
    })
    expect(await probe.sampleProcessTrees([1])).toBeUndefined()

    // ticks 基数取 2026 年附近的真实量级(> CIM epoch),子代比父代晚 100ms(= 1,000,000 ticks)
    const TICK_ROOT = '638800000000000000'
    const TICK_CHILD = '638800000001000000'
    const TICK_GRAND = '638800000002000000'
    const okProbe = createProcessProbe({
      platform: 'win32',
      sampleTimeoutMs: 5000,
      execFile: async (file, args) => {
        expect(file).toBe('powershell')
        expect(args.some((a) => a.includes('Get-CimInstance Win32_Process'))).toBe(true)
        expect(args).toEqual(['-NoProfile', '-NonInteractive', '-Command', expect.any(String)])
        return [
          `100\t0\t${TICK_ROOT}\troot.exe`,
          `101\t100\t${TICK_CHILD}\tchild.exe`,
          `102\t101\t${TICK_GRAND}\tgrand child.exe`, // Name 允许空格
          'junk-line-no-tabs',
          '',
        ].join('\r\n')
      },
    })
    const result = await okProbe.sampleProcessTrees([100])
    expect(result).toBeDefined()
    const tree = result!.get(100)!
    expect(tree.map((s) => s.pid)).toEqual([100, 101, 102])
    expect(tree[0]!.parentPid).toBe(0)
    expect(tree[1]!.parentPid).toBe(100)
    expect(tree[2]!.parentPid).toBe(101)
    expect(tree[1]!.comm).toBe('child.exe')
    expect(tree[2]!.comm).toBe('grand child.exe')
    // 创建时间三元组:ticks 换算为 UTC epoch 毫秒且单调不减
    const rootMs = tree[0]!.createdAtMs!
    expect(tree[1]!.createdAtMs! - rootMs).toBe(100)
    expect(tree[2]!.createdAtMs! - rootMs).toBe(200)
    // 已消失的根不出现在结果里
    const missing = await okProbe.sampleProcessTrees([777])
    expect(missing).toBeDefined()
    expect(missing!.has(777)).toBe(false)
  })

  it('parseCimProcessRow:cimTicksToEpochMs 换算与畸形行拒绝', () => {
    // 621355968000000000 ticks = Unix epoch(1970-01-01T00:00:00Z)→ 0 毫秒
    expect(cimTicksToEpochMs('621355968000000000')).toBe(0)
    // epoch + 1 秒(1000 万 ticks)
    expect(cimTicksToEpochMs('621355968010000000')).toBe(1000)
    // CreationDate 为空的系统进程记 0
    expect(cimTicksToEpochMs('0')).toBe(0)
    expect(cimTicksToEpochMs('abc')).toBeUndefined()
    expect(cimTicksToEpochMs('-5')).toBeUndefined()
    // 正常行:Name 居尾含空格不破坏解析
    const row = parseCimProcessRow('4242\t100\t621355968010000000\tWindows Service (x64)')
    expect(row).toEqual({ pid: 4242, comm: 'Windows Service (x64)', parentPid: 100, createdAtMs: 1000 })
    // 畸形行:缺列 / pid 非法 / ticks 非法 / 空名
    expect(parseCimProcessRow('4242\t100\t621355968100000000')).toBeUndefined()
    expect(parseCimProcessRow('0\t100\t621355968100000000\tx')).toBeUndefined()
    expect(parseCimProcessRow('4242\t100\tbad\tx')).toBeUndefined()
    expect(parseCimProcessRow('4242\t100\t621355968100000000\t')).toBeUndefined()
  })

  it('parseCimProcessList:空行跳过、坏行丢弃(与 /proc 扫描同口径,不重试)', () => {
    const samples = parseCimProcessList('\r\n10\t0\t621355968000000000\ta.exe\r\nbad\r\n11\t10\t621355968000000000\tb.exe\r\n')
    expect(samples.map((s) => s.pid)).toEqual([10, 11])
  })
})

describe.skipIf(process.platform !== 'win32')(
  'b76-09a 票2(G-998131) 验收:本机 Windows 真跑 CIM 建树(依赖 cmd.exe/CIM,Linux 上结构性不可跑)',
  () => {
  it(
    'spawn 活口子进程(其下再一层孙),sampleProcessTrees([root pid]) 含 root+child+grandchild 的 pid/parentPid/创建时间三元组',
    { timeout: 60_000 },
    async () => {
      const { spawn } = await import('node:child_process')
      // root = 本测试进程;child = cmd(其内再拉起 ping 作孙),windowsHide 纪律(AGENTS §5b)。
      const child = spawn('cmd.exe', ['/c', 'ping -n 30 127.0.0.1 > NUL'], {
        windowsHide: true,
        stdio: 'ignore',
      })
      try {
        // 给 cmd 拉起孙进程留出窗口;探针超时给足(CIM 全表 + PowerShell 冷启动可超红线 1s,
        // 红线默认值本身已被上方注入测试覆盖,此处只验建树正确性)。
        const probe = createProcessProbe({ platform: 'win32', sampleTimeoutMs: 30_000 })
        const rootPid = process.pid
        let tree: ReadonlyMap<number, readonly ProcessProbeSample[]> | undefined
        let samples: readonly ProcessProbeSample[] = []
        for (let attempt = 0; attempt < 6; attempt += 1) {
          tree = await probe.sampleProcessTrees([rootPid])
          samples = tree?.get(rootPid) ?? []
          if (samples.some((s) => s.parentPid === child.pid)) break
          await new Promise((resolve) => setTimeout(resolve, 1_000))
        }
        expect(tree).toBeDefined()
        const byPid = new Map(samples.map((s) => [s.pid, s]))
        // root:本进程自身在树内,带创建时间且不晚于当下
        const root = byPid.get(rootPid)!
        expect(root.createdAtMs).toBeTypeOf('number')
        expect(root.createdAtMs!).toBeLessThanOrEqual(Date.now())
        // child:ppid === root pid,创建时间晚于 root
        const childSample = byPid.get(child.pid)!
        expect(childSample.parentPid).toBe(rootPid)
        expect(childSample.createdAtMs!).toBeGreaterThan(root.createdAtMs!)
        // grandchild:存在 ppid === child.pid 的孙,创建时间不早于 child
        const grandchildren = samples.filter((s) => s.parentPid === child.pid)
        expect(grandchildren.length).toBeGreaterThan(0)
        for (const g of grandchildren) {
          expect(g.createdAtMs).toBeTypeOf('number')
          expect(g.createdAtMs!).toBeGreaterThanOrEqual(childSample.createdAtMs!)
        }
      } finally {
        // 终清:整树杀(cmd 与 ping),不留活口
        await new Promise<void>((resolve) => {
          const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
          })
          killer.on('exit', () => resolve())
          killer.on('error', () => resolve())
        })
      }
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
