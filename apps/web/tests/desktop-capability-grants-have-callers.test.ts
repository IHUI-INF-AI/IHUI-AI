// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面端能力清单的两条锁(2026-10-31 立)。
 *
 * 现读风险:`apps/desktop/src-tauri/capabilities/default.json` 把整条本机命令面
 * (屏幕截取、鼠标键盘合成、剪贴板读写、本地文件读写)授给 `https://aizhs.top/*` 远端页面。
 * 桌面端是薄壳,UI 本身就跑在线上页里,所以"页面真在用的那些"不能一刀摘掉 ——
 * 但**从来没人调用的那些**留着只有坏处:线上一处 XSS 就能拿着这些通道直接操作用户机器。
 *
 * 本文件钉两件事(都是"摘掉即翻红"的形状):
 *   ① 每一条 `allow-*` 授权,必须能在客户端语料里找到至少一处字符串引用;
 *      找不到 = 这条通道是给远端页白开的 ⇒ 判红。本枚落地时摘掉 12 条
 *      (minimax 重置族 11 条 + get-admin-window-info),其中含 factory-reset /
 *      quarantine-delete 这类**破坏性**本地动作。
 *   ② 插件级 fs 的 `$APPDATA/**` 读写档必须不存在。全仓客户端代码零处 import
 *      `@tauri-apps/plugin-fs`(现读 grep 0 命中),而 %APPDATA% 里住着桌面端自己的
 *      token vault 和别的应用的数据 —— 一个 JS 都没在用的授权,却是最直接的凭据读取面。
 *
 * 反"哑闸"自证:扫描器本身要先被证明能看见东西 ——
 *   · 已知真被调用的命令名必须在语料里命中(否则扫描器是坏的,整枚会假绿);
 *   · 一个故意编出来的名字必须命中 0 次(否则扫描器恒真,判据形同虚设);
 *   · 能力文件读不到 / 枚举到 0 条 allow-* ⇒ 直接判红,不用"0 条"冒充"没有违规"。
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
// 本文件在 apps/web/tests/ ⇒ 上跳两级是 apps/web,上跳三级是仓库根(逐段核过,别按"直觉"少跳一级)
const WEB_ROOT = join(HERE, '..')
const REPO_ROOT = join(HERE, '..', '..', '..')
const CAPABILITY_PATH = join(REPO_ROOT, 'apps/desktop/src-tauri/capabilities/default.json')

/** 客户端语料:线上页 + 桌面壳自己的 JS + 全部共享包 src
 *  (共享包必须一起扫:命令名可能被某个共享屏引用,漏掉就会把"其实在用"读成"无人调用",
 *   摘错授权会直接把功能改坏。包目录按 packages/* 现数,不写死清单 —— 写死的必然漂移。) */
const PACKAGE_SRC_ROOTS = existsSync(join(REPO_ROOT, 'packages'))
  ? readdirSync(join(REPO_ROOT, 'packages'))
      .map((p) => join(REPO_ROOT, 'packages', p, 'src'))
      .filter((p) => existsSync(p))
  : []
const CORPUS_ROOTS = [
  join(WEB_ROOT, 'src'),
  join(WEB_ROOT, 'app'),
  join(REPO_ROOT, 'apps/desktop/src'),
  ...PACKAGE_SRC_ROOTS,
]

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.next' || name.startsWith('.'))
      continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) collectSourceFiles(full, out)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(full)
  }
  return out
}

const corpusFiles = CORPUS_ROOTS.flatMap((r) => collectSourceFiles(r))
const corpus = corpusFiles.map((f) => readFileSync(f, 'utf8'))

function nameReferences(commandName: string): number {
  const needles = [`'${commandName}'`, `"${commandName}"`, `\`${commandName}\``]
  return corpus.reduce((n, t) => n + (needles.some((nd) => t.includes(nd)) ? 1 : 0), 0)
}

describe('桌面端 capability 不得把无人调用的本机通道开给远端页', () => {
  it('能力文件读得到,且 remote 授权确实存在(否则本枚测的不是这次的风险面)', () => {
    expect(existsSync(CAPABILITY_PATH), `能力文件不存在: ${CAPABILITY_PATH}`).toBe(true)
    const cap = JSON.parse(readFileSync(CAPABILITY_PATH, 'utf8'))
    expect(Array.isArray(cap.remote?.urls), 'capability.remote.urls 缺失').toBe(true)
    expect(cap.remote.urls.length).toBeGreaterThan(0)
    expect(corpusFiles.length, '客户端语料为 0 ⇒ 扫描器没输入,判不了').toBeGreaterThan(200)
  })

  it('扫描器先自证:已知被调用的名字看得见,编出来的名字看不见', () => {
    // 正向对照:get_desktop_prefs 由 apps/web/src/lib/desktop-prefs-bridge.ts 实际调用
    expect(nameReferences('get_desktop_prefs')).toBeGreaterThan(0)
    // 反向对照:不存在的名字必须 0 命中,否则"恒看得见"会把本枚变成哑闸
    expect(nameReferences('definitely_not_an_ihui_command_zzz')).toBe(0)
  })

  it('每条 allow-* 都能在客户端语料里找到引用', () => {
    const cap = JSON.parse(readFileSync(CAPABILITY_PATH, 'utf8'))
    const ids: string[] = (cap.permissions as unknown[])
      .map((p) => (typeof p === 'string' ? p : (p as { identifier?: string })?.identifier))
      .filter((x): x is string => Boolean(x))
    const allowCommands = ids.filter((id) => id.startsWith('allow-'))

    // 枚举到 0 判死(§0.3):不用"没有条目"冒充"通过"
    expect(allowCommands.length, '一条 allow-* 都没枚举到 ⇒ 判据没接到输入').toBeGreaterThan(0)

    const orphans = allowCommands
      .map((id) => ({ id, cmd: id.slice('allow-'.length).replace(/-/g, '_') }))
      .filter(({ cmd }) => nameReferences(cmd) === 0)
      .map(({ id }) => id)

    expect(orphans, `远端页拿到但客户端从不调用的授权: ${orphans.join(', ')}`).toEqual([])
  })

  it('不再把 %APPDATA% 整棵树的插件级读写授权给远端页', () => {
    const cap = JSON.parse(readFileSync(CAPABILITY_PATH, 'utf8'))
    const offenders = (cap.permissions as unknown[]).filter((p) => {
      if (!p || typeof p !== 'object') return false
      const entry = p as { identifier?: string; allow?: Array<{ path?: string }> }
      const isFsReadOrWrite =
        entry.identifier === 'fs:allow-read-text-file' ||
        entry.identifier === 'fs:allow-write-text-file' ||
        entry.identifier === 'fs:allow-read-file'
      const scopesToAppdata = (entry.allow ?? []).some((a) =>
        String(a.path ?? '').startsWith('$APPDATA'),
      )
      return isFsReadOrWrite && scopesToAppdata
    })
    expect(offenders, '客户端零处 import plugin-fs,这条授权只有暴露面没有用途').toEqual([])
  })

  it('本枚摘除的 12 条留在名单外(防止被顺手加回)', () => {
    const cap = JSON.parse(readFileSync(CAPABILITY_PATH, 'utf8'))
    const ids = new Set(
      (cap.permissions as unknown[])
        .map((p) => (typeof p === 'string' ? p : (p as { identifier?: string })?.identifier))
        .filter((x): x is string => Boolean(x)),
    )
    for (const gone of [
      'allow-minimax-reset-probe',
      'allow-minimax-reset-plan',
      'allow-minimax-reset-maintenance',
      'allow-minimax-reset-logout',
      'allow-minimax-reset-factory',
      'allow-minimax-quarantine-list',
      'allow-minimax-quarantine-restore',
      'allow-minimax-quarantine-delete',
      'allow-minimax-reset-history',
      'allow-checkin-audit-minimax-residual',
      'allow-checkin-audit-workbuddy-residual',
      'allow-get-admin-window-info',
    ]) {
      expect(ids.has(gone), `${gone} 已被客户端零引用摘除,不得回到远端授权面`).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
