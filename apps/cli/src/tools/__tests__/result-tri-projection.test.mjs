// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 G-109 验收档:工具结果的三条独立投影(给模型的 / 给人看的 / 落库的)必须各自有界且互不代替。
 *
 * 票面钉的就是**这条命令**(此前该入口从未在任何提交里存在过 —— 实交付只有 vitest 的
 * `apps/cli/tests/result-tri-projection.test.ts`,所以本行一直不翻勾):
 *   node --test apps/cli/src/tools/__tests__/result-tri-projection.test.mjs   (cwd = 仓库根)
 *
 * 三臂各自守一件事:
 *  ① output 被预算裁掉时,display 必须**仍含**被裁掉的那一段(受 display 自己的上限管,不吃 resultBudget);
 *  ② display 自己被超限裁掉时必须置 `truncated:true`,且**不得**把全文写进持久化 metadata;
 *  ③ 反向锁(最硬的一条):`output` 的字节语义一字未动,且模型侧装配**绝不**取 display
 *     —— 实现若把"给模型的"换成 display,这一臂当场红(上游注释点名要避免的方向)。
 *
 * 装载口径:`@ihui/types` 的 package 解析面指向 dist(构建产物),而本档判的是**源码面**的写侧
 * 入口 ⇒ 落库 writer 走绝对路径直读 .ts;tools 面走相对 .js ⇒ 由下方解析钩子改写到同名 .ts。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

function findRepoRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml')) && existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('找不到仓库根(往上 12 层没同时命中 package.json 与 pnpm-workspace.yaml)');
}

const REPO_ROOT = findRepoRoot();

/**
 * 为什么这里必须自带转译钩子:票面钉的入口是**裸命令**(不带任何旗标),而 Node 24 默认的
 * strip-only TS 装载吃不了本仓 TS 里合法的 `enum` 与构造器参数属性(`hub/resolver.ts:35` 等
 * 4 处)⇒ 直接 import tools 面会在装载期 ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX。
 * 正解不是把别人的热文件改写成"Node 恰好吃得下"的形态(那是为了测试动生产面),而是在**测试
 * 自己的装载层**用仓库既有的 `typescript` 做真变换。只处理 file: 下的 .ts,不覆盖任何真 .js。
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const baseDir = specifier.endsWith('.js') && !existsSync(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier))
        ? path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier.slice(0, -3))
        : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      // 相对 .js ⇒ 同名 .ts(仓内 ESM 源码约定);无扩展名目录导入 ⇒ index.ts(vite 平时替我们做这件事)
      const candidates = [baseDir, `${baseDir}.ts`, path.join(baseDir, 'index.ts')];
      for (const c of candidates) {
        if (c.endsWith('.ts') && existsSync(c)) {
          return { url: pathToFileURL(c).href, format: 'module', shortCircuit: true };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) {
      const file = fileURLToPath(url);
      const out = ts.transpileModule(readFileSync(file, 'utf8'), {
        fileName: file,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          verbatimModuleSyntax: true,
          isolatedModules: true,
        },
      });
      return { format: 'module', source: out.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const tools = await import(pathToFileURL(path.join(REPO_ROOT, 'apps/cli/src/tools/index.ts')).href);
const metadata = await import(
  pathToFileURL(path.join(REPO_ROOT, 'packages/types/src/tool-result-metadata.ts')).href
);

const { applyToolResultBudget, formatToolResult, TOOL_RESULT_DISPLAY_LIMIT_BYTES } = tools;
const { buildToolResultMetadata, TOOL_RESULT_METADATA_SCHEMA_VERSION } = metadata;

const BUDGET = {
  inlineLimitBytes: 64,
  providerVisibleLimitBytes: 64,
  policy: 'truncate',
  preview: { bytes: 64, lines: 160, from: 'head' },
};

describe('G-109 ①:display 必须留住被 output 裁掉的那一段', () => {
  it('output 截到 64 B,display 仍含尾部那段(它不吃 resultBudget,受自身上限管)', () => {
    const original = `HEAD-MARKER\n${'m'.repeat(4000)}\nCUT-AWAY-SEGMENT-MARKER`;
    const out = applyToolResultBudget({ success: true, output: original }, BUDGET);

    assert.equal(out.output.includes('CUT-AWAY-SEGMENT-MARKER'), false, 'output 该被裁掉尾部');
    assert.match(out.output, /^\[tool-result-budget\] output truncated: /, '散文注记仍是第一眼的事实');
    assert.ok(out.display, '裁剪发生 ⇒ 必须产出 display 投影');
    assert.equal(
      out.display.text.includes('CUT-AWAY-SEGMENT-MARKER'),
      true,
      'display 必须仍含被 output 裁掉的那一段(否则人读面与模型面看的是同一份残缺)',
    );
    assert.equal(out.display.originalBytes, Buffer.byteLength(original, 'utf8'));
    assert.ok(out.display.returnedBytes <= TOOL_RESULT_DISPLAY_LIMIT_BYTES, 'display 受自身上限管');
    assert.equal(out.display.budgetStrategy, 'truncate');
  });
});

describe('G-109 ②:display 超限要留结论位,且全文不得进 metadata', () => {
  it('原文大于 display 自身上限 ⇒ truncated 置位,metadata 里找不到越界那段', () => {
    const beyondCap = `BEYOND-CAP-TAIL-${'t'.repeat(1024)}`;
    const original = `${'a'.repeat(TOOL_RESULT_DISPLAY_LIMIT_BYTES)}${beyondCap}`;
    const out = applyToolResultBudget({ success: true, output: original }, BUDGET);

    assert.equal(out.display.truncated, true, 'display 自己被裁 ⇒ 必须置结论位(只写 true,不写 false 噪音)');
    assert.equal(
      Buffer.byteLength(out.display.text, 'utf8'),
      TOOL_RESULT_DISPLAY_LIMIT_BYTES,
      'display 上限是硬闸,越界字节不得留在投影里',
    );
    assert.equal(out.display.returnedBytes < out.display.originalBytes, true, '两本账必须可判');

    const record = buildToolResultMetadata({ toolCallId: 'call-1', toolName: 'read_file', display: out.display });
    assert.ok(record, '合法入参必须产得出条目');
    assert.equal(record.schemaVersion, TOOL_RESULT_METADATA_SCHEMA_VERSION);
    assert.equal(record.truncated, true, '四数进顶层 ⇒ 与 truncated 同批,守门 check-truncation-accounting 可判');
    assert.equal(record.originalBytes, out.display.originalBytes);
    assert.equal(record.returnedBytes, out.display.returnedBytes);
    assert.equal(record.budgetStrategy, 'truncate');
    assert.equal(record.display.kind, 'text');
    assert.equal(
      JSON.stringify(record).includes(`BEYOND-CAP-TAIL`),
      false,
      '全文(越界那一段)绝不允许落进持久化 metadata',
    );
    assert.equal('output' in record, false, '条目结构上就不该有 output 这一格');
  });

  it('非法入参一律拒产(null),不留半成品条目', () => {
    const display = { text: 'x', originalBytes: 1, returnedBytes: 1, budgetStrategy: 'truncate' };
    assert.equal(buildToolResultMetadata({ toolCallId: '', toolName: 't', display }), null);
    assert.equal(buildToolResultMetadata({ toolCallId: 'c', toolName: '', display }), null);
    assert.equal(buildToolResultMetadata({ toolCallId: 'c', toolName: 't', display: { ...display, originalBytes: Number.NaN } }), null);
  });
});

describe('G-109 ③ 反向锁:output 字节语义一字未动,模型侧绝不取 display', () => {
  it('未超限 ⇒ 原样返回,一个字节都不改', () => {
    const original = 'SHORT-AND-INTACT';
    const out = applyToolResultBudget({ success: true, output: original }, BUDGET);
    assert.equal(out.output, original, '未触发裁剪 ⇒ output 逐字节同形');
    assert.equal(out.display, undefined, '没裁剪就不该造出投影');
    assert.equal(out.truncation, undefined, '没裁剪就不该造出账');
  });

  it('模型侧装配只吃 output,display 文案进不了那一格', () => {
    const original = `MODEL-AUTHORITATIVE-MARKER\n${'z'.repeat(4000)}\nCUT-AWAY-SEGMENT-MARKER`;
    const budgeted = applyToolResultBudget({ success: true, output: original }, BUDGET);
    const withAlienDisplay = { ...budgeted, display: { text: 'HUMAN-VIEW-ONLY-MARKER', originalBytes: 9, returnedBytes: 9, budgetStrategy: 'truncate' } };

    const modelSide = formatToolResult({ name: 'read_file', arguments: {} }, withAlienDisplay);
    assert.equal(modelSide.includes('MODEL-AUTHORITATIVE-MARKER') || modelSide.includes('[tool-result-budget]'), true, '模型侧仍是 output 那一份');
    assert.equal(modelSide.includes('HUMAN-VIEW-ONLY-MARKER'), false, '把"给模型的"换成 display ⇒ 本臂当场红');
    assert.equal(withAlienDisplay.output, budgeted.output, '带上 display 也不得回头改写 output');
  });
});

describe('G-109 ④ 落库↔水合往返:写侧产物必须被既有读侧原样认回', () => {
  it('buildToolResultMetadata 的条目喂进 hydrateToolStateMap ⇒ 零降级、display 逐字回来', async () => {
    const hydration = await import(
      pathToFileURL(path.join(REPO_ROOT, 'apps/cli/src/sessions/tool-part-hydration.ts')).href
    );
    const display = { text: '人读视图全文', originalBytes: 5000, returnedBytes: 20, budgetStrategy: 'truncate' };
    const rec = buildToolResultMetadata({ toolCallId: 'call-7', toolName: 'read_file', display });
    assert.ok(rec, '合法入参必须产得出条目');

    const { toolState, report } = hydration.hydrateToolStateMap({
      'call-7': rec,
      'other-thing': { foo: 1 },
    });
    assert.equal(report.degraded, 0, '写侧产物若被读侧判成降级 ⇒ 这条落库等于没接上车');
    assert.equal(toolState['call-7'].display.text, display.text, 'display 全文必须逐字回来');
    assert.equal(toolState['call-7'].truncated, true, '四数推出的结论位必须穿过水合仍在');
    assert.deepEqual(toolState['other-thing'], { foo: 1 }, '非 tool-part 形状的条目一个字节都不动(不误伤 toolState 的其他用途)');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
