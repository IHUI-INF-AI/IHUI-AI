// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 插件「接口型工具」—— 从清单纯数据到模型可调用工具的全链路。
 *
 * 钉的是本票的核心承诺:**插件能贡献真工具,而装载器仍然不执行任何插件代码**。
 *
 * 每一组用例对应一条曾经会失守的边界:
 *  ① 编译:名字三段形态 / method 词表 / path 合法性 —— 拒收要**点名 + 带码**,不静默;
 *  ② 越权面:参数名撞路由身份键 ⇒ 拒收(模型可填他人会话 = 越权);
 *  ③ 危险档:清单只能抬档不能降档(POST 声明 `read` 仍落 write;DELETE 恒 dangerous);
 *  ④ 重名:与宿主在册工具撞名 ⇒ 编译期拒收,不是启动后静默丢;
 *  ⑤ 落地:清单 → 装载器 → 真 Tool,且**真发得出去请求**(注入 transport 抓实参);
 *  ⑥ 红线:装载链路仍无 dynamic import / require / vm / child_process(与既有形状锁同向)。
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setBaseUrl, setTokenProvider, setTransport } from '@ihui/api-client';

import { loadPluginsWithContributionAudit } from '../src/plugins/loader.js';
import {
  INTERFACE_REJECT_CODES,
  PLUGIN_INTERFACE_PREFIX,
  compileDeclaredInterface,
  compileDeclaredInterfaces,
} from '../src/plugins/interface-tools.js';
import type { Tool, ToolContext } from '../src/tools/index.js';

const CTX = {} as unknown as ToolContext;
const NO_NAMES: ReadonlySet<string> = new Set<string>();

/**
 * 剥掉行注释与块注释,只留**代码**。
 *
 * 为什么测试需要它:红线判据(无 dynamic import / require / vm / child_process)针对的是
 * 可执行代码,而 `interface-tools.ts` 的头注**必须**引用这些字样来解释"为什么不做本地工具"。
 * 不剥注释的判据会把"写清为什么不做"误判成"做了" —— 假红会逼人删掉那段解释,
 * 而那正是最该留下的东西。
 *
 * 简化处理:不追求语法级精确(模板字符串里的 `//` 会被误剥),但本文件注释里不含
 * 会被剥掉后改变红线结论的代码;且方向是"宁可多剥"(更容易判绿),不会产出假红。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

let root = '';

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'ihui-plugin-iface-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** 写一份插件清单到 `<root>/<dir>/plugin.json`。 */
function writePlugin(dir: string, manifest: Record<string, unknown>): void {
  const target = path.join(root, dir);
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(target, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf-8');
}

const GOOD = {
  name: 'crm__list_contacts',
  method: 'GET',
  path: '/api/crm/contacts',
  description: '列出 CRM 联系人',
  params: [{ name: 'limit', type: 'number', description: '返回条数', required: true }],
};

describe('① 编译:名字 / method / path 三条形态判据', () => {
  it('合法声明编译成 plugin__<ns>__<tool> 形态的工具,path 参数自动补成必填', () => {
    const out = compileDeclaredInterface(
      { ...GOOD, name: 'crm__get_contact', path: '/api/crm/contacts/:id' },
      NO_NAMES,
    );
    expect(out.reason).toBeUndefined();
    expect(out.tool?.name).toBe(`${PLUGIN_INTERFACE_PREFIX}crm__get_contact`);
    // path 里的 :id 由宿主补成必填 string 参数 —— 用户不必手写,也不会漏写
    expect(out.tool?.parameters.id).toEqual({ type: 'string', description: 'id 路径参数' });
    expect(out.tool?.required).toContain('id');
  });

  it('写全 plugin__ 前缀是幂等的(便于用户对照日志里的真实工具名)', () => {
    const out = compileDeclaredInterface({ ...GOOD, name: 'plugin__crm__list_contacts' }, NO_NAMES);
    expect(out.tool?.name).toBe(`${PLUGIN_INTERFACE_PREFIX}crm__list_contacts`);
  });

  it('名字不合三段形态 ⇒ name-invalid,并回显用户原样写的名字', () => {
    for (const bad of ['list_contacts', 'crm__a__b', 'CRM__x', 'crm__List-X', '']) {
      const out = compileDeclaredInterface({ ...GOOD, name: bad }, NO_NAMES);
      expect({ bad, code: out.code }).toEqual({ bad, code: 'name-invalid' });
      expect(out.tool).toBeUndefined();
    }
  });

  it('method 大小写不折叠(替用户猜等于掩盖拼错)且只收词表五项', () => {
    expect(compileDeclaredInterface({ ...GOOD, method: 'get' }, NO_NAMES).code).toBe('method-invalid');
    expect(compileDeclaredInterface({ ...GOOD, method: 'HEAD' }, NO_NAMES).code).toBe('method-invalid');
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(compileDeclaredInterface({ ...GOOD, method }, NO_NAMES).tool?.name).toBeTruthy();
    }
  });

  it('path 必须完整、不含空白或 ..(白空格会被 URL 规范化吃掉,.. 可越出挂载点)', () => {
    for (const bad of ['api/crm/contacts', '/api/crm/ contacts', '/api/../etc/passwd', '']) {
      expect({ bad, code: compileDeclaredInterface({ ...GOOD, path: bad }, NO_NAMES).code }).toEqual({
        bad,
        code: 'path-invalid',
      });
    }
  });

  it('参数形态坏 ⇒ 整条拒收(降级成"无参数"会让模型猜字段名,比不装更误导)', () => {
    expect(compileDeclaredInterface({ ...GOOD, params: 'limit=10' }, NO_NAMES).code).toBe('params-invalid');
    expect(compileDeclaredInterface({ ...GOOD, params: [{ name: 'x' }] }, NO_NAMES).code).toBe('params-invalid');
    // array 的元素 schema 搬不过去时也不得降级成 any[]
    expect(
      compileDeclaredInterface(
        { ...GOOD, params: [{ name: 'ids', type: 'array', items: { name: 'i', type: 'weird' } }] },
        NO_NAMES,
      ).code,
    ).toBe('params-invalid');
  });

  it('声明了 path 里不存在的路径参数 ⇒ 拒收(不静默丢弃,否则模型传的字段被忽略)', () => {
    const out = compileDeclaredInterface(
      { ...GOOD, path: '/api/crm/contacts', pathParams: [{ name: 'ghost', type: 'string' }] },
      NO_NAMES,
    );
    expect(out.code).toBe('params-invalid');
    expect(out.reason).toContain('ghost');
  });

  it('拒收码是封闭集:每条拒收都带 INTERFACE_REJECT_CODES 里的码', () => {
    const samples = [
      'not-object',
      { ...GOOD, name: 'bad' },
      { ...GOOD, method: 'FETCH' },
      { ...GOOD, path: 'nope' },
      { ...GOOD, params: 1 },
      { ...GOOD, params: [{ name: 'userId', type: 'string' }] },
    ];
    for (const sample of samples) {
      const out = compileDeclaredInterface(sample, NO_NAMES);
      expect(out.reason).toBeTruthy();
      expect(INTERFACE_REJECT_CODES).toContain(out.code as (typeof INTERFACE_REJECT_CODES)[number]);
    }
  });
});

describe('② 越权面:路由身份键不得进 schema', () => {
  it('业务参数撞身份键 ⇒ param-routing-identity', () => {
    const out = compileDeclaredInterface(
      { ...GOOD, params: [{ name: 'userId', type: 'string', description: '谁' }] },
      NO_NAMES,
    );
    expect(out.code).toBe('param-routing-identity');
  });

  it('path 占位撞身份键同样拒收(两条入口共用同一把尺)', () => {
    const out = compileDeclaredInterface({ ...GOOD, path: '/api/crm/:sessionId/notes' }, NO_NAMES);
    expect(out.code).toBe('param-routing-identity');
  });
});

describe('③ 危险档:清单只能抬档,不能降档', () => {
  const levelOf = (decl: Record<string, unknown>) =>
    compileDeclaredInterface({ ...GOOD, ...decl }, NO_NAMES).tool?.dangerLevel;

  it('method 推导:GET→read / POST·PUT·PATCH→write / DELETE→dangerous', () => {
    expect(levelOf({ method: 'GET', access: undefined })).toBe('read');
    expect(levelOf({ method: 'POST', access: undefined })).toBe('write');
    expect(levelOf({ method: 'PATCH', access: undefined })).toBe('write');
    expect(levelOf({ method: 'DELETE', access: undefined })).toBe('dangerous');
  });

  it('清单自述 read 压不低 POST 的 write,也压不低 DELETE 的 dangerous', () => {
    expect(levelOf({ method: 'POST', access: 'read' })).toBe('write');
    expect(levelOf({ method: 'DELETE', access: 'read' })).toBe('dangerous');
  });

  it('清单自述可以往上抬(GET 声明 dangerous 就按 dangerous 走)', () => {
    expect(levelOf({ method: 'GET', access: 'dangerous' })).toBe('dangerous');
  });

  it('写工具带契约声明(守门 111 的 TC5:缺 confirmation 即红)', () => {
    const write = compileDeclaredInterface({ ...GOOD, method: 'POST' }, NO_NAMES).tool;
    expect(write?.contract?.permission.effectScope).toBe('network');
    expect(write?.contract?.permission.confirmation?.mode).toBe('none');
    const dangerous = compileDeclaredInterface({ ...GOOD, method: 'DELETE' }, NO_NAMES).tool;
    expect(dangerous?.contract?.permission.confirmation?.mode).toBe('interactive');
  });
});

describe('④ 重名:与宿主在册工具撞名 → 编译期拒收', () => {
  it('命中 takenNames ⇒ name-conflict,且不产出工具', () => {
    const name = `${PLUGIN_INTERFACE_PREFIX}crm__list_contacts`;
    const out = compileDeclaredInterface(GOOD, new Set([name]));
    expect(out.code).toBe('name-conflict');
    expect(out.tool).toBeUndefined();
  });

  it('同批内两条同名声明:第一条成功,第二条按 name-conflict 拒收(不静默互相覆盖)', () => {
    const batch = compileDeclaredInterfaces([GOOD, GOOD], NO_NAMES);
    expect(batch.tools.map((t) => t.name)).toEqual([`${PLUGIN_INTERFACE_PREFIX}crm__list_contacts`]);
    expect(batch.outcomes.map((o) => o.code)).toEqual([undefined, 'name-conflict']);
  });

  it('两个 namespace 各自的同名末段互不冲突(前缀里有 namespace)', () => {
    const batch = compileDeclaredInterfaces([GOOD, { ...GOOD, name: 'erp__list_contacts' }], NO_NAMES);
    expect(batch.tools).toHaveLength(2);
  });
});

describe('⑤ 落地:清单 → 装载器 → 真 Tool → 真请求', () => {
  let captured: { url: string; method: string | undefined; body: string | undefined } | null = null;

  beforeEach(() => {
    captured = null;
    setBaseUrl('http://127.0.0.1:8802');
    setTokenProvider({ getToken: () => 'test-token' });
  });

  it('装载器编译出工具并把拒收项摊成 plugin-interface-rejected 诊断', () => {
    writePlugin('crm', {
      name: 'crm-plugin',
      version: '1.0.0',
      interfaces: [GOOD, { ...GOOD, name: 'BAD NAME', method: 'GET', path: '/api/x' }],
    });
    const loaded = loadPluginsWithContributionAudit({ pluginsDir: root });

    expect(loaded.interfaceTools.map((t) => t.name)).toEqual([`${PLUGIN_INTERFACE_PREFIX}crm__list_contacts`]);
    const rejected = loaded.diagnostics.filter((d) => d.code === 'plugin-interface-rejected');
    expect(rejected).toHaveLength(1);
    // 诊断必须点名"哪一条 + 为什么",而不是只说"有一个没装上"
    expect(rejected[0]?.message).toContain('BAD NAME');
    expect(rejected[0]?.message).toContain('name-invalid');
    expect(rejected[0]?.pluginName).toBe('crm-plugin');
    // 装载本身仍成功:拒的是那一条接口声明,不是这份插件
    expect(loaded.plugins.map((p) => p.name)).toEqual(['crm-plugin']);
  });

  it('宿主在册名字传进去后,插件贡献同名工具会被拒(不是等 registerTools 静默丢)', () => {
    writePlugin('crm', { name: 'crm-plugin', version: '1.0.0', interfaces: [GOOD] });
    const loaded = loadPluginsWithContributionAudit({
      pluginsDir: root,
      takenToolNames: [`${PLUGIN_INTERFACE_PREFIX}crm__list_contacts`],
    });
    expect(loaded.interfaceTools).toEqual([]);
    expect(loaded.diagnostics.some((d) => d.code === 'plugin-interface-rejected')).toBe(true);
  });

  it('编译出的工具真能把实参发到端点(query 带参、body 拆信封)', async () => {
    setTransport(async (url, init) => {
      captured = {
        url: String(url),
        method: init.method,
        body: typeof init.body === 'string' ? init.body : undefined,
      };
      const text = JSON.stringify({ code: 0, message: 'ok', data: { total: 2 } });
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => text,
        json: async () => JSON.parse(text) as unknown,
      } as unknown as Response;
    });

    writePlugin('crm', { name: 'crm-plugin', version: '1.0.0', interfaces: [GOOD] });
    const loaded = loadPluginsWithContributionAudit({ pluginsDir: root });
    const tool = loaded.interfaceTools[0] as Tool;
    const result = await tool.execute({ limit: 2 }, CTX);

    expect(result.success).toBe(true);
    expect(captured?.method).toBe('GET');
    expect(captured?.url).toContain('/api/crm/contacts');
    expect(captured?.url).toContain('limit=2');
    // 信封被拆:模型看到的是业务数据,不是 {code,message,data}
    expect(result.output).toContain('"total": 2');
    expect(tool.registrationOwner).toBe('plugin:crm');
  });
});

describe('⑥ 红线:装载链路仍不执行插件代码', () => {
  /**
   * 2026-11-13 研判结论的**形状锁**:接口型工具只支持 HTTP 端点,不做"本地工具"。
   *
   * 这条锁拦的是"后来者顺手加一档 `kind:'local'`"。加它之前必须先回答三问(答案都在
   * `interface-tools.ts` 头注里):
   *   ① `packages/types` 的 FORBIDDEN_EXECUTABLE_FIELDS 把 exec/script/command/shell/bin/
   *      main/run/eval/spawn 判非法 —— 加 local 档就要在清单里放命令,与那条禁令矛盾;
   *   ② `plugin-entry-channel-lock.test.ts` 的 ③ 逐字禁掉装载器的动态 import/require/vm/spawn;
   *   ③ 真需要本地能力的正路是"插件自带 MCP server",仓库里那条链已存在。
   * 所以这里断言的是"清单里出现 local/exec 类声明时,**编译层不认识它**",而不是"我们希望它不认识"。
   */
  it('拒绝 local/script 形态:HTTP-only 是刻意的能力边界(不是尚未实现)', () => {
    // ① 把"本地工具"能想到的写法都塞进一条声明:全都不该产出工具
    const localish: Array<Record<string, unknown>> = [
      { name: 'local__run', kind: 'local', args: ['--x'] },
      { name: 'local__run', method: 'LOCAL', path: '/x' },
      { name: 'local__run', exec: 'echo hi', path: '/x' },
      { name: 'local__run', method: 'POST', path: '/x', script: 'return 1' },
      { name: 'local__run', method: 'POST', path: '/x', command: 'rm -rf /' },
    ]
    for (const decl of localish) {
      const out = compileDeclaredInterface(decl, NO_NAMES)
      // 要么根本没编译成工具,要么编译出来也只是个普通 HTTP 调用(script/exec 等字段被完全忽略)
      if (out.tool) {
        expect(out.tool.name).toBe(`${PLUGIN_INTERFACE_PREFIX}local__run`)
        // 关键:那些可执行字段**一个都没进 schema**(模型看不到,也传不到执行层)
        for (const forbidden of ['exec', 'script', 'command', 'shell', 'args', 'kind']) {
          expect(Object.keys(out.tool.parameters)).not.toContain(forbidden)
        }
      }
    }
    // ② 至少有一条必须是被明确拒收的(证明不是"全都悄悄编译过了")
    expect(localish.some((decl) => compileDeclaredInterface(decl, NO_NAMES).tool === undefined)).toBe(true)
  });

  it('扫描与出口两档不 import 宿主工具表(与既有反空壳锁同向)', async () => {
    const { readFileSync } = await import('node:fs');
    // 划定:只有"只读清单 + 转接出口"这两类必须与工具表解耦。
    // interface-tools.ts 不在射程内 —— 它是编译层,执行腿就是 route-tools
    // (与 api-bridge / HR 工具族同一条腿);把它也禁掉等于要求"编译出工具但不许有执行腿"。
    for (const file of ['plugin-scan.ts', 'scan-result.ts', 'loader.ts']) {
      const text = stripComments(readFileSync(new URL(`../src/plugins/${file}`, import.meta.url), 'utf-8'));
      const runtimeImports = [...text.matchAll(/^import\s+(?!type\b)[^;]*from\s+'(\.\.\/tools\/[^']+)'/gm)].map(
        (m) => m[1],
      );
      expect({ file, runtimeImports }).toEqual({ file, runtimeImports: [] });
    }
  });

  it('interface-tools.ts 不含动态 import / require / vm / child_process', async () => {
    const { readFileSync } = await import('node:fs');
    // 必须先剥注释:本文件的头注**故意**引用 import() / child_process 这些字样
    // (它在解释"为什么不做本地工具"),而红线判的是**代码**,不是讨论红线的散文。
    // 不剥就会把"解释为什么不"判成"做了" —— 正是本仓最贵的那类假红。
    const text = stripComments(
      readFileSync(new URL('../src/plugins/interface-tools.ts', import.meta.url), 'utf-8'),
    );
    expect(/\bimport\s*\(/.test(text)).toBe(false);
    expect(/\brequire\s*\(/.test(text)).toBe(false);
    expect(text.includes('node:vm')).toBe(false);
    expect(text.includes('node:child_process')).toBe(false);
  });
});

describe('⑦ 参数校验:插件接口工具自动继承宿主校验器(零新增代码,但必须钉住)', () => {
  /**
   * 这一组是"实证"而不是"设想":`applyToolArgValidation`(`tools/index.ts`)是**统一出口**,
   * 所有走 `executeToolCall` 的工具都会过它 —— 插件编译出的 `Tool` 自然继承,本票没有为它写一行校验代码。
   *
   * 那为什么还要测:因为"继承"这件事**可以静默失守**。只要有人日后改编译层时把 `required`
   * 丢了、或把 `type` 的四种映射改错,工具仍然"能编译、能执行",但模型传错参数时会一路打到
   * 后端才知道 —— 那正是这条用例要拦的失效型(与 b76-14「漏搬 items ⇒ 等价 any[]」同一取向)。
   */
  it('必填 / 类型 / 合法三态都由既有校验器当场判定(不必打到后端)', async () => {
    const { enforceValidateToolArguments } = await import('../src/tools/argument-validation-telemetry.js');
    const tool = compileDeclaredInterface(
      {
        name: 'probe__write',
        method: 'POST',
        path: '/api/probe',
        description: '探测',
        params: [
          { name: 'count', type: 'number', description: '条数', required: true },
          { name: 'label', type: 'string', description: '标签' },
        ],
      },
      NO_NAMES,
    ).tool;
    expect(tool).toBeTruthy();

    // ① 缺必填 ⇒ reject / missing_required,且**点名**是哪个字段、期望什么类型
    const missing = enforceValidateToolArguments(tool!, {});
    expect(missing.status).toBe('reject');
    expect(missing.errors.some((e) => e.field === 'count' && e.reason === 'missing_required')).toBe(true);

    // ② 数字字符串 ⇒ 校验器按"容错优先"归一化(LLM 常把 3 传成 "3"),这是既有设计不是缺陷。
    //    本用例钉的是"归一化后能过",不是"我们希望它拒"。
    const coerced = enforceValidateToolArguments(tool!, { count: '3' });
    expect(coerced.status).toBe('pass');
    expect(coerced.args).toEqual({ count: '3' });

    // ③ 真类型错(字符串塞进 number)⇒ reject / type_mismatch。
    //    选非数字字符串而不是布尔:布尔进 number 时校验器会**按 1/0 归一化**
    //    (`tests/argument-validator.test.ts:71` 有专门用例钉住 `count:true → 1`),
    //    那是既有刻意设计(LLM 容错),不是缺陷,本票不改。
    const mismatch = enforceValidateToolArguments(tool!, { count: 'not-a-number' });
    expect(mismatch.status).toBe('reject');
    expect(mismatch.errors.some((e) => e.field === 'count' && e.reason === 'type_mismatch')).toBe(true);

    // ④ 合法 ⇒ pass,且原样放行(不做静默改写)
    const ok = enforceValidateToolArguments(tool!, { count: 3, label: 'x' });
    expect(ok.status).toBe('pass');
    expect(ok.args).toEqual({ count: 3, label: 'x' });
  });

  it('路径参数也进必填(schema 与校验面同源,不是只写在描述里)', async () => {
    const { enforceValidateToolArguments } = await import('../src/tools/argument-validation-telemetry.js');
    const tool = compileDeclaredInterface(
      { name: 'probe__get', method: 'GET', path: '/api/probe/{id}', description: '取一条' },
      NO_NAMES,
    ).tool;
    expect(tool?.required).toContain('id');
    const missing = enforceValidateToolArguments(tool!, {});
    expect(missing.status).toBe('reject');
    expect(missing.errors.some((e) => e.field === 'id' && e.reason === 'missing_required')).toBe(true);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
