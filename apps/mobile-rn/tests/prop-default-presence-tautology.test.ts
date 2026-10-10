// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 常驻看守:带默认值的形参不得被 `X !== undefined` 当存在性判据(判据实现在
 * `scripts/lib/default-param-tautology.mjs`,本文件只是消费者 —— 不得在此再抄一份正则,§22c)。
 *
 * 立因是实测:`apps/mobile-rn/src/components/LoginPopUp.tsx` 形参 `role = 'normal'` 而 `showProfile`
 * 的 Boolean(...) 里含 `role !== undefined` ⇒ 恒真 ⇒ 唯一调用点(`ProfileScreen.tsx:639`,只传
 * title/primary/secondary)本意要渲染的授权卡**结构上不可达**,屏幕上是一个空白资料表单。
 * 这一型没有任何编译期症状:类型层 `role: string = 'normal'` 让 `!== undefined` 永远成立,
 * typecheck / lint / 其余门全绿。
 *
 * 三态不得并桶:① 真仓 HEAD 面必须 0 命中;② 阳性对照 —— 修复前那段原文逐字喂进来必须命中,
 * 否则本测试只是"当前没东西"的空转尺子(本仓最高频失效型是"把没判写成判过了");
 * ③ 反向对照 —— `props.prompt !== undefined` 与"默认值住在另一个函数里"都不得命中,
 * 因为真仓 `BottomActionBar.tsx:229` 正是这一形而它是**正确**写法。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findDefaultParamTautologies } from '../../../scripts/lib/default-param-tautology.mjs' // arch-exempt: 判据只许有一份实现(§22c,两处算同一件事必漂移),本测试是它的消费者而不是第二份抄本;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

const FACES = ['apps/mobile-rn/src', 'packages/app/src', 'apps/miniapp-taro/src']
// 被审路径是**仓库相对**的,而 vitest 的 cwd 是包根(apps/mobile-rn)—— 不显式定根会让
// `git grep` 直接失败,而本测试把"失败"照实抛错而不是记绿(第一版就是这么暴露的)。
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

function git(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    cwd: ROOT,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

describe('默认值形参的存在性判据恒真', () => {
  // 超时预算 60s(默认 10s):本用例先 git grep 预筛再逐文件 git show 全仓 blob,高负载的
  // vitest 全量跑下实读 16.2s 会被 10s 掐掉而假红(2026-10-10 实测,单跑 4/4 绿)——它是
  // 环境性 flaky 不是反模式命中,预算给足让"真命中"与"超时假红"不再同形。
  it('真仓 HEAD 面:0 命中(命中即说明有人把默认值当"传没传")', () => {
    // 先用 git grep 预筛(判据字面量的严格超集),再逐文件跑判据 —— 全量读三千个 blob 会让
    // 本测试在每次 vitest 跑里成为最长的尾巴,而预筛漏一形的代价由下面两条用例兜住。
    let candidates = []
    try {
      candidates = git(['grep', '-l', '-e', '!== undefined', 'HEAD', '--', ...FACES])
        .split('\n')
        .filter(Boolean)
        .map((l) => l.replace(/^HEAD:/, ''))
        .filter((p) => /\.(tsx|ts)$/.test(p))
    } catch (e) {
      throw new Error(`无法枚举被审面(git grep 失败)⇒ 不得记为通过:${String(e).slice(0, 160)}`)
    }
    expect(candidates.length, '预筛到 0 个候选 = 尺子看不见这一族,不是"仓库干净"').toBeGreaterThan(0)
    const hits = []
    for (const p of candidates) {
      let src
      try {
        src = git(['show', `HEAD:${p}`])
      } catch {
        continue // 刚被删除的路径:不在被审面内容里,跳过而不是判失败
      }
      for (const h of findDefaultParamTautologies(src)) hits.push(`${p}:${h.line} ${h.snippet}`)
    }
    expect(hits, `恒真存在性判据 ${hits.length} 处:\n${hits.join('\n')}`).toEqual([])
  }, 60_000)

  it('阳性对照:修复前那段原文逐字喂进来必须命中(否则本测试是空转尺子)', () => {
    const before = [
      'export function LoginPopUp({',
      "  role = 'normal',",
      '}: Props) {',
      '  const showProfile = Boolean(',
      '    onSave ||',
      '    avatarUrl !== undefined ||',
      '    nickname !== undefined ||',
      '    role !== undefined ||',
      '    phone !== undefined,',
      '  )',
      '  return null',
      '}',
    ].join('\n')
    const hits = findDefaultParamTautologies(before)
    expect(hits.map((h) => h.name)).toEqual(['role'])
  })

  it('反向对照 A:props.prompt !== undefined 不判(默认值在别的函数里,问的不是同一件事)', () => {
    const ok = [
      'export function BottomActionBar(props: P) {',
      '  if (props.prompt !== undefined) {',
      '    return null',
      '  }',
      '  return null',
      '}',
      '',
      'function ChatInputBar({',
      "  prompt = '',",
      '}: P2) {',
      '  return null',
      '}',
    ].join('\n')
    expect(findDefaultParamTautologies(ok)).toEqual([])
  })

  it('反向对照 B:注释与字符串里的该形态不得计入(判据看代码面)', () => {
    const prose = [
      'function C({',
      "  role = 'normal',",
      '}: P) {',
      '  // 旧写法 role !== undefined 是恒真的,已删',
      "  const note = 'role !== undefined'",
      '  return null',
      '}',
    ].join('\n')
    expect(findDefaultParamTautologies(prose)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
