// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门「V3 #62 侧栏装载对账」的 §22c 镜像测试。
//
// 判据实现一律从源文件 import(不在这里抄第二份),这里只补 self-test 拿不到的三种证明:
//   T1 接线的**成套性**:现在未接提交链 ⇒ 只验"若被接上则必须 blocking + skipEnv 齐备";
//   T2 取材面形状锁:必须走 face-reader 的读取入口,不得回到按磁盘/裸 git show 判;
//   T3 真文件形态锁:输入逐字取自真实交付文件(§22c "镜像测试只复读实现就是复读机"),
//      并用"把三处调用点注释掉"的变异证明这条判据真的会红 —— 而不是只会对夹具发红。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ } from '../check-v3-62-conversation-mount.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT_NAME = 'check-v3-62-conversation-mount.mjs'
const GUARD = join(REPO, 'scripts', SCRIPT_NAME)
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SIDEBAR = join(REPO, 'apps/web/src/components/sidebar-chat-history.tsx')

const src = readFileSync(GUARD, 'utf8')
const sidebarText = readFileSync(SIDEBAR, 'utf8')

test('T1 接线成套性:现在不得被声称已接提交链;一旦被接上则必须 blocking + skipEnv', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const registered = runner.includes(`script: '${SCRIPT_NAME}'`)
  if (!registered) {
    // 本票按任务书不得改 guardian-runner ⇒ 未注册是**当前事实**,不是缺陷。
    // 这条断言的方向是"别把未接线谎报成已接线":门自身与 AGENTS/README 不得出现肯定式声称。
    assert.ok(!/__registered_in_guardian_runner__/.test(src), '门脚本不得暗示自己已接提交链')
    return
  }
  const i = runner.indexOf(`script: '${SCRIPT_NAME}'`)
  const block = runner.slice(Math.max(0, i - 700), i + 700)
  assert.match(block, /mode:\s*'blocking'/, '接上后必须是 blocking')
  assert.ok(
    block.includes(`skipEnv: '${__test__.SKIP_ENV_NAME}'`),
    '接上后必须带本门专属的 skipEnv(与其他门共用会串失败归属)',
  )
})

test('T2 取材面形状锁:必须走 face-reader 的读取入口,不得按磁盘或自派生 git show 判内容', () => {
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须引 face-reader(门 118 的 face 档)')
  assert.match(src, /catBatch\(/, '内容必须经 catBatch 读,否则"引了层仍按磁盘判"= 半接线')
  assert.doesNotMatch(src, /git\s+show\b/, '不得自派生 git show 取内容')
  assert.doesNotMatch(src, /readFileSync\(\s*join\(\s*ROOT/, '不得按仓库根拼路径读被审内容')
  assert.doesNotMatch(
    src,
    /const\s+ROOT\s*=\s*process\.cwd\(\)/,
    '不得用 cwd 定根(门 70 的镜像 13/14 恒红那一型)',
  )
})

test('T3 真文件形态锁:侧栏真实源码里的三处装载点必须被同一判据认出(逐字取自交付文件)', () => {
  const masked = __test__.maskNoise(sidebarText, { keepStrings: false })
  for (const exit of __test__.MOUNT_EXITS.filter((x) => x.lane === 'ui')) {
    const used = masked.split(/\r?\n/).some((l) => __test__.isUseLine(l, exit.symbol))
    assert.ok(used, `真实侧栏源码应含 ${exit.symbol} 的调用/渲染点 —— 缺了就是本票没接上`)
  }
})

test('T3c 服务车道真源码:Python 的 def 行**不得**算装车点,而 llm.py 的那一条必须算(成对)', () => {
  const svc = __test__.MOUNT_EXITS.find((x) => x.lane === 'service')
  assert.ok(svc, '登记表里必须有服务侧出口,否则本条判据退化为空转')
  const defText = readFileSync(join(REPO, svc.ownFile), 'utf8')
  const callText = readFileSync(join(REPO, 'apps/ai-service/app/routers/llm.py'), 'utf8')
  const defMasked = __test__.maskNoise(defText, { keepStrings: false, hashLineComments: true })
  const callMasked = __test__.maskNoise(callText, { keepStrings: false, hashLineComments: true })
  const defLines = defMasked.split(/\r?\n/).filter((l) => __test__.isUseLine(l, svc.symbol))
  const callLines = callMasked.split(/\r?\n/).filter((l) => __test__.isUseLine(l, svc.symbol))
  assert.ok(
    defMasked.includes(`def ${svc.symbol}(`) || defMasked.includes(`async def ${svc.symbol}(`),
    `${svc.ownFile} 应含该出口的定义行`,
  )
  assert.equal(defLines.length, 0, `Python 定义行被算成装车点(${defLines.length} 处)⇒ 本门对"生产者被摘掉"恒绿`)
  assert.ok(callLines.length >= 1, 'llm.py 的生产者调用点必须被认出')
  // 变异必须在**原文**上做、再交给判据自己遮蔽:在遮蔽后的文本上插 `#` 等于把注释写给
  // 一个已经不再看注释的面 ⇒ 遮蔽层没关掉任何东西,变异臂会"永远无效"(本条第一次跑就是这样红的)。
  const mutated = callText
    .split(/\r?\n/)
    .map((l) => (__test__.isUseLine(l, svc.symbol) ? `# gate-mutation: ${l}` : l))
    .join('\n')
  assert.equal(
    __test__
      .maskNoise(mutated, { keepStrings: false, hashLineComments: true })
      .split(/\r?\n/)
      .filter((l) => __test__.isUseLine(l, svc.symbol)).length,
    0,
    '注释掉调用点后仍有"调用点" ⇒ 变异无效',
  )
})

test('T3b 变异对照:把装载点整行注释掉,同一条判据必须翻红(不只会对夹具发红)', () => {
  const findUseLine = (text, symbol) =>
    __test__
      .maskNoise(text, { keepStrings: false })
      .split(/\r?\n/)
      .findIndex((l) => __test__.isUseLine(l, symbol))

  for (const exit of __test__.MOUNT_EXITS.filter((x) => x.lane === 'ui')) {
    const lines = sidebarText.split(/\r?\n/)
    const idx = findUseLine(sidebarText, exit.symbol)
    assert.ok(idx >= 0, `真实侧栏应含 ${exit.symbol} 的调用点(否则 T3b 无变异对象)`)
    assert.ok(!lines[idx].trim().startsWith('//'), '被变异的这一行原本必须是真代码')

    // 整行注释掉(只在符号前插 /* */ 是无效变异 —— 符号仍然活着)
    const mutated = [...lines]
    mutated[idx] = `// gate-mutation: ${mutated[idx]}`
    assert.ok(
      findUseLine(mutated.join('\n'), exit.symbol) === -1,
      `${exit.symbol} 注释掉一处后仍有别处调用点 —— 判据认的是"存在任一调用点",本变异只证明该行被认成调用点`,
    )
  }
})

test('T4 登记表自洽:每条出口必须落在自己那条车道该在的面内、且含它登记的符号', () => {
  // 分道断言而不是"一律 apps/web/src/":服务侧出口就该在 ai-service 里,
  // 拿侧栏前缀去判它等于要求别人把生产者搬回 web 端(判据替人做了架构决定)。
  const LANE_PREFIX = { ui: 'apps/web/src/', service: 'apps/ai-service/' }
  for (const exit of __test__.MOUNT_EXITS) {
    const prefix = LANE_PREFIX[exit.lane]
    assert.ok(prefix, `未知车道 ${exit.lane}(新增车道必须同时给它一条真源码判据,不许复用别的车道的)`)
    assert.ok(exit.ownFile.startsWith(prefix), `登记出口 ${exit.symbol} 必须在 ${prefix}: ${exit.ownFile}`)
    assert.ok(
      readFileSync(join(REPO, exit.ownFile), 'utf8').includes(exit.symbol),
      `${exit.ownFile} 应含它登记的符号 ${exit.symbol}(否则台账指向的不是这份实现)`,
    )
  }
})

test('T5 测试面识别:夹具/用例文件不得算生产装载证据(正反成对)', () => {
  assert.equal(__test__.isTestSurface('apps/web/src/components/__tests__/x.test.tsx'), true)
  assert.equal(__test__.isTestSurface('apps/web/e2e/foo.spec.ts'), true)
  assert.equal(__test__.isTestSurface('apps/web/tests/setup.ts'), true)
  assert.equal(__test__.isTestSurface('apps/web/src/components/sidebar-chat-history.tsx'), false)
})

test('T6 两面旗同给 ⇒ exit 2(不得静默挑一个面)', () => {
  const r = spawnSync(process.execPath, [GUARD, '--staged', '--worktree'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  assert.equal(r.status, 2, `期望 exit 2,实得 ${r.status};输出:${r.stdout}${r.stderr}`)
})

test('T7 默认档必须判 HEAD 而非磁盘(正面跑一次并给出可解析结论)', () => {
  const r = spawnSync(process.execPath, [GUARD], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
  })
  // 允许 0(全绿)或 1(存量/落地前索引差),但不许 2 —— 2 是"判不出来"
  assert.notEqual(r.status, 2, `不应无法判定:${r.stdout}${r.stderr}`)
  assert.match(r.stdout, /面=HEAD blob/, '结论行必须报出被审面')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
