// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O43建议② 钩子运行期外来件护栏的镜像测试(§22c:判据只引实现那一份,本文件不得再算一遍)。
 *
 * 判据本体是 `diffForeignIndexEntries()`(commit-payload-attribution 那份,已被该文件 18 例
 * 钉死),本文件钉的是**接线形状**:
 *   - 护栏必须**先转发真实钩子**再复量(少转一个 = 静默摘钩子,O43 票面点名的最贵失效方向);
 *   - 非 pre-commit 钩子必须原样 exec、**不带**复量(它们在写树之后,拦不住也没资格拦);
 *   - 判据必须是 attribution 那一份本体(引用相等,不是形状相似);
 *   - safe-commit 侧:临时 hooksPath 注入 + GUARD_MARK 拦截必须排在 --no-verify 兜底**之前**
 *     (兜底会把外来件照样交出去,拦截排在兜底后面就白装了)。
 */
import { describe, test as t } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { diffForeignIndexEntries } from '../lib/commit-payload-attribution.mjs'
import { gitStagedPaths } from '../lib/git-paths.mjs'
import { __test__ as guard } from '../lib/hook-window-guard.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const safeCommitSrc = () => readFileSync(join(repoRoot, 'scripts', 'safe-commit.mjs'), 'utf8')

describe('hook-window-guard(O43建议②)', () => {
  t('T1 钩子清单:排除 README.md 与点文件,字典序;.husky 缺失 = 空', () => {
    const dir = mkScratch('hook-window-guard-t1')
    try {
      mkdirSync(join(dir, '.husky'))
      for (const f of ['pre-commit', 'commit-msg', 'README.md', '.gitkeep'])
        writeFileSync(join(dir, '.husky', f), '#!/bin/sh\n')
      assert.deepEqual(guard.huskyHookNames(dir), ['commit-msg', 'pre-commit'])
      assert.deepEqual(guard.huskyHookNames(join(dir, 'no-such-dir')), [])
    } finally {
      rmScratch(dir)
    }
  })

  t('T2 pre-commit 转发体:先转发真实钩子(`|| exit $?` 原码透传),成功后才 `--check` 复量', () => {
    const body = guard.buildForwardBody({
      hook: 'pre-commit',
      realHookPath: 'G:/repo/.husky/pre-commit',
      repoRoot: 'G:\\repo',
      baselineFile: 'G:/repo/tmp/baseline.json',
    })
    assert.match(body, /sh "G:\/repo\/\.husky\/pre-commit" "\$@" \|\| exit \$\?/)
    assert.match(body, /--check --baseline "G:\/repo\/tmp\/baseline\.json" --repo "G:\/repo"/)
    // 复量必须在转发**之后**(indexOf 顺序锁:调换顺序 = 复量跑在钩子前,窗口又开了)
    assert.ok(body.indexOf('|| exit $?') < body.indexOf('--check'), '先转发后复量')
  })

  t('T2b 非 pre-commit 钩子:原样 exec 透传,**不带**复量(它们在写树后,复量无意义)', () => {
    for (const hook of ['commit-msg', 'post-commit', 'pre-push', 'reference-transaction']) {
      const body = guard.buildForwardBody({
        hook,
        realHookPath: `G:/repo/.husky/${hook}`,
        repoRoot: 'G:/repo',
        baselineFile: 'G:/repo/tmp/baseline.json',
      })
      assert.match(body, new RegExp(`exec sh "G:/repo/\\.husky/${hook}" "\\$@"`))
      assert.ok(!body.includes('--check'), `${hook} 不得带复量`)
      assert.ok(!body.includes('exit $?'), `${hook} 不得吞退出码`)
    }
  })

  t('T3 parseExpectedEnv:换行分隔、反斜杠归一、空行丢弃、trim;缺省 = 空集', () => {
    assert.deepEqual(guard.parseExpectedEnv('a/b\nc\\d\n\n e \n'), ['a/b', 'c/d', 'e'])
    assert.deepEqual(guard.parseExpectedEnv(undefined), [])
    assert.deepEqual(guard.parseExpectedEnv(''), [])
  })

  t('T4 §22c 接线锁:护栏的判据/建议必须是 attribution 那一份本体(引用相等)', () => {
    assert.equal(guard.judgeRef, diffForeignIndexEntries)
    assert.equal(typeof guard.adviceRef, 'function')
    // 库源码不得出现第二份 -z 取材或自算差集的形状(取路径只走 gitStagedPaths 出口)
    const src = readFileSync(join(repoRoot, 'scripts', 'lib', 'hook-window-guard.mjs'), 'utf8')
    assert.ok(!src.includes("--name-status"), '不得自拆第二份 -z 帧')
    assert.match(src, /from '\.\/commit-payload-attribution\.mjs'/)
  })

  t('T5 GUARD_MARK:单行标记,且 safe-commit 的拦截必须排在 --no-verify 兜底之前', () => {
    assert.ok(guard.GUARD_MARK.length > 8 && !guard.GUARD_MARK.includes('\n'))
    const src = safeCommitSrc()
    const iMark = src.indexOf('hookOutput.includes(GUARD_MARK)')
    const iFallback = src.indexOf('commitArgs(true)')
    assert.ok(iMark > 0, 'safe-commit 必须扫 hookOutput 里的护栏标记')
    assert.ok(iFallback > 0, '--no-verify 兜底必须仍在(门真红那半的应急路径)')
    assert.ok(iMark < iFallback, '护栏拦截必须先于兜底:兜底会把外来件照样交出去')
    assert.match(src, /import \{ buildWrappedHooksDir, GUARD_MARK \} from '\.\/lib\/hook-window-guard\.mjs'/)
    assert.match(src, /'-c', `core\.hooksPath=\$\{hookWindowGuard\.hooksDir\}`/, '发令必须注入临时 hooksPath')
  })

  t('T6 真仓:全量钩子都被转发,基线文件可解析,cleanup 清场', () => {
    const dir = mkScratch('hook-window-guard-t6')
    try {
      const g = guard.buildWrappedHooksDir({
        repoRoot,
        tmpRoot: dir,
        baselinePaths: ['a\\b.txt', 'c.txt'],
      })
      try {
        const names = guard.huskyHookNames(repoRoot)
        assert.ok(names.length > 0, '本仓应有 .husky 钩子')
        assert.deepEqual(g.hookNames, names)
        assert.equal(g.baselineCount, 2)
        for (const h of names) assert.ok(existsSync(join(g.hooksDir, h)), `钩子 ${h} 必须有转发器`)
        const baseline = JSON.parse(readFileSync(join(g.hooksDir, 'baseline.json'), 'utf8'))
        assert.deepEqual(baseline, ['a/b.txt', 'c.txt'])
        // pre-commit 转发器指向真实 .husky/pre-commit
        const pc = readFileSync(join(g.hooksDir, names.includes('pre-commit') ? 'pre-commit' : names[0]), 'utf8')
        if (names.includes('pre-commit')) assert.match(pc, /\.husky\/pre-commit/)
      } finally {
        g.cleanup()
      }
      assert.ok(!existsSync(g.hooksDir), 'cleanup 后目录应消失')
    } finally {
      rmScratch(dir)
    }
  })

  t('T6b 无 .husky 的仓(夹具形态):hooksDir=null,不生成目录', () => {
    const dir = mkScratch('hook-window-guard-t6b')
    try {
      const g = guard.buildWrappedHooksDir({ repoRoot: dir, tmpRoot: dir, baselinePaths: [] })
      assert.equal(g.hooksDir, null)
      assert.equal(g.hookNames.length, 0)
      g.cleanup()
    } finally {
      rmScratch(dir)
    }
  })

  t('T7 写树前复量接线:基线=当前索引 ⇒ 不判红(与仓态无关的状态独立反控)', () => {
    // 只读:checkHookWindow 对共享仓只跑 gitStagedPaths(读),不写任何东西。
    const dir = mkScratch('hook-window-guard-t7')
    try {
      const current = gitStagedPaths({ root: repoRoot }).map((p) => p.replaceAll('\\', '/'))
      const bf = join(dir, 'baseline.json')
      writeFileSync(bf, JSON.stringify(current))
      const d = guard.checkHookWindow({ repoRoot, baselineFile: bf, expectedRaw: '' })
      assert.equal(d.blocking, false, `基线=当前索引时不得判红(新进=${d.newEntries.length})`)
    } finally {
      rmScratch(dir)
    }
  })
})
