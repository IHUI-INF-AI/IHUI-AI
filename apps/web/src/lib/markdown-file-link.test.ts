// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  decodeFilePathUriEscapes,
  getContainingDirectoryPath,
  getPathLeaf,
  isAbsoluteFilePath,
  joinFilePath,
  normalizeWorkspaceRelativeFilePath,
  parseMarkdownFileLink,
  stripBalancedPathQuotes,
  toFileUrl,
} from './markdown-file-link'

/**
 * Markdown 文件链接解析安全链验收测试(2026-09-30 立,吸收批次 74 票 G-977966)。
 * 锁定验收:行列号三格式 / ../ 逃逸拒绝 / /etc/passwd allowlist 拒绝 /
 * %2520 字面保留 / Windows 盘符 workspace 接受 /C:/ / file:// 非 localhost → UNC /
 * 家目录注入解析与 ~user 拒绝 / toFileUrl 补转义 # ? / decodeURI 保留 %2F。
 */

describe('parseMarkdownFileLink 行列号后缀三格式', () => {
  it('`:行` 后缀拆出行号(app.ts:30 → path + line 30)', () => {
    expect(parseMarkdownFileLink('app.ts:30')).toEqual({ path: 'app.ts', line: 30 })
  })

  it('`#L5-L10` 范围后缀取头行,范围尾可留(report.md#L5-L10 → line 5)', () => {
    expect(parseMarkdownFileLink('report.md#L5-L10')).toEqual({ path: 'report.md', line: 5 })
    expect(parseMarkdownFileLink('report.md#L5')).toEqual({ path: 'report.md', line: 5 })
    expect(parseMarkdownFileLink('report.md#l7')).toEqual({ path: 'report.md', line: 7 })
  })

  it('`:行:列` 后缀拆出行与列,并按 workspace 拼接', () => {
    const result = parseMarkdownFileLink('src/app.tsx:30:8', { workspacePath: 'C:\\work' })
    expect(result).toEqual({ path: 'C:\\work\\src\\app.tsx', line: 30, column: 8 })
  })

  it('裸文件名无 workspace 语境:只做目标解析,原样返回归一结果', () => {
    expect(parseMarkdownFileLink('README.md')).toEqual({ path: 'README.md' })
    expect(parseMarkdownFileLink('./notes/todo.md')).toEqual({ path: 'notes/todo.md' })
  })
})

describe('parseMarkdownFileLink workspace 相对与 `../` 逃逸拒绝', () => {
  it('`../escape` 直接前导逃逸 → null', () => {
    expect(parseMarkdownFileLink('../escape', { workspacePath: 'C:\\work' })).toBeNull()
  })

  it('嵌套回退(./a/../../escape)在拼接后才逃逸,词法归一拒绝 → null', () => {
    expect(parseMarkdownFileLink('./a/../../escape', { workspacePath: 'C:\\work' })).toBeNull()
    expect(parseMarkdownFileLink('./a/b/../../../escape', { workspacePath: '/home/u/proj' })).toBeNull()
  })

  it('无 workspace 语境时含 `..` 段的相对路径拒绝', () => {
    expect(parseMarkdownFileLink('../escape')).toBeNull()
  })

  it('workspace 内相对路径按分隔符推断拼接', () => {
    expect(parseMarkdownFileLink('src/a.ts', { workspacePath: 'C:\\work' })).toEqual({
      path: 'C:\\work\\src\\a.ts',
    })
    expect(parseMarkdownFileLink('./src/a.ts', { workspacePath: '/home/u/proj' })).toEqual({
      path: '/home/u/proj/src/a.ts',
    })
  })
})

describe('parseMarkdownFileLink 绝对路径与 Unix 系统根 allowlist', () => {
  it('`/etc/passwd` 在 Windows workspace 上下文被 allowlist 拒绝(本机不可达)', () => {
    expect(parseMarkdownFileLink('/etc/passwd', { workspacePath: 'C:\\work' })).toBeNull()
  })

  it('`/etc/passwd` 在 Unix workspace 被 allowlist 识别为系统绝对路径,不误拼 workspace', () => {
    expect(parseMarkdownFileLink('/etc/passwd', { workspacePath: '/home/u/proj' })).toEqual({
      path: '/etc/passwd',
    })
    expect(parseMarkdownFileLink('/Users/li/notes.md', { workspacePath: '/home/u/proj' })).toEqual({
      path: '/Users/li/notes.md',
    })
  })

  it('非系统根的前导 `/` 按 markdown 根相对处理(harden 把 ./x 规范成 /x)', () => {
    expect(parseMarkdownFileLink('/flappy.html', { workspacePath: '/home/u/proj' })).toEqual({
      path: '/home/u/proj/flappy.html',
    })
  })

  it('远程 workspace 非系统根(/workspace):已在 workspace 内则不重复拼接', () => {
    expect(parseMarkdownFileLink('/workspace/a/b.md', { workspacePath: '/workspace' })).toEqual({
      path: '/workspace/a/b.md',
    })
  })

  it('盘符绝对路径原样接受,不再拼 workspace', () => {
    expect(parseMarkdownFileLink('C:/dir/a.md:30', { workspacePath: 'C:\\work' })).toEqual({
      path: 'C:/dir/a.md',
      line: 30,
    })
  })

  it('反斜杠 Windows 绝对路径先归一后缀再解析', () => {
    expect(parseMarkdownFileLink('C:\\dir\\report.md:30')).toEqual({
      path: 'C:/dir/report.md',
      line: 30,
    })
  })
})

describe('parseMarkdownFileLink `/C:/` harden 内部格式', () => {
  it('Windows 盘符 workspace 接受 `/C:/x/y.md`,剥前导斜杠(反斜杠 UNC 同理)', () => {
    expect(parseMarkdownFileLink('/C:/x/y.md', { workspacePath: 'C:\\work' })).toEqual({
      path: 'C:/x/y.md',
    })
    expect(parseMarkdownFileLink('/C:/x/y.md:9', { workspacePath: 'C:/work' })).toEqual({
      path: 'C:/x/y.md',
      line: 9,
    })
  })

  it('Unix workspace / 无 workspace 时 `/C:/` 拒绝', () => {
    expect(parseMarkdownFileLink('/C:/x/y.md', { workspacePath: '/home/u/proj' })).toBeNull()
    expect(parseMarkdownFileLink('/C:/x/y.md')).toBeNull()
  })
})

describe('parseMarkdownFileLink file:// URL 解析', () => {
  it('非 localhost hostname → UNC 形态', () => {
    expect(parseMarkdownFileLink('file://server/share/doc.md')).toEqual({
      path: '//server/share/doc.md',
    })
  })

  it('Windows 盘符 file URL 去前导斜杠', () => {
    expect(parseMarkdownFileLink('file:///C:/x/y.md')).toEqual({ path: 'C:/x/y.md' })
  })

  it('file URL 内 percent-escape 在归一化阶段解码一次', () => {
    expect(parseMarkdownFileLink('file:///home/li/docs/a%20b.md')).toEqual({
      path: '/home/li/docs/a b.md',
    })
  })

  it('非文件协议链拒绝', () => {
    expect(parseMarkdownFileLink('https://a.com/x.md')).toBeNull()
    expect(parseMarkdownFileLink('mailto:a@b.com')).toBeNull()
  })
})

describe('parseMarkdownFileLink `~` 家目录解析(homePath 注入)', () => {
  it('`~/x` 经注入 homePath 解析;`./~/x` harden 产物同链', () => {
    expect(parseMarkdownFileLink('~/doc.md', { homePath: '/Users/li' })).toEqual({
      path: '/Users/li/doc.md',
    })
    expect(parseMarkdownFileLink('./~/doc.md', { homePath: 'C:\\Users\\wang' })).toEqual({
      path: 'C:\\Users\\wang\\doc.md',
    })
  })

  it('homePath 未注入或非绝对 → 拒绝', () => {
    expect(parseMarkdownFileLink('~/doc.md')).toBeNull()
    expect(parseMarkdownFileLink('~/doc.md', { homePath: 'relative/path' })).toBeNull()
  })

  it('`~user/x` 命名家目录拒绝', () => {
    expect(parseMarkdownFileLink('~user/x.md', { homePath: '/Users/li' })).toBeNull()
  })
})

describe('parseMarkdownFileLink percent-escape 与引号剥离', () => {
  it('%2520 字面保留:只在归一化阶段解码一次,不提前解码', () => {
    const result = parseMarkdownFileLink('my%2520file.md')
    expect(result?.path).toBe('my%20file.md')
    expect(result?.path).not.toContain(' ')
    expect(result?.path).not.toBe('my file.md')
  })

  it('percent 编码引号对剥离后仍走单次解码', () => {
    expect(parseMarkdownFileLink('%22my%20file.md%22')).toEqual({ path: 'my file.md' })
  })

  it('外围成对引号剥离(弯引号/直引号),不成对保留原文', () => {
    expect(stripBalancedPathQuotes('“my file.md”')).toBe('my file.md')
    expect(stripBalancedPathQuotes('"a.md"')).toBe('a.md')
    expect(stripBalancedPathQuotes('un"balanced')).toBe('un"balanced')
    // harden 产物 /“path”:剥引号后仍是相对路径时还原保护层
    expect(stripBalancedPathQuotes('/“my file.md”')).toBe('/my file.md')
  })

  it('解码发生在后缀拆分之后:文件名空格不破坏 `:行` 解析', () => {
    expect(parseMarkdownFileLink('a%20b.md:3', { workspacePath: '/home/u/proj' })).toEqual({
      path: '/home/u/proj/a b.md',
      line: 3,
    })
  })
})

describe('normalizeWorkspaceRelativeFilePath 词法归一', () => {
  it('根目录下溢返回 null,普通归一跳过 `.` 与空段', () => {
    expect(normalizeWorkspaceRelativeFilePath('a/../../c')).toBeNull()
    expect(normalizeWorkspaceRelativeFilePath('a/./b')).toBe('a/b')
    expect(normalizeWorkspaceRelativeFilePath('a\\b')).toBe('a/b')
  })
})

describe('path 工具组', () => {
  it('getPathLeaf:反斜杠/正斜杠通吃,盘符根回退盘符', () => {
    expect(getPathLeaf('C:\\dir\\file.md')).toBe('file.md')
    expect(getPathLeaf('/a/b/')).toBe('b')
    expect(getPathLeaf('C:\\')).toBe('C:')
  })

  it('getContainingDirectoryPath:盘符根特殊处理返回 `C:\\`', () => {
    expect(getContainingDirectoryPath('C:\\dir\\f.md')).toBe('C:\\dir')
    expect(getContainingDirectoryPath('C:\\f.md')).toBe('C:\\')
    expect(getContainingDirectoryPath('/a/b')).toBe('/a')
    expect(getContainingDirectoryPath('f.md')).toBeNull()
  })

  it('isAbsoluteFilePath:含 UNC 形态', () => {
    expect(isAbsoluteFilePath('/a/b')).toBe(true)
    expect(isAbsoluteFilePath('C:\\a')).toBe(true)
    expect(isAbsoluteFilePath('\\\\srv\\share')).toBe(true)
    expect(isAbsoluteFilePath('a/b')).toBe(false)
  })

  it('joinFilePath:分隔符按基准路径推断,子路径为绝对路径时直接返回', () => {
    expect(joinFilePath('C:\\work', 'a\\b.md')).toBe('C:\\work\\a\\b.md')
    expect(joinFilePath('/work', 'a/b.md')).toBe('/work/a/b.md')
    expect(joinFilePath('C:\\work\\', 'x.md')).toBe('C:\\work\\x.md')
    expect(joinFilePath('/work', '/abs.md')).toBe('/abs.md')
  })

  it('decodeFilePathUriEscapes:decodeURI 只还原路径文本,保留 %2F 分隔符转义', () => {
    expect(decodeFilePathUriEscapes('a%2Fb.md')).toBe('a%2Fb.md')
    expect(decodeFilePathUriEscapes('a%20b.md')).toBe('a b.md')
    expect(decodeFilePathUriEscapes('no-escape.md')).toBe('no-escape.md')
  })

  it('toFileUrl:文件名含 # ? 时补转义(encodeURI 不转义,会被 URL 解析截断 pathname)', () => {
    expect(toFileUrl('C:\\dir\\index#v2.html')).toBe('file:///C:/dir/index%23v2.html')
    expect(toFileUrl('E:\\dir\\index#v2.html')).toBe('file:///E:/dir/index%23v2.html')
    expect(toFileUrl('/tmp/a?b.md')).toBe('file:///tmp/a%3Fb.md')
    expect(toFileUrl('/tmp/a b.md')).toBe('file:///tmp/a%20b.md')
  })

  it('toFileUrl:UNC 形态生成 file://host/share', () => {
    expect(toFileUrl('\\\\server\\share\\f.md')).toBe('file://server/share/f.md')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
