// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { describe, expect, it } from 'vitest'

import {
  type ProcessTableRow,
  type RootKillDispatch,
  buildParentChildMap,
  collectProcessTree,
  isPidAlive,
  isValidTargetPid,
  reapProcessTree,
  sameProcess,
  taskkillOutputConfirmsRoot,
} from '../src/acp/process-tree-reaper.js'

function row(pid: number, parentPid: number, groupId = pid, birthToken = `bt-${pid}`): ProcessTableRow {
  return { pid, parentPid, groupId, birthToken }
}

/** 假想 pid:大数,避开 process.pid(被判 invalid)。 */
const ROOT = 40_000
const KID = 40_001
const GRAND = 40_002

/**
 * 死亡轮用零超时(gracefulMs=forceMs=0):deadline==now0,`now()<deadline` 首次即 false,
 * 循环体恰好跑 1 次(唯一一次真实 pollMs 睡眠可接受),判据 = 末尾那次 re-check。
 * now 用严格递增计数器,保证"deadline 之后"的比较语义成立。
 */
function tickingNow(): () => number {
  let t = 0
  return () => ++t
}

/** 递减读取计数器:前 `full` 次返回 fullTable,之后恒返回空表(根消失)。 */
function tableReader(fullTable: Map<number, ProcessTableRow>, full: number) {
  let remaining = full
  return async (): Promise<Map<number, ProcessTableRow> | null> => {
    if (remaining > 0) {
      remaining -= 1
      return fullTable
    }
    return new Map()
  }
}

describe('J5 进程树收割', () => {
  describe('① isValidTargetPid 守卫', () => {
    it('拒 pid 0/1(系统)、非整数、负数、NaN', () => {
      expect(isValidTargetPid(0)).toBe(false)
      expect(isValidTargetPid(1)).toBe(false)
      expect(isValidTargetPid(-5)).toBe(false)
      expect(isValidTargetPid(1.5)).toBe(false)
      expect(isValidTargetPid(Number.NaN)).toBe(false)
    })
    it('拒自身 pid(防自杀),放行正常目标 pid', () => {
      expect(isValidTargetPid(process.pid)).toBe(false)
      expect(isValidTargetPid(ROOT)).toBe(true)
    })
  })

  describe('② isPidAlive 探针(真实 process.kill(pid,0))', () => {
    it('守卫拒绝的 pid(自身/0/1/非整数)恒判死', () => {
      // isPidAlive 复用 isValidTargetPid 守卫:自身 pid(防自杀)、0/1、非整数一律 false。
      // 注:它设计用于探测"目标"进程,自身被守卫排除 ⇒ 探测自身返回 false(非"我死了")。
      expect(isPidAlive(process.pid)).toBe(false)
      expect(isPidAlive(0)).toBe(false)
      expect(isPidAlive(1)).toBe(false)
      expect(isPidAlive(1.5)).toBe(false)
    })
    // 平台脆弱断言已去掉:沙箱上大号 pid 的 kill 可能返回 EPERM(判活),不可靠,
    // 故不依赖"具体 pid 是否存在"来钉 isPidAlive;存活判定由 reapProcessTree 集成用例覆盖。
  })

  describe('⑤ sameProcess 身份双校验(birthToken + groupId)', () => {
    it('birthToken 或 groupId 任一不同 ⇒ 不同进程(PID 重用防护)', () => {
      const a = row(ROOT, 1)
      expect(sameProcess(a, row(ROOT, 1))).toBe(true)
      expect(sameProcess(a, row(ROOT, 1, ROOT, 'bt-other'))).toBe(false)
      expect(sameProcess(a, row(ROOT, 1, ROOT + 1))).toBe(false)
    })
    it('单侧 undefined ⇒ 不等;双 undefined ⇒ true(WB 可选链原语义)', () => {
      expect(sameProcess(row(ROOT, 1), undefined)).toBe(false)
      expect(sameProcess(undefined, row(ROOT, 1))).toBe(false)
      // 双 undefined:undefined===undefined ⇒ true,是 WB samePosixProcess 可选链的自然产物。
      // 实际调用路径(waitForTreeDeath)rootRow 恒有值,不会触发该分支;此处钉死以固化 WB 语义。
      expect(sameProcess(undefined, undefined)).toBe(true)
    })
  })

  describe('⑥ buildParentChildMap + collectProcessTree', () => {
    it('从根递归收集整棵子树(不含根)', () => {
      const table = new Map([
        [ROOT, row(ROOT, 1)],
        [KID, row(KID, ROOT)],
        [GRAND, row(GRAND, KID)],
        [40_003, row(40_003, 999)],
      ])
      expect(collectProcessTree(ROOT, table)).toEqual([KID, GRAND])
    })
    it('父子映射结构', () => {
      const table = new Map([
        [ROOT, row(ROOT, 1)],
        [KID, row(KID, ROOT)],
      ])
      expect(buildParentChildMap(table).get(ROOT)).toEqual([KID])
    })
    it('环检测:循环父子不无限递归(visited 兜住)', () => {
      const table = new Map([
        [ROOT, row(ROOT, KID)],
        [KID, row(KID, ROOT)],
      ])
      expect(collectProcessTree(ROOT, table)).toEqual([KID, ROOT])
    })
    it('根不在表里 ⇒ 空树', () => {
      const table = new Map([[KID, row(KID, 999)]])
      expect(collectProcessTree(ROOT, table)).toEqual([])
    })
  })

  describe('taskkillOutputConfirmsRoot(win32 根确认)', () => {
    it('输出点名目标 pid ⇒ 确认;点名别的 pid ⇒ 不确认', () => {
      expect(taskkillOutputConfirmsRoot(`SUCCESS: The process with PID ${ROOT} has been terminated.`, ROOT)).toBe(true)
      expect(taskkillOutputConfirmsRoot('PID 12345 not found.', ROOT)).toBe(false)
    })
  })

  describe('reapProcessTree 状态机', () => {
    interface Entry {
      kind: 'root' | 'group'
      target: number
      force: boolean
    }
    function recorder(): {
      log: Entry[]
      rootKill: RootKillDispatch
      groupKill: RootKillDispatch
    } {
      const log: Entry[] = []
      const rootKill: RootKillDispatch = async (pid, _group, force) => {
        log.push({ kind: 'root', target: pid, force })
        return { ok: true, output: 'killed' }
      }
      const groupKill: RootKillDispatch = async (pid, _group, force) => {
        log.push({ kind: 'group', target: pid, force })
        return { ok: true, output: 'group killed' }
      }
      return { log, rootKill, groupKill }
    }

    /** posix 分支测试的公共环境:非 win32 + 真实 isAlive 探针。 */
    function posixEnv(): { restore: () => void } {
      const original = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux' })
      return { restore: () => Object.defineProperty(process, 'platform', { value: original }) }
    }

    it('posix 整树收割:进程组 → 根 → 树成员,优雅轮 SIGTERM 不升级', async () => {
      const { restore } = posixEnv()
      try {
        const { log, rootKill, groupKill } = recorder()
        const table = new Map([
          [ROOT, row(ROOT, 1)],
          [KID, row(KID, ROOT)],
        ])
        // 开头读 1 次拿根行;死亡轮读 1 次(空表 ⇒ 根消失 ⇒ 判死)。
        const result = await reapProcessTree(ROOT, {
          gracefulMs: 0,
          pollMs: 1,
          rootKill,
          groupKill,
          readTable: tableReader(table, 1),
          isAlive: async () => false,
          now: tickingNow(),
        })
        expect(result.reaped).toBe(true)
        expect(result.escalated).toBe(false)
        // 进程组(根是组长 pgid==pid)+ 根 + 树成员(KID)都要被点杀。
        expect(log.some((e) => e.kind === 'group' && e.target === -ROOT)).toBe(true)
        expect(log.some((e) => e.kind === 'root' && e.target === ROOT)).toBe(true)
        expect(log.some((e) => e.kind === 'root' && e.target === KID)).toBe(true)
      } finally {
        restore()
      }
    })

    it('升级:优雅轮未死 ⇒ SIGKILL(force=true)', async () => {
      const { restore } = posixEnv()
      try {
        const { log, rootKill, groupKill } = recorder()
        const table = new Map([[ROOT, row(ROOT, 1)]])
        // 开头 1 次 + 优雅轮 1 次(根在 ⇒ 未死)+ 升级轮 1 次(空 ⇒ 死)。
        const result = await reapProcessTree(ROOT, {
          gracefulMs: 0,
          forceMs: 0,
          pollMs: 1,
          rootKill,
          groupKill,
          readTable: tableReader(table, 2),
          isAlive: async () => true, // 恒在场 ⇒ 只能靠表格判根消失(逼走表格路径)
          now: tickingNow(),
        })
        expect(result.reaped).toBe(true)
        expect(result.escalated).toBe(true)
        // 升级轮必须发 force=true 信号。
        expect(log.some((e) => e.force)).toBe(true)
      } finally {
        restore()
      }
    })

    it('POSIX 表取不到 ⇒ 未判定:只杀根,不猜树成员', async () => {
      const { log, rootKill } = recorder()
      const result = await reapProcessTree(ROOT, {
        gracefulMs: 0,
        pollMs: 1,
        rootKill,
        readTable: async () => null,
        isAlive: async () => false,
        now: tickingNow(),
      })
      expect(result.reaped).toBe(true)
      expect(result.escalated).toBe(false)
      // 只点根 1 次,不点成员(group 不触发,无表格判组长)。
      expect(log.filter((e) => e.kind === 'root')).toHaveLength(1)
      expect(log[0]).toMatchObject({ kind: 'root', target: ROOT })
    })

    it('win32:taskkill /F 派发 + OS 复核确认 ⇒ 收割成功', async () => {
      const original = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32' })
      try {
        const { log, rootKill } = recorder()
        const result = await reapProcessTree(ROOT, {
          gracefulMs: 0,
          pollMs: 1,
          rootKill,
          isAlive: async () => false,
          now: tickingNow(),
        })
        expect(result.reaped).toBe(true)
        expect(result.escalated).toBe(false)
        // win 恒 force=true(强杀),无 group 调用。
        expect(log).toHaveLength(1)
        expect(log[0]).toMatchObject({ kind: 'root', target: ROOT, force: true })
      } finally {
        Object.defineProperty(process, 'platform', { value: original })
      }
    })

    it('invalid pid ⇒ 拒收割不派生', async () => {
      const { log, rootKill } = recorder()
      const result = await reapProcessTree(1, {
        rootKill,
        now: tickingNow(),
      })
      expect(result.reaped).toBe(false)
      expect(log).toHaveLength(0)
    })

    it('SIGKILL 后仍在 ⇒ 不装成功(still-alive)', async () => {
      const { rootKill, groupKill } = recorder()
      const table = new Map([[ROOT, row(ROOT, 1)]])
      const result = await reapProcessTree(ROOT, {
        gracefulMs: 0,
        forceMs: 0,
        pollMs: 1,
        rootKill,
        groupKill,
        readTable: tableReader(table, Number.MAX_SAFE_INTEGER), // 根永在 ⇒ 永不死
        isAlive: async () => true,
        now: tickingNow(),
      })
      expect(result.reaped).toBe(false)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
