// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D159(2026-09-30 立):审批帧"逐请求事实"的**到端通路**源码锁。
 *
 * 为什么这一族判据住在 node 测试而不是端内用例:web 的 vitest 档案里 `import.meta.url`
 * 拿不到值(实测 ①②③ 三条都 ENOENT 到 `.../__tests__/undefined`),而"读别的包源码"
 * 本来就不该依赖端内运行时。api-client 那侧的行为用例见
 * `packages/api-client/tests/tool-approval-env-projection-d159.test.ts`(8 例,RC=0)。
 *
 * 立因(不是假想):上面 15 条组件用例把视图测全了,而生产链路的解析面把三个字段整块
 * 丢掉 ⇒ 屏幕上永远"字段缺席 = 整块不渲染",那 15 例一路绿。视图正确 ≠ 通道接通,
 * 这是本仓最高频的失效型("造好没装车",守门 64/70/81/115/138 同族)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

test('D159-W1 解析面必须把环境事实递进 tool-approval 回调', () => {
  const src = read('packages/api-client/src/client.ts')
  assert.match(
    src,
    /\.\.\.projectToolApprovalEnvFacts\(json\)/,
    'api-client 的 tryParseToolApproval 不再投影 ⇒ 弹窗那一块结构上永远收不到字段',
  )
})

test('D159-W2 桥必须逐字段转发三个键(少一个就是那一维到端不亮)', () => {
  const src = read('apps/web/src/hooks/use-chat/send-message.ts')
  for (const key of ['execEnvironment', 'networkTarget', 'blockedNetworkTargets']) {
    assert.match(
      src,
      new RegExp(`\\{\\s*${key}: event\\.${key}`),
      `桥缺 ${key} 的转发(视图有分支也没人喂它)`,
    )
  }
})

test('D159-W3 agent 任务流解析面复用同一份投影,不得各写一半判据', () => {
  const src = read('packages/shared/src/sse/agent-events.ts')
  assert.match(
    src,
    /\.\.\.projectToolApprovalEnvFacts\(p\)/,
    '两条通道各自判一遍"哪些字段算环境事实"必然漂开(AGENTS:两处算同一件事必漂移)',
  )
})

test('D159-W4 投影判据只许一份实现,且必须经包入口递出(守门 98/149 的那一半)', () => {
  const client = read('packages/api-client/src/client.ts')
  const decls = client.match(/export function projectToolApprovalEnvFacts/g) || []
  assert.equal(decls.length, 1, `投影出口被复制成 ${decls.length} 份 ⇒ 两处判据必漂移`)
  const index = read('packages/api-client/src/index.ts')
  assert.match(
    index,
    /export \{ projectToolApprovalEnvFacts \} from '\.\/client\.js'/,
    '入口是显式命名清单,漏列则跨包 import 拿到 undefined(而 web 构建吞掉 TS2724)',
  )
})

test('D159-W5 反向对照:三处通路被摘掉任意一处,本文件必须有对应用例翻红', () => {
  // 这一条不真改文件(共享工作区不得动别人在飞的源码),它锁的是**判据形状**:
  // W1/W2/W3 各自只依赖一处文本,所以任何一处被摘线只会红它自己那一条,不会连带。
  const pairs = [
    ['packages/api-client/src/client.ts', /\.\.\.projectToolApprovalEnvFacts\(json\)/],
    ['apps/web/src/hooks/use-chat/send-message.ts', /\{ execEnvironment: event\.execEnvironment/],
    ['packages/shared/src/sse/agent-events.ts', /\.\.\.projectToolApprovalEnvFacts\(p\)/],
  ]
  for (const [rel, re] of pairs) {
    const hit = re.test(read(rel))
    assert.equal(hit, true, `${rel} 的通路判据当前不成立 ⇒ 本文件的正向用例是恒红而非有牙`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
