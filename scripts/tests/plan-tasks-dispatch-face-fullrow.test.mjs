// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks-dispatch-face-fullrow.test.mjs —— 派单面必须**整行**输出(2026-11-03 立,§22c)。
 *
 * 立因(实测,7 枚 `dispatch-settled:no-progress`):同一张票被独立派发 7 次,会话 exit 0 但零产物、
 * 票行逐字未变。根因 = `listRows` 用 `clip(r.raw, 96)` 把票面截成半句(行首 `- [ ] ` 6 字符 + 90 字符),
 * 而 `auto-evolve` 的 `parseTicketRows` 把这份出单面**原样**当票面文本喂给派发 prompt ⇒ 验收面只剩半句。
 * 所以牙不在"输出里有几个字",而在**逐字节整行**:夹具的 LONG_ROW 逐字取 HEAD 版 B53 原行(420 字符),
 * 尾注「不另立票(避免同形态副本翻倍)〕」正是被 96 字窗口斩在「并」字之后的那一段。
 *
 * 判据口径:生产链路真 CLI(`--root` 夹具仓)+ 消费者 `parseTicketRows` 只 import 不重写,
 * 并断言"出单面切片里的行 == 消费端拿到的文本 == 夹具原行",三份同源。
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { parseTicketRows } from '../auto-evolve.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const CLI = path.join(ROOT, 'scripts', 'plan-tasks.mjs')

// 逐字取自 HEAD 版 PROJECT_PLAN.md 的 B53 行(420 字符):末尾的「不另立票」是被 96 字裁剪切掉的那段。
const LONG_ROW =
  '- [ ] B53 [deploy-feedback] [deploy_outcome/alert_firing] rollback /deploy/rollback 部署异常 ⇒ 排查链路并修复（登记@2026-10-31/deploy-feedback;来源:deploy_outcome;证据:dims=web+llm action=rollback 窗口=1440min count=1 first=2026-10-31T05:58:08.165Z last=2026-10-31T05:58:08.165Z route=/deploy/rollback sample="deploy_outcome action=rollback sha=[hex:40] dim…"） 〔同签名 rollback 告警已于 2026-11-02 由 B69 重新登记;本行为 2026-10-31 首次登记留档,不另立票(避免同形态副本翻倍)〕'
const SHORT_ROW = '- [ ] G-902 **短票行原样输出** 短正文,不受影响'
const LONG_TAIL = '不另立票(避免同形态副本翻倍)〕'

function withRepo(fn) {
  const dir = mkScratch('plan-fullrow')
  const git = (...args) =>
    spawnSync(
      gitBinary(),
      ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...args],
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 120000 },
    )
  const run = (args) =>
    spawnSync(process.execPath, [CLI, '--root', dir, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
  const put = (body) => writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), body, 'utf8')
  try {
    git('init', '-q', '-b', 'main')
    put(['# 计划', '### P0', LONG_ROW, SHORT_ROW].join('\n') + '\n')
    git('add', '-A', '--', 'PROJECT_PLAN.md')
    git('commit', '-qm', 'base')
    fn({ dir, run })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('长票行(B53 逐字,420 字)在派单面上必须整行输出:尾注「不另立票」不得丢', () => {
  withRepo(({ run }) => {
    const r = run(['--open', '--dispatchable'])
    assert.equal(r.status, 0, `CLI 不该红:${r.stdout}\n${r.stderr}`)
    // 区段切片:只看出单清单那一段(汇总头注里也有行号与数字,混进来会把头注当票)
    const face = r.stdout.slice(r.stdout.lastIndexOf('判定面'))
    const longLine = face.split(/\r?\n/).find((l) => l.includes('B53'))
    assert.ok(longLine, `派单面切片里没有长票行:B53。实得:\n${face.slice(0, 400)}`)
    // 逐字节:行首形状不变,正文整行不裁剪
    assert.equal(longLine, `  L3  ${LONG_ROW}`, '长票行必须逐字节整行输出(96 字裁剪会把验收面斩成半句)')
    assert.ok(longLine.endsWith(LONG_TAIL), `尾注必须完整保留,实得结尾「${longLine.slice(-30)}」`)
    assert.ok(LONG_ROW.length > 200, `夹具本身必须长于 200 字,实得 ${LONG_ROW.length}`)
    assert.ok(!longLine.endsWith('…'), '裁剪形态(省略号/半句)不得回潮')
  })
})

test('短票行不受影响:行首 `  L<n>  ` + 整行,逐字节与夹具一致', () => {
  withRepo(({ run }) => {
    const r = run(['--open', '--dispatchable'])
    const face = r.stdout.slice(r.stdout.lastIndexOf('判定面'))
    const shortLine = face.split(/\r?\n/).find((l) => l.includes('G-902'))
    assert.ok(shortLine, `派单面切片里没有短票行:G-902。实得:\n${face.slice(0, 400)}`)
    assert.equal(shortLine, `  L4  ${SHORT_ROW}`)
    assert.ok(SHORT_ROW.length < 96, '短行必须落在旧的 96 字窗口内,作为"短票行不受影响"的对照')
  })
})

test('消费者同源:parseTicketRows 拿到的票面文本 == 出单面整行剥掉 `- [ ] ` == 夹具原行', () => {
  withRepo(({ run }) => {
    const out = run(['--open', '--dispatchable']).stdout
    const rows = parseTicketRows(out)
    const long = rows.find((x) => x.text.startsWith('B53'))
    assert.ok(long, `parseTicketRows 没拿到 B53 ⇒ 派发 prompt 拿不到票面。实得 ${rows.length} 行`)
    // parseTicketRows 的契约就是「`  L<n>  ` + 原行」剥掉 `- [ ] ` 与首尾空白 ⇒ 两侧必须逐字同源
    assert.equal(long.text, LONG_ROW.slice('- [ ] '.length))
    assert.ok(long.text.endsWith(LONG_TAIL), '消费端必须看到尾注(截断会在 96 字处把验收面斩断)')
    assert.ok(long.text.length > 96, `消费端文本必须长于旧的 96 字窗口,实得 ${long.text.length}`)
    const short = rows.find((x) => x.text.startsWith('G-902'))
    assert.equal(short.text, SHORT_ROW.slice('- [ ] '.length))
  })
})
