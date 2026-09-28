// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):check-agent-engine-parity.mjs 的"可跑性不得依赖 cwd"防线(G-257)。
//
// 为什么这一票只能用 spawn 证明、不能 import 判据:本门顶层就是 CLI(常量解析 + 结果汇总
// 全在模块顶层,末尾直接 process.exit),既没有 §22d 的 isDirectRun 守卫也没有 __test__ 出口
// —— 被 import 就会在测试进程里跑完并退出。而 G-257 的缺陷**恰好是进程启动语义**
// (ROOT 由"脚本自身位置"还是"调用者站在哪个目录"决定),这类行为只能靠真起两个 cwd 各跑
// 一次来证明;在测试里另抄一份解析器既违反 §22c(禁止复制源函数实现),也证不到启动语义。
//
// 四条不可漂的判据方向:
//   T1/T2 票面解阻判据 —— **两个 cwd 退出码一致**且结论逐字相同(默认档 + 提交链那档);
//   T4 形状锁 —— ROOT 必须由 import.meta.url 推导,`process.cwd()` 定根不得回来(反向锁读
//      **代码面**,遮罩唯一实现 lib/code-mask.mjs —— 头注里逐字留着旧写法,按原文判会逼后人删说明);
//   T5/T6 失效必须响 —— 被审面取不到 ⇒ exit 2 并点名,绝不记绿;且这一档在真仓任意深子目录
//      必须仍是 0(两条配成对,否则"恒 exit 2"的退化实现也能骗过 T5);
//   T7 头注留痕 —— 事故记述与纪律必须写在文件里,否则下一轮就有人按 cwd 重写回去。

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// 夹具与反向锁共用的遮罩唯一实现(§3 共享层优先:两处实现必漂移)。
import { gitBinary } from '../lib/face-reader.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-agent-engine-parity.mjs')
/** 提交链实际调用的那一档(pre-commit-hook.js 的批外步骤)。 */
const HOOK_ARGS = ['--quiet', '--staged']

function runScript(script, args, cwd, timeout = 180000) {
  let out = ''
  let code = 0
  try {
    out = execFileSync(process.execPath, [script, ...args], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = typeof e?.status === 'number' ? e.status : -1
    out = String(e?.stdout ?? '') + String(e?.stderr ?? '')
  }
  return { code, out }
}

function runCli(args, cwd, timeout = 180000) {
  return runScript(SCRIPT, args, cwd, timeout)
}

/** 结论行去掉 ANSI 与行尾差异,便于逐字比较(颜色由 lib/logger 注入,不参与语义)。 */
const strip = (s) =>
  s
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')

test('T1 解阻判据:默认档在仓根与 apps/ai-service 两个 cwd 下退出码一致且结论逐字相同', () => {
  const atRoot = runCli([], REPO)
  const atSvc = runCli([], join(REPO, 'apps', 'ai-service'))
  assert.equal(atRoot.code, 0, `仓根应绿;实得 exit ${atRoot.code}\n${atRoot.out}`)
  assert.equal(
    atSvc.code,
    atRoot.code,
    `两个 cwd 退出码必须一致(G-257 的解阻判据);实得 仓根=${atRoot.code} 子目录=${atSvc.code}\n仓根:\n${atRoot.out}\n子目录:\n${atSvc.out}`,
  )
  assert.equal(
    strip(atSvc.out),
    strip(atRoot.out),
    `同一份代码在两个 cwd 下必须给同一句结论;仓根:\n${strip(atRoot.out)}\n子目录:\n${strip(atSvc.out)}`,
  )
  assert.match(atSvc.out, /协议 parity 通过/, '结论行必须真说到"通过",不能是空输出')
  assert.match(atSvc.out, /面=HEAD blob/, '结论行必须点名取材面(不静默出合格证)')
})

test('T2 提交链那一档(--quiet --staged)同样两 cwd 一致(--quiet 只静音成功行,不得改退出码)', () => {
  const atRoot = runCli(HOOK_ARGS, REPO)
  const atSvc = runCli(HOOK_ARGS, join(REPO, 'apps', 'ai-service'))
  assert.equal(atRoot.code, 0, `真仓索引面应绿;实得 exit ${atRoot.code}\n${atRoot.out}`)
  assert.equal(
    atSvc.code,
    atRoot.code,
    `--quiet --staged 两 cwd 必须同码:${atRoot.code} vs ${atSvc.code}`,
  )
  assert.equal(strip(atSvc.out), strip(atRoot.out), '--quiet 下两面都应无输出')
})

test('T3 两面旗同给 ⇒ exit 2 判死,且在哪个 cwd 跑都判死(拒发生在派生 git 之前)', () => {
  for (const cwd of [REPO, join(REPO, 'apps', 'ai-service')]) {
    const { code, out } = runCli(['--staged', '--worktree'], cwd)
    assert.equal(code, 2, `${cwd} 下应 exit 2;实得 ${code}\n${out}`)
    assert.match(out, /无法判定/, '必须喊"无法判定",不得冒红也不得记绿')
  }
})

test('T4 形状锁:ROOT 由脚本自身位置推导,process.cwd() 定根不得回来;取材仍走 face-reader', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(
    src,
    /const ROOT = resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\), '\.\.'\)/,
    'G-257 的修法本体:ROOT = 脚本自身位置的上上级',
  )
  // 反向锁一律读**代码面**:头注里逐字记着旧写法 `const ROOT = process.cwd()`(那是本票的
  // 立项凭据,不该被删),按原文判就会逼后人删说明 —— 守门 131/70 记过同型(门判自己的散文)。
  const code = maskCommentsAndStrings(src)
  // 遮罩真在起作用的证明:散文里有该形态,而代码面判据仍绿(否则这条断言是恒真的空话)。
  assert.match(src, /=\s*process\.cwd\s*\(/, '夹具前提:历史记述仍在注释里')
  assert.doesNotMatch(code, /=\s*process\.cwd\s*\(/, '代码面不得再用 process.cwd() 定根(§15)')
  assert.doesNotMatch(code, /resolve\(process\.cwd\s*\(/, '代码面不得把仓库相对路径拼到 cwd 上')
  // 遮噪方向按判据分两档(守门 118 同口径):模块说明符**本身就是字符串**,连字符串一起抹会让
  // "有没有引共用层"这条判据直接失明 ⇒ 它只能在原文面上查;标识符形态才读代码面。
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须引共用取材层')
  assert.match(code, /catBatch\(/, '三份被审文件必须一次批量读同面同轮(守门 118)')
  assert.match(code, /selectFace\(/, '判定面选择必须由层统一')
})

test('T5 失效必须响:被审面取不到 ⇒ exit 2 并点名,绝不记绿(临时构造面,不靠真仓状态)', async () => {
  // 在一个只放了门体 + 它所 import 的三个 lib 的临时 git 仓里,HEAD 没有那三份被审文件
  // ⇒ 唯一正确结论是 exit 2「无法判定」。把"取不到"记成通过的实现,这条先红。
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const scratch = mkScratch('aep-')
  try {
    mkdirSync(join(scratch, 'scripts', 'lib'), { recursive: true })
    copyFileSync(SCRIPT, join(scratch, 'scripts', 'gate.mjs'))
    for (const lib of ['face-reader.mjs', 'gitdir.mjs', 'logger.mjs']) {
      copyFileSync(join(REPO, 'scripts', 'lib', lib), join(scratch, 'scripts', 'lib', lib))
    }
    // 夹具里的 git 经共用层取绝对路径(§5b:"git 调用不得依赖环境" —— 服务账户与交互账户
    // 的 PATH 互不相通,裸 'git' 会在某些宿主下静默失败,让本条退化成"取不到也算通过")。
    const GIT_BIN = gitBinary()
    const g = (args) =>
      execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', scratch, ...args], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    let inited = true
    try {
      g(['init', '-q'])
      g(['config', 'user.name', 'mirror'])
      g(['config', 'user.email', 'mirror@example.invalid'])
      writeFileSync(join(scratch, 'README.md'), '# 与本协议无关的占位\n', 'utf8')
      g(['add', '-A'])
      g(['commit', '-qm', 'scratch base'])
    } catch {
      inited = false // 派生 git 不可用时仍是"取不到输入",结论方向不变,只是面更空
    }
    assert.ok(inited, '夹具应能建起临时仓(建不起也不得因此判绿 —— 下面仍要求 exit 2)')
    const { code, out } = runScript(join(scratch, 'scripts', 'gate.mjs'), [], scratch, 120000)
    assert.equal(
      code,
      2,
      `被审三份文件都不在这张面上 ⇒ 必须 exit 2(不记绿也不冒红);实得 ${code}\n${out}`,
    )
    assert.match(out, /无法判定|取不到输入/, '必须把原因喊出来(失效必须响,不得静默 exit 2)')
  } finally {
    rmScratch(scratch)
  }
})

test('T6 真仓从任意深子目录跑都不得退化成恒 2(与 T5 配成对,排除"永远喊无法判定"的实现)', () => {
  const deep = join(REPO, 'packages', 'sdk', 'python', 'ihui_ai')
  const { code, out } = runCli([], deep)
  assert.equal(code, 0, `深子目录应绿(证明 T5 的红不是恒红);实得 ${code}\n${out}`)
  assert.match(out, /协议 parity 通过/)
})

test('T7 头注必须写明这一条纪律(修法没有注释背书,下一个人会按 cwd 重写回去)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  // 截到**代码里那行** `const ROOT = ...` 之前,而不是第一个 "const ROOT" 出现处 ——
  // 第一个出现在事故记述的注释里(它本身就写着 `const ROOT = process.cwd()`),按它截会把
  // 要验的那句切在窗口外(夹具自己制造的假红,与守门 13c 的 CRLF 那一型同族)。
  const at = src.search(/^const ROOT = /m)
  assert.ok(at > 0, '必须存在代码行的 const ROOT 定义')
  const header = src.slice(0, at)
  assert.match(header, /ROOT 由脚本自身位置推导/, '头注点名"由脚本自身位置推导"')
  assert.match(header, /process\.cwd/, '头注保留旧写法的事故记述(为什么不能改回去)')
  assert.match(header, /同一份代码两个答案|两个答案/, '头注必须写清后果,而不是只写规矩')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
