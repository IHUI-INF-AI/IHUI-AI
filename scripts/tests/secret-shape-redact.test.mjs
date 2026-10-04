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
// 守护侧那一档的**真实运行值**走真模块(不源码抄一份):合一后的不变量只有跑真模块才成立。
// git-guardian.mjs 的模块级只有常量与函数定义,没有落盘/发信副作用,所以 import 是零副作用的。
import * as guardModule from '../git-guardian.mjs'

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
    // 取 **HEAD 面**而不是磁盘:一份关于"已入库实现"的断言不能用别人未提交的工作树现场来判。
    // (EBUSY:Windows 下 node 子进程调 git 必须 stdio:['ignore','pipe','pipe']。)
    const src = execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'show', 'HEAD:scripts/git-guardian.mjs'],
      {
        cwd: path.resolve(HERE, '../..'),
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
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

// ─────────────────────────────────────────────────────────────────────────────
// T4 / T5:合一本票(G-334 + G-400 同题合派)的正反成对用例。
//
// T4 **正例**:一份实现被调时,脱敏结果与改前**逐字相同**。
//   期望值不是"跑绿了算过",而是一张**改前实测冻结表** —— 26 组真实形态输入 × (默认 limit /
//   limit=10) 各自的期望输出,在迁移**之前**从旧实现上逐字量出来写死在这里。语义一旦漂移
//   (哪怕只放松一处规则),这张表立刻对不上。
//   语料覆盖面:散文逐字不改 / assignment 留键名抹值(= 与 : 两种分隔符)/ 裸嵌 token 整行打码 /
//   多行混合 / 空·空白·null·undefined·数字入参 / 截断边界 300 与 301 / 先脱敏后截断的次序 /
//   `sep.index < 40` 判据的两侧(39 留键名、40 整行打码)/ CRLF / 行尾空白 trimEnd /
//   40 位 git sha 不被抹 / 空行被 filter / limit 显式收窄。
// T5 **反例**:两个入口(lib 的直接导出 与 git-guardian 的再导出/镜像出口)对同一输入
//   **必须完全一致**。这是"两份实现合一"的核心不变量 —— 合一之后它们恒等,但**恒等是结果不是
//   保证**:日后有人在本文件里再写一份本地实现、或改 lib 时只改一边,T5 会当场翻红。
// ─────────────────────────────────────────────────────────────────────────────

// [名称, 输入, 期望输出(默认 limit=300), 期望输出(limit=10)]
const FROZEN_PRE_MERGE = [
  ["纯散文诊断(无凭据形状,逐字不改)", "connect ECONNREFUSED 127.0.0.1:5432\nat TCPConnectWrap.afterConnect", "connect ECONNREFUSED 127.0.0.1:5432 / at TCPConnectWrap.afterConnect", "connect EC…(截断)"],
  ["assignment 留键名抹值", "RESEND_API_KEY=re-secret-value-123", "RESEND_API_KEY=***", "RESEND_API…(截断)"],
  ["冒号分隔 assignment 同样留键名", "authorization: Bearer abcdef123456", "authorization:***", "authorizat…(截断)"],
  ["裸嵌 token 无分隔符可切 ⇒ 整行打码", "Bearer eyJhbGciOiJIUzI1Ni5x", "[已脱敏]", "[已脱敏]"],
  ["多行混合:命中行打码、散文行逐字留", "SMTP 发送失败\nRESEND_API_KEY=re-secret-value-123\n堆栈第一行", "SMTP 发送失败 / RESEND_API_KEY=*** / 堆栈第一行", "SMTP 发送失败 …(截断)"],
  ["空字符串明写占位", '', "(无输出)", "(无输出)"],
  ["纯空白+换行不得伪装成有内容", "   \n", "(无输出)", "(无输出)"],
  ["null 入参", null, "(无输出)", "(无输出)"],
  ["undefined 入参", undefined, "(无输出)", "(无输出)"],
  ["数字入参(String() 语义)", 12345, "12345", "12345"],
  ["超长正文触发截断(301 > 300)", "x".repeat(301), "x".repeat(300) + "…(截断)", "x".repeat(10) + "…(截断)"],
  ["截断边界 300(恰好不多不少,不截)", "y".repeat(300), "y".repeat(300), "y".repeat(10) + "…(截断)"],
  ["命中行 + 超长尾巴(先脱敏后截断)", "token=t-abcdef\n" + "x".repeat(600), "token=*** / " + "x".repeat(288) + "…(截断)", "token=*** …(截断)"],
  ["分隔符索引 39(< 40 边界内)⇒ 留键名", " ".repeat(33) + "token=t-abcdef", " ".repeat(33) + "token=***", " ".repeat(10) + "…(截断)"],
  ["分隔符索引 40(= 40 边界外)⇒ 整行打码", " ".repeat(35) + "token=t-abcdef", "[已脱敏]", "[已脱敏]"],
  ["CRLF 行尾", "RESEND_API_KEY=re-secret\r\nplain line\r\n", "RESEND_API_KEY=*** / plain line", "RESEND_API…(截断)"],
  ["行尾空白 trimEnd 后再判", "RESEND_API_KEY=re-secret-value-123   ", "RESEND_API_KEY=***", "RESEND_API…(截断)"],
  ["40 位 git sha 不是凭据,逐字留", "线上构建 3fab392c704d1416c532c840c6fa75913f240874 vs origin/main", "线上构建 3fab392c704d1416c532c840c6fa75913f240874 vs origin/main", "线上构建 3fab3…(截断)"],
  ["散文里提到 token/apikey 这两个词", "gitee apikey.txt 取不到形状合法的 token(注意同目录副本不可用)", "[已脱敏]", "[已脱敏]"],
  ["空行夹在中间被 filter 掉", "a\n\nRESEND_API_KEY=re-1\n\nb", "a / RESEND_API_KEY=*** / b", "a / RESEND…(截断)"],
  ["多个命中行各打码一次", "API_KEY=k-1\nsecret=s-2\nplain", "API_KEY=*** / secret=*** / plain", "API_KEY=**…(截断)"],
  ["只有换行", "\n\n\n", "(无输出)", "(无输出)"],
  ["tab 分隔无 =/: 可切 ⇒ 整行打码", "api_key\tvalue-should-be-masked", "[已脱敏]", "[已脱敏]"],
  ["github 前缀字面量裸值不被子进程档收(留给正文档档)", "failed with ghp_abcdefghijklmnopqrst", "failed with ghp_abcdefghijklmnopqrst", "failed wit…(截断)"],
  ["passw 变体命中(键名+值)", "password: hunter2-correct-horse", "password:***", "password:*…(截断)"],
  ["limit 显式收窄时截断点跟着走", "abcdefghijklmnopqrstuvwxyz", "abcdefghijklmnopqrstuvwxyz", "abcdefghij…(截断)"],
]

describe('T4 正例:一份实现被调时,脱敏结果与改前逐字相同(改前实测冻结表)', () => {
  for (const [name, input, expected, expectedLimit10] of FROZEN_PRE_MERGE) {
    it(`${name}`, () => {
      assert.equal(
        redactChildOutput(input),
        expected,
        '默认 limit=300 的脱敏结果与改前不一致 —— 合一只许换实现位置,不许改语义',
      )
      assert.equal(
        redactChildOutput(input, 10),
        expectedLimit10,
        'limit 显式收窄时结果与改前不一致 —— 同上',
      )
    })
  }
})

describe('T5 反例:两个入口对同一输入必须产出完全一致(合一的核心不变量)', () => {
  it('lib 直接导出 === git-guardian 的再导出 === git-guardian 镜像出口(默认 limit)', () => {
    const guard = read('../git-guardian.mjs')
    assert.match(
      guard,
      /import\s*\{[^}]*\bredactChildOutput\b[^}]*\}\s*from\s*'\.\/lib\/secret-shape-redact\.mjs'/,
      'git-guardian.mjs 必须从那唯一出口 import(引了名字却本地另写等于没引)',
    )
    for (const [name, input, expected] of FROZEN_PRE_MERGE) {
      const viaTest = guardRuntime().redactChildOutput(input)
      assert.equal(
        viaTest,
        redactChildOutput(input),
        `${name}:两个入口产出不同 —— 又出现了一份各改各的实现`,
      )
      assert.equal(viaTest, expected, `${name}:该入口的产出同时偏离改前冻结值`)
    }
  })

  it('两个入口在 limit 显式收窄时同样必须一致', () => {
    const guardFn = guardRuntime().redactChildOutput
    for (const [name, input, , expectedLimit10] of FROZEN_PRE_MERGE) {
      assert.equal(
        guardFn(input, 10),
        redactChildOutput(input, 10),
        `${name}:limit=10 通路两入口产出不同`,
      )
      assert.equal(guardFn(input, 10), expectedLimit10, `${name}:limit=10 产出偏离改前冻结值`)
    }
  })

  it('不得复活本文件私有规则字面量(源码形状锁:那份实现已迁走)', () => {
    const guard = read('../git-guardian.mjs')
    assert.equal(
      guard.includes('SECRETISH_RE ='),
      false,
      'git-guardian.mjs 里不得再出现 SECRETISH 规则字面量 —— 实现只许住在 lib 里一份',
    )
  })
})

// git-guardian 是每 2 分钟 tick 的常驻体,直接 import 会在测试里跑它的模块级副作用。
// 这里只取它的两个出口形状:优先走真模块(它此刻无 import 期副作用),失败则读源文本判定。
let _guardRuntime = null
function guardRuntime() {
  if (_guardRuntime) return _guardRuntime
  _guardRuntime = guardModule
  return _guardRuntime
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
