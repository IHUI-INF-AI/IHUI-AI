// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语言包「面(face)」取面实现的回归钉(2026-10-05 立)。
 * 跑法:node --test scripts/tests/i18n-message-faces.test.mjs
 *
 * 钉的是 2026-10-05 实测抓到的那一型缺陷:
 *   扫描器 scan-i18n-zh-residue.mjs 与修复器 fix-zh-tw-residue.mjs 是同一件事的两头
 *   (一个判、一个修),却各带一份面清单与路径拼法。扫描器 2026-07-25 随 i18n 单一来源
 *   迁到 packages/i18n/messages/<face>/,修复器仍指 apps/web/messages/ 等迁移前旧址
 *   ⇒ --target=web/extension/miniapp-taro 三条全部命中"跳过(不存在)",末行却打
 *   "总计: 0 个文件, 0 行改动",与"无残留"同形。后果:zh-TW 简体残留在 api(5 处)与
 *   miniapp-taro(2 处)两面躺了三个月无人发现,而正牌修复出口静默失效。
 *
 * 四条断言各自咬住一个失效面,全部靠**真跑**取证,不是源码形状锁:
 *   T1 面清单与路径拼法只有一个出处,七面同构,且与磁盘上的语言包目录逐一同名;
 *   T2 修复器遇缺失目标必须判"未判定"(exit 2),不得再打印"0 个文件, 0 行改动"放行;
 *   T3 未知面两边都报错退出,不得静默回落成默认面;
 *   T4 扫描器按面取到的正是该面语言包(落到 web 会打出 "web/zh-TW.json")。
 *   —— T2 是变异敏感点:把缺失分支退回旧写法 `continue`,空目录下 RC=0,T2 立刻翻红。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(HERE, '../..')
const FIXER = join(ROOT, 'scripts/fix-zh-tw-residue.mjs')
const SCANNER = join(ROOT, 'scripts/scan-i18n-zh-residue.mjs')

/**
 * 跑一枚脚本,返回 {code, out}。
 * 子进程一律 windowsHide + stdio 三件套(§26:不吃 stdin 的子进程不给 stdio 会撞 EBUSY)。
 */
function run(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

test('T1 面清单与路径拼法只有一个出处,七面同构', async () => {
  const { I18N_MESSAGE_FACES, faceMessageRelPath, isKnownFace } = await import(
    '../lib/i18n-message-faces.mjs'
  )
  assert.deepEqual(I18N_MESSAGE_FACES, [
    'web',
    'extension',
    'shared',
    'api',
    'cli',
    'miniapp-taro',
    'mobile-rn',
  ])
  // 七面同构:web 不再有单独分支(特例分支正是两头漂开的成因)
  assert.equal(faceMessageRelPath('web', 'zh-TW'), 'packages/i18n/messages/web/zh-TW.json')
  assert.equal(
    faceMessageRelPath('miniapp-taro', 'zh-TW'),
    'packages/i18n/messages/miniapp-taro/zh-TW.json',
  )
  assert.equal(isKnownFace('nope'), false)
  // 面清单是**封闭**集合:新增语言包目录必须同时改 lib,不得靠"看起来无害"口头豁免
  const dirs = readdirSync(join(ROOT, 'packages/i18n/messages'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  assert.deepEqual(dirs, [...I18N_MESSAGE_FACES].sort())
})

test('T2 修复器遇缺失目标判“未判定”(exit 2),不打印“0 个文件, 0 行改动”放行', () => {
  // 空目录里七个面全部不存在 —— 这正是修复器旧址漂移时的真实形态。
  const empty = mkScratch('i18n-faces-probe-')
  try {
    const r = run(FIXER, ['--target=all'], empty)
    assert.equal(r.code, 2, `期望 exit 2(未判定),实得 ${r.code};输出:${r.out}`)
    assert.ok(r.out.includes('未判定'), `输出缺“未判定”判定语:${r.out}`)
    // 旧写法的外衣:跳过 + 计 0,与“无残留”同形 ⇒ 连这句一起钉死
    assert.ok(!r.out.includes('跳过(不存在)'), `又回到静默跳过:${r.out}`)
    assert.ok(
      !/总计: 0 个文件, 0 行改动\s*$/.test(r.out.trimEnd()),
      `末行仍是“0 个文件, 0 行改动”的放行形态:${r.out}`,
    )
  } finally {
    rmScratch(empty)
  }
})

test('T3 未知面两边都报错退出,不得静默回落成默认面', () => {
  const s = run(SCANNER, ['zh-TW', '--target=nope'], ROOT)
  assert.equal(s.code, 2)
  assert.ok(s.out.includes('未知 --target=nope'), s.out)
  const f = run(FIXER, ['--target=nope'], ROOT)
  assert.equal(f.code, 2)
  assert.ok(f.out.includes('未知 --target=nope'), f.out)
})

test('T4 扫描器按面取到的正是该面语言包,不静默落到 web', () => {
  // 取面错误的可见后果:对着别的文件报“无残留”。
  // 这里逐面真跑,并要求面标签与本轮请求的 target 逐字一致。
  for (const face of ['api', 'cli', 'miniapp-taro', 'mobile-rn']) {
    const r = run(SCANNER, ['zh-TW', `--target=${face}`], ROOT)
    assert.equal(r.code, 0, `${face} 面现读非绿:${r.out}`)
    assert.ok(r.out.includes(`${face}/zh-TW.json`), `${face} 面未取到本面:${r.out}`)
    assert.ok(!r.out.includes('web/zh-TW.json'), `${face} 面被静默落到 web:${r.out}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
