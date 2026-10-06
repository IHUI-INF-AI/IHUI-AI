// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D55/G-66 取证用例:miniapp-taro 运行时权限决策徽章**不得**直显英文枚举。
//
// 本端能测到哪一层、为什么止步于此:
//  - **取词层(完整)**:按端运行时的同一套语义构造合并视图 ——
//    `translate(mergeMessages(shared, miniapp-taro), key, { fallback: zhCN })`,即
//    `src/i18n/index.tsx` 里 Provider 的那一行(见下方「端接线证据」),词值全部来自
//    `packages/i18n/messages/*` 的**真实词包**,测试内不写任何字面词映射。
//  - **调用点层(完整)**:直接对 `src/components/AgentRuntimePanel.tsx` 的源码文本做结构断言,
//    实现退化为 `{permission.decision}` 或丢掉 `stepDecision.` 命名空间都会红。
//  - **渲染层(本端做不到,非偷懒)**:该端 vitest 是 `environment: 'node'`,端内没有 jsdom /
//    @testing-library 依赖;且组件与 `@/i18n` 都会连带 import `@tarojs/components` /
//    `@tarojs/taro` → `@tarojs/runtime`,后者在 node 下直接
//    `ReferenceError: ENABLE_INNER_HTML is not defined`(那是 Taro 构建期 define,测试环境没有)。
//    所以这里用「取词 + 调用点」两层把同一个缺陷钉住,不假称渲染级已验。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { mergeMessages, translate } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'
import { permissionDecisionWord, STEP_DECISIONS } from '@ihui/shared/chat'
import { describe, expect, it } from 'vitest'

const MESSAGES_DIR = join(__dirname, '../../../../../packages/i18n/messages')
const readPack = (dir: string, locale: string): Messages =>
  JSON.parse(readFileSync(join(MESSAGES_DIR, dir, `${locale}.json`), 'utf8')) as Messages

/** 复刻端内 Provider 的取词:merged 视图 + zh-CN 兜底 + 调用点注入的 stepDecision 命名空间 */
function makeT(locale: string): (key: string) => string {
  const merged = mergeMessages(readPack('shared', locale), readPack('miniapp-taro', locale))
  const zhCN = mergeMessages(readPack('shared', 'zh-CN'), readPack('miniapp-taro', 'zh-CN'))
  return (key) => translate(merged, key, { fallback: zhCN })
}

/** 端内调用点的取词闭包形态:t(`stepDecision.${k}`) */
function wordFor(decision: unknown, locale = 'zh-CN'): string {
  const t = makeT(locale)
  return permissionDecisionWord(decision, (k) => t(`stepDecision.${k}`))
}

describe('权限决策徽章取词(miniapp-taro 合并视图)', () => {
  it('zh-CN:权限矩阵 allow/ask/deny 出中文态词,绝不回显键名/原始码', () => {
    expect(wordFor('deny')).toBe('已拒绝')
    expect(wordFor('allow')).toBe('已放行')
    expect(wordFor('ask')).toBe('需确认')
    for (const value of ['allow', 'ask', 'deny'] as const) {
      const word = wordFor(value)
      expect(word).not.toBe(value)
      expect(word).not.toContain('stepDecision.')
      expect(word).not.toContain('perm.')
    }
  })

  it('zh-CN:15 值步骤决策集全部本地化(auto_skip_approval → 自动批准(免审批))', () => {
    expect(wordFor('auto_skip_approval')).toBe('自动批准(免审批)')
    for (const value of STEP_DECISIONS) {
      const word = wordFor(value)
      expect(word).not.toBe(value)
      expect(word).not.toContain('stepDecision.')
      expect(word.trim().length).toBeGreaterThan(0)
    }
  })

  it('未知取值 maybe_allow:原样显示,绝不猜成「已放行」', () => {
    expect(wordFor('maybe_allow')).toBe('maybe_allow')
    expect(wordFor('maybe_allow')).not.toBe('已放行')
    expect(wordFor('maybe_allow')).not.toContain('stepDecision.')
  })

  it('en 视图同样可达(证明取词打的是真实词包,不是中文硬编码)', () => {
    const zh = wordFor('deny', 'zh-CN')
    const en = wordFor('deny', 'en')
    expect(en.length).toBeGreaterThan(0)
    expect(en).not.toBe('deny')
    expect(en).not.toBe(zh)
    expect(wordFor('auto_skip_approval', 'en')).not.toContain('stepDecision.')
  })

  it('缺键形态:词包整体缺 stepDecision 时界面就会回显键名(正式用例据此拦红)', () => {
    const stripped = mergeMessages(
      { ...(readPack('shared', 'zh-CN') as Record<string, unknown>) } as Messages,
      readPack('miniapp-taro', 'zh-CN'),
    ) as Messages
    delete (stripped as Record<string, unknown>).stepDecision
    const echoT = (key: string) => translate(stripped, key, {})
    // 端内调用点的闭包是 t(`stepDecision.${k}`):缺键时喷到界面上就是这条字符串
    expect(permissionDecisionWord('deny', (k) => echoT(`stepDecision.${k}`))).toBe(
      'stepDecision.perm.deny',
    )
    // 共享层自身的防线:拿到"原样回显自己 key"的 t 时必须退回原始码,绝不喷 `perm.deny`
    expect(permissionDecisionWord('deny', (k) => k)).toBe('deny')
  })
})

describe('权限决策徽章端接线证据(miniapp-taro 源码)', () => {
  const panel = readFileSync(join(__dirname, '../AgentRuntimePanel.tsx'), 'utf8')
  const i18nEntry = readFileSync(join(__dirname, '../../i18n/index.tsx'), 'utf8')
  const oneLine = (src: string): string => src.replace(/\s+/g, ' ')
  /**
   * 排版无关的比较:去掉换行缩进与 prettier 的尾逗号,只留实参顺序与身份。
   * 逐字含空格断言会在任何人跑一次格式化时红 —— 那与正确性无关(实测本仓 prettier 会折行并补 `,`)。
   */
  const stripFormat = (src: string): string =>
    src.replace(/,*(\s*[)\]])/g, '$1').replace(/\s+/g, '')

  /**
   * 这条判据要钉的是**调用形状**,不是第一个实参叫什么名字。
   * `t(key, params)` 根本没有 locale 形参 —— 当前语言由 I18nProvider 同步到模块级
   * `currentLocale`(见 index.tsx 里那段注释)。上一版把标识符逐字写成 `locale`,于是
   * 2026-10-06 那次"离线语言包改按需拉取"(枚 6e9a5555e8)把 t() 改成读 `currentLocale`
   * (语义一字未变)时,这条断言判红,而它红在**已入库**面上 ⇒ 全队唯一 required 门被一次
   * 排版级重构堵住。假红的代价从来不是"多一行红",是所有人的交付。
   * 放宽的只有"标识符是谁";`fallback: zhCNMessages` 与 `params` 两档一档不松,
   * 并由下面那两条构造面成对自证(摘掉 fallback 必读红,换标识符不得读红)。
   */
  const T_CALL_SHAPE =
    /translate\(getMessages\([A-Za-z_$][\w$]*\),key,\{fallback:zhCNMessages,params\}\)/

  it('组件从 @ihui/shared 引 permissionDecisionWord,并以 stepDecision 命名空间取词', () => {
    expect(/import\s*{[^}]*permissionDecisionWord[^}]*}\s*from\s*'@ihui\/shared'/.test(panel)).toBe(
      true,
    )
    expect(oneLine(panel)).toContain(
      'permissionDecisionWord(permission.decision, (k) => t(`stepDecision.${k}`))',
    )
  })

  it('徽章位不得直显原始枚举值 {permission.decision}', () => {
    expect(oneLine(panel)).not.toMatch(/\{\s*permission\.decision\s*\}/)
  })

  it('端 i18n 必须以 shared 为 base 做深合并(否则上面的合并视图与运行时不一致)', () => {
    expect(i18nEntry).toContain('@ihui/i18n/messages/shared/zh-CN.json')
    // 比的是**实参顺序与身份**,不是排版:prettier 把超过 80 列的调用折成多行并补尾逗号,
    // 逐字含空格的断言会在任何人跑一次格式化的时候变红(与正确性无关的假红)。
    expect(stripFormat(i18nEntry)).toContain(
      stripFormat('mergeMessages(sharedZhCN as Messages, miniappZhCN as Messages)'),
    )
    expect(stripFormat(i18nEntry)).toMatch(T_CALL_SHAPE)
    // 成对自证(变异对照,不靠人记得去改源码):同一形状只换标识符 ⇒ 必须仍匹配;
    // 少了 `fallback: zhCNMessages` 那一档 ⇒ 必须不匹配。两条同时成立才叫"放宽的是标识符,
    // 不是判据本身"。cond 一律是已求值布尔,不得把箭头函数当条件传(§守门速查那条恒绿断言同型)。
    expect(
      T_CALL_SHAPE.test(
        stripFormat(
          'function t(k){ return translate(getMessages(anyName), key, { fallback: zhCNMessages, params }) }',
        ),
      ),
    ).toBe(true)
    expect(
      T_CALL_SHAPE.test(
        stripFormat(
          'function t(k){ return translate(getMessages(currentLocale), key, { params }) }',
        ),
      ),
    ).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
