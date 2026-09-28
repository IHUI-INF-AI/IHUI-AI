// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-pwsh-version.test.mjs
// 守门「PowerShell 版本声明守门」(check-pwsh-version.mjs)的 §22c 镜像测试(2026-09-27 G-225 立)。
//
// 为什么每例都必须存在:本门 2026-09-27 之前对 deploy/** 是**静默跳过** —— 门一路报绿,
// 而读 AGENTS.md §27"所有项目内 .ps1 必须 #requires -Version 7"的人以为运维脚本已有版本
// 强制。"把没判写成判过了"是本仓最高频的失效型,所以本组测试钉三件事:
//  ① 豁免面的可见报告行必须真存在且带数(T2:摘掉可见性即红);
//  ② 调用侧判据必须**有牙** —— 同一行裸 powershell 形态在代码面必命中、写进注释必不命中
//     (T4 成对;只留一侧就是替"门瞎了"背书);
//  ③ 遮噪必须走 scripts/lib/code-mask.mjs 那一份实现,门里不得出现自写的注释剥离
//     (T1 源码形状锁;"两处算同一件事必漂移"是本仓记过最多次的失败型)。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const GATE = join(SCRIPTS_DIR, 'check-pwsh-version.mjs')
const MASK_LIB = join(SCRIPTS_DIR, 'lib', 'code-mask.mjs')

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/**
 * 跑门并捕获退出码 + **合并输出**(门用 --root 测试通道指到夹具,绝不审真仓)。
 * 用 spawnSync 而不是 execFileSync:后者的成功路径只回 stdout,会把 console.warn 的
 * [WARN] 退化成"看不见" —— 而"退化必须喊出来"正是被测判据之一(T6),
 * 捕获面漏 stderr 等于测试自己犯了本票要修的那一型(把没判读成没喊)。
 */
function runGate(args) {
  const r = spawnSync(process.execPath, [GATE, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { code: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

const PRAGMA_OK = '#requires -Version 7\nWrite-Host hi\n'
const PRAGMA_MISSING = 'Write-Host hi\n'

test('T1 遮噪实现只能有一份:门必须 import lib/code-mask 的 maskCommentsAndStrings,不得自带注释剥离', () => {
  const lib = readFileSync(MASK_LIB, 'utf8')
  assert.match(lib, /export function maskCommentsAndStrings\b/, '共用遮罩 lib 不见了')
  const src = readFileSync(GATE, 'utf8')
  assert.match(
    src,
    /from '\.\/lib\/code-mask\.mjs'/,
    '本门没引共用遮罩 —— 第二份实现必漂移(§3 共享层优先)',
  )
  assert.match(src, /maskCommentsAndStrings\(/, '引了 lib 却没调用 = 半接线(守门 118 同型)')
  assert.ok(
    !/function\s+(stripComments|removeComments|maskComment\w*)\s*\(/.test(src),
    '门里出现了自写的注释剥离函数 —— 判据与遮噪必须只有一台机器',
  )
  assert.ok(
    !/replace\(\s*\/\\\/\\\*\[[^\]]*\]\*\\\//.test(src),
    '门里出现了自写的块注释剥离正则 —— 同上,必须走 lib',
  )
})

test('T2 豁免面可见性:deploy/** 缺 pragma 不判红,但报告必须报数并点名,且不得声称"全仓 .ps1 合规"', () => {
  const dir = mkScratch('pwsh-exempt-')
  try {
    put(dir, 'deploy/win/tool.ps1', PRAGMA_MISSING) // 豁免面:缺 pragma
    put(dir, 'src/clean.ps1', PRAGMA_OK) // 判定面:合规
    const { code, out } = runGate(['--root', dir])
    assert.equal(code, 0, `豁免面不得判红(补 pragma 在 5.1 上=停服务):\n${out}`)
    assert.match(out, /\[EXEMPT\]/, '报告里必须出现豁免面可见行(摘掉可见性即红)')
    assert.match(out, /\[EXEMPT\][^\n]*:\s*1 个 \.ps1/, '豁免总数没报出:\n' + out)
    assert.match(out, /缺 `#requires -Version 7`/, '缺 pragma 计数没报出')
    assert.match(out, /-\s+deploy\/win\/tool\.ps1/, '缺 pragma 的豁免文件必须逐条点名')
    assert.match(out, /不判/, '必须写明这一面"没判"而不是混进通过')
    assert.ok(
      !/all project \.ps1/.test(out),
      '旧结论行"all project .ps1 files declare"不得回来 —— 豁免面从未被判定,那句话是假账',
    )
    assert.match(out, /\[OK\][^\n]*非豁免/, '结论行必须限定在已判面')
  } finally {
    rmScratch(dir)
  }
})

test('T3 判定面不放宽:非豁免 .ps1 缺 pragma 仍判红并点名(阳性对照)', () => {
  const dir = mkScratch('pwsh-red-')
  try {
    put(dir, 'deploy/win/tool.ps1', PRAGMA_MISSING) // 豁免面照常豁免
    put(dir, 'src/bad.ps1', PRAGMA_MISSING) // 判定面违规
    put(dir, 'src/clean.ps1', PRAGMA_OK)
    const { code, out } = runGate(['--root', dir])
    assert.equal(code, 1, '判定面违规必须红(豁免 deploy 不等于整门放水):\n' + out)
    assert.match(out, /-\s+src[/\\]bad\.ps1/)
    const failSection = out.split('[FAIL]')[1] ?? ''
    assert.ok(!failSection.includes('clean.ps1'), '合规文件不得混进 FAIL 清单')
  } finally {
    rmScratch(dir)
  }
})

test('T4 调用侧判据有牙:代码面裸 powershell 调用 deploy .ps1 必点名;同文写进注释/合规形态必不点名', () => {
  const dir = mkScratch('pwsh-caller-')
  try {
    put(dir, 'deploy/win/tool.ps1', PRAGMA_MISSING) // 让豁免面非空,顺带证明两行并存
    // 违规形态(逐字取文档警告的形态):剥掉注释与字符串后仍在代码面上
    put(dir, 'caller.mjs', 'powershell -File deploy/win/tool.ps1\n')
    // 反向对照 1:同一行写进 // 注释 ⇒ 必须不可见(否则门在判自己的散文)
    put(dir, 'commented.mjs', '// powershell -File deploy/win/tool.ps1\n')
    // 反向对照 2:usage 帮助文本(字符串)⇒ 必须不可见
    put(dir, 'usage.mjs', "console.log('usage: powershell -File deploy/win/tool.ps1')\n")
    // 反向对照 3:合规形态 a) 显式 pwsh
    put(dir, 'pwsh-ok.mjs', 'pwsh -File deploy/win/tool.ps1\n')
    // 反向对照 4:合规形态 b) powershell + 同行引用 .vbs 包装(§26)
    put(dir, 'vbs-ok.mjs', 'wscript.exe hidden.vbs powershell -File deploy/win/tool.ps1\n')
    // 反向对照 5:裸 powershell 但目标不在 deploy/** ⇒ 不属本判据
    put(dir, 'elsewhere.mjs', 'powershell -File D:\\somewhere\\tool.ps1\n')
    // 反向对照 6:powershell 出现在标识符里、无 `-参数` 跟随 ⇒ 不误伤
    put(dir, 'ident.mjs', 'const powershellPath = find(); powershellPath.run(deploy/win/tool.ps1)\n')
    const { code, out } = runGate(['--root', dir])
    assert.equal(code, 0, `默认档调用侧只报数不判红:\n${out}`)
    assert.match(out, /\[CALLER\][^\n]*站点: 1 个/, `应恰好命中 1 处,实际:\n${out}`)
    assert.match(out, /-\s+caller\.mjs:1/, '违规调用点必须点名到 文件:行')
    for (const neg of ['commented.mjs', 'usage.mjs', 'pwsh-ok.mjs', 'vbs-ok.mjs', 'elsewhere.mjs', 'ident.mjs']) {
      assert.ok(
        !new RegExp(`-\\s+${neg}:`).test(out),
        `${neg} 不该被点名 —— 宁漏不误报,命中注释/字符串/合规形态就是门在判自己的文档`,
      )
    }
    // 问责档:同一夹具 --strict 必须把命中计入退出码
    const strict = runGate(['--root', dir, '--strict'])
    assert.equal(strict.code, 1, '--strict 下命中必须计入退出码(问责档)\n' + strict.out)
  } finally {
    rmScratch(dir)
  }
})

test('T5 --strict 在无命中的夹具上仍 exit 0(strict 不是恒红开关)', () => {
  const dir = mkScratch('pwsh-strict-')
  try {
    put(dir, 'src/clean.ps1', PRAGMA_OK)
    put(dir, 'ok.mjs', "execFileSync('pwsh', ['-File', 'deploy/win/tool.ps1'])\n")
    const { code, out } = runGate(['--root', dir, '--strict'])
    assert.equal(code, 0, `无命中时 --strict 必须绿:\n${out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T6 --staged 在无暂存内容/非 git 环境不炸(退化路径可见)', () => {
  const dir = mkScratch('pwsh-staged-')
  try {
    put(dir, 'src/clean.ps1', PRAGMA_OK)
    // 夹具不是 git 仓 ⇒ 必须打 [WARN] 并退化全树扫描,而不是静默放过或崩(exit 2/栈)
    const { code, out } = runGate(['--staged', '--root', dir])
    assert.equal(code, 0, `非 git 环境的 --staged 必须走退化路径且判 0:\n${out}`)
    assert.match(out, /\[WARN\]/, '退化必须喊出来(静默退化=把没判写成判过了)')
    assert.match(out, /\[CALLER\]/, '退化档同样要输出两面报告行')
    assert.match(out, /\[EXEMPT\]/)
  } finally {
    rmScratch(dir)
  }
})

test('T7 真仓现读冒烟(不设数字断言,只钉"三面报告都在")', () => {
  const { code, out } = runGate([])
  assert.match(out, /\[EXEMPT\][^\n]*deploy\/\*\*[^\n]*\d+ 个 \.ps1/)
  assert.match(out, /\[CALLER\][^\n]*\d+ 个/)
  assert.ok(code === 0 || code === 1, `门必须给出可诊断结论(不得 2/崩溃),实得 ${code}:\n${out}`)
  // 本例刻意不断言数字:数字属共享工作树瞬时状态(守门 103 T12 那一课),
  // 它只钉"报告三面都在" —— 摘掉任何一行可见性,本例即红。
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
