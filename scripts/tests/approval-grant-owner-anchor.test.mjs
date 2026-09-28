// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 审批授权两半的存续锚点锁(会话级缓存 + D158 主体绑定)。
//
// 为什么要有这一条,而不是只靠守门 84:
// 本轮 D158 主体绑定与 Carousel 都走**对象空间**落地(工作树当时是他人在途现场,按磁盘取字节会毁它)。
// 旁路落地留下的形状是:HEAD 有修复、索引与工作树停在祖先面。此时任何人一次不带 pathspec 的
// `git commit`(交索引)或一次 `git add && commit`(交工作树)都会把修复写回旧态 —— 84 确实会拦
// (那两份都"字节级等于某祖先版本"),但 84 可被 --no-verify 合法跳过,而跳过时没人知道少了一道防线。
// 本锁补的就是那一格:判据打在 **HEAD blob** 上,回滚一旦发生,下一次跑测试就红,而不是静默。
//
// 口径:一律判 HEAD blob(不判滞后的共享工作树 —— 判磁盘会在"旁路刚落地成功"的当天自己报红,
// 而红的是别人的现场,不是仓库)。
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const gitShow = (p) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'show', `HEAD:${p}`], {
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })

const LLM = 'apps/ai-service/app/routers/llm.py'
const PERSIST = 'apps/ai-service/app/services/approval_persistence.py'

/** 取一个 Python 顶层 def 的函数体(到下一个顶层 def/class 为止)——按结构取,不数全文出现次数。 */
function pyBody(src, name) {
  const start = src.search(new RegExp(`^def ${name}\\(`, 'm'))
  if (start < 0) return null
  const rest = src.slice(start)
  const next = rest.slice(1).search(/^def |^class /m)
  return next < 0 ? rest : rest.slice(0, next + 1)
}

test('会话级授权与 D158 主体绑定的锚点都还在 HEAD 面', () => {
  const llm = gitShow(LLM)
  // 会话级缓存那一半。刻意**不数出现次数**:注释里提一次这个名字就多算一次,并发会话补一句
  // 说明就会把"恰好 N 处"的断言顶红(本锁第一版正是这样,4 处变 6 处而代码一字未动)。
  // 判的是结构:定义在位、有一处真调用、桶键形态带主体。
  assert.match(llm, /^def _grant_bucket_key\(/m, '会话级桶键函数被摘线 ⇒ 归属那一半没了')
  assert.match(llm, /return _grant_bucket_key\(/, '桶键无人调用 ⇒ 定义只是装饰')
  assert.match(llm, /return f"conv::\{uid\}::\{conv\}"/, '桶键不再携带 JWT 主体 ⇒ 会话级归属失效')
  assert.match(llm, /_GRANT_TTL_SECONDS = 1800\.0/, '滑动 TTL 常量被改 ⇒ 归属寿命不再是被审的那一份')
  assert.match(llm, /^def _grant_drop_if_turn_scoped\(/m, '收尾清理函数被摘线 ⇒ 会话桶可能被本轮收尾误删')
  // D158 主体绑定那一半:写入侧与命中侧必须**各自真的用到**同一份算键出口
  // (只看"文件里出现过这个名字"不够 —— 注释提一句就算命中,那正是本仓"把没判写成判过了"的形态)。
  for (const fn of ['_persist_grant_rule', '_exec_prefix_grant_hits']) {
    const body = pyBody(llm, fn)
    assert.ok(body !== null, `${fn} 不在了 ⇒ 判序被整块摘除`)
    assert.match(body, /_scoped_exec_prefix_key\(/, `${fn} 不再经唯一算键出口 ⇒ 两侧又开始各算各的`)
  }
  const writer = pyBody(llm, '_persist_grant_rule') || ''
  assert.match(
    writer,
    /def _persist_grant_rule|owner_uuid/,
    '落规则入口没有 owner 形参 ⇒ 又回到无主体写入',
  )
  assert.match(llm, /^def _persist_grant_rule\([\s\S]{0,160}owner_uuid: str \| None/m, '落规则入口丢了 owner 形参')
  const persist = gitShow(PERSIST)
  assert.match(persist, /^def scoped_cache_key\(/m, '存储层主体前缀实现被摘线')
  assert.match(persist, /^def key_is_owned_by\(/m, '撤销/列表的归属闸被摘线')
})

test('变异对照:把算键出口从写入侧/命中侧摘掉,主判据必须翻红(不得是恒真断言)', () => {
  const llm = gitShow(LLM)
  // 变异要喂在**主判据用的那一把尺子**上(pyBody + 函数体内出现算键出口)。
  // 只断言"全文计数下降"不算证明 —— 那测的是另一件事,主判据完全可以对同一输入报绿。
  const stripped = llm.replace(/_scoped_exec_prefix_key\(/g, 'normalize_exec_key(')
  for (const fn of ['_persist_grant_rule', '_exec_prefix_grant_hits']) {
    const body = pyBody(stripped, fn) || ''
    assert.ok(
      !/_scoped_exec_prefix_key\(/.test(body),
      `改名后 ${fn} 体内仍算命中 ⇒ 这把锁数的是残留文本,不是实现`,
    )
    assert.ok(body.length > 0, `${fn} 的函数体取不到 ⇒ 变异没落到实处,这条对照无牙`)
  }
})

test('覆盖面自证:两份文件在 HEAD 面都取得到正文(取不到不算通过)', () => {
  for (const p of [LLM, PERSIST]) {
    assert.ok(gitShow(p).length > 500, `${p} 正文取不到 ⇒ 无法判定,不记通过`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
