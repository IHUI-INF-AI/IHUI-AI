// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-079 回归:Windows cmd.exe 与 POSIX 分词错配。
 *
 * 旧 tokenizer 只认 `$` / `\`,在 Windows(shell:true ⇒ cmd.exe)下:
 *   - `%USERPROFILE%` 被当普通字符 ⇒ 变量展开后的真实路径看不见,静默放行;
 *   - `^` 未识别 ⇒ `r^m` 在 cmd 里等价 `rm`,却能绕过命令名判定;
 *   - `\` 被当 POSIX 转义 ⇒ `C:\Users\me\.env` 被吃掉字符。
 * 现按方言分词:cmd 下 `%VAR%` 记 cmd-variable issue(fail closed,不猜展开值)、
 * `^` 静态去转义(`r^m` ⇒ `rm`)、`\` 按路径分隔符保留。POSIX 默认行为不变。
 */
import { describe, expect, it } from 'vitest';
import { tokenizeCommand } from '../src/tools/command-policy/tokenizer.js';
import { evaluateCommandAllowlist } from '../src/sandbox/index.js';

describe('cmd 方言:%VAR% 不静默放行', () => {
  it('`type %USERPROFILE%\\.env` 记 cmd-variable 且参数标记为不可静态确定', () => {
    const result = tokenizeCommand('type %USERPROFILE%\\.env', { dialect: 'cmd' });

    expect(result.issues.some((i) => i.kind === 'cmd-variable')).toBe(true);
    expect(result.segments[0]!.argv[1]!.expanded).toBe(true);
    expect(result.segments[0]!.argv[1]!.value).toContain('%USERPROFILE%');
  });

  it('双引号内的 %VAR% 在 cmd 里照样展开,同样记 issue', () => {
    const result = tokenizeCommand('type "%USERPROFILE%\\.env"', { dialect: 'cmd' });

    expect(result.issues.some((i) => i.kind === 'cmd-variable')).toBe(true);
  });

  it('非变量形态的 % 不误报(`100%` / `%%`)', () => {
    expect(tokenizeCommand('echo 100% done', { dialect: 'cmd' }).issues).toHaveLength(0);
    expect(tokenizeCommand('echo 100%%', { dialect: 'cmd' }).issues).toHaveLength(0);
  });
});

describe('cmd 方言:^ 转义与 \\ 路径分隔符', () => {
  it('`r^m` 归一为 `rm`(cmd 里就是 rm)', () => {
    const result = tokenizeCommand('r^m -rf build', { dialect: 'cmd' });

    expect(result.issues).toHaveLength(0);
    expect(result.segments[0]!.argv[0]!.value).toBe('rm');
  });

  it('`^` 后的 & 是字面量,不当作段分隔符', () => {
    const result = tokenizeCommand('git status ^& del x', { dialect: 'cmd' });

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]!.argv).toEqual([
      { value: 'git', expanded: false },
      { value: 'status', expanded: false },
      { value: '&', expanded: false },
      { value: 'del', expanded: false },
      { value: 'x', expanded: false },
    ]);
  });

  it('`\\` 在 cmd 下是路径分隔符,不被当作转义吃掉', () => {
    const result = tokenizeCommand('type C:\\Users\\me\\.env', { dialect: 'cmd' });

    expect(result.segments[0]!.argv[1]!.value).toBe('C:\\Users\\me\\.env');
  });
});

describe('POSIX 默认行为不变', () => {
  it('未传 dialect 时 `\\` 仍是转义符', () => {
    const result = tokenizeCommand('r\\m -rf build');

    expect(result.segments[0]!.argv[0]!.value).toBe('rm');
  });

  it('未传 dialect 时 `%VAR%` 不是变量展开(保持字面量)', () => {
    const result = tokenizeCommand('type %USERPROFILE%\\.env');

    expect(result.issues).toHaveLength(0);
  });
});

describe('调用方(sandbox)在 Windows 上走 cmd 语义', () => {
  it.skipIf(process.platform !== 'win32')('%VAR% 与 ^ 转义命令被白名单判据拒绝', () => {
    const allow = ['type', 'rm'];

    // 能静态求出 `rm`,但 rm 之外还带越权参数——这里只验"命令名可见/不可见"这一层:
    // `%USERPROFILE%` 展开不可判定 ⇒ 整行拒;`r^m` 归一为 rm ⇒ 命令名不再逃逸。
    expect(evaluateCommandAllowlist('type %USERPROFILE%\\.env', allow)).not.toBeNull();
    expect(evaluateCommandAllowlist('r^m -rf build', ['type'])).not.toBeNull();
    expect(evaluateCommandAllowlist('r^m -rf build', allow)).toBeNull();
  });
});
