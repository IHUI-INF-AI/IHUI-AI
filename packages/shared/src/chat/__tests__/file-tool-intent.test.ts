// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D113 配套:文件族「意图→工具集」策略的行为锁与单一源锁(2026-09-27 立,票⑲)。
 *
 * 为什么要有这一份:策略从 `apps/web/src/hooks/use-chat/tool-config.ts` 搬到共享层之后,
 * "两端同值"这件事只剩散文在承诺。散文会漂 —— 本仓最贵的失效型就是"看起来有、其实没装车",
 * 而这张表决定的是"哪些话术让模型拿到写类工具",分叉不体现在报错上,只体现在
 * "同一句话在扩展能改文件、在 web 不能"。所以判据必须落在被审文件上,而不是落在这段注释里。
 *
 * 两组锁:① 行为对子(读意图/写意图/无文件上下文/空串各一对正反);
 *        ② 单一源(消费方指向本子路径、任何端内不得再写关键词正则、
 *           且本模块**故意不进 `./chat` barrel** —— 与 task-status.ts 的同名词并置会产出
 *           `export *` 歧义,web 按 `.has()` 消费那一份,拿到数组是运行时崩)。
 *           扩展端此刻不是消费方(它没有委托面),这一格也由第②组钉住:排除要带理由。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { FILE_READ_INTENT_TOOLS, FILE_WRITE_INTENT_TOOLS, fileToolsFor } from '../file-tool-intent'

const HERE = dirname(fileURLToPath(import.meta.url))
/** __tests__ → chat → src → shared → packages → 仓库根:少算一层会以 ENOENT 出现而不是判红,
 *  所以根必须当场验一枚只存在于根的文件(本仓同一枚坑在 extension 测试里也踩过一次)。 */
const REPO_ROOT = resolve(HERE, '../../../../..')
if (!existsSync(join(REPO_ROOT, 'pnpm-workspace.yaml'))) {
  throw new Error(`REPO_ROOT 解析异常:${REPO_ROOT} 下没有 pnpm-workspace.yaml ⇒ 相对层数写错`)
}

const webConfig = readFileSync(
  join(REPO_ROOT, 'apps/web/src/hooks/use-chat/tool-config.ts'),
  'utf8',
)
const extTools = readFileSync(join(REPO_ROOT, 'apps/extension/lib/ui-control-tools.ts'), 'utf8')
const chatBarrel = readFileSync(join(REPO_ROOT, 'packages/shared/src/chat/index.ts'), 'utf8')

describe('fileToolsFor 行为对子', () => {
  it('只有读意图 ⇒ 只给只读族,一个写类工具都不给', () => {
    const tools = fileToolsFor('请调用 read_file 读取 src/a.ts')
    expect(tools).toEqual([...FILE_READ_INTENT_TOOLS])
    expect(tools).not.toContain('write_file')
  })

  it('文件上下文 + 明确修改动词 ⇒ 读写两族都给(扩展与 web 同口径的那条用例)', () => {
    const tools = fileToolsFor('帮我修改 src/a.ts 文件的代码逻辑')
    expect(tools).toContain('write_file')
    expect(tools).toContain('edit_file')
  })

  it('只有修改动词、没有文件上下文 ⇒ 一律不给(宁可少给,不可多给)', () => {
    expect(fileToolsFor('改一下逻辑')).toEqual([])
  })

  it('空串 ⇒ 空数组(普通问答不携带 agentTools,后端根本不进 tool loop)', () => {
    expect(fileToolsFor('')).toEqual([])
    expect(fileToolsFor('今天天气怎么样')).toEqual([])
  })

  it('返回的是新数组:调用方排序/去重不得回写进单源常量', () => {
    const first = fileToolsFor('帮我修改 src/a.ts 文件的代码逻辑')
    first.push('polluted')
    expect(fileToolsFor('帮我修改 src/a.ts 文件的代码逻辑')).not.toContain('polluted')
    expect(FILE_WRITE_INTENT_TOOLS).not.toContain('polluted')
  })
})

describe('单一源:消费方指回这一处,且没有第二份判据', () => {
  const SUBPATH = '@ihui/shared/chat/file-tool-intent'
  /** prettier 一折行,按原始文本比的锁就红了 —— 形状锁必须比归一化后的文本(本仓记过多次) */
  const flat = (s: string) => s.replace(/\s+/g, ' ')

  it('web 走 re-export(不打断既有 import 面)', () => {
    expect(flat(webConfig)).toContain(`from '${SUBPATH}'`)
  })

  it('扩展端此刻**不**是消费方 —— 它没有委托面,带文件族等于塞两个必败工具(理由见端内头注)', () => {
    expect(flat(extTools)).not.toContain(`from '${SUBPATH}'`)
    expect(flat(extTools)).toContain('_ADMIN_ONLY_TOOLS') // 排除必须带理由,否则会被"顺手补回来"
  })

  it('消费方(含扩展)都不得再写第二份关键词正则', () => {
    for (const [name, src] of [
      ['apps/web/tool-config.ts', webConfig],
      ['apps/extension/ui-control-tools.ts', extTools],
    ]) {
      expect(src, name).not.toMatch(/FILE_(READ|WRITE)_INTENT_RE\s*=\s*\//)
    }
  })

  it('本模块刻意不进 ./chat barrel:与 task-status 的同名词并置会产 `export *` 歧义', () => {
    expect(chatBarrel).not.toMatch(/export \* from '\.\/file-tool-intent'/)
    // 而 task-status 那份 FILE_WRITE_TOOLS(识别白名单 Set)必须仍在 barrel 里 —— 摘掉它是另一侧的断链
    expect(chatBarrel).toMatch(/export \* from '\.\/task-status'/)
  })
})
