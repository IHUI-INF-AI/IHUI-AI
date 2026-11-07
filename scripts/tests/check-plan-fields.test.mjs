// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-plan-fields.mjs` 的镜像测试(§22c):判据一律 import 生产出口 `__test__` /
 * 具名导出,本文件**零复算** —— 不在这里重写"什么算 A1/A2/A3/孤儿"。
 *
 * 承重五条:
 *  ① 导入不走 main(模块顶层的 isDirectRun 守卫真的在);
 *  ② 投影 `render → parse → render` 幂等、`parse(render(x))` 逐字段相等(含超 48 字、owner 自带 `｜`);
 *  ③ 字段与散文矛盾**只在散文本人表过态**时为真,`actionable` 兜底值等于"没说";
 *  ④ 孤儿记录(侧车找不到对应行)只报数、不判红(规格 §1);
 *  ⑤ A1/A2/A3 的阳性对照仍能红 —— 差值棘轮有牙。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G, idNorm, judge, readFaces, verdict } from '../check-plan-fields.mjs'
import { __test__ as H } from '../lib/plan-field-line.mjs'
import { leaseDupGroupsOf } from '../lib/plan-id-lease.mjs'
import { compositeKeyOf, dispositionOfV2 } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const mk = (raw, line = 1) => ({ line, state: 'open', raw })
const REC = {
  key: compositeKeyOf('- [ ] G-1 甲 细节'),
  owner: '门 130 持有人',
  waiting: 'none',
  updatedAt: '2026-10-22T00:00:00.000Z',
}

describe('check-plan-fields 可导入且导入不走 main', () => {
  it('import 只拿到判据出口,不执行判定/不自检、不打印', () => {
    const r = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', "import('./scripts/check-plan-fields.mjs')"],
      { cwd: ROOT, encoding: 'utf8' },
    )
    assert.equal(r.status, 0, r.stderr)
    assert.equal(r.stdout, '', '导入就必须静默:任何打印都说明 main 被 isDirectRun 放行了')
  })

  it('判据确实以 __test__ 导出(同一引用,不是第二份实现)', () => {
    assert.equal(G.judge, judge)
    assert.equal(G.verdict, verdict)
  })
})

describe('--staged 档回归锁:崩溃即门不存在(§0.9,g33-s15 立@2026-10-30)', () => {
  // 立因:9fdbc207ba 删掉纪元折算的定义面、6d0dbde7c9 收编把消费行带回而不带声明,HEAD 上
  // `readFaces` 在 face!=='head' 分支引用裸标识符 `translate` ⇒ `node scripts/check-plan-fields.mjs
  // --staged` 必抛 ReferenceError。这道 blocking 门(stagedTriggers=PROJECT_PLAN.md)在 pre-commit
  // 面等于不存在,而崩溃还会把每次碰台账的提交顶成红/逼人跳门(§12e)。本锁真跑 CLI,把
  // "崩了悄悄回来"钉成测试红;差值维的取数面正是 --staged,所以锁必须挂在这一档。
  it('真跑 --staged:不抛 ReferenceError、必产机读结论行、RC∈{0,1,2}', () => {
    const r = spawnSync(process.execPath, ['scripts/check-plan-fields.mjs', '--staged'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    assert.ok([0, 1, 2].includes(r.status), `退出码必须是三态之一,实得 ${r.status}:${r.stderr}`)
    assert.doesNotMatch(String(r.stderr ?? ''), /is not defined|ReferenceError/)
    assert.match(
      String(r.stdout ?? ''),
      /PLAN-FIELDS-RESULT state=(clean|warn|red|undetermined)\b/,
      '崩溃的指纹就是机读行缺失(run() 在打印前抛出) ⇒ 必须现出结论行',
    )
  })

  it('纪元身份尺 idNorm:换号不换正文同一身份,正文改一字仍判新', () => {
    const a = '- [ ] G-41 甲某件活 细节'
    const b = '- [ ] H07 甲某件活 细节'
    assert.equal(idNorm(a), idNorm(b), '重编号只是把同一件事搬到新号下,A1 不得读成新行(§12e)')
    assert.notEqual(idNorm(a), idNorm('- [ ] H07 甲某件活 细节日'), '正文变一个字必须仍判新')
    // 族表必须含 H|I 且位数到 6 —— check-plan-line-loss 的 bodyKeyOf 注记记过的同一条漂移教训。
    assert.equal(idNorm('- [ ] D42046 断线重连'), idNorm('- [ ] D14 断线重连'))
    assert.equal(idNorm('- [ ] H04 题面'), idNorm('- [ ] H05 题面'))
  })
})

describe('标头投影:render → parse → render 幂等、逐字段相等', () => {
  it('等环境记录的每一字段都能原样读回', () => {
    const x = { owner: '门 130 持有人', waiting: 'env', blocking: '容器运行时' }
    const header = H.renderHeader({ key: 'G-9#x', ...x })
    const p = H.parseHeader('- [ ] ' + header + ' 标题某件活')
    assert.equal(p.malformed, false)
    assert.deepEqual(p.rec, { key: null, ...x })
    assert.equal(H.renderHeader(p.rec), header, 'render∘parse∘render 必须回到同一串')
  })

  it('waiting=none 的记录不带空等段,读回仍是 waiting=none', () => {
    const x = { owner: '甲', waiting: 'none', blocking: '' }
    const header = H.renderHeader({ key: 'G-9#x', ...x })
    assert.equal(header, '〔归:甲〕')
    assert.deepEqual(H.parseHeader('- [ ] ' + header + ' 标题').rec, { key: null, ...x })
  })

  it('owner 自带 `｜` 也逐字段往返(分隔符只在后一段像槽名时才切)', () => {
    const x = { owner: 'A｜B', waiting: 'env', blocking: '容器运行时' }
    const header = H.renderHeader({ key: 'G-9#x', ...x })
    const p = H.parseHeader('- [ ] ' + header + ' 标题')
    assert.equal(p.malformed, false)
    assert.deepEqual(p.rec, { key: null, ...x })
    assert.equal(H.renderHeader(p.rec), header)
  })

  it('未知槽名仍判 malformed(补 `｜` 不得把语法校验放宽掉)', () => {
    assert.equal(H.parseHeader('- [ ] 〔归:甲｜神秘:乙〕 标题').malformed, true)
  })

  it('超 48 字的 owner 完整渲染且可往返(投影无损,不截断加 `…`)', () => {
    const owner = '门'.repeat(60)
    const x = { owner, waiting: 'none', blocking: '' }
    assert.ok(owner.length > H.MAX)
    const header = H.renderHeader({ key: 'G-9#x', ...x })
    assert.ok(!header.includes('…'))
    assert.ok(header.length > H.MAX)
    assert.deepEqual(H.parseHeader('- [ ] ' + header + ' 标题').rec, { key: null, ...x })
  })
})

describe('字段与散文矛盾:只有散文自己表了态才算 conflict', () => {
  const mkFields = (key, rec) => ({ map: new Map(rec ? [[key, rec]] : []), undetermined: false })

  it('散文回落 actionable(= 没说)+ 侧车补上等待 ⇒ 不是矛盾(正常迁移不得被喊成冲突)', () => {
    const line = '- [ ] G-9 跨端头像尺寸唯一表 —— 细节'
    const key = compositeKeyOf(line)
    const d = dispositionOfV2({
      line,
      fields: mkFields(key, { key, owner: '', waiting: 'human', blocking: '产品拍板' }),
    })
    assert.equal(d.bucket, 'waiting-human')
    assert.equal(d.source, 'fields')
    assert.equal(d.conflict, false)
  })

  it('散文自己判了"归他人"、侧车说"可做" ⇒ conflict=true,且以侧车为准', () => {
    const line = '- [ ] G-9 跨端头像尺寸唯一表 —— 归属:门 130 持有人'
    const key = compositeKeyOf(line)
    const d = dispositionOfV2({
      line,
      fields: mkFields(key, { key, owner: '', waiting: 'none' }),
    })
    assert.equal(d.bucket, 'actionable')
    assert.equal(d.conflict, true)
  })
})

describe('守门判定:差值维有牙、孤儿只报数', () => {
  it('A1 阳性对照:新行无租约无侧车 ⇒ 红并点名', () => {
    const v = judge([mk('- [ ] G-2 乙 细节')], { baseRowTexts: new Set(), map: new Map() })
    assert.equal(v.a1, 1)
    assert.equal(verdict(v, 'staged').code, 1)
  })

  it('A2 必须逐字相等:正文里包含同一串,不得把行内错标头蒙过去', () => {
    const want = H.renderHeader(REC)
    const title = '- [ ] 〔归:另一个人〕 G-1 甲 细节'
    const line = `${title} —— 备注里写了 ${want}`
    const key = compositeKeyOf(line)
    const v = judge([mk(line)], { map: new Map([[key, { ...REC, key }]]) })
    assert.equal(v.a2, 1)
    assert.equal(verdict(v, 'staged').code, 1)
  })

  it('A3 阳性对照:同键两条投影读数互斥且基准面没有 ⇒ 红', () => {
    const other = { ...REC, owner: '另一个人', updatedAt: '2026-10-23T00:00:00.000Z' }
    const v = judge([], { allRecords: [REC, other], baseSideSignatures: new Set() })
    assert.equal(v.a3, 1)
    assert.equal(verdict(v, 'staged').code, 1)
  })

  it('孤儿记录:侧车有、台账找不到对应行 ⇒ 只报 orphan,exit 0', () => {
    const orphan = { ...REC, key: 'G-999#台账里已经没有这一行' }
    const v = judge([mk('- [ ] G-1 甲 细节')], { map: new Map(), allRecords: [orphan] })
    assert.equal(v.orphan, 1)
    const r = verdict(v, 'head')
    assert.match(r.line, /orphan=1/)
    assert.equal(r.code, 0, '孤儿是已知形态,不得判红(规格 §1)')
  })

  it('记录有对应行 ⇒ 不算孤儿', () => {
    const v = judge([mk('- [ ] G-1 甲 细节')], {
      map: new Map([[REC.key, REC]]),
      allRecords: [REC],
    })
    assert.equal(v.orphan, 0)
  })

  it('全量档没有基准面 ⇒ A1/A3 报 NA,存量只 warn', () => {
    const v = judge([mk('- [ ] G-2 乙 细节')], { map: new Map() })
    const r = verdict(v, 'head')
    assert.equal(v.hasBase, false)
    assert.match(r.line, /a1=NA/)
    assert.equal(r.state, 'warn')
    assert.equal(r.code, 0)
  })
})

/**
 * 租约绝对唯一维(2026-11-03 立):`〔千段租约〕` 同 `(族, 机器, 段)` 两行即重复。
 * 判据落 `--strict`;默认档逐字不变(只报数、exit 0),避免把存量 dup 变成与提交内容无关的恒红门。
 * 三向对照:同族同机同段 ⇒ 重复;换族、换段 ⇒ 都不是重复(段号只在族内成义)。
 */
describe('租约绝对唯一:--strict 判红、默认只报数、换族/换段不误伤', () => {
  const lease = (id, seg) =>
    `- [x] ${id} 〔千段租约〕 本机=M1 段=${seg}(取号器专用行:占用面只取本行主键=段尾号;段内连号自段首起)`

  it('单源分组:同键双行成组且带真实行号;换族/换段各自独立', () => {
    const content = [
      lease('G-120', 'G-101~G-120'),
      lease('G-120', 'G-101~G-120'),
      lease('G-220', 'G-201~G-220'),
      lease('D-120', 'D-101~D-120'),
    ].join('\n')
    const groups = leaseDupGroupsOf(content)
    assert.equal(groups.length, 1, '只有同族同机同段那两行算重复')
    assert.deepEqual(
      groups[0].map((e) => e.lineNo),
      [1, 2],
      '行号必须是被审面里的真实 1 基行号',
    )
    assert.equal(groups[0][0].segment, 'G:101~120')
  })

  it('judge 读数 + verdict 两档:默认 warn/exit 0,--strict red/exit 1', () => {
    const rows = [
      mk(lease('G-120', 'G-101~G-120'), 1),
      mk(lease('G-120', 'G-101~G-120'), 2),
    ]
    const v = judge(rows, { map: new Map() })
    assert.equal(v.leaseDup, 1)
    assert.match(v.leaseDupList[0], /L1 \/ L2/, '错误输出必须点名两条行号')
    assert.match(v.leaseDupList[0], /重复 ×2/, '必须给出重复条数')
    assert.match(v.leaseDupList[0], /千段租约/, '必须给重复内容摘要')
    const relaxed = verdict(v, 'head')
    assert.equal(relaxed.code, 0, '默认档只报数:存量租约重复不得打断其它腿')
    assert.match(relaxed.line, /leaseDup=1/)
    const strict = verdict(v, 'head', { strict: true })
    assert.equal(strict.code, 1, '--strict:同键两行即红')
    assert.equal(strict.state, 'red')
    assert.match(strict.line, /strict=1/)
  })

  it('CLI 档位端到:同一现场默认 run=0,strict run=1(run 即 main 的 --strict 接线)', () => {
    const dir = mkScratch('check-plan-fields-strict')
    try {
      execFileSync('git', ['init', '-q'], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] })
      mkdirSync(path.join(dir, 'scripts', 'data'), { recursive: true })
      writeFileSync(path.join(dir, 'scripts', 'data', 'plan-fields.jsonl'), '', 'utf8')
      writeFileSync(
        path.join(dir, 'PROJECT_PLAN.md'),
        ['# 计划', '', lease('G-120', 'G-101~G-120'), lease('G-120', 'G-101~G-120'), ''].join('\n'),
        'utf8',
      )
      execFileSync('git', ['add', 'PROJECT_PLAN.md', 'scripts/data/plan-fields.jsonl'], {
        cwd: dir,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      execFileSync(
        'git',
        ['-c', 'user.name=fixture', '-c', 'user.email=fixture@local', 'commit', '-q', '-m', 'fixture'],
        { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      const relaxed = G.run({ root: dir, face: 'worktree' })
      assert.equal(relaxed, 0, '默认档必须仍 exit 0(只报数)')
      const strict = G.run({ root: dir, face: 'worktree', strict: true })
      assert.equal(strict, 1, '--strict 必须非零')
    } finally {
      rmScratch(dir)
    }
  })
})

/**
 * 合并态「新增行」的相对面(2026-11-07 票:merge 提交的「新增行」判据只对第一父)。
 * 红线:
 *  ① 第二父带来的行 ⇒ 不算本次新增(任一父里已存在就排除);
 *  ② 合并时我们自己新写、两个父里都没有的行 ⇒ 仍算新增,A1 仍须红;
 *  ③ 单亲提交 ⇒ 与改前逐字节一致(基准面恰为 HEAD 的开行集合,不多不少);
 *  ④ 父提交取不到(坏对象 / 空 MERGE_HEAD)⇒ fail-closed 判未判定(exit 2),
 *    绝不允许退化成「没有新增」而放行。
 * 官司一律真跑生产出口 `readFaces` / `run`,本文件零复算(§22c)。
 */
describe('A1 合并态:新增行的相对面 = 全部父提交求并集排除', () => {
  const BASE = '- [ ] G-1 基线行 细节'
  const OURS = '- [ ] G-2 我方分支带来的行 细节'
  const THEIRS = '- [ ] G-3 第二父带来的历史欠账 细节'
  const FRESH = '- [ ] G-4 合并时我们自己新写的行 细节'

  const g = (dir, args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=fixture',
        '-c',
        'user.email=fixture@local',
        '-c',
        'commit.gpgsign=false',
        '-c',
        `core.hooksPath=${path.join(dir, '.nohooks')}`,
        ...args,
      ],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
    )
  const mergeHead = (dir) => path.join(dir, '.git', 'MERGE_HEAD')

  /**
   * 造真二父现场:两侧各自在文件尾追加不同行 ⇒ ort 必冲突;解成并集后 `git add`,
   * 此时 MERGE_HEAD 在、索引面 = 解完的合并结果 —— 正是本门 `--staged` 档面对的那一态。
   * `extra` 用来追加「两个父里都没有」的自写行。
   */
  function makeMergeRepo(dir, extra = []) {
    mkdirSync(path.join(dir, 'scripts', 'data'), { recursive: true })
    mkdirSync(path.join(dir, '.nohooks'), { recursive: true })
    g(dir, ['init', '-q'])
    const base = String(g(dir, ['symbolic-ref', '--short', 'HEAD'])).trim()
    const put = (lines) =>
      writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), ['# 计划', '', ...lines, ''].join('\n'), 'utf8')
    writeFileSync(path.join(dir, 'scripts', 'data', 'plan-fields.jsonl'), '', 'utf8')
    put([BASE])
    g(dir, ['add', 'PROJECT_PLAN.md', 'scripts/data/plan-fields.jsonl'])
    g(dir, ['commit', '-q', '-m', 'base'])
    g(dir, ['checkout', '-q', '-b', 'theirs'])
    put([BASE, THEIRS])
    g(dir, ['add', 'PROJECT_PLAN.md'])
    g(dir, ['commit', '-q', '-m', 'theirs'])
    g(dir, ['checkout', '-q', base])
    put([BASE, OURS])
    g(dir, ['add', 'PROJECT_PLAN.md'])
    g(dir, ['commit', '-q', '-m', 'ours'])
    try {
      g(dir, ['merge', '--no-commit', '--no-ff', 'theirs'])
    } catch {
      // 冲突是预期:两侧都在尾部追加,解按「两侧独有行全保留」
    }
    assert.ok(existsSync(mergeHead(dir)), '造场失败:MERGE_HEAD 不在,后面的臂会变成单亲口径')
    put([BASE, OURS, THEIRS, ...extra])
    g(dir, ['add', 'PROJECT_PLAN.md'])
    return dir
  }

  it('① 第二父带来的行不算新增:A1=0,退出码 0', () => {
    const dir = mkScratch('check-plan-fields-merge-p2')
    try {
      makeMergeRepo(dir)
      const f = readFaces(dir, 'staged')
      assert.equal(f.ok, true, f.why)
      assert.ok(f.baseRowTexts.has(OURS), '第一父(HEAD)里的行必须在基准面里')
      assert.ok(f.baseRowTexts.has(THEIRS), '第二父里的行必须进并集 —— 否则它就是「合并方新增」')
      const v = judge(f.rows, { baseRowTexts: f.baseRowTexts, map: f.map, allRecords: f.allRecords })
      assert.equal(v.a1, 0, `A1 必须为 0,实得 ${v.a1}:${v.a1List.join(' | ')}`)
      assert.equal(G.run({ root: dir, face: 'staged' }), 0)
    } finally {
      rmScratch(dir)
    }
  })

  it('② 合并时自写的新行(两个父都没有)仍算新增 ⇒ A1 红并点名', () => {
    const dir = mkScratch('check-plan-fields-merge-fresh')
    try {
      makeMergeRepo(dir, [FRESH])
      const f = readFaces(dir, 'staged')
      assert.equal(f.ok, true, f.why)
      const v = judge(f.rows, { baseRowTexts: f.baseRowTexts, map: f.map, allRecords: f.allRecords })
      assert.equal(v.a1, 1, `只有自写行算新增,实得 ${v.a1}`)
      assert.match(v.a1List.join('\n'), /G-4/, 'A1 必须点名自写的那一行')
      assert.equal(G.run({ root: dir, face: 'staged' }), 1, '合并态的自写新增仍必须拦红')
    } finally {
      rmScratch(dir)
    }
  })

  it('③ 回归:两个父都没有的行不得被并集整面放行(只排父里已有的)', () => {
    const dir = mkScratch('check-plan-fields-merge-regress')
    try {
      makeMergeRepo(dir, [FRESH])
      const f = readFaces(dir, 'staged')
      assert.equal(f.baseRowTexts.has(FRESH), false, '自写行不在任何父里 ⇒ 不得进基准面')
      assert.ok(
        f.rows.some((r) => r.raw === FRESH),
        '自写行确实在被审面(索引)上 —— 它必须被看见',
      )
      assert.equal(f.baseRowTexts.has(THEIRS), true, '对照:第二父的行必须被排除')
    } finally {
      rmScratch(dir)
    }
  })

  it('④ 单亲提交行为不变:基准面 === HEAD 的开行集合(逐字)', () => {
    const dir = mkScratch('check-plan-fields-single-parent')
    try {
      mkdirSync(path.join(dir, 'scripts', 'data'), { recursive: true })
      mkdirSync(path.join(dir, '.nohooks'), { recursive: true })
      g(dir, ['init', '-q'])
      writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), ['# 计划', '', BASE, ''].join('\n'), 'utf8')
      writeFileSync(path.join(dir, 'scripts', 'data', 'plan-fields.jsonl'), '', 'utf8')
      g(dir, ['add', 'PROJECT_PLAN.md', 'scripts/data/plan-fields.jsonl'])
      g(dir, ['commit', '-q', '-m', 'base'])
      // 索引面追加一行(未提交)⇒ 单亲口径下只有这一行算新增
      writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), ['# 计划', '', BASE, FRESH, ''].join('\n'), 'utf8')
      g(dir, ['add', 'PROJECT_PLAN.md'])
      assert.equal(existsSync(mergeHead(dir)), false, '本臂必须是非合并态')
      const f = readFaces(dir, 'staged')
      assert.equal(f.ok, true, f.why)
      assert.deepEqual([...f.baseRowTexts].sort(), [BASE].sort(), '单亲基准面必须就是 HEAD 的开行集合')
      const v = judge(f.rows, { baseRowTexts: f.baseRowTexts, map: f.map, allRecords: f.allRecords })
      assert.equal(v.a1, 1)
      assert.match(v.a1List.join('\n'), /G-4/)
    } finally {
      rmScratch(dir)
    }
  })

  it('⑤ 父提交取不到(坏对象)⇒ 判未判定 exit 2,不许当成「没有新增」放行', () => {
    const dir = mkScratch('check-plan-fields-merge-badparent')
    try {
      makeMergeRepo(dir, [FRESH])
      writeFileSync(mergeHead(dir), `${'0'.repeat(40)}\n`, 'utf8')
      const f = readFaces(dir, 'staged')
      assert.equal(f.ok, false, '父提交读不出时 readFaces 必须 fail-closed')
      assert.match(f.why, /未判定/)
      assert.equal(G.run({ root: dir, face: 'staged' }), 2, '未判定必须是 exit 2,不是 exit 0')
    } finally {
      rmScratch(dir)
    }
  })

  it('⑥ 合并态但 MERGE_HEAD 为空 ⇒ 同样判未判定(不得退化成「父只有一个」)', () => {
    const dir = mkScratch('check-plan-fields-merge-empty')
    try {
      makeMergeRepo(dir)
      writeFileSync(mergeHead(dir), '', 'utf8')
      const f = readFaces(dir, 'staged')
      assert.equal(f.ok, false)
      assert.match(f.why, /未判定/)
      assert.equal(G.run({ root: dir, face: 'staged' }), 2)
    } finally {
      rmScratch(dir)
    }
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
