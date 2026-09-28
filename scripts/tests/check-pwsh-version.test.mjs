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
import { resolveGitBin } from '../lib/gitdir.mjs'
// §22c:判据一律**直接 import 源实现**,不得在测试里再抄一份遮噪逻辑(抄的那份会跟着一起漂绿)。
import {
  SCRIPT_COMMENT_DIALECTS,
  maskScriptComments,
  scanScriptCommentSpans,
} from '../lib/code-mask.mjs'

const GIT_BIN = resolveGitBin() || 'git'

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
    put(
      dir,
      'ident.mjs',
      'const powershellPath = find(); powershellPath.run(deploy/win/tool.ps1)\n',
    )
    const { code, out } = runGate(['--root', dir])
    assert.equal(code, 0, `默认档调用侧只报数不判红:\n${out}`)
    assert.match(out, /\[CALLER\][^\n]*站点: 1 个/, `应恰好命中 1 处,实际:\n${out}`)
    assert.match(out, /-\s+caller\.mjs:1/, '违规调用点必须点名到 文件:行')
    for (const neg of [
      'commented.mjs',
      'usage.mjs',
      'pwsh-ok.mjs',
      'vbs-ok.mjs',
      'elsewhere.mjs',
      'ident.mjs',
    ]) {
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

// ─── G-391②(2026-09-28):调用侧覆盖面从"只判 JS/TS"扩到脚本系 ───────────────
// 盲区原文:`.ps1/.sh/.bat/.vbs` 里的调用点结构上不判(code-mask 不认其注释语法)。
// 补这一族需要的是**各语言的遮噪语义**,不是放宽判据 —— 所以 T8–T12 各钉一条:
//  ① 同一形态写在**代码面**必须被点名(阳性对照;把某个方言的遮噪摘掉 ⇒ 该方言的"注释用例"转红,
//     把某个扩展名从覆盖面里摘掉 ⇒ 该扩展名的"命中用例"转红);
//  ② 同一形态只写在**该语言自己的注释**里必须不点名(反向对照:门不得判自己的解释文字,
//     守门 70/131 同型);
//  ③ 合法写法(pwsh / 同行经 *.vbs 包装 / 目标不在 deploy/**)不得点名。
// 脚本档**刻意不遮字符串**:VBScript/batch/PowerShell 的真调用就写在引号里
// (`objShell.Run "powershell -File deploy\\…"` 是 §26 计划任务的包装形态),抹引号 = 没收尺子。

const CALL_PATH = 'deploy/win/tool.ps1' // 被调路径(不需要真存在,判据看的是调用侧文本)
const CALL_WIN = 'deploy\\win\\tool.ps1'
/** 命中行的三种书写形态(纯文本,便于逐方言复用) */
const barePs = `powershell -File ${CALL_WIN}\n`
const bareSh = `powershell -File ${CALL_PATH}\n`

/**
 * 逐方言成对夹具:`hit` = 代码面上的真调用(必须点名),
 * `comment` = **同一段文本**只存在于该语言的注释里(必须不可见)。
 * `file` 的扩展名必须与门里 CALLER_SCRIPT_DIALECT 的键对得上(T9 拿它做名单正向证明)。
 */
const SCRIPT_PAIRS = [
  {
    name: 'ps1 行首 # 注释',
    hit: 'hit.ps1',
    comment: 'cmt.ps1',
    commentText: `#requires -Version 7\n# ${barePs.trim()}\n`,
    hitText: `#requires -Version 7\n${barePs}`,
  },
  {
    name: 'ps1 <# #> 块注释',
    hit: 'hit2.ps1',
    comment: 'cmt2.ps1',
    commentText: `#requires -Version 7\n<#\n  ${barePs.trim()}\n#>\nWrite-Host ok\n`,
    hitText: `#requires -Version 7\n${barePs}`,
  },
  {
    name: 'sh 词首 # 注释',
    hit: 'hit.sh',
    comment: 'cmt.sh',
    commentText: `#!/bin/sh\n# ${bareSh.trim()}\n`,
    hitText: `#!/bin/sh\n${bareSh}`,
  },
  {
    name: 'bash # 在词中不算注释(该行仍是代码面)',
    hit: 'hit.bash',
    comment: 'cmt.bash',
    commentText: `# ${bareSh.trim()}\n`,
    hitText: `echo a#b ${bareSh}`,
  },
  {
    name: 'bat @rem 注释',
    hit: 'hit.bat',
    comment: 'cmt.bat',
    commentText: `@echo off\r\n@rem ${barePs.trim()}\r\n`,
    hitText: `@echo off\r\nstart ${barePs}`,
  },
  {
    name: 'cmd :: 注释',
    hit: 'hit.cmd',
    comment: 'cmt.cmd',
    commentText: `:: ${barePs.trim()}\r\n`,
    hitText: barePs,
  },
  {
    name: 'vbs 串外撇号注释;串内的调用必须仍可见',
    hit: 'hit.vbs',
    comment: 'cmt.vbs',
    commentText: `' ${barePs.trim()}\n`,
    hitText: `objShell.Run "${barePs.trim()}", 1, False\n`,
  },
]

test('T8 脚本系调用面有牙:每种语言的代码面命中必点名,同文写进该语言注释必不点名', () => {
  const dir = mkScratch('pwsh-script-')
  try {
    const expect = []
    const hidden = []
    for (const p of SCRIPT_PAIRS) {
      put(dir, p.hit, p.hitText)
      expect.push(p.hit)
      put(dir, p.comment, p.commentText)
      hidden.push(p.comment)
      // 合法形态 a) 显式 pwsh(同目录换名,避免与 hit 文件同名)
      const pwshRel = p.hit.replace(/^hit/, 'pwshok')
      put(dir, pwshRel, p.hitText.replace(/powershell/g, 'pwsh'))
      hidden.push(pwshRel)
      // 合法形态 b) §26 的 wscript/*.vbs 包装(同行出现 .vbs ⇒ 该形态按既有判据算合规)
      const wrappedRel = p.hit.replace(/^hit/, 'wrapped')
      put(dir, wrappedRel, `${p.hitText.trimEnd()} rem wrapper.vbs\n`)
      hidden.push(wrappedRel)
    }
    // 目标不在 deploy/** 的裸调用:不属本判据(既有射程边界,不得因扩面而变宽)
    put(dir, 'elsewhere.sh', `powershell -File src/run.ps1\n`)
    hidden.push('elsewhere.sh')
    // 标识符形态:powershell 后不跟 `-参数` ⇒ 不误伤(既有边界,扩面后仍须成立)
    put(dir, 'ident.bat', `set powershellPath=1\n%powershellPath% deploy\\win\\tool.ps1\n`)
    hidden.push('ident.bat')

    const { code, out } = runGate(['--root', dir])
    assert.equal(code, 0, `命中属调用侧,默认档必须只报数不判红:\n${out}`)
    assert.match(
      out,
      new RegExp(`\\[CALLER\\][^\\n]*站点: ${expect.length} 个`),
      `应恰好命中 ${expect.length} 处(每种语言一条),实际:\n${out}`,
    )
    for (const rel of expect) {
      assert.match(
        out,
        new RegExp(`-\\s+${rel.replace('.', '\\.')}:[12]\\b`),
        `${rel} 的代码面站点没被点名,或行号被报漂(遮噪不等长 ⇒ 行号会跳)\n${out}`,
      )
    }
    for (const rel of hidden) {
      assert.ok(
        !new RegExp(`-\\s+${rel.replace('.', '\\.')}:[0-9]`).test(out),
        `${rel} 不该被点名 —— 注释形态/合规形态被判定,就是门在判自己的文档或判据被放宽`,
      )
    }
    // 问责档:命中计入退出码(扩面后脚本系也必须能问责,否则"报数"没人看)
    const strict = runGate(['--root', dir, '--strict'])
    assert.equal(strict.code, 1, `--strict 下脚本系命中必须计入退出码:\n${strict.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T9 覆盖面名单正向证明(§120):门里登记的每个脚本扩展名都真能命中一条', () => {
  const src = readFileSync(GATE, 'utf8')
  const block = /const CALLER_SCRIPT_DIALECT = new Map\(\[([\s\S]*?)\]\)\n/.exec(src)
  assert.ok(block, '门里找不到 CALLER_SCRIPT_DIALECT 映射 ⇒ 覆盖面被整块摘掉(判据失明不是通过)')
  const entries = [...block[1].matchAll(/\['(\.[a-z0-9]+)',\s*'([a-z]+)'\]/g)].map((m) => ({
    ext: m[1],
    dialect: m[2],
  }))
  const exts = entries.map((e) => e.ext)
  // 票面要求的六个扩展名:漏一条 = 该扩展名的调用点在面上整型隐身(守门 102 左向箭头那一课)
  for (const need of ['.ps1', '.sh', '.bash', '.bat', '.cmd', '.vbs']) {
    assert.ok(exts.includes(need), `覆盖面漏扩展名 ${need} ⇒ 门对该形态全盲`)
  }
  // 方言名必须是 lib 那一份封闭集里的:在门里自造方言 = 遮噪层在提交链上抛错
  for (const { ext, dialect } of entries) {
    assert.ok(
      SCRIPT_COMMENT_DIALECTS.includes(dialect),
      `${ext} 映射到未知方言 ${dialect}(lib 会抛错,而不是静默放过)`,
    )
  }
  // 正向证明:名单里每一条都造一个真站点,逐条点名 —— 名单可以是张死表而门一路报绿,这条就是防它。
  // (注释形态的逐语言反证在 T8:那里按各语言自己的注释语法喂,不能用同一把 `#` 套所有语言。)
  const dir = mkScratch('pwsh-exts-')
  try {
    for (const { ext } of entries) put(dir, `cover/a${ext}`, bareSh)
    const { out } = runGate(['--root', dir])
    for (const { ext } of entries) {
      // 只认 CALLER 的 `文件:行:` 形态(判定面的 FAIL 清单不带行号,不会串台)
      assert.match(
        out,
        new RegExp(`-\\s+cover[/\\\\]a${ext.replace('.', '\\.')}:1:`),
        `扩展名 ${ext} 在名单里却没命中 ⇒ 名单与判据脱钩(§120 立此判据的原因)\n${out}`,
      )
    }
  } finally {
    rmScratch(dir)
  }
})

test('T10 遮噪语义(共用层):等长、只遮注释不遮字符串、未知方言抛错而不是静默返原文', () => {
  const samples = {
    ps: `#requires -Version 7\n<#\n doc ${barePs.trim()}\n#>\n${barePs}`,
    sh: `#!/bin/sh\n# ${bareSh.trim()}\n${bareSh}`,
    bat: `@echo off\r\n@rem ${barePs.trim()}\r\n${barePs}`,
    vbs: `' ${barePs.trim()}\nobjShell.Run "${barePs.trim()}", 1\n`,
  }
  for (const d of SCRIPT_COMMENT_DIALECTS) {
    const src = samples[d]
    assert.ok(src, `方言 ${d} 没有样本 ⇒ 名单条目缺正向证明`)
    const masked = maskScriptComments(src, d)
    assert.equal(masked.length, src.length, `${d}: 遮噪必须等长(各门按行回溯并报行号)`)
    assert.equal(
      masked.split(/\r?\n/).length,
      src.split(/\r?\n/).length,
      `${d}: 行数不得变(换行必须原样保留)`,
    )
    const spans = scanScriptCommentSpans(src, d)
    assert.ok(spans.length > 0, `${d}: 一条注释都没遮 ⇒ 该方言的遮噪整块失效`)
    for (const [from, to] of spans) {
      assert.ok(from < to && to <= src.length, `${d}: 区间越界 [${from},${to})`)
      for (let k = from; k < to; k++) {
        if (src[k] === '\n') assert.equal(masked[k], '\n', `${d}: 换行被遮掉了`)
        else if (src[k] === '\r') assert.equal(masked[k], '\r', `${d}: CR 被遮掉了`)
        else assert.equal(masked[k], ' ', `${d}: 注释位未遮成空格 @${k}`)
      }
    }
    // 只遮注释、**不遮字符串**:代码面(含引号里的真调用)在遮噪后必须仍逐字可见
    const visible = masked.includes(bareSh.trim()) || masked.includes(barePs.trim())
    assert.ok(visible, `${d}: 代码面那条被抹掉了 ⇒ 遮噪越界(抹了字符串或抹了多行)`)
  }
  // 未知方言必须抛错:静默返原文 = 把全部注释当代码判(误报),静默返空 = 整型失明
  assert.throws(() => maskScriptComments('x', 'nope'), /未知脚本方言/)
  assert.equal(maskScriptComments('', 'ps'), '')
  assert.deepEqual(scanScriptCommentSpans(bareSh, 'ps'), [])
})

test('T11 --staged 与全量档同形:.ps1/.vbs 里的调用侧在暂存档也必须被看见', () => {
  const dir = mkScratch('pwsh-staged-shape-')
  try {
    // deploy 下的 .ps1 旧写法被豁免面 continue 掉 ⇒ 调用侧在暂存档看不见它(两面分叉)
    put(dir, 'deploy/win/pos.ps1', `#requires -Version 7\n${barePs}`)
    put(dir, 'wrapper.vbs', `objShell.Run "${barePs.trim()}", 1\n`)
    const full = runGate(['--root', dir])
    assert.match(full.out, /deploy[/\\]win[/\\]pos\.ps1:2/, `全量档必须点名:\n${full.out}`)
    assert.match(full.out, /wrapper\.vbs:1/, `全量档必须点名 vbs 站点:\n${full.out}`)
    // 造一个真 git 仓:--staged 必须走暂存路径,否则本例什么也没证明(退化路径与全量同形是废话)
    const g = gitInitAndAdd(dir)
    assert.ok(g.ok, `夹具 git 不可用(${g.reason})⇒ 无法证伪"退化为全树扫描",本例按未判定处理而判红`)
    const staged = runGate(['--staged', '--root', dir])
    assert.ok(
      !/非 git 环境/.test(staged.out),
      `--staged 走了退化路径,本例就没在证暂存档:\n${staged.out}`,
    )
    assert.match(
      staged.out,
      /deploy[/\\]win[/\\]pos\.ps1:2/,
      `--staged 必须与全量档同形:\n${staged.out}`,
    )
    assert.match(staged.out, /wrapper\.vbs:1/, `--staged 必须点名 vbs 站点:\n${staged.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T12 报告文案不得回头声称脚本系是盲区(覆盖面声称与判据必须同形)', () => {
  const dir = mkScratch('pwsh-prose-')
  try {
    put(dir, 'src/ok.ps1', '#requires -Version 7\nWrite-Host hi\n')
    const { out } = runGate(['--root', dir])
    assert.ok(
      !/因遮噪层[\s\S]{0,40}不判/.test(out),
      `报告仍在说脚本系"因遮噪层不适用而不判"(覆盖面已扩,那句话现在是假账):\n${out}`,
    )
    assert.match(out, /覆盖面[\s\S]{0,300}\.ps1/, '覆盖面行必须逐条列出脚本扩展名')
    assert.match(out, /覆盖面[\s\S]{0,400}\.vbs/, '覆盖面行必须点名 .vbs')
  } finally {
    rmScratch(dir)
  }
})

/** 在夹具里起一个一次性 git 仓并 `add -A`;失败返回原因(调用方据此判红,不静默跳过)。 */
function gitInitAndAdd(dir) {
  for (const args of [
    ['init', '-q'],
    ['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'],
  ]) {
    const s = spawnSync(GIT_BIN, ['-c', 'safe.directory=*', ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
    })
    if (s.status !== 0) {
      return {
        ok: false,
        reason: `git ${args.join(' ')} ⇒ ${String(s.stderr ?? s.error ?? '').trim()}`,
      }
    }
  }
  return { ok: true }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
