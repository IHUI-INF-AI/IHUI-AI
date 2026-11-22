// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ruff 提交链门的接线锁(§22c 形态锁:装车证明读 HEAD 面 runner,摘线不得被读成已装车)。
 *
 * 为什么单开一份而不是并进 check-ruff-python.test.mjs:
 *   那份镜像测试 import 本门脚本的 `__test__`(判据单源),判的是"门自己会不会判";
 *   这份判的是"门有没有被调度器装车"—— 两个面,两把尺子,混在一起就分不清红的是哪一侧。
 *
 * 为什么读 HEAD 面:注册条目写在工作树但没有提交时,`node scripts/guardian-runner.mjs`
 * 根本不会跑到它 —— 只有 HEAD 面的条目在别的会话/CI 里才是真的。
 * 先把锁写成"HEAD 面必须有",落地前它红、落地后它绿,这就是"摘掉即翻红"的阳性对照。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const GATE_REL = 'check-ruff-python.mjs'
const RUNNER_REL = 'scripts/guardian-runner.mjs'

function readHead(rel) {
  return execFileSync('git', ['show', `HEAD:${rel}`], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  })
}

/** 从 runner 源码里切出 script: '<gate>' 那条注册块(前后各 600 字节,足够覆盖 id..onFailHint)。 */
function entryBlockOf(runnerSrc, gateRel) {
  const idx = runnerSrc.indexOf(`script: '${gateRel}'`)
  if (idx < 0) return null
  return runnerSrc.slice(Math.max(0, idx - 600), idx + 600)
}

/** 一把尺子判"条目是否成套";返回逐维结论而不是抛错,好让反向对照逐条点。 */
function judgeEntry(block) {
  if (!block) return { found: false }
  return {
    found: true,
    id: /id:\s*'254'/.test(block),
    blocking: /mode:\s*'blocking'/.test(block),
    skipEnv: /skipEnv:\s*'HUSKY_SKIP_RUFF'/.test(block),
    triggers: /stagedTriggers:\s*\[/.test(block),
  }
}

test('T1 装车证明:HEAD 面 runner 登记了 ruff 门,且 id/blocking/skipEnv/stagedTriggers 四维成套', () => {
  const head = readHead(RUNNER_REL)
  const v = judgeEntry(entryBlockOf(head, GATE_REL))
  assert.ok(v.found, `${RUNNER_REL} 的 HEAD 面必须登记 ${GATE_REL},否则它只是仓库里一个没人调度的脚本`)
  assert.ok(v.id, 'id 必须是 254(与检查器里声明的号一致)')
  assert.ok(v.blocking, 'ruff 违规必须拦提交(CI 已在跑同样的检查,提交链不能更松)')
  assert.ok(v.skipEnv, 'blocking 而无 skipEnv ⇒ 出问题时没人能应急放行(§22c 形态锁)')
  assert.ok(v.triggers, '必须显式写 stagedTriggers(留空 = 提交通道任何都跑、落地通道永不复跑,两通道反义)')
})

test('T2 反向对照:同一把尺子喂"缺 skipEnv / 缺 stagedTriggers / 换了 id"的合成块必须逐条咬住', () => {
  const base = `\n  {\n    id: '254',\n    script: '${GATE_REL}',\n    args: [],\n    mode: 'blocking',\n    skipEnv: 'HUSKY_SKIP_RUFF',\n    stagedTriggers: ['apps/ai-service/'],\n  },\n`
  const pass = judgeEntry(base)
  assert.deepEqual(pass, { found: true, id: true, blocking: true, skipEnv: true, triggers: true }, '基线块四维齐备必须判过')

  const noSkip = judgeEntry(base.replace(/skipEnv: '[A-Z_]+',\n?/, ''))
  assert.equal(noSkip.skipEnv, false, '摘掉 skipEnv ⇒ 该维必须翻假(锁若对真违规无牙,它就只是装饰)')

  const noTriggers = judgeEntry(base.replace(/stagedTriggers: \[[^\]]*\],\n?/, ''))
  assert.equal(noTriggers.triggers, false, '摘掉 stagedTriggers ⇒ 该维必须翻假')

  const wrongId = judgeEntry(base.replace("id: '254'", "id: '255'"))
  assert.equal(wrongId.id, false, '换了 id ⇒ 该维必须翻假')

  const downgraded = judgeEntry(base.replace("mode: 'blocking'", "mode: 'warn'"))
  assert.equal(downgraded.blocking, false, '降成 warn ⇒ 该维必须翻假')

  assert.deepEqual(judgeEntry(null), { found: false }, '找不到条目时必须显式报 found:false,不得当成通过')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
