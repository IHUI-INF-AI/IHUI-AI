// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面安装器双门禁「已接入 pre-commit」回归自检。
// 跑法:node --test scripts/tests/installer-gates-wiring.test.mjs
//
// 为什么需要:check-installer-assets.mjs 与 desktop-nsis-template.mjs --check 两道判据
//   自写下后只被手动跑过(在 guardian-runner / .husky / .github 零命中),等于「记得跑才有
//   保护」。2026-09-22 把它们正式挂进 pre-commit。本用例锁住两件事:
//   ① 注册表里这两项确实存在且是 blocking + 有条件触发 + 有应急变量与修复提示(防被误删/降级);
//   ② 判据本身仍能拦住「引用了位图却没登记 File 打包行」这一静默失败(用注入位图副本实测,
//      不写任何被 git 跟踪的文件)。
// 注:断言只读注册表源码文本,不复制 runner 的匹配逻辑(§22c 禁镜像实现)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUNNER_SRC = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const NSI_REL = 'apps/desktop/src-tauri/windows/ihui-ui.nsi'

/** 抠出注册表里指定 id 的对象字面量文本(id 行 → 最近的 `\n  },`)。 */
function itemBlock(id) {
  const start = RUNNER_SRC.indexOf(`id: '${id}',`)
  assert.notEqual(start, -1, `注册表缺少 id ${id}`)
  const end = RUNNER_SRC.indexOf('\n  },', start)
  assert.notEqual(end, -1, `id ${id} 的对象字面量未正常闭合`)
  return RUNNER_SRC.slice(start, end)
}

/** 取 stagedTriggers 数组里的路径前缀字符串。 */
function stagedTriggersOf(block) {
  const m = block.match(/stagedTriggers:\s*\[([\s\S]*?)\]/)
  assert.ok(m, '该项必须声明 stagedTriggers(只在安装器相关文件进暂存区时才跑)')
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

test('id 61 已注册为 blocking,并带条件触发 / 应急变量 / 修复提示', () => {
  const block = itemBlock('61')
  assert.match(block, /script:\s*'check-installer-assets\.mjs'/)
  assert.match(block, /mode:\s*'blocking'/)
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_INSTALLER_ASSETS_GUARD'/)
  assert.match(block, /onFailHint:/)
  assert.match(block, /IHUI_EXTRACTPAGESETS_SET/, '修复提示必须指向补 File 行的位置')
  assert.match(block, /desktop-installer-assets\.mjs/, '修复提示必须指向 5 档资产重新导出')
  assert.deepEqual(stagedTriggersOf(block), [
    'apps/desktop/src-tauri/windows/',
    'scripts/desktop-installer-assets.mjs',
  ])
})

test('id 62 已注册为 blocking,触发含模板脚本与侧车补丁 JSON', () => {
  const block = itemBlock('62')
  assert.match(block, /script:\s*'desktop-nsis-template\.mjs'/)
  assert.match(block, /args:\s*\['--check'\]/, '必须以 --check 形态挂载')
  assert.match(block, /mode:\s*'blocking'/)
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_NSIS_TEMPLATE_GUARD'/)
  assert.match(block, /onFailHint:/)
  assert.match(block, /--emit-patches/, '修复提示①:直接手改要重跑登记')
  assert.deepEqual(stagedTriggersOf(block), [
    'apps/desktop/src-tauri/windows/installer.nsi',
    'scripts/desktop-nsis-template.mjs',
    'scripts/desktop-nsis-ihui-patches.json',
  ])
})

test('runner 执行循环确实消费 stagedTriggers(声明未生效=假绿)', () => {
  assert.match(RUNNER_SRC, /function stagedPathsTouch\(/)
  assert.match(RUNNER_SRC, /check\.stagedTriggers && passStaged && !stagedPathsTouch/)
})

test('注册表 id 全局唯一(防 61/62 与后续条目撞号)', () => {
  const ids = [...RUNNER_SRC.matchAll(/^\s{4}id: '([^']+)',$/gm)].map((m) => m[1])
  assert.ok(ids.length >= 90, `解析到 ${ids.length} 项,数量异常(解析口径可能已漂移)`)
  assert.equal(
    new Set(ids).size,
    ids.length,
    `存在重复 id:${ids.filter((x, i) => ids.indexOf(x) !== i)}`,
  )
})

test('注入违规实测:删掉 File 打包行 → 门禁必须 exit 1(临时副本,不碰仓库文件)', () => {
  const src = readFileSync(join(ROOT, NSI_REL), 'utf8')
  const lines = src.split('\n')
  const packedRe = /File\s+"\/oname=\$PLUGINSDIR\\([\w.-]+\.bmp)"/
  // 只做取样(挑出所有打包行),判定完全交给被测脚本:逐个删一行,直到某次被判红。
  // 逐个试是因为 refs 只统计真正被加载的位图(splash.bmp 由 AdvSplash 以别的写法引用,
  // 删它的 File 行不构成"引用未打包"),只要存在一条删了不拦的位图 = 判据失效。
  const candidates = [...src.matchAll(new RegExp(packedRe.source, 'g'))].map((m) => m[1])
  assert.ok(candidates.length > 0, `${NSI_REL} 解析不到 File 打包行,取样失败`)
  const dir = mkdtempSync(join(tmpdir(), 'ihui-installer-gate-'))
  try {
    let blocked = null
    for (const name of candidates) {
      const dropAt = lines.findIndex((l) => packedRe.test(l) && l.includes(name))
      if (dropAt < 0) continue
      const fixture = join(dir, 'ihui-ui.injected.nsi')
      writeFileSync(
        fixture,
        [...lines.slice(0, dropAt), ...lines.slice(dropAt + 1)].join('\n'),
        'utf8',
      )
      let out = ''
      let code = 0
      try {
        out = execFileSync(
          process.execPath,
          [join(ROOT, 'scripts', 'check-installer-assets.mjs')],
          {
            cwd: ROOT,
            encoding: 'utf8',
            env: { ...process.env, IHUI_NSI_PATH: fixture },
            windowsHide: true,
          },
        )
      } catch (e) {
        code = e.status
        out = `${e.stdout ?? ''}${e.stderr ?? ''}`
      }
      if (code !== 0) {
        blocked = { name, out }
        break
      }
    }
    assert.ok(
      blocked,
      `删掉 ${candidates.length} 条 File 打包行里的任意一条,门禁全部 exit 0 → 判据已失效`,
    )
    assert.match(blocked.out, /引用了但未打包/)
    assert.match(blocked.out, new RegExp(blocked.name.replace('.', '\\.')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('当前仓库状态两项门禁均绿(接入不得引入既存红)', () => {
  const run = (args, env) =>
    execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env, windowsHide: true })
  const gate61 = run([join(ROOT, 'scripts', 'check-installer-assets.mjs')], process.env)
  assert.match(gate61, /PASS —— 引用\/打包\/落盘三方一致/)
  // 无 @tauri-apps/cli 原生模块的环境里 --check 会打印「跳过校验」并 exit 0(既有宽松兜底),
  // 两种结局都算绿 —— 本用例只保证"不假红",不保证 CI 上真比对。
  const gate62 = run([join(ROOT, 'scripts', 'desktop-nsis-template.mjs'), '--check'], process.env)
  assert.match(gate62, /OK:仓库模板|跳过校验/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
