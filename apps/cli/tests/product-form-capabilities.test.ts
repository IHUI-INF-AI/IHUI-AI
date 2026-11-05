// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 产品形态能力闸(goal-b49 Y3,2026-11-05)的判据 + 接线锁。
 *
 * 覆盖五组:
 *  1. **判据单源**:表与纯函数只从 `@ihui/types` 取(本文件不复制任何一行表);
 *  2. **正例**:该形态开启该能力(cli × localWorkspace ⇒ enabled);
 *  3. **反例**:该形态关闭该能力(miniapp × localWorkspace ⇒ disabled);
 *  4. **边界例**:缺键 ⇒ 判 `unjudged` 并点名形态与能力(**不默判**);
 *  5. **接线锁**:① 工具注册处真的按表降权(形态表关掉的能力面在该形态下不挂载,且出声);
 *     ② 钩子派发收口真的按表降权(不派发 + skipped 档 + feedback 具名码);
 *     ③ **无空能力键**:逐条扫真实工具族的 `name` 字面量,确认每个能力键都有工具消费它(§0.9)。
 *
 * 缺键方向恒为「多要一次定向说明」:未登记 ⇒ 出声 + 不挂载,绝不静默放行,也绝不静默拒绝。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRODUCT_CAPABILITIES,
  PRODUCT_FORM_CAPABILITIES,
  PRODUCT_FORMS,
  evaluateProductFormCapability,
  type ProductCapability,
} from '@ihui/types';

import {
  PRODUCT_FORM_CAPABILITY_OFF,
  PRODUCT_FORM_CAPABILITY_UNJUDGED,
  PRODUCT_FORM_ENV,
  clearProductFormAnnouncements,
} from '../src/lib/product-form.js';
import { capabilityOfToolName } from '../src/tools/product-form-gate.js';
import { clearTools, getTool, registerTools, type Tool } from '../src/tools/index.js';
import { runSessionStartHooks, type HooksConfig } from '../src/hooks/index.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

const isWindows = process.platform === 'win32';
const exit0 = isWindows ? 'cmd /c exit 0' : "sh -c 'exit 0'";

/** 判据与消费点都要在**默认 cli 形态**下零回归 ⇒ 命令钩子需过既有信任门(与同族用例同口径)。 */
process.env.IHUI_TRUST_WORKSPACE = '1';

function fakeTool(name: string): Tool {
  return {
    name,
    description: '',
    parameters: {},
    required: [],
    execute: async () => ({ success: true, output: '' }),
  };
}

let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearTools();
  clearProductFormAnnouncements();
  delete process.env[PRODUCT_FORM_ENV];
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  stderrSpy.mockRestore();
  delete process.env[PRODUCT_FORM_ENV];
});

/** 收集本次出声写到 stderr 的全部文本(出声是本票的核心可见面,必须能断言)。 */
function stderrText(): string {
  return stderrSpy.mock.calls.map((call) => String(call[0] ?? '')).join('');
}

describe('产品形态能力表(判据单源)', () => {
  it('形态与能力两轴都取自 @ihui/types 的唯一一份(本用例不复制表)', () => {
    expect([...PRODUCT_FORMS]).toEqual(['web', 'miniapp', 'rn', 'cli']);
    expect([...PRODUCT_CAPABILITIES]).toEqual(['localWorkspace', 'localHooks', 'browserRuntime']);
    // 每个形态都有自己的一行(没有形态缺席)
    for (const form of PRODUCT_FORMS) {
      expect(PRODUCT_FORM_CAPABILITIES[form], `形态 ${form} 缺行`).toBeTruthy();
    }
  });

  it('cli 行三格全开;web 行的 browserRuntime 是**未登记**(缺键),不是 false', () => {
    expect(PRODUCT_FORM_CAPABILITIES.cli).toEqual({
      localWorkspace: true,
      localHooks: true,
      browserRuntime: true,
    });
    const webRow = PRODUCT_FORM_CAPABILITIES.web;
    expect(webRow.localWorkspace).toBe(false);
    expect(webRow.localHooks).toBe(false);
    // 缺格 = undefined(未登记);写成 false 就是把"没判"冒充成"判过"(§0.3)
    expect(webRow.browserRuntime).toBeUndefined();
    expect('browserRuntime' in webRow).toBe(false);
  });
});

describe('降权判定(纯函数:形态 + 能力 ⇒ 三态 + 理由)', () => {
  it('正例:cli × localWorkspace ⇒ enabled,理由点名形态与能力', () => {
    const verdict = evaluateProductFormCapability('cli', 'localWorkspace');
    expect(verdict.state).toBe('enabled');
    expect(verdict.reason).toContain('cli');
    expect(verdict.reason).toContain('localWorkspace');
  });

  it('反例:miniapp × localWorkspace ⇒ disabled,理由点名形态与能力', () => {
    const verdict = evaluateProductFormCapability('miniapp', 'localWorkspace');
    expect(verdict.state).toBe('disabled');
    expect(verdict.reason).toContain('miniapp');
    expect(verdict.reason).toContain('localWorkspace');
  });

  it('边界例一:形态合法但该格未登记(web × browserRuntime)⇒ unjudged,不是默判', () => {
    const verdict = evaluateProductFormCapability('web', 'browserRuntime');
    expect(verdict.state).toBe('unjudged');
    expect(verdict.reason).toContain('web');
    expect(verdict.reason).toContain('browserRuntime');
    expect(verdict.reason).toContain('未登记');
  });

  it('边界例二:形态未登记 ⇒ unjudged 并点名那个形态', () => {
    const verdict = evaluateProductFormCapability('desktop-app', 'localWorkspace');
    expect(verdict.state).toBe('unjudged');
    expect(verdict.reason).toContain('desktop-app');
  });

  it('边界例三:能力未登记 ⇒ unjudged 并点名那个能力', () => {
    const verdict = evaluateProductFormCapability('cli', 'telepathy');
    expect(verdict.state).toBe('unjudged');
    expect(verdict.reason).toContain('telepathy');
  });
});

describe('接线锁一:工具注册处按表降权(apps/cli/src/tools/index.ts)', () => {
  it('形态表关掉该能力面 ⇒ 该工具不挂载,且**出声**点名形态 · 能力 · 工具', () => {
    process.env[PRODUCT_FORM_ENV] = 'miniapp';
    registerTools([fakeTool('write_file'), fakeTool('fetch_url')]);
    expect(getTool('write_file')).toBeUndefined();
    const text = stderrText();
    expect(text).toContain(PRODUCT_FORM_CAPABILITY_OFF);
    expect(text).toContain('miniapp');
    expect(text).toContain('localWorkspace');
    expect(text).toContain('write_file');
  });

  it('同形态下**不受形态门管**的服务面工具照旧挂载(行为与改前逐字相同)', () => {
    process.env[PRODUCT_FORM_ENV] = 'miniapp';
    registerTools([fakeTool('fetch_url')]);
    expect(getTool('fetch_url')).toBeTruthy();
  });

  it('形态表开启该能力面(cli)⇒ 工具照旧挂载,且不出声', () => {
    process.env[PRODUCT_FORM_ENV] = 'cli';
    registerTools([fakeTool('write_file')]);
    expect(getTool('write_file')).toBeTruthy();
    expect(stderrText()).not.toContain(PRODUCT_FORM_CAPABILITY_OFF);
  });

  it('缺键(web × browserRuntime)⇒ 浏览器工具不挂载,出声且具名"未登记"', () => {
    process.env[PRODUCT_FORM_ENV] = 'web';
    registerTools([fakeTool('browser_navigate')]);
    expect(getTool('browser_navigate')).toBeUndefined();
    const text = stderrText();
    expect(text).toContain(PRODUCT_FORM_CAPABILITY_UNJUDGED);
    expect(text).toContain('未登记');
    expect(text).toContain('browserRuntime');
  });

  it('形态声明成未登记值 ⇒ 一律不挂载并出声(不静默当默认形态继续跑)', () => {
    process.env[PRODUCT_FORM_ENV] = 'desktop-app';
    registerTools([fakeTool('write_file')]);
    expect(getTool('write_file')).toBeUndefined();
    expect(stderrText()).toContain(PRODUCT_FORM_CAPABILITY_UNJUDGED);
  });
});

describe('接线锁二:钩子派发收口按表降权(apps/cli/src/hooks/index.ts)', () => {
  let markerFile = '';
  let markerSeq = 0;

  beforeEach(() => {
    markerFile = path.join(os.tmpdir(), `ihui-product-form-${process.pid}-${markerSeq++}.tmp`);
    fs.rmSync(markerFile, { force: true });
  });

  afterEach(() => {
    fs.rmSync(markerFile, { force: true });
  });

  function markerCommand(): string {
    return isWindows
      ? `cmd /c echo ran>"${markerFile}"`
      : `sh -c 'echo ran > "${markerFile}"'`;
  }

  function markerWritten(): boolean {
    return fs.existsSync(markerFile);
  }

  function configWith(command: string): HooksConfig {
    return { sessionStart: [{ name: 'marker-hook', command, blockOnError: true }] };
  }

  it('形态关掉本机钩子面 ⇒ 钩子不派发,skipped 档 + feedback 具名码', async () => {
    process.env[PRODUCT_FORM_ENV] = 'miniapp';
    const result = await runSessionStartHooks(configWith(markerCommand()), {
      workspacePath: os.tmpdir(),
    });
    expect(markerWritten()).toBe(false);
    expect(result.terminal).toBe('skipped');
    expect(result.feedback).toContain(PRODUCT_FORM_CAPABILITY_OFF);
    expect(result.feedback).toContain('localHooks');
    expect(result.feedback).toContain('miniapp');
    // 失效方向:不改写既有阻断语义(exitCode 0 ⇒ 不阻断,与 skipped 同形)
    expect(result.proceed).toBe(true);
  });

  it('形态开启本机钩子面(cli)⇒ 钩子照旧派发(零回归)', async () => {
    process.env[PRODUCT_FORM_ENV] = 'cli';
    const result = await runSessionStartHooks(configWith(exit0), {
      workspacePath: os.tmpdir(),
    });
    expect(result.terminal).toBe('succeeded');
    expect(result.proceed).toBe(true);
  });
});

describe('接线锁三:无空能力键(§0.9:每个能力键都有真消费方)', () => {
  /** 消费点源码面(逐条点名能力键的地方;`localHooks` 在钩子派发收口,另两枚在工具注册处)。 */
  const CONSUMER_FILES = [
    'apps/cli/src/tools/index.ts',
    'apps/cli/src/tools/product-form-gate.ts',
    'apps/cli/src/hooks/index.ts',
  ];

  it('每个能力键都有真消费方:真实工具族消费它,或消费点源码逐条点名它', () => {
    const toolsDir = path.join(repoRoot, 'apps', 'cli', 'src', 'tools');
    const names = new Set<string>();
    for (const file of fs.readdirSync(toolsDir)) {
      if (!file.endsWith('.ts')) continue;
      const text = fs.readFileSync(path.join(toolsDir, file), 'utf8');
      for (const match of text.matchAll(/name:\s*'([a-z_0-9]+)'/g)) {
        names.add(match[1]!);
      }
    }
    const consumedByTools = new Set<ProductCapability>();
    for (const name of names) {
      const capability = capabilityOfToolName(name);
      if (capability !== undefined) consumedByTools.add(capability);
    }
    const consumerSources = CONSUMER_FILES.map((rel) =>
      fs.readFileSync(path.join(repoRoot, rel), 'utf8'),
    ).join('\n');
    for (const capability of PRODUCT_CAPABILITIES) {
      const byTool = consumedByTools.has(capability);
      const byConsumerSite = consumerSources.includes(`'${capability}'`);
      expect(
        byTool || byConsumerSite,
        `能力键 ${capability} 没有任何消费方(既无真实工具消费,消费点源码也不点名它)`,
      ).toBe(true);
    }
    // 工具面两枚必须**真的**有工具消费(不是只在源码里出现过字面量)
    expect(consumedByTools.has('localWorkspace')).toBe(true);
    expect(consumedByTools.has('browserRuntime')).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
