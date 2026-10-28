// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-stale-stashes.mjs`(stash 滞留源码改动守门,AGENTS.md §12d 配套)。
 *
 * 门体导出的判据只有两枚:`gate.NON_WORK_FILE`(哪些路径不算"源码改动")与
 * `gate.formatAge`(滞留时长怎么写成人能读的单位)。两者一律由门体裁定 —— 本文件不重述那条正则,
 * 也不重列单位串(AGENTS.md §22c 红线 + 守门 191 的 F1/F2),单位刻度全部由 `formatAge`
 * 自己的产出当探针问出来。
 *
 * 断言输入逐字取自真仓 HEAD:`git ls-tree -r HEAD --name-only` 的在册路径、
 * `git show -s --format=%ct HEAD` 的提交器时间,都经 `scripts/lib/face-reader.mjs` 的派生通路现取,
 * 不用自造夹具当主证(§22c「回声机」教训)。
 *
 * 硬边界(票面写死):**只读 stash,绝不写 stash** —— 不 push / 不 pop / 不 apply / 不 drop / 不 clear。
 * 那既是别人的数据,也被本机钩子硬拦。因此 main() 的 warn/block 分级**无法**在本文件里被构造证明;
 * 这一维按诚实口径处理:加载期同步量能力探测,探测不过整条跳过,并把"这一维此刻没判"写进测试名
 * (禁止 warn + return 冒充判过)。
 *
 * 用例清单:
 *  T1 NON_WORK_FILE 正反成对(真仓在册路径逐字):锁文件判"非源码"、真源码路径判"源码"、
 *     挂真仓目录前缀的锁文件仍命中、同一枚串加一节尾巴必须判不进去(锚点有牙)。
 *  T2 formatAge 分支正反 + 钳位有牙:0 与负输入都不得写成 0、分钟档保留数值、
 *     档位随时长单调变粗、同档内数值随时长递增。
 *  T3 真仓实锚:HEAD 提交器时长(现读)交给 formatAge,读数必须是"数值 + 单位"且刻度自洽。
 *  T4 装车 + 只读不变量:在**没人共享**的临时 git 仓里跑门体 CLI ⇒ exit 0 并明写"为空",
 *     跑完(含 --strict / --blocking / --warn-hours=0 多轮)该仓 stash 列表逐字不变。
 *  T5 本机 stash 实况档:main() 的滞留分级读的是本机 stash 列表这一瞬时状态 —— 列表非空或读不到
 *     就整条跳过(这一维此刻不判,跳过不等于通过)。
 *
 * 派生一律 `windowsHide: true` + `stdio: ['ignore','pipe','pipe']`(AGENTS.md §12g);
 * 临时目录/临时 git 仓一律 mkScratch/rmScratch(§26 唯一落点)。门体模块级那枚 `where git` IIFE
 * 属既存事实(import 门体就会跑一次),本文件不"顺手改"它。
 * 本机 Node v24.19 无 `it.skipIf`(实测 `typeof it.skipIf === 'undefined'`),
 * 等价形状是 `it(name, { skip: <原因字符串 | false> }, fn)`。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-stale-stashes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_CLI = join(REPO, 'scripts', 'check-stale-stashes.mjs')

/** 真仓 HEAD 在册路径(逐字取自 `git ls-tree -r HEAD --name-only` 的实测输出)。 */
const LOCK_REL = 'pnpm-lock.yaml'
const SOURCE_REL = 'apps/web/src/components/feedback/portal-panel.tsx'
const REAL_DIR_REL = 'apps/mobile-rn'

function gitRead(args, cwd = REPO) {
  return spawnSync(
    gitBinary(),
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', cwd, ...args],
    {
      encoding: 'utf8',
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 1 << 26,
    },
  )
}

/** 只读取 stash 列表(与门体同一条命令面);读不到不当成"空",如实点名。 */
function readStashList(cwd) {
  const r = gitRead(['stash', 'list', '--format=%gd%x09%ct%x09%gs'], cwd)
  if (r.status !== 0 && r.status !== 128) {
    return { ok: false, reason: `git stash list 失败(exit=${r.status})`, lines: [], raw: '' }
  }
  const raw = String(r.stdout || '')
  return { ok: true, reason: '', lines: raw.split('\n').filter(Boolean), raw }
}
const STASH_PROBE = readStashList(REPO)

/** HEAD 提交器时间 → 真实滞留毫秒(现读,不写死;取不到给 null)。 */
const HEAD_AGE_MS = (() => {
  const r = gitRead(['show', '-s', '--format=%ct', 'HEAD'])
  if (r.status !== 0) return null
  const ct = Number(String(r.stdout || '').trim())
  if (!Number.isFinite(ct)) return null
  return Date.now() - ct * 1000
})()

/**
 * 单位刻度不抄进测试:向 gate.formatAge 问三档探针拿到它自己的单位名,再按那个自证的刻度序给任意
 * 时长定序。刻度序漂开 ⇒ rank 出现 -1 ⇒ 断言自己会红。
 * ⚠ 探针取值必须各自落在**不同分支**上:实测 `formatAge(86_400_000)`(整一天)走的是小时分支
 * (h=24 < 48),拿它当天档探针会让小时档与天档同名单向撞红 —— 那是本测试尺子的错,不是门体的错。
 */
const AGE_LADDER = [30_000, 2 * 3_600_000, 3 * 86_400_000].map((p) => String(gate.formatAge(p)).split(' ')[1])
function rankOfAge(ms) {
  const label = String(gate.formatAge(ms)).split(' ')[1]
  return { label, rank: AGE_LADDER.indexOf(label) }
}
function amountOfAge(ms) {
  return Number(String(gate.formatAge(ms)).split(' ')[0])
}

describe('check-stale-stashes · §22c 镜像测试(判据一律走门体导出的 gate)', () => {
  it('T1 gate.NON_WORK_FILE 正反成对(真仓在册路径逐字)与锚点有牙', () => {
    assert.equal(gate.NON_WORK_FILE.test(LOCK_REL), true, '真仓根那枚在册锁文件判不进"非源码" = 尺子看不见锁文件')
    assert.equal(gate.NON_WORK_FILE.test(`${REAL_DIR_REL}/${LOCK_REL}`), true, '挂上真仓在册目录前缀的锁文件必须同样命中(^|/ 那一臂)')
    assert.equal(gate.NON_WORK_FILE.test(SOURCE_REL), false, '真源码路径被判成非源码 = 门会把丢源码的 stash 放行')
    assert.equal(gate.NON_WORK_FILE.test(`${LOCK_REL}.bak`), false, '$ 锚点没锚住:尾巴多一节的备份会被当成锁文件吃掉')

    // 混列对账:真锁文件 + 真源码混在一起时,"源码改动"那一支必须只剩源码
    const files = [`${REAL_DIR_REL}/${LOCK_REL}`, SOURCE_REL, LOCK_REL]
    assert.deepEqual(files.filter((f) => !gate.NON_WORK_FILE.test(f)), [SOURCE_REL], 'workFiles 口径漂开(把锁文件算进源码或反之)')
    assert.deepEqual(files.filter((f) => gate.NON_WORK_FILE.test(f)).sort(), [LOCK_REL, `${REAL_DIR_REL}/${LOCK_REL}`].sort(), '锁文件口径漂开')
  })

  it('T2 gate.formatAge 分支正反 + 钳位有牙(0 与负值不写 0、档位单调、同档数值递增)', () => {
    assert.equal(new Set(AGE_LADDER).size, 3, `三档探针拿到了同名单位 ${JSON.stringify(AGE_LADDER)} ⇒ 刻度无法定序,先修本测试的探针取值`)
    assert.ok(String(gate.formatAge(30 * 60_000)).startsWith('30'), `分钟档里 30 分钟应写成 30 起步,实得「${gate.formatAge(30 * 60_000)}」`)
    assert.equal(rankOfAge(30 * 60_000).rank, 0, '30 分钟必须落在最细那一档')
    for (const edge of [0, -60_000]) {
      const s = String(gate.formatAge(edge))
      assert.ok(amountOfAge(edge) >= 1, `钳位失效:${edge}ms 写成了「${s}」`)
      assert.equal(rankOfAge(edge).rank, 0, `钳位档必须是最细那一档,实得「${s}」`)
    }
    assert.ok(rankOfAge(30_000).rank === 0 && rankOfAge(2 * 3_600_000).rank > rankOfAge(30_000).rank, '分钟档与小时档必须分得开')
    assert.ok(rankOfAge(3 * 86_400_000).rank > rankOfAge(2 * 3_600_000).rank, '小时档与天档必须分得开(实测:天档从 48h 起,整一天仍落小时档 —— 拿 1 天当天档探针是本测试尺子的错)')
    assert.ok(rankOfAge(49 * 3_600_000).rank > rankOfAge(47 * 3_600_000).rank, '47h 与 49h 写成同一档 = 分级读数无从判断')
    assert.ok(amountOfAge(96 * 3_600_000) > amountOfAge(72 * 3_600_000), '同单位内数值必须随时长递增')
    assert.ok(rankOfAge(96 * 3_600_000).rank === rankOfAge(72 * 3_600_000).rank, '72h 与 96h 应同档(否则上一条递增断言比的是单位而不是数)')
  })

  it(
    'T3 真仓实锚:HEAD 提交器时长交给 gate.formatAge,读数由门体自证的刻度定序',
    {
      skip:
        typeof HEAD_AGE_MS === 'number' && HEAD_AGE_MS >= 0
          ? false
          : '能力探测未过:HEAD 提交器时间取不到(git show -s 失败)—— 这一维此刻不判',
    },
    () => {
      const real = String(gate.formatAge(HEAD_AGE_MS))
      assert.ok(real.length > 0, '真实时长必须写得出读数')
      assert.match(real, /^[0-9.]+ \S/, '读数必须是"数值 + 单位"两段,报告才拼得出「滞留 X」')
      const { rank } = rankOfAge(HEAD_AGE_MS)
      assert.ok(rank >= 0, `真实读数的单位「${real}」不在门体探针定出的刻度里(读数与分级脱钩)`)
      assert.ok(amountOfAge(HEAD_AGE_MS) >= 1, '真实滞留时长不得写成 0')
      assert.ok(rankOfAge(HEAD_AGE_MS * 1000).rank >= rank, '放大一千倍落到更细的档 = 分级不可比')
      assert.ok(rankOfAge(Math.max(1, Math.floor(HEAD_AGE_MS / 1000))).rank <= rank, '缩小一千倍落到更粗的档 = 分级不可比')
    },
  )

  it('T4 装车 + 只读不变量:临时 git 仓里跑 CLI ⇒ exit 0 明写"为空",多轮跑完 stash 列表逐字不变', () => {
    const repo = mkScratch('ihui-stale-stashes-t4-')
    try {
      assert.equal(gitRead(['init', '--quiet'], repo).status, 0, '临时仓 init 失败')
      assert.equal(gitRead(['config', 'user.email', 'gate-test@example.invalid'], repo).status, 0)
      assert.equal(gitRead(['config', 'user.name', 'gate-test'], repo).status, 0)
      assert.equal(
        gitRead(['commit', '--quiet', '--allow-empty', '-m', 'gate fixture baseline'], repo).status,
        0,
        '夹具仓需要一个基线提交,才谈得上"有 stash 可滞留"',
      )
      const before = readStashList(repo)
      assert.equal(before.ok, true, `夹具仓 stash 读不到:${before.reason}`)
      assert.deepEqual(before.lines, [], '夹具仓基线必须零 stash,否则"不变"这条断言没有意义')

      const run = (extra = []) =>
        spawnSync(process.execPath, [GATE_CLI, ...extra], {
          encoding: 'utf8',
          cwd: repo,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 120_000,
          maxBuffer: 1 << 26,
        })
      const first = run()
      assert.equal(typeof first.status, 'number', 'CLI 没有退出码 = 没跑成,不记绿')
      assert.equal(first.status, 0, `零 stash 的夹具仓不该被阻塞,实得 rc=${first.status} / ${String(first.stdout).slice(0, 200)}`)
      assert.ok(String(first.stdout).includes('git stash 为空'), '零 stash 时的读数必须明写"为空"而不是沉默')

      // 分级旗标同样只读:问责档在零 stash 面上必须放行,且不得写任何东西
      for (const flag of ['--strict', '--blocking', '--warn-hours=0', '--block-hours=0']) {
        const x = run([flag])
        assert.equal(x.status, 0, `${flag} 在零 stash 面上应放行,实得 rc=${x.status} / ${String(x.stdout).slice(0, 160)}`)
      }
      const after = readStashList(repo)
      assert.equal(after.raw, before.raw, '门体跑过之后 stash 列表发生变化 ⇒ 它写了别人的数据,必须点名')
      assert.equal(after.lines.length, 0, '门体不得自建 stash(§12d 的处置出口不能被门自己吃掉)')
    } finally {
      rmScratch(repo, { bestEffort: true })
    }
  })

  it(
    'T5 本机 stash 实况档:main() 的滞留分级读的是本机 stash 列表这一瞬时状态(列表非空或读不到时,这一维此刻不判;本测试绝不写 stash)',
    {
      skip:
        STASH_PROBE.ok && STASH_PROBE.lines.length === 0
          ? false
          : `能力探测未过:${
              STASH_PROBE.ok
                ? `本机此刻有 ${STASH_PROBE.lines.length} 个 stash,分级读数由他人数据决定`
                : STASH_PROBE.reason
            } —— 而票面禁止任何 stash 写操作(钩子硬拦),block/warn 两支无法在本机被构造证明;跳过不等于通过`,
    },
    () => {
      const r = spawnSync(process.execPath, [GATE_CLI], {
        encoding: 'utf8',
        cwd: REPO,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
        maxBuffer: 1 << 26,
      })
      assert.equal(r.status, 0, `本机零 stash 时门体应放行,实得 rc=${r.status} / ${String(r.stdout).slice(0, 200)}`)
      assert.ok(String(r.stdout).includes('git stash 为空'), '本机零 stash 时读数必须明写"为空"')
      assert.equal(readStashList(REPO).raw, STASH_PROBE.raw, '跑完一次本机 CLI 后本机 stash 必须逐字不变(只读承诺)')
    },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
