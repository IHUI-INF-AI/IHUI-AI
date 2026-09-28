// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/secret-shape-redact.mjs` 的镜像测试(G-334)。
 *
 * 三件事,每件都对应一次真实自伤或一条本仓反复记过的禁令:
 *  T1 三档语义**成对**证明 —— 脱敏/脱敏+截断/只判值形状是三个不同的问题,并成一档就会
 *     复现"把 500 字诊断砍成 300 字"那次(拿泄露修复换不可处置的告警)。
 *  T2 巡检侧不得再留第二份规则字面量,必须引 lib(两处实现必漂移,本仓最高频失效型)。
 *  T3 **前向条件锁**:守护侧此刻仍有一份历史副本(它正被他人持有,不属本票射程),所以这里
 *     不写"守护侧必须为 0"那种当下恒红的断言 —— 而是写"一旦它 import 了 lib,本地那份规则
 *     字面量就必须消失"。存量照红只会逼人 --no-verify 并连带废掉全部守门(§12e 同型),
 *     而这条条件式在迁移发生的那一刻自动开始有牙。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import {
  redactAlertDetail,
  redactChildOutput,
  redactSecretishLines,
} from '../lib/secret-shape-redact.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const read = (rel) => readFileSync(path.resolve(HERE, rel), 'utf8')

describe('T1 三档语义各自成对', () => {
  it('子进程档:命中行留键名抹值,无分隔符可切的整行打码', () => {
    assert.equal(redactSecretishLines('RESEND_API_KEY=re-secret-value-123'), 'RESEND_API_KEY=***')
    assert.equal(redactSecretishLines('Bearer eyJhbGciOiJIUzI1Ni5x'), '[已脱敏]')
  })

  it('子进程档有截断,正文档**不得**截断(同一缺陷的两种病)', () => {
    const long = `token=t-abcdef\n${'x'.repeat(600)}`
    assert.match(redactChildOutput(long), /…\(截断\)$/, '子进程档必须截断,否则日志被撑爆')
    const longDetail = `${'诊断'.repeat(300)} token=t-secretvalue-xyz`
    assert.equal(
      redactAlertDetail(longDetail).length > 500,
      true,
      '正文档必须留全诊断(完整性优先,不是泄露面)',
    )
    assert.match(redactAlertDetail(longDetail), /token=\*\*\*/, '但值必须消失')
  })

  it('正文档只抹值形状:散文与 40 位 sha 逐字通过', () => {
    assert.equal(
      redactAlertDetail('gitee apikey.txt 取不到形状合法的 token(注意同目录副本不可用)'),
      'gitee apikey.txt 取不到形状合法的 token(注意同目录副本不可用)',
      '提到 token 这个词 ≠ 泄露,不得整行打码',
    )
    const shaLine = '线上构建 3fab392c704d1416c532c840c6fa75913f240874 vs origin/main'
    assert.equal(redactAlertDetail(shaLine), shaLine, '40 位 git sha 不是凭据,抹掉就没法归因部署停摆')
    assert.equal(
      redactAlertDetail('http=401 {"access_token":"ghp_SUPERSECRETVVALUE"}'),
      'http=401 {"access_token":"[已脱敏]"}',
      '已知前缀字面量必须被替换',
    )
    assert.equal(redactAlertDetail(''), '(无详情)', '空值明写占位,不静默变短')
    assert.equal(redactAlertDetail('   '), '(无详情)', '纯空白与空值同判 —— 只有空格的正文等于没寄')
    assert.equal(redactChildOutput('   \n'), '(无输出)', '空输出不得伪装成有内容')
  })
})

describe('T2 巡检侧不得再留第二份规则字面量', () => {
  for (const needle of ['SECRETISH_RE =', 'ALERT_ASSIGN_RE =', 'ALERT_LITERAL_RE =']) {
    it(`check-credential-health.mjs 里不得出现 \`${needle}\``, () => {
      const src = read('../check-credential-health.mjs')
      assert.equal(
        src.includes(needle),
        false,
        `规则只许住在 lib/secret-shape-redact.mjs;出现 \`${needle}\` 就是又抄了一份`,
      )
    })
  }

  it('巡检侧必须真的 import 那一份出口(引了名字却本地另写等于没引)', () => {
    const src = read('../check-credential-health.mjs')
    assert.match(
      src,
      /import\s*\{[^}]*redactAlertDetail[^}]*\}\s*from\s*'\.\/lib\/secret-shape-redact\.mjs'/,
      '必须从 lib 取 redactAlertDetail',
    )
  })
})

describe('T3 守护侧的前向条件锁(存量此刻不判红)', () => {
  it('守护侧若已引 lib,本地那份 SECRETISH 规则必须同时消失', () => {
    // 取 **HEAD 面**而不是磁盘:该文件此刻的工作树副本是他人未提交的在飞内容(相对 HEAD 有
    // 15 行独有新增),拿磁盘态判一条关于"已入库实现"的断言 = 把别人的现场写成本仓结论。
    const src = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'show', 'HEAD:scripts/git-guardian.mjs'],
      { cwd: path.resolve(HERE, '../..'), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true },
    )
    const importsLib = /from\s*'\.\/lib\/secret-shape-redact\.mjs'/.test(src)
    const hasLocalRule = src.includes('SECRETISH_RE =')
    if (importsLib) {
      assert.equal(
        hasLocalRule,
        false,
        '已经 import 了唯一出口,却仍留着本地规则字面量 ⇒ 两份实现各改各的,正是本票要防的',
      )
    } else {
      // 刻意不判红:迁移归该文件持有人(见 PROJECT_PLAN G-334)。只打印,不钉死这次提交。
      console.info('ℹ️ 守护侧 HEAD 面仍是历史第二份实现(迁移归该文件持有人,见 PROJECT_PLAN G-334)')
    }
  })

  it('出口不得被摘线:三个名字必须都还在 lib 的导出面上', () => {
    const lib = read('../lib/secret-shape-redact.mjs')
    for (const fn of ['redactSecretishLines', 'redactAlertDetail', 'redactChildOutput']) {
      assert.match(lib, new RegExp(`export function ${fn}\\(`), `${fn} 的 export 被摘掉了`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
