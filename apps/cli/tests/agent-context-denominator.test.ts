// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-916940③④ 源码锁:agent.ts 两处 `opts.contextLimit ?? <容量>` 的兜底分母必须来自唯一
// 容量出口 getModelContextCapacity(opts.modelId),不得再写字面量(字面量兜底 ⇒ 非 128K 模型
// 的百分比/压缩阈值全错且账面不响)。判据形态照搬已入库的 apps/web/tests/agent-pane-context-denominator.test.ts。
// 变异实证:把字面量写回去 ⇒ 第 1/2 条红;出口改名/删 import ⇒ 第 3/4 条红。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { DEFAULT_CONTEXT_CAPACITY, getModelContextCapacity } from '@ihui/api-client';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT_SRC = join(HERE, '..', 'src', 'commands', 'agent.ts');

describe('G-916940③④ agent.ts 上下文容量兜底引用唯一出口', () => {
  const src = readFileSync(AGENT_SRC, 'utf8');

  it('不得再出现硬编码容量字面量(128000 / 128_000)', () => {
    expect(src).not.toMatch(/128[_,]?000/);
  });

  it('两处 contextLimit 兜底都必须是 opts.contextLimit ?? getModelContextCapacity(opts.modelId)', () => {
    const sites = src.match(/opts\.contextLimit \?\? [^;\n]+/g) ?? [];
    expect(sites.length).toBe(2);
    for (const site of sites) {
      expect(site).toContain('opts.contextLimit ?? getModelContextCapacity(opts.modelId)');
    }
  });

  it('出口必须经 @ihui/api-client 导入(不另设第二份容量表)', () => {
    expect(src).toMatch(/import\s*\{[^}]*getModelContextCapacity[^}]*\}\s*from\s*'@ihui\/api-client'/);
  });

  it('出口对样本模型确实给出不同容量(防"把字面量换个名字继续写死")', () => {
    expect(getModelContextCapacity('deepseek-chat')).not.toBe(getModelContextCapacity('claude-3-5-sonnet'));
  });

  it('兜底语义不变:未知/空模型 id 回落 DEFAULT_CONTEXT_CAPACITY(用户没传就用默认)', () => {
    expect(getModelContextCapacity('definitely-unknown-model-xyz')).toBe(DEFAULT_CONTEXT_CAPACITY);
    expect(getModelContextCapacity('')).toBe(DEFAULT_CONTEXT_CAPACITY);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
