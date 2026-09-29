// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自定义命令的加载与展开(G-814413)—— 四条硬约束各由哪几条用例钉住:
 *
 *   硬约束 1(插值只有一处 / 无占位符追加 User arguments / 动态 shell 抛错不静默丢弃):
 *     「有占位符」两形态 + 「无占位符」+ 「动态 shell 不得被静默剥掉」
 *   硬约束 2(保留名复用 slash-registry 的名单,撞名拒绝且点名撞了谁):
 *     「保留名判据与注册表同源」+「保存撞内置名被拒并点名正主」
 *   硬约束 3(校验/探测阶段绝不执行内嵌 shell):
 *     「哨兵文件:校验与探测四条路径都不执行」——先跑阳性对照证明那段 body 被执行时
 *     **必然**产出哨兵文件,再断言四条路径跑完后它不存在;只留"不存在"这一半,
 *     用例对一台根本没在看的尺子也会绿(AGENTS §22c「镜像只复读实现就是复读机」同型)。
 *   硬约束 4(失败不静默、文案走 i18n、不硬编码中文):
 *     「未定义命令名回非空可操作文案」+「参数不足可操作报错」+「七条文案都能取到且不是键名回显」
 *     +「内置同名命令不被用户命令顶掉」(先证明那份文件确实在盘上,否则"没被顶掉"可能只是没读到)
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fsNode from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { t, getLocale, setLocale, type Locale } from '../src/i18n/index.js';
import {
  findSlashCommand,
  getAllSlashNames,
  renderSlashHelp,
  slashCompleter,
  suggestSlashCommands,
} from '../src/commands/slash-registry.js';
import { handleCustomCommandSave } from '../src/commands/repl.js';
import {
  CustomCommandError,
  buildCustomCommandInvocation,
  expandCustomCommandPrompt,
  getCustomCommandsDir,
  isReservedCustomCommandName,
  loadCustomCommand,
  probeCustomCommand,
  saveCustomCommand,
  splitCustomCommandArguments,
  usesUnsupportedDynamicShell,
} from '../src/commands/custom-commands.js';

/** 写一条命令文件(绕过 save,模拟用户手写 / 搬家来的文件) */
function writeCommandFile(name: string, body: string): string {
  const dir = getCustomCommandsDir();
  fsNode.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.md`);
  fsNode.writeFileSync(file, body, 'utf-8');
  return file;
}

describe('自定义命令:加载 + 展开(G-814413)', () => {
  let tmpHome = '';
  let originalEnv: NodeJS.ProcessEnv = {};

  beforeEach(() => {
    tmpHome = fsNode.mkdtempSync(path.join(os.tmpdir(), 'ihui-custom-cmd-'));
    originalEnv = { ...process.env };
    // §15b:落点是用户级目录,测试经 IHUI_HOME 换根,不碰真实 ~/.ihui
    process.env.IHUI_HOME = tmpHome;
  });

  afterEach(() => {
    process.env = originalEnv;
    fsNode.rmSync(tmpHome, { recursive: true, force: true });
  });

  // ── 硬约束 1:插值形态 ────────────────────────────────────────────────

  it('有占位符:$ARGUMENTS 被整串替换,且不再追加 User arguments 段', () => {
    const definition = loadCustomCommandFrom('echo', 'Echo: $ARGUMENTS');
    const out = expandCustomCommandPrompt(definition, 'a b c');
    expect(out.prompt).toContain('Echo: a b c');
    expect(out.prompt).not.toContain('User arguments:');
    expect(out.usedArgumentsPlaceholder).toBe(true);
    expect(out.argumentCount).toBe(3);
  });

  it('有占位符:$1..$n 按位置替换,引号与转义按一个参数计', () => {
    const definition = loadCustomCommandFrom('two', '第一 [$1] 第二 [$2]');
    const out = expandCustomCommandPrompt(definition, '"带 空格 的参数" second');
    expect(out.prompt).toContain('第一 [带 空格 的参数] 第二 [second]');
    expect(out.prompt).not.toContain('User arguments:');
    expect(out.usedArgumentsPlaceholder).toBe(true);
    expect(splitCustomCommandArguments('a "b c" \\"d\\"')).toEqual(['a', 'b c', '"d"']);
  });

  it('参数内容里的 $1 不被第二轮再展开(合遍替换的正向证明)', () => {
    // 上游两遍替换(replaceAll 后 replace)会把用户参数里的 `$1` 当模板二次吃进去;
    // 参数是数据不是模板输入 —— 这里必须原样出现在结果里。
    const definition = loadCustomCommandFrom('literal', '引用 [$ARGUMENTS]');
    const out = expandCustomCommandPrompt(definition, '$1 和 $2');
    expect(out.prompt).toContain('引用 [$1 和 $2]');
    expect(out.usedArgumentsPlaceholder).toBe(true);
  });

  it('无占位符:给了参数就追加 User arguments: 段(上游 :41-43 同语义)', () => {
    const definition = loadCustomCommandFrom('plain', '列出未完成任务');
    const out = expandCustomCommandPrompt(definition, 'alpha beta');
    expect(out.prompt).toContain('User arguments:\nalpha beta');
    expect(out.usedArgumentsPlaceholder).toBe(false);
    expect(out.argumentCount).toBe(2);
  });

  it('无占位符且没给参数:不追加空段', () => {
    const definition = loadCustomCommandFrom('plain2', 'hi');
    const out = expandCustomCommandPrompt(definition, '');
    expect(out.prompt).not.toContain('User arguments:');
    expect(out.argumentCount).toBe(0);
  });

  it('动态 shell 判据两种形态都认(纯字面,不执行)', () => {
    expect(usesUnsupportedDynamicShell('run !`ls -la` now')).toBe(true);
    expect(usesUnsupportedDynamicShell('```!\nls\n```')).toBe(true);
    expect(usesUnsupportedDynamicShell('普通正文,没有 shell')).toBe(false);
  });

  it('含动态 shell ⇒ 抛错而不是静默丢弃那一段', () => {
    // 刻意经 writeCommandFile 落盘:saveCustomCommand 自己在写盘前就拒了这一型(见上面那条闸),
    // 用 save 造不出"已存下的 shell 命令"——而展开路径必须仍能拦住搬家/手写进来的文件。
    writeCommandFile('shelly', '前 !`echo hi` 后');
    const definition = loadCustomCommand('shelly');
    let caught: unknown = null;
    try {
      expandCustomCommandPrompt(definition, 'x');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CustomCommandError);
    expect((caught as CustomCommandError).code).toBe('unsupported_shell');
    // 文案必须是可操作的(非空、不是键名回显、点名命令)
    const message = (caught as CustomCommandError).message;
    expect(message.trim().length).toBeGreaterThan(0);
    expect(message).not.toContain('cli.custom.');
    expect(message).toContain('shelly');
  });

  // ── 硬约束 2:保留名名单只有一份 ──────────────────────────────────────

  it('保留名判据与 slash-registry 同源:注册表每个名字(含别名)都被判保留', () => {
    const names = getAllSlashNames();
    expect(names.length).toBeGreaterThanOrEqual(40); // 阳性对照:名单读到了东西,不是空表放过
    for (const entry of names) {
      expect(isReservedCustomCommandName(entry)).toBe(true);
      expect(isReservedCustomCommandName(entry.replace(/^\//, ''))).toBe(true);
    }
    expect(isReservedCustomCommandName('definitely-not-a-builtin-xyz')).toBe(false);
  });

  it('保存撞内置名 ⇒ 被拒且点名撞了谁(别名相撞回报正主)', () => {
    expect(() => saveCustomCommand({ name: 'model', body: 'x' })).toThrow(CustomCommandError);
    try {
      saveCustomCommand({ name: 'model', body: 'x' });
    } catch (e) {
      const err = e as CustomCommandError;
      expect(err.code).toBe('reserved_name');
      expect(err.message).toContain('model');
      expect(err.details.owner).toBe('model');
    }
    // /quit 是 /exit 的别名 ⇒ 撞的是别名,文案要点名正主 exit 而不是原样念 quit
    try {
      saveCustomCommand({ name: 'quit', body: 'x' });
      expect.unreachable('别名撞名必须被拒');
    } catch (e) {
      const err = e as CustomCommandError;
      expect(err.code).toBe('reserved_name');
      expect(err.details.owner).toBe('exit');
      expect(err.message).toContain('exit');
    }
  });

  it('内置同名命令不被用户命令顶掉:先证明那份文件确实在盘上', () => {
    const file = writeCommandFile('model', '替你把模型切成最贵的');
    // 阳性对照:文件真的存在 —— 否则"没被顶掉"可能只是因为根本没读到
    expect(fsNode.existsSync(file)).toBe(true);
    expect(probeCustomCommand('model')).toBe(false);
    const inv = buildCustomCommandInvocation('model', 'gpt');
    expect(inv.handled).toBe(false);
    if (!inv.handled) expect(inv.reason).toBe('reserved');
  });

  // ── 硬约束 3:校验/探测阶段绝不执行内嵌 shell ─────────────────────────

  it('哨兵文件:load / probe / expand / save 四条校验路径都不执行 !`…`', () => {
    const sentinel = path.join(tmpHome, 'sentinel-did-it-ran.txt');
    // 这段 body 若真被执行,就会创建 sentinel —— 先跑一次"故意执行"证明这条判据有牙
    const embedded = `require('fs').writeFileSync(${JSON.stringify(sentinel)},'ran')`;
    execFileSync(process.execPath, ['-e', embedded], { windowsHide: true });
    expect(fsNode.existsSync(sentinel)).toBe(true); // 阳性对照:执行 ⇒ 哨兵必出现
    fsNode.rmSync(sentinel, { force: true });

    const body = `看看 !\`${embedded}\` 的结果`;
    const dir = getCustomCommandsDir();
    fsNode.mkdirSync(dir, { recursive: true });
    fsNode.writeFileSync(path.join(dir, 'danger.md'), body, 'utf-8');

    // ① 加载(读盘 + 解析)
    const definition = loadCustomCommand('danger');
    expect(fsNode.existsSync(sentinel)).toBe(false);
    // ② 探测(保留名 + load 这一对,刻意不展开)
    expect(probeCustomCommand('danger')).toBe(true);
    expect(fsNode.existsSync(sentinel)).toBe(false);
    // ③ 展开:必须抛错,且抛之前之后都没执行
    expect(() => expandCustomCommandPrompt(definition, 'a')).toThrow(CustomCommandError);
    expect(fsNode.existsSync(sentinel)).toBe(false);
    // ④ 保存:四道闸都在写盘之前,永远不会留下"存下了但跑不了"的干
    expect(() => saveCustomCommand({ name: 'danger2', body })).toThrow(CustomCommandError);
    expect(fsNode.existsSync(sentinel)).toBe(false);
    expect(fsNode.existsSync(path.join(dir, 'danger2.md'))).toBe(false);
    // ⑤ 分派入口同样不得执行(它必然走到 ③ 的抛错)
    expect(() => buildCustomCommandInvocation('danger', 'a')).toThrow(CustomCommandError);
    expect(fsNode.existsSync(sentinel)).toBe(false);
  });

  // ── 硬约束 4:失败不静默 ─────────────────────────────────────────────

  it('未定义命令名 ⇒ 非空可操作文案(点名命令与落点目录)', () => {
    const inv = buildCustomCommandInvocation('nope-not-here', 'whatever');
    expect(inv.handled).toBe(false);
    if (!inv.handled) {
      expect(inv.reason).toBe('not_found');
      expect(inv.message.trim().length).toBeGreaterThan(0);
      expect(inv.message).not.toContain('cli.custom.'); // 键名回显 = 语言包没补
      expect(inv.message).toContain('nope-not-here');
      expect(inv.message).toContain(getCustomCommandsDir());
    }
  });

  it('参数不足 ⇒ 可操作报错(不静默把 $3 换成空串)', () => {
    const definition = loadCustomCommandFrom('three', '第三是 [$3]');
    let caught: unknown = null;
    try {
      expandCustomCommandPrompt(definition, '只 给');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CustomCommandError);
    const err = caught as CustomCommandError;
    expect(err.code).toBe('missing_arguments');
    expect(err.details.required).toBe('3');
    expect(err.details.given).toBe('2');
    expect(err.message).not.toContain('cli.custom.');
    expect(err.message).toContain('three');
  });

  it('空正文 / 非法名字:各自报出可操作文案,且非法名字不会走到拼路径', () => {
    writeCommandFile('blank', '---\ndescription: 只有 frontmatter\n---\n\n   \n');
    expect(() => loadCustomCommand('blank')).toThrow(CustomCommandError);
    expect(() => probeCustomCommand('blank')).toThrow(CustomCommandError); // 探测只放过 not_found

    expect(() => saveCustomCommand({ name: '', body: 'x' })).toThrow(CustomCommandError);
    expect(() => saveCustomCommand({ name: '..', body: 'x' })).toThrow(CustomCommandError);
    for (const bad of ['../evil', 'Has Spaces', '1leading', 'UPPER']) {
      let code = '';
      try {
        saveCustomCommand({ name: bad, body: 'x' });
      } catch (e) {
        code = (e as CustomCommandError).code;
      }
      expect(code).toBe('invalid_name');
    }
    // 名字形态闸在读盘之前:../ 形态不会去碰自定义目录之外的任何路径
    expect(fsNode.existsSync(path.join(getCustomCommandsDir(), '..', 'evil.md'))).toBe(false);
  });

  it('保存 → 读回 → 展开 往返一致(存自定义命令的那一半真的能用)', () => {
    const saved = saveCustomCommand({
      name: 'my-diff',
      description: '看某个文件的\n变更',
      body: '请解释这段 diff:$ARGUMENTS',
    });
    expect(fsNode.existsSync(saved.path)).toBe(true);
    const definition = loadCustomCommand('my-diff');
    expect(definition.description).toBe('看某个文件的 变更'); // 折成单行,frontmatter 才可再解析
    const out = expandCustomCommandPrompt(definition, 'src/a.ts');
    expect(out.prompt).toContain('请解释这段 diff:src/a.ts');
    expect(out.prompt).toContain('user/my-diff.md');
  });

  it('七条文案在语言包里都取得到(不是键名回显)—— 五语言齐不齐由 i18n parity 门判', () => {
    const cases: [string, Record<string, string>][] = [
      ['cli.custom.unknown', { name: 'a', dir: 'd' }],
      ['cli.custom.reserved', { name: 'a', owner: 'model' }],
      ['cli.custom.invalidName', { name: 'a' }],
      ['cli.custom.emptyBody', { name: 'a', path: 'p' }],
      ['cli.custom.unsupportedShell', { name: 'a' }],
      ['cli.custom.missingArgs', { name: 'a', required: '3', given: '1' }],
      ['cli.custom.saved', { name: 'a', path: 'p' }],
    ];
    for (const [key, params] of cases) {
      const text = t(key, params);
      expect(text).not.toBe(key);
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  /** 经 save 落盘再读回(展开路径只吃 CustomCommandDefinition) */
  function loadCustomCommandFrom(name: string, body: string) {
    saveCustomCommand({ name, body });
    return loadCustomCommand(name);
  }
});

/**
 * 接线对账 —— 上面全部用例只证明"模块能用",不证明"有人在屏幕上调用它"。
 * 本仓最高频的失效型就是"造好没装车"(AGENTS 守门 64/70/81/115/138 同族):
 * 模块、用例、类型全绿,而用户敲 `/mycmd` 时得到的仍是"未知命令"。
 * 判据只看代码面(注释与字符串里的名字不算装车),并对每条断言配一次变异对照 ——
 * 只留"它现在通过"这一半,就等于给一台根本没在看的尺子发合格证。
 */
describe('repl 接线:自定义命令必须有生产调用方', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const replSrc = fsNode.readFileSync(path.join(here, '../src/commands/repl.ts'), 'utf8');

  /**
   * 取分派函数的函数体:从声明行起,到下一个顶格 `function` 声明之前。
   * 不按"整份文件最后一个 default:"定位 —— repl.ts 里 `default: {` 出现多处,
   * 别人的分支会把本判据变成"写好了也判红"(本轮实测就是这样)。
   */
  function slashDispatchBody(src: string): string {
    const start = src.indexOf('async function handleSlashCommand(');
    if (start < 0) return '';
    const rest = src.slice(start + 1);
    const next = /^(?:async )?function /m.exec(rest);
    return next ? src.slice(start, start + 1 + next.index) : src.slice(start);
  }

  /**
   * 只保留代码行(行首双斜杠、星号开头的都是注释,不算调用点)。
   * 刻意按**行**过滤而不是正则剥块注释:repl.ts 里有 skills 目录的 glob 字符串,
   * 其中的「斜杠紧跟星号」会被非贪婪配对当成块注释开头,一路吞到 27,796 字符之后的
   * 真闭合序列 —— 本轮实测就是这样把整个 switch 抹掉的(「遮噪层比被判内容更宽」那一型)。
   */
  function codeLines(src: string): string {
    return src
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
  }

  /** 分派函数 default: 分支的代码面文本(取不到返回空串,让断言翻红而不是静默通过)。 */
  function dispatchCode(src: string): string {
    return codeLines(slashDispatchBody(src));
  }

  /** 返回 default: 分支里 buildCustomCommandInvocation 的调用位置(-1 表示没有)。 */
  function callSiteInDefaultBranch(code: string): number {
    const def = code.indexOf('default: {');
    if (def < 0) return -1;
    return code.indexOf('buildCustomCommandInvocation(', def);
  }

  it('repl.ts 从 custom-commands.js 引入分派入口', () => {
    expect(codeLines(replSrc)).toMatch(/from '\.\/custom-commands\.js'/);
  });

  it('default: 分支里真的调用 buildCustomCommandInvocation(不是只 import)', () => {
    expect(callSiteInDefaultBranch(dispatchCode(replSrc))).toBeGreaterThan(-1);
  });

  it('命中后走 sendToAgent,且顺序是"先构造再发送"', () => {
    const code = dispatchCode(replSrc);
    const call = callSiteInDefaultBranch(code);
    expect(call).toBeGreaterThan(-1);
    expect(code.indexOf('await sendToAgent(invocation.prompt', call)).toBeGreaterThan(call);
  });

  it('CustomCommandError 被念出来而不是退化成"未知命令"', () => {
    const code = dispatchCode(replSrc);
    const call = callSiteInDefaultBranch(code);
    expect(call).toBeGreaterThan(-1);
    expect(code.slice(call, code.indexOf('reportUnknownSlashCommand(cmd)', call))).toMatch(
      /e instanceof CustomCommandError/,
    );
  });

  it('变异对照:摘掉调用点后判据必须翻红(证明上面几条有牙)', () => {
    const mutated = replSrc.replace('buildCustomCommandInvocation(cmd,', '/* 摘线 */ (cmd,');
    expect(callSiteInDefaultBranch(dispatchCode(mutated))).toBe(-1);
  });
});

/**
 * `/custom save` —— 把"保存"这一半接到屏幕上(台账号 G-814413 的后半 / 死键 `cli.custom.saved` 的接线)。
 *
 * 上面那一组用例只证明 `saveCustomCommand()` 能用;它此前**全仓零生产调用方**,
 * 用户能跑自定义命令却不能存 —— 回执文案因此是"五语言都翻好了、没人发出去"的死键。
 * 本组钉四件事,每件都配正反对照:
 *  ① 成功路径:文件真落盘 + 回执真被打到输出面(不是只 return 一个对象);
 *  ② 占位符原样:`$ARGUMENTS` / `$1` 写在正文里必须逐字进文件(吃掉它的表现是"存成功了但没参数");
 *  ③ 三条拒绝各不落盘:缺正文 / 缺参数 / 撞内置名 —— 走既有文案,不新写措辞、不静默保存空正文;
 *  ④ 五语言都解析得出这句回执(复用 i18n 加载器的 setLocale/t 入口,不另写一份 parity 校验)。
 */
describe('REPL `/custom save`:保存入口 + 回执接线', () => {
  let tmpHome = '';
  let originalEnv: NodeJS.ProcessEnv = {};
  let originalLocale: Locale = 'zh-CN';
  let emitted: string[] = [];

  beforeEach(() => {
    tmpHome = fsNode.mkdtempSync(path.join(os.tmpdir(), 'ihui-custom-save-'));
    originalEnv = { ...process.env };
    process.env.IHUI_HOME = tmpHome; // §15b:落点在用户级目录,测试换根,不碰真实 ~/.ihui
    originalLocale = getLocale();
    setLocale('zh-CN'); // 语言档钉住:断言里既要 t() 现取的期望值,也要 zh-CN 的观感
    emitted = [];
    vi.spyOn(console, 'info').mockImplementation((...a: unknown[]) => {
      emitted.push(a.map((x) => String(x)).join(' '));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setLocale(originalLocale);
    process.env = originalEnv;
    fsNode.rmSync(tmpHome, { recursive: true, force: true });
  });

  function commandFile(name: string): string {
    return path.join(getCustomCommandsDir(), `${name}.md`);
  }

  it('① 成功:文件真落盘,回执真被打到输出面(含「已保存自定义命令 /demo」)', () => {
    handleCustomCommandSave('save demo 请解释这段 diff');
    const file = commandFile('demo');
    expect(fsNode.existsSync(file)).toBe(true);
    const receipt = t('cli.custom.saved', { name: 'demo', path: file });
    expect(emitted.some((line) => line.includes(receipt))).toBe(true);
    expect(emitted.join('\n')).toContain('已保存自定义命令 /demo');
    // 反向对照:成功路径不该同时念一条拒因(那会让"存好了"与"没存"在输出上同形)
    expect(emitted.join('\n')).not.toContain(t('cli.custom.emptyBody', { name: 'demo', path: file }));
  });

  it('② 正文里的 $ARGUMENTS / $1 原样落盘(占位符不得在保存这一环被吃掉)', () => {
    handleCustomCommandSave('save echo 全参:$ARGUMENTS 首位:$1  次位:$2');
    const written = fsNode.readFileSync(commandFile('echo'), 'utf-8');
    expect(written).toContain('$ARGUMENTS');
    expect(written).toContain('首位:$1  次位:$2'); // 连正文内部的双空白都原样(未被 split/join 归一)
    expect(written).toContain('全参:');
    // 存进去的仍是可用占位符:读回展开后才真的被替换(证明保存环没提前替换成空串)
    const out = expandCustomCommandPrompt(loadCustomCommand('echo'), '甲 乙');
    expect(out.prompt).toContain('全参:甲 乙 首位:甲  次位:乙');
  });

  it('③a 缺正文 ⇒ 走既有 emptyBody 文案、给出用法、不落盘', () => {
    handleCustomCommandSave('save nobody');
    expect(fsNode.existsSync(commandFile('nobody'))).toBe(false);
    const out = emitted.join('\n');
    expect(out).toContain(t('cli.custom.emptyBody', { name: 'nobody', path: commandFile('nobody') }));
    expect(out).toContain(findSlashCommand('custom')?.usage ?? 'NO-USAGE');
    // 反向对照:回执一个字节都没漏出去(拒绝与成功在输出面上必须不同形)
    expect(out).not.toContain(t('cli.custom.saved', { name: 'nobody', path: commandFile('nobody') }));
  });

  it('③b 连名字都没给 / 子命令不认识 ⇒ 只报用法,不落任何文件、不报"未知命令"', () => {
    handleCustomCommandSave('save');
    handleCustomCommandSave('list');
    const out = emitted.join('\n');
    const usage = findSlashCommand('custom')?.usage ?? 'NO-USAGE';
    expect(usage).not.toBe('NO-USAGE'); // 阳性对照:注册表里那条 usage 在位,用法行不是空串
    expect(out.split('✗').length - 1).toBe(2); // 两次调用各给一行用法
    expect(out).toContain(usage);
    expect(out).not.toContain('未知命令'); // 退化成"未知命令"会把真缺陷说成用户拼错
    const dir = getCustomCommandsDir();
    expect(fsNode.existsSync(dir) ? fsNode.readdirSync(dir) : []).toEqual([]);
  });

  it('③c 撞内置名(model)⇒ 走既有 reserved 文案并点名正主,不落盘', () => {
    handleCustomCommandSave('save model 替你把模型切成最贵的');
    expect(fsNode.existsSync(commandFile('model'))).toBe(false);
    const out = emitted.join('\n');
    expect(out).toContain(t('cli.custom.reserved', { name: 'model', owner: 'model' }));
    expect(out).toContain('model');
    // 反向对照:同一位置放一个不撞名的命令必须能存下(证明拦的是撞名而不是整条入口坏了)
    handleCustomCommandSave('save notmodel ok');
    expect(fsNode.existsSync(commandFile('notmodel'))).toBe(true);
  });

  it('④ 五语言都解析得出这句回执(复用加载器 setLocale/t,不写第二份 parity 校验)', () => {
    for (const locale of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as Locale[]) {
      setLocale(locale);
      const text = t('cli.custom.saved', { name: 'demo', path: 'p/q.md' });
      expect(text, locale).not.toBe('cli.custom.saved');
      expect(text, locale).toContain('demo');
      expect(text, locale).toContain('p/q.md');
    }
  });

  it('⑤ 结构锁:分派块里真的有 case custom 且调用保存入口(摘线必读红)', () => {
    const src = fsNode.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/commands/repl.ts'),
      'utf8',
    );
    // 注释里的名字不算装车 —— 过滤必须发生在**变异之后**(先过滤再变异会让被注释掉的调用点
    // 仍以"代码行"的身份留在窗口里,那条反向对照就永远不红 = 一台没牙的尺子)。
    const codeLinesOnly = (text: string): string =>
      text
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n');
    const code = codeLinesOnly(src);
    const start = code.indexOf("case 'custom':");
    expect(start).toBeGreaterThan(-1);
    expect(code.slice(start, start + 240)).toContain('handleCustomCommandSave(');
    // 变异对照:把调用点注释掉后,同一判据必须翻红
    const mutated = codeLinesOnly(src.replace('handleCustomCommandSave(input.slice', '// handleCustomCommandSave(input.slice'));
    const mutatedStart = mutated.indexOf("case 'custom':");
    expect(mutatedStart).toBeGreaterThan(-1);
    expect(mutated.slice(mutatedStart, mutatedStart + 240)).not.toContain('handleCustomCommandSave(');
  });

  it('⑥ /help 与 Tab 补全都看得见它(与既有 /queue 同形:同一注册表驱动,判据对二者一模一样)', () => {
    const custom = findSlashCommand('custom');
    const queue = findSlashCommand('queue');
    expect(custom, '注册表里必须有 custom(否则 /help、补全、保留名判据都查不到它)').toBeDefined();
    // 阳性对照:同一条获取路径也必须取到既有命令 —— 取不到就说明判据读的是空表
    expect(queue, '阳性对照:注册表里的 queue 在位').toBeDefined();

    const help = renderSlashHelp();
    for (const meta of [custom!, queue!]) {
      const line = help.split('\n').find((l) => l.includes(meta.usage));
      expect(line, `${meta.name}: /help 里要有一行含 usage`).toBeDefined();
      expect(line!, `${meta.name}: 同一行还要带上描述`).toContain(meta.description);
    }

    expect(getAllSlashNames()).toContain('/custom');
    expect(slashCompleter('/cus').hits).toContain('/custom');
    expect(slashCompleter('/que').hits).toContain('/queue');
    // 反向锁:没注册过的名字不得被补出来(否则上面两条 hits 断言是恒真的)
    expect(slashCompleter('/customx').hits).toEqual([]);
    // 打错字时"相似度建议"也指向正主(同一张表,不用维护第二份名单)
    expect(suggestSlashCommands('custm').map((c) => c.name)).toContain('custom');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
