// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Spec ↔ Code 双向落差引擎的回归(`apps/cli/src/commands/spec-drift.ts`)。
 *
 * 为什么这个文件必须存在(而不是"引擎看着能跑就算完"):
 * `spec-drift.ts` 自己的注释里写着"清单会不会腐烂,由 `apps/cli/tests/spec-drift.test.ts`
 * 的覆盖对账用例钉住"—— 注释点名一个不存在的测试,就是本仓 §12d 红线里"commit message
 * 声称未落盘的条目"那一型(账面看着有防线,实际无人看守)。本文件把那句话变成事实。
 *
 * 同时钉住一个**实测到的整片失明**:判据从前只遮"用法"、从不遮"声明位",于是
 * `async execute(args, ctx){` 里那个作为**声明**的 `args` 永远残留 ⇒ `\bargs\b` 恒成立
 * ⇒ 121 枚工具里 117 枚落 `unetermined`、双向落差各 0 处、退出码 0。
 * 修前的"逐条点名未判定"看着很吵,实际什么都没判 —— 所以第一条用例就是它的反向锁。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeToolSurface,
  extractArgUsage,
  handlerArgsParamName,
  handlerBodyStart,
  handlerSignature,
  EXCLUDED_FAMILIES,
  type ProjectableToolLike,
} from '../src/commands/spec-drift.js';

/** 造一枚工具:execute 传函数源码字符串即可(判据读的就是 toString())。 */
function fakeTool(overrides: Partial<ProjectableToolLike> & { name: string; code: string }): ProjectableToolLike {
  const { name, code, ...rest } = overrides;
  // 判据的对象就是 Function.prototype.toString 的产物,构造它是唯一取证方式;
  // 输入全是本文件内的字面量常量,不来自外部(所以不存在注入面)。
  // 先按**对象方法简写**编译(与真 Tool 对象的 `async execute(args, ctx) {}` 同形,toString 也同形);
  // 只有箭头形态的夹具才走表达式那一支。
  let execute: unknown;
  try {
    execute = new Function(`return ({ ${code} }).execute`)();
  } catch {
    execute = new Function(`return (${code})`)();
  }
  return { name, parameters: {}, execute, ...rest };
}

function analyze(tools: ProjectableToolLike[]) {
  return analyzeToolSurface(tools.map((tool) => ({ tool, family: 'TEST_TOOLS' })));
}

describe('签名区不得被当成"把 args 整体传走"(修前该判据对 117/121 枚工具失明)', () => {
  it('方法形态:声明位被遮后能真判到键级', () => {
    const tool = fakeTool({
      name: 'read_file',
      parameters: { path: { type: 'string' }, unused: { type: 'string' } },
      code: `async execute(args, ctx) { const p = args.path; return { ok: Boolean(p) && Boolean(ctx) } }`,
    });
    const report = analyze([tool]);
    expect(report.undetermined).toHaveLength(0);
    const dead = report.findings.filter((f) => f.kind === 'dead-parameter');
    expect(dead.map((f) => f.tool)).toEqual(['read_file']);
    expect(dead[0]?.detail).toContain('unused');
    expect(dead[0]?.detail).not.toContain('path');
  });

  it('箭头形态与无括号单参形态同样能判', () => {
    const arrow = fakeTool({
      name: 'arrow_tool',
      parameters: { a: {} },
      code: `async (args, ctx) => ({ ok: Boolean(args.a || ctx) })`,
    });
    const bare = fakeTool({
      name: 'bare_arrow',
      parameters: { a: {} },
      code: `async args => ({ ok: Boolean(args.a) })`,
    });
    const report = analyze([arrow, bare]);
    expect(report.undetermined).toHaveLength(0);
    expect(report.findings).toHaveLength(0);
  });

  it('真的整体传走时才落未判定(不得因为"遮了签名"就一律不判)', () => {
    const tool = fakeTool({
      name: 'passthrough',
      parameters: { a: {} },
      code: `async execute(args, ctx) { return runInner(args, ctx) }`,
    });
    const report = analyze([tool]);
    expect(report.undetermined).toHaveLength(1);
    expect(report.findings.filter((f) => f.kind === 'dead-parameter')).toHaveLength(0);
  });

  it('解构签名:能确定拆出键集就判,拆不出来才留未判定(V3 #83 残余第②型)', () => {
    // 正例:{ a, b } 结构上就是在读 args.a / args.b ⇒ 声明的 c 才是真落差
    const tool = fakeTool({
      name: 'destructured',
      parameters: { a: {}, b: {}, c: {} },
      code: `async execute({ a, b }, ctx) { return { ok: Boolean(a) && Boolean(b) && Boolean(ctx) } }`,
    });
    expect(handlerSignature(String(tool.execute))).toEqual({ kind: 'destructured', name: null, keys: ['a', 'b'] });
    // handlerArgsParamName 是"命名形参"那一档的降格投影,解构形态仍必须是 null(不得兜底成 args)
    expect(handlerArgsParamName(String(tool.execute))).toBeNull();
    const report = analyze([tool]);
    expect(report.undetermined).toHaveLength(0);
    expect(report.countsByKind['dead-parameter']).toBe(1);
    expect(report.findings.find((f) => f.kind === 'dead-parameter')?.detail).toContain('c');

    // 反例:rest / 嵌套 / 计算键 ⇒ 键集折不出来,两侧一律不判(把"判不出"折进键集就是合格证)
    for (const [name, code] of [
      ['with_rest', `async execute({ a, ...rest }, ctx) { return { ok: Boolean(a) && Boolean(rest) && Boolean(ctx) } }`],
      ['nested', `async execute({ a: { b } }, ctx) { return { ok: Boolean(b) } }`],
      ['computed', `async execute({ 'x-y': v }, ctx) { return { ok: Boolean(v) } }`],
      ['positional', `async execute([a, b], ctx) { return { ok: Boolean(a) && Boolean(b) && Boolean(ctx) } }`],
    ] as const) {
      const t = fakeTool({ name, parameters: { a: {} }, code });
      const r = analyze([t]);
      expect(r.findings, `${name}: 判不出键集时不得产假阳`).toHaveLength(0);
      expect(r.undetermined[0]?.cause, `${name}: 必须落"解构不可定"这一档`).toBe('destructured');
      expect(r.undetermined[0]?.reason).toContain('解构模式');
    }
  });

  it('零形参 handler 是可判的"一个都没读",不是"看不见"(残余第②型的另一半)', () => {
    expect(handlerSignature(`async execute() { return { ok: true } }`).kind).toBe('none');
    // 正例:声明与实现都空 ⇒ 既无落差也不算未判定
    const clean = fakeTool({ name: 'no_args_clean', parameters: {}, code: `async execute() { return { ok: true } }` });
    const cleanReport = analyze([clean]);
    expect(cleanReport.undetermined).toHaveLength(0);
    expect(cleanReport.findings).toHaveLength(0);

    // 反向锁:零形参却向模型 advertise 了参数 ⇒ 必须是 dead-parameter，
    // 不得因为"首参识别不了"而把它洗成未判定(那等于给缺陷发通行证)
    const lying = fakeTool({
      name: 'no_args_lies',
      parameters: { query: { type: 'string' } },
      code: `async execute() { return { ok: true } }`,
    });
    const lyingReport = analyze([lying]);
    expect(lyingReport.undetermined).toHaveLength(0);
    expect(lyingReport.countsByKind['dead-parameter']).toBe(1);
    expect(lyingReport.findings[0]?.detail).toContain('query');
  });

  it('同函数内 `const opts = args` 直接别名:键级取用读得出来就不再是未判定', () => {
    const tool = fakeTool({
      name: 'aliased',
      parameters: { a: {}, b: {} },
      code: `async execute(args, ctx) { const opts = args; return { ok: Boolean(opts.a) && Boolean(opts.b) && Boolean(ctx) } }`,
    });
    const report = analyze([tool]);
    expect(report.undetermined).toHaveLength(0);
    expect(report.findings).toHaveLength(0);

    // 反向锁:别名被整份交出去 ⇒ 照样未判定(通道开了不等于什么都放过)
    const leaked = fakeTool({
      name: 'aliased_leak',
      parameters: { a: {} },
      code: `async execute(args) { const opts = args; return handOff(opts) }`,
    });
    const leakReport = analyze([leaked]);
    expect(leakReport.undetermined).toHaveLength(1);
    expect(leakReport.undetermined[0]?.cause).toBe('cross_function');
  });

  it('同文件一跳委托:被调体在 toString 里 ⇒ 进去量键(残余第①型的可判那一半)', () => {
    const tool = fakeTool({
      name: 'one_hop',
      parameters: { alpha: {}, beta: {} },
      code: `async execute(args) {
        const pick = (input) => { return Boolean(input.alpha) && Boolean(input.beta) };
        return { ok: pick(args) };
      }`,
    });
    const report = analyze([tool]);
    expect(report.undetermined, '一跳可解析 ⇒ 不得再落未判定').toHaveLength(0);
    expect(report.findings).toHaveLength(0);
  });

  it('反向锁:两跳 / 跨文件的委托仍然未判定(不得偷偷放宽)', () => {
    // 两跳:execute -> inner -> outer,inner 把它的形参整体交给 outer
    const twoHop = fakeTool({
      name: 'two_hop',
      parameters: { alpha: {} },
      code: `async execute(args) {
        const inner = (input) => outer(input);
        return { ok: inner(args) };
      }`,
    });
    const twoHopReport = analyze([twoHop]);
    expect(twoHopReport.undetermined).toHaveLength(1);
    expect(twoHopReport.undetermined[0]?.cause).toBe('cross_function');
    expect(twoHopReport.undetermined[0]?.reason).toContain('整体交给了别处');

    // 跨文件:`budgetOf(args)` 的真身在模块作用域里,execute.toString() 根本不含它
    // (真仓 browser_page_snapshot 就是这个形态)⇒ 只能喊"源码不在面里",不许猜
    const crossFile = fakeTool({
      name: 'cross_file',
      parameters: { alpha: {} },
      code: `async execute(args) { return { ok: Boolean(budgetOf(args)) } }`,
    });
    const crossReport = analyze([crossFile]);
    expect(crossReport.undetermined).toHaveLength(1);
    expect(crossReport.undetermined[0]?.cause).toBe('cross_function');

    // 非首位实参:`runPreToolCall("codegraph", args)` 的 args 落在第二位,
    // 与被调方首参不对齐 ⇒ 按票面边界不解析(真仓 codegraph 那一处)
    const secondActual = fakeTool({
      name: 'second_actual',
      parameters: { alpha: {} },
      code: `async execute(args) { return { ok: Boolean(runPreToolCall("x", args)) } }`,
    });
    expect(analyze([secondActual]).undetermined[0]?.cause).toBe('cross_function');
  });

  it('`args` 只作为对象字面量的键 / 别人的属性名出现时不得算整份传走(真仓 debug_launch 假阳)', () => {
    const tool = fakeTool({
      name: 'key_position',
      parameters: { type: {}, command: {} },
      code: `async execute(args, ctx) {
        const launchArgs = { program: args.command, args: args.type, cwd: ctx };
        return { ok: Boolean(launchArgs) };
      }`,
    });
    const report = analyze([tool]);
    expect(report.undetermined, '键位 args: 与 cfg.args 都不是"把 args 交出去"').toHaveLength(0);
    expect(report.findings).toHaveLength(0);
    // 同一处形态换成真读取,必须仍然判得出(证明遮掉的不是判据本身)
    const spread = fakeTool({
      name: 'real_spread',
      parameters: { type: {} },
      code: `async execute(args) { return { ok: Boolean({ ...args }) } }`,
    });
    expect(analyze([spread]).undetermined[0]?.cause).toBe('other');
  });

  it('未判定分成因计数三档恒在,且与点名清单同数', () => {
    const nonFunction = { ...fakeTool({ name: 'not_a_function', parameters: {}, code: `async execute(args) { return args }` }), execute: 42 };
    const mixed = analyze([
      fakeTool({ name: 'opaque_call', parameters: { a: {} }, code: `async execute(args) { return go(args) }` }),
      fakeTool({ name: 'opaque_destructure', parameters: { a: {} }, code: `async execute({ a, ...r }) { return { ok: Boolean(a) && Boolean(r) } }` }),
      nonFunction,
    ]);
    expect(mixed.undeterminedByCause).toEqual({ cross_function: 1, destructured: 1, other: 1 });
    const sum = Object.values(mixed.undeterminedByCause).reduce((x, y) => x + y, 0);
    expect(sum).toBe(mixed.undetermined.length);
    // 三档键必须在(缺档会把"这一档没看"读成"这一档为 0")
    expect(Object.keys(mixed.undeterminedByCause).sort()).toEqual(['cross_function', 'destructured', 'other']);
  });

  it('handlerBodyStart 只在深度 0 认体起点(括号内的 { 与 => 不算)', () => {
    const src = `async execute(args, ctx = { a: 1 }) { const f = (x) => x; return f(args) }`;
    const at = handlerBodyStart(src);
    expect(src.slice(at, at + 2)).toBe('{ ');
    expect(at).toBe(src.indexOf('{ const'));
  });
});

describe('四个判据各自有牙(正反成对)', () => {
  it('code->spec undeclared-arg-read:读了没声明的键', () => {
    const tool = fakeTool({
      name: 'sneaky',
      parameters: { path: {} },
      code: `async execute(args) { return { ok: Boolean(args.path) && Boolean(args.secretSide) } }`,
    });
    const report = analyze([tool]);
    expect(report.countsByKind['undeclared-arg-read']).toBe(1);
    expect(report.findings.find((f) => f.kind === 'undeclared-arg-read')?.detail).toContain('secretSide');
  });

  it('code->spec effect-not-declared:声明只读却在写盘;声明 write 时不判', () => {
    const lying = fakeTool({
      name: 'liar',
      dangerLevel: 'read',
      code: `async execute(args) { require('node:fs').writeFileSync('/tmp/x', 'y'); return { ok: true } }`,
    });
    const honest = { ...lying, name: 'honest', dangerLevel: 'write' };
    const report = analyze([lying, honest]);
    expect(report.countsByKind['effect-not-declared']).toBe(1);
    expect(report.findings.find((f) => f.kind === 'effect-not-declared')?.tool).toBe('liar');
  });

  it('契约缺席不等于反证(旧写法把"没声明"读成"会改写"⇒ 本判据结构上永不成立)', () => {
    const noContract = fakeTool({
      name: 'no_contract',
      dangerLevel: 'read',
      code: `async execute(args) { require('node:fs').writeFileSync('/tmp/x', 'y'); return { ok: true } }`,
    });
    expect(analyze([noContract]).countsByKind['effect-not-declared']).toBe(1);
    // 反证在位时以更具体的一侧为准:dangerLevel 写着 read,契约却声明 mutating ⇒ 不判
    const contradicted = { ...noContract, contract: { contract: { permission: { effectScope: 'workspace' } } } };
    expect(analyze([contradicted as never]).countsByKind['effect-not-declared']).toBeUndefined();
  });

  it('dangerLevel 未写 ⇒ 不判 effect-not-declared(那是守门 111 flip-audit 的地盘)', () => {
    const tool = fakeTool({
      name: 'no-danger',
      code: `async execute(args) { require('node:fs').writeFileSync('/tmp/x', 'y'); return { ok: true } }`,
    });
    expect(analyze([tool]).countsByKind['effect-not-declared']).toBeUndefined();
  });

  it('spec->code required-not-declared:required 点名了 parameters 里没有的键', () => {
    const tool = fakeTool({
      name: 'impossible',
      parameters: { path: {} },
      required: ['user_id'],
      code: `async execute(args) { return { ok: Boolean(args.path) } }`,
    });
    const report = analyze([tool]);
    expect(report.countsByKind['required-not-declared']).toBe(1);
    expect(report.findings.find((f) => f.kind === 'required-not-declared')?.detail).toContain('user_id');
  });

  it('helper(args, "key") 形态算作对 key 的取用(不产假阳)', () => {
    const tool = fakeTool({
      name: 'via_helper',
      parameters: { selector: {} },
      code: `async execute(args) { return { ok: Boolean(requireString(args, 'selector')) } }`,
    });
    expect(analyze([tool]).findings).toHaveLength(0);
  });
});

describe('键级用法提取的边界(遮罩错位会同时产假阳与假阴)', () => {
  it('解构赋值与可选链都认', () => {
    const src = `async execute(args, ctx) { const { a, b: renamed } = args; const c = args?.d; return { ok: Boolean(a && renamed && c && ctx) } }`;
    const { keys, opaque } = extractArgUsage(src, 'args');
    expect(opaque).toBe(false);
    expect(keys).toEqual(['a', 'b', 'd']);
  });

  it('{ ...rest } = args ⇒ 判为看不见,而不是"没用到"', () => {
    const { opaque } = extractArgUsage(`async execute(args) { const { ...rest } = args; return { ok: true, rest } }`, 'args');
    expect(opaque).toBe(true);
  });
});

describe('族清单不腐烂(spec-drift.ts 注释点名的那条对账)', () => {
  // 根由本文件位置推导,不靠 process.cwd():守门 70 的镜像测试曾 13/14 恒红,原因就是
  // 判据按自身位置定根而测试靠 cwd 定位夹具 —— 两侧一漂,套件就在扫真仓。
  const HERE = dirname(fileURLToPath(import.meta.url));
  const TOOLS_DIR = join(HERE, '..', 'src', 'tools');
  const DRIFT_SRC = readFileSync(join(HERE, '..', 'src', 'commands', 'spec-drift.ts'), 'utf8');

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(p));
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(p);
    }
    return out;
  }

  /**
   * 从源码里取 `wanted` 清单的族名,**不**在测试内 import 全部工具族。
   * 两条实测理由:(a) 真载入把套件从 <1s 拖到 70s;(b) 宿主模块图不同(vitest 的 SSR
   * transform 在 memory.js 上抛 TDZ,CLI 真跑 15 族全入)会让同一断言在不同 runner 里
   * 给出不同结论 —— 那不是清单腐烂,拿它判红就是造一台与改动无关的恒红门。
   * 运行期的"整族载入失败"由 `runSpecDrift` 自己抬退出码守(loadErrors>0 ⇒ return 1)。
   */
  function wantedNames(): string[] {
    const block = DRIFT_SRC.match(/const wanted: Array<[\s\S]*?\[[\s\S]*?\n  \];/);
    expect(block, 'spec-drift.ts 里找不到 wanted 清单本体 ⇒ 对账失去对象,必须红而不是跳过').not.toBeNull();
    return [...(block![0] ?? '').matchAll(/\['([A-Z][A-Z_]*_TOOLS)'/g)].map((m) => m[1]!);
  }

  function declaredFamilies(): Set<string> {
    const out = new Set<string>();
    for (const file of walk(TOOLS_DIR)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/export const ([A-Z][A-Z_]*_TOOLS)\b/g)) {
        const name = m[1];
        if (name) out.add(name);
      }
    }
    return out;
  }

  it('每一族要么进 wanted 清单被审,要么在排除表里带理由;两个方向都不许静默', () => {
    const declared = declaredFamilies();
    const wanted = wantedNames();
    expect(declared.size).toBeGreaterThan(5);
    expect(wanted.length).toBeGreaterThan(5);

    const excluded = new Set(Object.keys(EXCLUDED_FAMILIES));
    const missing = [...declared].filter((n) => !wanted.includes(n) && !excluded.has(n));
    expect(missing, 'src/tools 新导出一族却没人把它接进判据 ⇒ 判据对该族静默失明').toEqual([]);

    const phantom = wanted.filter((n) => !declared.has(n));
    expect(phantom, '清单里还挂着已经不存在的族名 ⇒ 报告里的"被审族"是假账').toEqual([]);

    for (const [name, why] of Object.entries(EXCLUDED_FAMILIES)) {
      expect(why.length, `排除项 ${name} 的理由不能是空串/纯指针`).toBeGreaterThan(6);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
