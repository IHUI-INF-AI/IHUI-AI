/**
 * CSV 导出公共工具。
 *
 * 提供 CSV 公式注入(Formula Injection / CSV Injection, OWASP)防护。
 *
 * 背景:Excel / Google Sheets / LibreOffice 打开 CSV 时,若单元格值以 `=` `+` `-` `@`
 * 开头,会被当作公式执行。攻击者可构造 `=HYPERLINK("http://evil","x")`、
 * `=cmd|'/C calc'!A0`、`@SUM(...)` 等载荷,在管理端导出对账/报表时触发命令执行或
 * 数据窃取(单元格内容可被公式外带)。
 *
 * 修复:对所有以这些字符开头的单元格值前缀 `'`(单引号),Excel 将其视为纯文本而非公式。
 *
 * 注意:数字字段(金额/计数等)由程序生成、非用户可控,不属于注入面;但本函数对任何
 * 以 `=`/`+`/`-`/`@` 开头的字符串统一处理,不影响数字显示以外的正常文本。
 */
export function sanitizeCsvCell(v: string): string {
  const first = v.charAt(0)
  if (first === '=' || first === '+' || first === '-' || first === '@') {
    return `'${v}`
  }
  return v
}
