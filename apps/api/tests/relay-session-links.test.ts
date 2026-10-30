// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话关联台账测试(⑦第二刀·台账面)。fixture 注入临时目录,断言:
 * - rebuild 方案 A 分桶正确:since 后归账号、since 前与时刻不可判显式标 null(绝不猜);
 * - dry-run 不写台账;--apply 才写,且重复写留 .bak 备份;
 * - assign/unassign 人工标注(linkedBy=manual)生效,且不被 rebuild 重建覆盖;
 * - 坏输入(缺参/坏 ISO/未知账号/未知会话)拒绝;
 * - 输出零内容回显(会话正文埋雷不出现)。
 */
import { describe, it, expect, afterAll } from 'vitest'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  applyLedger,
  defaultLinksPaths,
  emptyLedger,
  formatLedgerList,
  loadLedger,
  main,
  parseConversationIdList,
  planAssign,
  planAssignBatch,
  planRebuild,
  planUnassign,
  readConversationIdList,
  scanConversationIds,
  type SessionLinksLedger,
  type SessionLinksPaths,
} from '../scripts/relay-session-links.js'

const SECRET_BODY = 'TOPSECRET-CONVERSATION-BODY-links-77e1'

function makeFixture(): { paths: SessionLinksPaths; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'wb-links-test-'))
  const paths: SessionLinksPaths = {
    ledgerFile: join(root, 'relay', 'session_links.json'),
    sessionsRoot: join(root, 'sessions'),
    projectsRoot: join(root, 'projects'),
  }
  return { paths, root }
}

/** 转写文件:首行带可控 timestamp 的元数据行(正文埋雷走第二行,只验不回显) */
function writeTranscript(paths: SessionLinksPaths, conv: string, firstTs: string): void {
  const ws = join(paths.projectsRoot, 'ws-a')
  mkdirSync(ws, { recursive: true })
  writeFileSync(
    join(ws, `${conv}.jsonl`),
    `{"type":"meta","sessionId":"${conv}","timestamp":"${firstTs}"}\n${SECRET_BODY}\n`,
  )
}

function writeSessionDir(paths: SessionLinksPaths, conv: string): void {
  mkdirSync(join(paths.sessionsRoot, conv), { recursive: true })
  writeFileSync(join(paths.sessionsRoot, conv, 'state.json'), '{}')
}

const cleanup: string[] = []
afterAll(() => {
  for (const p of cleanup) rmSync(p, { recursive: true, force: true })
})

describe('scanConversationIds:会话全集与创建时刻证据', () => {
  it('并集盘点两面;转写首行 timestamp 是时间证据;无证据为 null(不猜)', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    writeTranscript(paths, 'conv-with-ts', '2026-06-01T00:00:00.000Z')
    writeSessionDir(paths, 'conv-dir-only')
    const scan = scanConversationIds(paths.sessionsRoot, paths.projectsRoot)
    expect(scan.conversations.sort()).toEqual(['conv-dir-only', 'conv-with-ts'])
    expect(scan.times['conv-with-ts']).toBe('2026-06-01T00:00:00.000Z')
    // 目录只有 birthtime(=测试运行时刻),证据存在但值不固定;绝不为 null
    expect(scan.times['conv-dir-only']).not.toBeNull()
  })
})

describe('planRebuild:方案 A 分桶', () => {
  it('since 后归账号;since 前显式 null;时刻不可判显式 null;manual 不被覆盖', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    writeTranscript(paths, 'conv-before', '2026-01-01T00:00:00.000Z') // since 前 ⇒ null
    writeTranscript(paths, 'conv-after', '2027-06-01T00:00:00.000Z') // since 后 ⇒ acct-a
    writeSessionDir(paths, 'conv-dir-only') // 只有 birthtime(现在) ⇒ after ⇒ acct-a
    const scan = scanConversationIds(paths.sessionsRoot, paths.projectsRoot)

    // 人工先标 conv-before manual → acct-b;rebuild(acct-a) 不得覆盖
    const seeded: SessionLinksLedger = planAssign(
      { ...emptyLedger(), accounts: [{ accountId: 'acct-b', label: 'B', since: '' }] },
      'conv-before',
      'acct-b',
    ).next
    const plan = planRebuild(
      seeded,
      { since: '2026-10-01T00:00:00.000Z', accountId: 'acct-a', label: 'A' },
      scan.conversations,
      scan.times,
    )
    expect(plan.next.accounts.map((a) => a.accountId).sort()).toEqual(['acct-a', 'acct-b'])
    expect(plan.next.links['conv-after']).toMatchObject({
      accountId: 'acct-a',
      linkedBy: 'auto-since',
    })
    expect(plan.next.links['conv-before']).toMatchObject({
      accountId: 'acct-b',
      linkedBy: 'manual',
    })
    expect(plan.next.links['conv-dir-only']).toMatchObject({
      accountId: 'acct-a',
      linkedBy: 'auto-since',
    })
    expect(plan.changes.join('\n')).toContain('conv-after: 无记录 → acct-a')
  })

  it('整体存量场景:since 设在未来 ⇒ 全部显式 null,绝不猜归属', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    writeTranscript(paths, 'conv-x', '2026-06-01T00:00:00.000Z')
    writeSessionDir(paths, 'conv-y')
    const scan = scanConversationIds(paths.sessionsRoot, paths.projectsRoot)
    const plan = planRebuild(
      emptyLedger(),
      { since: '2030-01-01T00:00:00.000Z', accountId: 'acct-a' },
      scan.conversations,
      scan.times,
    )
    for (const conv of scan.conversations) {
      expect(plan.next.links[conv]).toMatchObject({ accountId: null, linkedBy: 'auto-since' })
    }
  })

  it('坏输入:坏 ISO / 缺 account 拒绝', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    const scan = scanConversationIds(paths.sessionsRoot, paths.projectsRoot)
    expect(() =>
      planRebuild(
        emptyLedger(),
        { since: 'not-a-date', accountId: 'a' },
        scan.conversations,
        scan.times,
      ),
    ).toThrow(/--since/)
    expect(() =>
      planRebuild(
        emptyLedger(),
        { since: '2026-01-01T00:00:00Z', accountId: '' },
        scan.conversations,
        scan.times,
      ),
    ).toThrow(/--account/)
  })
})

describe('assign / unassign', () => {
  it('assign 人工标注;未知账号拒绝;unassign 显式标 null(manual)', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    writeTranscript(paths, 'conv-m', '2026-06-01T00:00:00.000Z')
    const withAcct = {
      ...emptyLedger(),
      accounts: [{ accountId: 'acct-a', label: 'A', since: '' }],
    }
    const assigned = planAssign(withAcct, 'conv-m', 'acct-a').next
    expect(assigned.links['conv-m']).toMatchObject({ accountId: 'acct-a', linkedBy: 'manual' })
    expect(() => planAssign(withAcct, 'conv-m', 'no-such-acct')).toThrow(/accounts/)
    const unassigned = planUnassign(assigned, 'conv-m').next
    expect(unassigned.links['conv-m']).toMatchObject({ accountId: null, linkedBy: 'manual' })
    expect(() => planUnassign(assigned, 'conv-not-in-ledger')).toThrow(/无此会话/)
  })
})

describe('applyLedger / main:写盘纪律', () => {
  it('dry-run 不写台账;--apply 写;重复 --apply 留 .bak;.bak 是旧内容', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    writeTranscript(paths, 'conv-z', '2027-06-01T00:00:00.000Z')
    const args = [
      'rebuild',
      '--since',
      '2026-10-01T00:00:00.000Z',
      '--account',
      'acct-a',
      '--label',
      '主号',
    ]
    expect(main(args, paths)).toBe(0)
    expect(existsSync(paths.ledgerFile)).toBe(false) // dry-run 未写

    expect(main([...args, '--apply'], paths)).toBe(0)
    const first = loadLedger(paths.ledgerFile)!
    expect(first.links['conv-z']).toMatchObject({ accountId: 'acct-a' })

    expect(main([...args, '--apply'], paths)).toBe(0)
    const bakNames = readdirSync(join(paths.ledgerFile, '..')).filter((n) =>
      n.startsWith('session_links.json.bak-'),
    )
    expect(bakNames.length).toBe(1)
    const bak = JSON.parse(
      readFileSync(join(paths.ledgerFile, '..', bakNames[0]!), 'utf8'),
    ) as SessionLinksLedger
    expect(bak.links['conv-z']).toMatchObject({ accountId: 'acct-a' })
  })

  it('坏子命令与缺参拒绝(退出码 2),不写任何路径', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    expect(main(['frobnicate'], paths)).toBe(2)
    expect(main(['assign', '--conversation', 'c'], paths)).toBe(2)
    expect(main(['unassign'], paths)).toBe(2)
    expect(existsSync(paths.ledgerFile)).toBe(false)
  })

  it('list 展示零内容回显:计数/时刻可见,正文埋雷绝不出现', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    writeTranscript(paths, 'conv-z', '2027-06-01T00:00:00.000Z')
    main(
      ['rebuild', '--since', '2026-10-01T00:00:00.000Z', '--account', 'acct-a', '--apply'],
      paths,
    )
    const ledger = loadLedger(paths.ledgerFile)!
    const text = formatLedgerList(ledger, defaultLinksPaths('/nonexistent-home'))
    expect(text).toContain('桶内=1')
    expect(text).toContain('未归属')
    expect(text).not.toContain(SECRET_BODY)
  })
})

/** 造一份"账号已登记、会话全部显式未归属(auto-since)"的台账底稿,供批量人工照标 */
function seedAssignedLedger(
  paths: SessionLinksPaths,
  accounts: { accountId: string; label: string }[],
  convs: string[],
): SessionLinksLedger {
  const ledger: SessionLinksLedger = {
    version: 1,
    accounts: accounts.map((a, i) => ({ ...a, since: `2026-0${i + 1}-01T00:00:00.000Z` })),
    links: {},
  }
  for (const conv of convs) {
    ledger.links[conv] = {
      accountId: null,
      linkedAt: '2026-01-01T00:00:00.000Z',
      linkedBy: 'auto-since',
    }
  }
  return ledger
}

describe('assign-batch:人工清单批量 assign(方案 A 红线:绝不机器猜)', () => {
  it('清单解析:忽略空行/注释/行内空白,按首次出现去重', () => {
    expect(
      parseConversationIdList(
        [
          '# 人工核对清单(注释行不算)',
          '',
          '  conv-a  ',
          'conv-b',
          '',
          '   ',
          '# conv-commented-out',
          'conv-a',
          'conv-c # 行尾注释不去掉(id 逐字节取自行内容)',
        ].join('\n'),
      ),
    ).toEqual(['conv-a', 'conv-b', 'conv-c # 行尾注释不去掉(id 逐字节取自行内容)'])
  })

  it('逐条标 manual;台账外且盘点不到的会话跳过并点名,不阻断其余;清单外的行不碰', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    const seeded = seedAssignedLedger(
      paths,
      [{ accountId: 'acct-a', label: 'A' }],
      ['conv-in-ledger', 'conv-keep'],
    )
    writeTranscript(paths, 'conv-on-disk-only', '2026-06-01T00:00:00.000Z')
    const scan = scanConversationIds(paths.sessionsRoot, paths.projectsRoot)
    const plan = planAssignBatch(
      seeded,
      'acct-a',
      ['conv-in-ledger', 'conv-ghost', 'conv-on-disk-only'],
      new Set(scan.conversations),
    )
    expect(plan.next.links['conv-in-ledger']).toMatchObject({
      accountId: 'acct-a',
      linkedBy: 'manual',
    })
    expect(plan.next.links['conv-on-disk-only']).toMatchObject({
      accountId: 'acct-a',
      linkedBy: 'manual',
    })
    // 不存在的会话绝不写入(既不写账号,也不写 null 占位)
    expect('conv-ghost' in plan.next.links).toBe(false)
    expect(plan.skipped).toHaveLength(1)
    expect(plan.skipped[0]).toContain('conv-ghost')
    // 点名同时进 warnings(人类可读面)
    expect(plan.warnings.join('\n')).toContain('conv-ghost')
    expect(plan.changes).toHaveLength(2)
    expect(plan.listedCount).toBe(3)
    // 清单外的台账行原样保留(不被批量动作顺手改写)
    expect(plan.next.links['conv-keep']).toMatchObject({ accountId: null, linkedBy: 'auto-since' })
    // 台账 accounts 不被批量 assign 改写
    expect(plan.next.accounts).toEqual(seeded.accounts)
  })

  it('账号必须已在台账:未知账号/前缀不唯一/空清单都拒绝(不写任何一条)', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    const two = seedAssignedLedger(
      paths,
      [
        { accountId: 'acct-alpha', label: '甲' },
        { accountId: 'acct-beta', label: '乙' },
      ],
      ['conv-a'],
    )
    const existing = new Set(['conv-a'])
    expect(() => planAssignBatch(two, 'no-such', ['conv-a'], existing)).toThrow(/账号/)
    expect(() => planAssignBatch(two, 'acct-', ['conv-a'], existing)).toThrow(/不唯一/)
    expect(() => planAssignBatch(two, 'acct-alpha', [], existing)).toThrow(/清单为空/)
    expect(() => planAssignBatch(two, '', ['conv-a'], existing)).toThrow(/--account/)
    // 唯一前缀可解析(不要求全量 id)
    const byPrefix = planAssignBatch(two, 'acct-al', ['conv-a'], existing)
    expect(byPrefix.next.links['conv-a']).toMatchObject({
      accountId: 'acct-alpha',
      linkedBy: 'manual',
    })
  })

  it('readConversationIdList:清单文件不存在 ⇒ 抛错(绝不回落成"空清单=没事干")', () => {
    const { root } = makeFixture()
    cleanup.push(root)
    expect(() => readConversationIdList(join(root, 'nope.txt'))).toThrow(/不存在/)
    const file = join(root, 'ids.txt')
    writeFileSync(file, '# 注释\nconv-a\n\n')
    expect(readConversationIdList(file)).toEqual(['conv-a'])
  })

  it('main: dry-run 不写台账;--apply 写盘留 .bak 且逐条 linkedBy=manual', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    applyLedger(
      paths.ledgerFile,
      seedAssignedLedger(paths, [{ accountId: 'acct-a', label: 'A' }], ['conv-a', 'conv-b']),
    )
    const file = join(root, 'ids.txt')
    writeFileSync(file, '# 人工确认\nconv-a\nconv-b\n')
    const args = ['assign-batch', '--file', file, '--account', 'acct-a']
    expect(main(args, paths)).toBe(0)
    expect(loadLedger(paths.ledgerFile)!.links['conv-a']).toMatchObject({ accountId: null })
    expect(readdirSync(join(paths.ledgerFile, '..')).filter((n) => n.includes('.bak-'))).toEqual([])

    expect(main([...args, '--apply'], paths)).toBe(0)
    const after = loadLedger(paths.ledgerFile)!
    for (const conv of ['conv-a', 'conv-b']) {
      expect(after.links[conv]).toMatchObject({ accountId: 'acct-a', linkedBy: 'manual' })
    }
    const baks = readdirSync(join(paths.ledgerFile, '..')).filter((n) =>
      n.startsWith('session_links.json.bak-'),
    )
    expect(baks.length).toBe(1)
    const bak = JSON.parse(
      readFileSync(join(paths.ledgerFile, '..', baks[0]!), 'utf8'),
    ) as SessionLinksLedger
    expect(bak.links['conv-a']).toMatchObject({ accountId: null, linkedBy: 'auto-since' })
  })

  it('main: 未知账号 / 缺 --file / 清单全是不存在的会话 ⇒ 拒绝写盘', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    applyLedger(
      paths.ledgerFile,
      seedAssignedLedger(paths, [{ accountId: 'acct-a', label: 'A' }], []),
    )
    const before = readFileSync(paths.ledgerFile, 'utf8')
    expect(main(['assign-batch', '--account', 'acct-a'], paths)).toBe(2)
    expect(
      main(['assign-batch', '--file', join(root, 'ghost.txt'), '--account', 'nope'], paths),
    ).toBe(2)
    const ghostFile = join(root, 'ghosts.txt')
    writeFileSync(ghostFile, 'conv-not-there\n')
    // 有效清单但逐条都验不过 ⇒ 计划 0 条,写盘与否都不改变归属真相
    expect(main(['assign-batch', '--file', ghostFile, '--account', 'acct-a'], paths)).toBe(0)
    expect(readFileSync(paths.ledgerFile, 'utf8')).toBe(before)
    expect(
      main(['assign-batch', '--file', ghostFile, '--account', 'acct-a', '--apply'], paths),
    ).toBe(0)
    expect('conv-not-there' in loadLedger(paths.ledgerFile)!.links).toBe(false)
  })

  it('输出零内容回显:批量预览/执行都不带会话正文', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    writeTranscript(paths, 'conv-a', '2026-06-01T00:00:00.000Z')
    applyLedger(
      paths.ledgerFile,
      seedAssignedLedger(paths, [{ accountId: 'acct-a', label: 'A' }], []),
    )
    const file = join(root, 'ids.txt')
    writeFileSync(file, 'conv-a\n')
    const logs: string[] = []
    const orig = console.log
    console.log = (...a: unknown[]) => {
      logs.push(a.join(' '))
    }
    try {
      expect(main(['assign-batch', '--file', file, '--account', 'acct-a', '--apply'], paths)).toBe(
        0,
      )
    } finally {
      console.log = orig
    }
    expect(logs.join('\n')).toContain('conv-a')
    expect(logs.join('\n')).not.toContain(SECRET_BODY)
  })
})

describe('applyLedger:坏台账拒续写', () => {
  it('台账存在但不可解析 ⇒ 读时抛错(宁可拒做,不在坏台账上继续写)', () => {
    const { paths, root } = makeFixture()
    cleanup.push(root)
    mkdirSync(join(paths.ledgerFile, '..'), { recursive: true })
    writeFileSync(paths.ledgerFile, '{oops')
    expect(() => loadLedger(paths.ledgerFile)).toThrow(/不可解析/)
    expect(() => applyLedger(paths.ledgerFile, emptyLedger())).not.toThrow() // 写路径自身可用(上层先 load 已拒)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
