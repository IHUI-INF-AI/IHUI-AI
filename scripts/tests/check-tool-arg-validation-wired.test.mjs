// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门「工具入参校验器接线对账」(§22c —— 直接 import 源模块,不复制判据实现)
//
// 钉六件事:
//  1. 源模块 export `__test__` 且判据所需纯函数在内(§22c phase B/C);
//  2. 装车前置:本门按任务书**不由实现票接线**(注册表由主会话单写)。未注册 ⇒ 通过并如实点名;
//     一旦出现在 runner 里,必须同时是 blocking + 与门内一致的 skipEnv,且编号在整份 runner 唯一;
//  3. 编号 115 在 runner 里不得已被别人占用(撞号会串 skipEnv 与失败归属 —— 仓里踩过);
//  4. 真仓取材可用:HEAD / 索引 / 磁盘三面的枚举与内容都读得到,且**同面同轮**;
//  5. 定义文件自身的头注/声明行不得被认成"生产调用方"(字面量尺子量到自己的解释注释 = 自咬的门);
//  6. 判据失效的方向:扫不到候选 ⇒ exit 2,绝不表现为 exit 0 的绿;两面旗同给 ⇒ exit 2。
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ } from '../check-tool-arg-validation-wired.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GUARD = join(REPO, 'scripts', 'check-tool-arg-validation-wired.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SCRIPT_NAME = 'check-tool-arg-validation-wired.mjs'

/** 只在测试内做的注册表解析(不是判据实现的副本,是"装车"检查) */
function registrationOf(text, scriptName) {
  const lines = text.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(`script: '${scriptName}'`)) continue
    const block = lines.slice(Math.max(0, i - 12), i + 12).join('\n')
    hits.push({
      id: /id:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      mode: /mode:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      skipEnv: /skipEnv:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      line: i + 1,
    })
  }
  return hits
}

const runGuard = (extra = []) =>
  spawnSync(process.execPath, [GUARD, ...extra], { encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 64 << 20 })

test('1 §22c:源模块导出判据所需的纯函数', () => {
  for (const k of ['maskNoise', 'findCallLines', 'isDeclarationLine', 'classifyPath', 'isTestSurface', 'auditModeSource', 'decide', 'analyze', 'listCandidates'])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
  assert.equal(__test__.SKIP_ENV_NAME, 'HUSKY_SKIP_TOOL_ARG_VALIDATION_WIRED', '紧急跳过 env 名不得漂移')
  assert.equal(__test__.GUARDIAN_ID_EXPECTED, '115', '本票申报的编号')
})

test('2+3 装车前置:未注册则如实点名待接线;注册了必须 blocking + 真实 skipEnv + 编号唯一 + 115 未被占', () => {
  const text = readFileSync(RUNNER, 'utf8')
  const hits = registrationOf(text, SCRIPT_NAME)
  if (hits.length === 0) {
    console.log('  ℹ️  本门按任务书未由实现票接线 guardian-runner(注册表由主会话单写)⇒ 此处如实点名,不冒充已装')
  } else {
    assert.equal(hits.length, 1, `注册块出现 ${hits.length} 次(script: 行重复即撞号)`)
    assert.equal(hits[0].mode, 'blocking', '本门必须是 blocking(warn 级等于没有)')
    assert.equal(hits[0].skipEnv, __test__.SKIP_ENV_NAME, '紧急跳过环境变量必须与门内一致')
  }
  // 申报的编号 115 在整份 runner 里不得已被别的门占用(撞号会串 skipEnv 与失败归属)
  const lines = text.split('\n')
  lines.forEach((l, idx) => {
    if (!/^\s*id:\s*'115',\s*$/.test(l)) return
    const block = lines.slice(Math.max(0, idx - 12), idx + 12).join('\n')
    assert.ok(
      block.includes(`script: '${SCRIPT_NAME}'`),
      'id 115 已被别的门占用 ⇒ 后来者必须改号(本门申报 115,撞号即串 skipEnv 与失败归属)',
    )
  })
  // 变异对照:伪造一条 mode:'warn' 的注册,装车解析必须如实报出 warn(证明这条断言有牙)
  const fabricated = `  {\n    id: '115',\n    script: '${SCRIPT_NAME}',\n    mode: 'warn',\n    skipEnv: 'X',\n  },\n`
  const mutated = registrationOf(fabricated, SCRIPT_NAME)
  assert.equal(mutated.length, 1)
  assert.notEqual(mutated[0].mode, 'blocking', '变异注入未被识破 ⇒ 装车断言无牙')
  assert.notEqual(mutated[0].skipEnv, __test__.SKIP_ENV_NAME, '变异注入的 skipEnv 未被识破 ⇒ 装车断言无牙')
})

test('4 真仓取材可用:三面各自枚举得到、内容各自读得到', () => {
  for (const face of ['head', 'staged', 'worktree']) {
    const rels = __test__.listCandidates(REPO, face)
    assert.ok(rels.length > 0, `${face} 面连校验器定义都枚举不到 ⇒ 取材通路断了`)
    assert.ok(
      rels.includes(__test__.DEFINITION_FILE),
      `${face} 面应当含定义文件 ${__test__.DEFINITION_FILE},实得 ${rels.join(', ')}`,
    )
  }
  const res = __test__.analyze(REPO, 'head')
  assert.ok(res.scanned > 0, '真仓 HEAD 面必须扫到候选')
  // **不钉仓库瞬时状态**:模式源在不在 HEAD 面上,随本票是否已提交而变。
  // 只钉它必须与结论互斥对应 —— 缺席就当且只当一条 V2 红,不得既缺席又判绿。
  const hasV2Absent = res.violations.some((v) => v.includes('影子档缺席'))
  assert.equal(hasV2Absent, !res.modeSourceAvailable, `模式源缺席与 V2 判红必须一一对应,实得 available=${res.modeSourceAvailable} violations=${res.violations}`)
  // 结论方向由纯函数决定,测试不钉仓库瞬时状态:violations 里有 V1 当且仅当 callerFound=false
  const hasV1 = res.violations.some((v) => v.startsWith('V1'))
  assert.equal(hasV1, !res.callerFound, `V1 与 callerFound 必须互斥对应,实得 callerFound=${res.callerFound} violations=${res.violations}`)
  // V2 的两条结构判据由**构造面**证明(self-test A6/A7/A8),这里刻意不再从磁盘读模式源 ——
  // 头 face 的结论混进磁盘内容,正是"自洽但基准错位的假绿尺子"(§取材面教训)。
  assert.ok(
    __test__.auditModeSource("export const TOOL_ARG_VALIDATION_MODES = ['off','shadow'] as const\nexport const DEFAULT_TOOL_ARG_VALIDATION_MODE = 'off'\n").issues.length === 0,
    '构造的正例必须判无问题(否则 A6/A7 的红是假的)',
  )
})

test('5 定义文件自身不算调用方(头注里的解释文字不得骗绿)', () => {
  const src = readFileSync(join(REPO, __test__.DEFINITION_FILE), 'utf8')
  assert.ok(src.includes(`${__test__.CALL_PATTERN}`), '夹具前提:定义文件文本里确实出现该串(声明 + 头注示例)')
  const calls = __test__.findCallLines(src)
  assert.equal(calls.length, 0, `定义文件不应贡献调用方,实得 ${JSON.stringify(calls)}`)
  assert.equal(__test__.classifyPath(__test__.DEFINITION_FILE), 'definition')
  assert.equal(__test__.classifyPath('apps/cli/tests/argument-validator.test.ts'), 'test')
  assert.equal(__test__.classifyPath('apps/cli/src/tools/index.ts'), 'prod')
  assert.equal(__test__.classifyPath('README.md'), 'doc')
  assert.equal(__test__.classifyPath('scripts/check-tool-arg-validation-wired.mjs'), 'self')
})

test('6 判据失效不得记绿:空仓 ⇒ exit 2;两面旗同给 ⇒ exit 2;--self-test ⇒ 全绿', () => {
  const dir = mkScratch('tool-arg-wired-blank-')
  try {
    writeFileSync(join(dir, 'README.md'), 'no validator here\n')
    gitRaw(['init', '-q'], dir)
    gitRaw(['add', '-A'], dir)
    gitRaw(['commit', '-q', '-m', 'blank fixture'], dir)
    const blank = runGuard(['--root', dir])
    assert.equal(blank.status, 2, `扫不到候选必须 exit 2(无法判定),实得 ${blank.status}:${blank.stdout}${blank.stderr}`)
    assert.match(`${blank.stdout}${blank.stderr}`, /无法判定/)
  } finally {
    rmScratch(dir)
  }
  const both = runGuard(['--staged', '--worktree'])
  assert.equal(both.status, 2, `两面旗同给必须 exit 2,实得 ${both.status}`)
  const st = runGuard(['--self-test'])
  assert.equal(st.status, 0, `自检必须全绿,实得 ${st.status}:${st.stdout}${st.stderr}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
