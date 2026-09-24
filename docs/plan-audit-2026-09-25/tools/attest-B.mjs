import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const rows = []
const rec = (label, args) => {
  let code = 0
  let tail = ''
  try {
    const o = execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, windowsHide: true, timeout: 900000 })
    tail = o.trim().split('\n').slice(-1)[0] || '(无输出)'
  } catch (e) {
    code = e.status ?? -1
    tail = (((e.stdout || '') + (e.stderr || '')).toString().trim().split('\n').slice(-2).join(' | ')) || (e.message || '').slice(0, 90)
  }
  rows.push(`${code === 0 ? 'exit 0 ' : `exit ${code}`} ${label.padEnd(38)} ${tail.slice(0, 150)}`)
  console.log(rows.at(-1))
  writeFileSync('.ihui-agent/tmp/plan-audit/attest-B.txt', rows.join('\n'), 'utf8')
}

rec('watermark verify', ['scripts/watermark.mjs', 'verify'])
rec('门 79 冲突标记 @HEAD', ['scripts/check-no-conflict-markers.mjs', '--rev', 'HEAD'])
rec('门 57 对话流元素覆盖', ['scripts/check-chat-element-coverage.mjs'])
rec('门 55 工具名覆盖', ['scripts/check-tool-name-display-coverage.mjs'])
rec('门 56 措辞可解析', ['scripts/check-tool-display-resolvable.mjs'])
rec('门 74 词表可解析', ['scripts/check-word-table-resolvable.mjs'])
rec('门 40 共享层重复', ['scripts/check-shared-layer-duplication.mjs'])
rec('门 78 workspace 依赖链接', ['scripts/check-workspace-dep-links.mjs'])
rec('门 89 接线对账', ['scripts/check-gate-wiring.mjs'])
rec('门 90 sse dispatch @HEAD', ['scripts/check-sse-dispatch-parity.mjs'])
rec('门 100 合并吞并 @origin..HEAD', ['scripts/check-merge-addition-loss.mjs'])
rec('门 71 计划登记行自检', ['scripts/check-plan-line-loss.mjs', '--self-test'])
