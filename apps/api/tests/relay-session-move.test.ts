// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 单会话搬移腿测试(⑦第二刀·搬移面)。fixture 全注入临时目录,绝不碰真实会话库,断言:
 * - 默认 dry-run 零改动;--apply 后原位消失、桶内 sha 逐一核对;
 * - ops.jsonl 逐条记账(路径+sha256,零内容);undo --op <n> 单条回退到原位;
 * - 未归属(accountId=null)/台账缺失/会话不存在/当日快照缺失 → 拒绝并明说;
 * - 拒绝场景不写任何路径;输出零内容回显(会话正文埋雷不出现)。
 */
import { describe, it, expect, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  appendOps,
  findTodaySnapshot,
  main,
  planMove,
  readOps,
  type MovePaths,
} from '../scripts/relay-session-move.js'
import { applyLedger, emptyLedger, planAssign } from '../scripts/relay-session-links.js'

const CONV = 'c1111111-2222-4333-8444-555566667777'
const ACCT = 'acct-a'
const SECRET_BODY = 'TOPSECRET-CONVERSATION-BODY-move-31f7'

const sha256Of = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex')

function makeFixture(): { paths: MovePaths; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'wb-move-test-'))
  const paths: MovePaths = {
    sessionsRoot: join(root, 'sessions'),
    projectsRoot: join(root, 'projects'),
    bucketsRoot: join(root, 'buckets'),
    backupsSessionsDir: join(root, 'backups', 'sessions'),
    opsLogFile: join(root, 'relay', 'move_ops.jsonl'),
    ledgerFile: join(root, 'relay', 'session_links.json'),
  }
  return { paths, root }
}

function seedConversation(paths: MovePaths): void {
  mkdirSync(join(paths.sessionsRoot, CONV, 'nested'), { recursive: true })
  writeFileSync(join(paths.sessionsRoot, CONV, 'state.json'), '{"v":1}')
  writeFileSync(join(paths.sessionsRoot, CONV, 'nested', 'deep.json'), '{}')
  const ws = join(paths.projectsRoot, 'ws-a')
  mkdirSync(ws, { recursive: true })
  writeFileSync(join(ws, `${CONV}.jsonl`), `{"type":"meta"}\n${SECRET_BODY}\n`)
  writeFileSync(join(ws, `${CONV}.meta.json`), '{"title":"x"}')
}

/** 当日快照 fixture:createdAt=当前真实时刻(main 走真实时钟也能命中"当日") */
function seedSnapshot(paths: MovePaths): string {
  const dir = join(paths.backupsSessionsDir, '20261027T100000Z')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({
      createdAt: new Date().toISOString(),
      source: { sessionsRoot: paths.sessionsRoot, projectsRoot: paths.projectsRoot },
      files: [],
    }),
  )
  return dir
}

function seedLedger(paths: MovePaths, accountId: string | null): void {
  let ledger = {
    ...emptyLedger(),
    accounts: [{ accountId: ACCT, label: 'A', since: '2026-10-01T00:00:00.000Z' }],
  }
  if (accountId !== null) {
    ledger = planAssign(ledger, CONV, accountId).next
  } else {
    ledger = {
      ...ledger,
      links: {
        [CONV]: { accountId: null, linkedAt: new Date().toISOString(), linkedBy: 'auto-since' },
      },
    }
  }
  applyLedger(paths.ledgerFile, ledger)
}

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

describe('findTodaySnapshot:备份先行', () => {
  it('当日+source 根匹配才算在位;隔日/根不符/缺 manifest 都不算', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    seedSnapshot(paths)
    expect(
      findTodaySnapshot(
        paths.backupsSessionsDir,
        paths.sessionsRoot,
        paths.projectsRoot,
        new Date(),
      ),
    ).not.toBeNull()
    // +48h 必为另一 UTC 日
    expect(
      findTodaySnapshot(
        paths.backupsSessionsDir,
        paths.sessionsRoot,
        paths.projectsRoot,
        new Date(Date.now() + 48 * 3_600_000),
      ),
    ).toBeNull()
    expect(
      findTodaySnapshot(
        paths.backupsSessionsDir,
        'G:/other-sessions',
        paths.projectsRoot,
        new Date(),
      ),
    ).toBeNull()
    rmSync(join(paths.backupsSessionsDir, '20261027T100000Z', 'manifest.json'))
    expect(
      findTodaySnapshot(
        paths.backupsSessionsDir,
        paths.sessionsRoot,
        paths.projectsRoot,
        new Date(),
      ),
    ).toBeNull()
  })
})

describe('planMove:红线拒绝面', () => {
  it('当日快照缺失 → 拒绝且要求先跑备份,不自动代跑', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    seedConversation(paths)
    seedLedger(paths, ACCT)
    expect(() => planMove(CONV, paths, new Date())).toThrow(/快照/)
  })

  it('会话不存在 / 台账缺失 / 未归属(null)/ 账号不在 accounts → 各自拒绝', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    seedConversation(paths)
    seedSnapshot(paths)
    expect(() => planMove('c9999999-0000-4000-8000-000000000000', paths, new Date())).toThrow(
      /会话不存在/,
    )
    expect(() => planMove(CONV, paths, new Date())).toThrow(/台账不存在/)
    seedLedger(paths, null)
    expect(() => planMove(CONV, paths, new Date())).toThrow(/未归属/)
    // 台账链接指向的账号不在 accounts:构造坏台账
    mkdirSync(join(paths.ledgerFile, '..'), { recursive: true })
    writeFileSync(
      paths.ledgerFile,
      JSON.stringify({
        version: 1,
        accounts: [],
        links: { [CONV]: { accountId: 'ghost', linkedAt: '', linkedBy: 'manual' } },
      }),
    )
    expect(() => planMove(CONV, paths, new Date())).toThrow(/accounts/)
  })
})

describe('move 全链:dry-run → --apply → undo/restore', () => {
  it('dry-run 零改动;--apply 原位消失、桶内 sha 核对、ops 记账、目录收空', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    seedConversation(paths)
    seedSnapshot(paths)
    seedLedger(paths, ACCT)
    const stateShaBefore = sha256Of(readFileSync(join(paths.sessionsRoot, CONV, 'state.json')))

    expect(main(['move', '--conversation', CONV], paths)).toBe(0)
    expect(existsSync(join(paths.bucketsRoot, ACCT))).toBe(false) // dry-run 未建桶
    expect(existsSync(paths.opsLogFile)).toBe(false)
    // 源零改动
    expect(sha256Of(readFileSync(join(paths.sessionsRoot, CONV, 'state.json')))).toBe(
      stateShaBefore,
    )

    expect(main(['move', '--conversation', CONV, '--apply'], paths)).toBe(0)
    // 原位消失(目录也收空)
    expect(existsSync(join(paths.sessionsRoot, CONV))).toBe(false)
    expect(existsSync(join(paths.projectsRoot, 'ws-a', `${CONV}.jsonl`))).toBe(false)
    expect(existsSync(join(paths.projectsRoot, 'ws-a', `${CONV}.meta.json`))).toBe(false)
    // 桶内在位且逐文件 sha 与源一致(镜像原结构)
    const bucketState = join(paths.bucketsRoot, ACCT, 'workspace', 'sessions', CONV, 'state.json')
    expect(existsSync(bucketState)).toBe(true)
    expect(sha256Of(readFileSync(bucketState))).toBe(stateShaBefore)
    expect(
      existsSync(
        join(paths.bucketsRoot, ACCT, 'workspace', 'sessions', CONV, 'nested', 'deep.json'),
      ),
    ).toBe(true)
    expect(existsSync(join(paths.bucketsRoot, ACCT, 'projects', 'ws-a', `${CONV}.jsonl`))).toBe(
      true,
    )
    expect(
      readFileSync(join(paths.bucketsRoot, ACCT, 'projects', 'ws-a', `${CONV}.jsonl`), 'utf8'),
    ).toContain(SECRET_BODY)
    // ops 记账:1 条 move,3 个文件,只有路径/字节/sha
    const ops = readOps(paths.opsLogFile)
    expect(ops).toHaveLength(1)
    expect(ops[0]!.type).toBe('move')
    expect(ops[0]!.conversationId).toBe(CONV)
    expect(ops[0]!.accountId).toBe(ACCT)
    expect(ops[0]!.entries).toHaveLength(4)
    for (const e of ops[0]!.entries) expect(existsSync(e.from)).toBe(false) // 源侧已移走
  })

  it('undo --op 1 单条回退:原位逐字节复原,桶内副本移除,undo 记账', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    seedConversation(paths)
    seedSnapshot(paths)
    seedLedger(paths, ACCT)
    const statePath = join(paths.sessionsRoot, CONV, 'state.json')
    const jsonlPath = join(paths.projectsRoot, 'ws-a', `${CONV}.jsonl`)
    const stateShaBefore = sha256Of(readFileSync(statePath))

    expect(main(['move', '--conversation', CONV, '--apply'], paths)).toBe(0)
    expect(main(['undo', '--op', '1', '--apply'], paths)).toBe(0)

    expect(existsSync(statePath)).toBe(true)
    expect(existsSync(jsonlPath)).toBe(true)
    expect(sha256Of(readFileSync(statePath))).toBe(stateShaBefore)
    expect(readFileSync(jsonlPath, 'utf8')).toContain(SECRET_BODY)
    // 桶侧副本移除,空目录收干净
    expect(existsSync(join(paths.bucketsRoot, ACCT, 'workspace', 'sessions', CONV))).toBe(false)
    expect(existsSync(join(paths.bucketsRoot, ACCT, 'projects', 'ws-a', `${CONV}.jsonl`))).toBe(
      false,
    )
    const ops = readOps(paths.opsLogFile)
    expect(ops).toHaveLength(2)
    expect(ops[1]!.type).toBe('undo')
    expect(ops[1]!.refOp).toBe(1)
  })

  it('undo 坏行号/缺参拒绝,不动库', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    seedConversation(paths)
    seedSnapshot(paths)
    seedLedger(paths, ACCT)
    expect(main(['undo', '--op', '99'], paths)).toBe(1) // planUndo 抛错 → main 捕获
    expect(main(['undo'], paths)).toBe(2)
    expect(main(['undo', '--op', '0'], paths)).toBe(2)
    expect(existsSync(paths.opsLogFile)).toBe(false)
  })

  it('restore 从桶回移原位;台账缺失时按桶结构兜底归属', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    seedConversation(paths)
    seedSnapshot(paths)
    seedLedger(paths, ACCT)
    expect(main(['move', '--conversation', CONV, '--apply'], paths)).toBe(0)
    // 删掉台账文件也行:桶结构自带归属(唯一持有者);ops 日志在另一个文件,不受影响
    rmSync(paths.ledgerFile, { force: true })
    expect(main(['restore', '--conversation', CONV, '--apply'], paths)).toBe(0)
    expect(existsSync(join(paths.sessionsRoot, CONV, 'state.json'))).toBe(true)
    expect(existsSync(join(paths.projectsRoot, 'ws-a', `${CONV}.jsonl`))).toBe(true)
    expect(existsSync(join(paths.bucketsRoot, ACCT, 'workspace', 'sessions', CONV))).toBe(false)
    const ops = readOps(paths.opsLogFile)
    expect(ops).toHaveLength(2)
    expect(ops[1]!.type).toBe('restore')
  })
})

describe('零内容纪律', () => {
  it('ops 记账与 planMove 文件清单只有路径/字节/sha,正文埋雷不出现', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    seedConversation(paths)
    seedSnapshot(paths)
    seedLedger(paths, ACCT)
    const plan = planMove(CONV, paths, new Date())
    const planText = JSON.stringify(plan.files)
    expect(planText).not.toContain(SECRET_BODY)
    appendOps(paths.opsLogFile, {
      ts: new Date().toISOString(),
      type: 'move',
      conversationId: CONV,
      accountId: ACCT,
      entries: plan.files,
    })
    const onDisk = readFileSync(paths.opsLogFile, 'utf8')
    expect(onDisk).not.toContain(SECRET_BODY)
    expect(readOps(paths.opsLogFile)).toHaveLength(1)
  })
})
