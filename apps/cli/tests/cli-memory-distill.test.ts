// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记忆蒸馏测试 — 近似合并、不同 kind 不误合并、超预算裁剪账目守恒、摘要器失败回退、输出稳定。
 * 全为纯函数用例,不需要临时目录/绝对路径。
 */
import { describe, it, expect } from 'vitest';
import { distillMemoryEntries, type DistillEntry } from '../src/memory/distill.js';

function entry(
  text: string,
  kind: string,
  createdAt = 1,
  source = 'session',
): DistillEntry {
  return { text, kind, createdAt, source };
}

describe('distillMemoryEntries', () => {
  it('近似条目合并(同 kind,文本仅换语序)', async () => {
    const result = await distillMemoryEntries([
      entry('项目统一使用 pnpm 管理依赖', 'convention', 1),
      entry('项目统一用 pnpm 管理依赖', 'convention', 2),
    ]);
    expect(result.kept).toBe(1);
    expect(result.merged).toBe(1);
    expect(result.dropped).toBe(0);
    // 代表文本取更长的那条(归一化后更长),不丢信息。
    expect(result.text).toContain('项目统一使用 pnpm 管理依赖');
    expect(result.kept + result.merged + result.dropped).toBe(2);
  });

  it('完全重复条目多次合并,账目守恒', async () => {
    const result = await distillMemoryEntries([
      entry('所有新模块必须使用 ESM 并保留文件头声明。', 'convention', 1),
      entry('所有新模块必须使用 ESM 并保留文件头声明。', 'convention', 2),
      entry('所有新模块必须使用 ESM 并保留文件头声明。', 'convention', 3),
    ]);
    expect(result.kept).toBe(1);
    expect(result.merged).toBe(2);
    expect(result.dropped).toBe(0);
    expect(result.kept + result.merged + result.dropped).toBe(3);
  });

  it('不同 kind 即使文本相同也不误合并', async () => {
    const result = await distillMemoryEntries([
      entry('所有新模块必须使用 ESM 并保留文件头声明。', 'decision', 1),
      entry('所有新模块必须使用 ESM 并保留文件头声明。', 'fact', 2),
    ]);
    expect(result.kept).toBe(2);
    expect(result.merged).toBe(0);
    expect(result.dropped).toBe(0);
    expect(result.text).toContain('## decision');
    expect(result.text).toContain('## fact');
  });

  it('超预算按最近优先裁剪,且 kept+merged+dropped == 输入数', async () => {
    const entries = [
      entry('旧条目:构建脚本使用 gulp 打包前端资源。', 'fact', 1_600_000_000_000),
      entry('中条目:数据库迁移使用 drizzle-kit 生成 SQL。', 'fact', 1_700_000_000_000),
      entry('较新事实:缓存层统一走 Redis,不再本地存。', 'fact', 1_750_000_000_000),
      entry('最新事实:日志统一走 stderr,stdout 只输出结果。', 'decision', 1_780_000_000_000),
    ];
    const result = await distillMemoryEntries(entries, { charBudget: 60 });
    expect(result.dropped).toBeGreaterThan(0);
    expect(result.kept + result.merged + result.dropped).toBe(entries.length);
    expect(result.text).toContain('最新事实:日志统一走 stderr,stdout 只输出结果。');
    expect(result.text).not.toContain('旧条目:构建脚本使用 gulp 打包前端资源。');
  });

  it('摘要器抛错 → 回退规则产物且不抛', async () => {
    const entries = [
      entry('决策落定:对外接口保留 v1 版本。', 'decision', 10),
      entry('根因:旧实现把空串当成缺失值。', 'root-cause', 20),
    ];
    const baseline = await distillMemoryEntries(entries);
    const result = await distillMemoryEntries(entries, {
      summarize: async () => {
        throw new Error('LLM 不可用');
      },
    });
    expect(result.kept).toBe(baseline.kept);
    expect(result.merged).toBe(baseline.merged);
    expect(result.dropped).toBe(baseline.dropped);
    expect(result.text).toBe(baseline.text);
  });

  it('摘要器成功时用摘要文本覆盖规则产物', async () => {
    const result = await distillMemoryEntries([entry('决策落定:保留 v1 接口。', 'decision', 10)], {
      summarize: async () => '摘要:保留 v1 接口,新增 v2 另开路径。',
    });
    expect(result.text).toBe('摘要:保留 v1 接口,新增 v2 另开路径。');
  });

  it('输出稳定(同一输入两次字节一致)', async () => {
    const entries = [
      entry('项目约定:提交前必须跑 lint。', 'convention', 3),
      entry('项目约定:提交之前必须运行 lint。', 'convention', 4),
      entry('用户偏好:注释使用中文。', 'preference', 5),
    ];
    const first = JSON.stringify(await distillMemoryEntries(entries));
    const second = JSON.stringify(await distillMemoryEntries(entries));
    expect(first).toBe(second);
    expect(first).toContain('项目约定');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
