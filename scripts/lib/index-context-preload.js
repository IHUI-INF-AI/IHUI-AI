// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * index-context-preload.js — 由 `index-context.js#lintStagedEnv` 经 NODE_OPTIONS
 * (`--require=<本文件>`)注入 lint-staged 及其 node 任务子进程(2026-11-04 立)。
 *
 * 只做一件事:索引上下文丢失 ⇒ 当场 fail-closed。
 * 为什么必须放到子进程里:父钩子只能看到 lint-staged 的最终退出码与 stderr,而 lint-staged
 * 的 git 步骤失败会被它吞进 debugLog(gitWorkflow.js:443)。子进程这一层能在**开工瞬间**
 * 判定「我拿到的到底是不是调用方声明的那份私有索引」,不依赖事后从行为倒推。
 *
 * 判据(缺一即拒绝):
 *  ① IHUI_REQUIRE_PRIVATE_INDEX=1(本次确实处于私有索引模式);
 *  ② IHUI_EXPECTED_GIT_INDEX_FILE 在场(期望值随环境一起丢失 ⇒ 不能当作"没要求");
 *  ③ GIT_INDEX_FILE 与期望值逐字相等;
 *  ④ 该文件存在且非空。
 */
const fs = require('node:fs')

const LOST_PREFIX = '索引上下文丢失'

function lost(message) {
  process.stderr.write(`❌ ${LOST_PREFIX}:${message}(lint-staged 子进程拒绝落回共享索引)\n`)
  process.exit(1)
}

if (process.env.IHUI_REQUIRE_PRIVATE_INDEX === '1') {
  const expected = process.env.IHUI_EXPECTED_GIT_INDEX_FILE
  const actual = process.env.GIT_INDEX_FILE
  if (!expected) lost('期望的私有索引指针随环境丢失')
  if (!actual) lost(`GIT_INDEX_FILE 被清空(应为 ${expected})`)
  if (actual !== expected) lost(`GIT_INDEX_FILE=${actual} 与期望 ${expected} 不一致`)
  try {
    if (!fs.statSync(actual).isFile() || fs.statSync(actual).size === 0)
      lost(`私有索引文件为空或不是普通文件:${actual}`)
  } catch {
    lost(`私有索引文件不存在:${actual}`)
  }
}
