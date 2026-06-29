/**
 * commitlint 配置（conventional commits 规范）
 *
 * 提交格式：type(scope): subject
 * 例：feat(fankui): 添加图片上传功能
 *     fix(upload): 修复 uploadSinglePicture 返回值 bug
 *     docs(eslint): 补充 eslint 配置说明
 *
 * 规则等级：
 * - 0: off 不校验
 * - 1: warning 警告（不阻止提交）
 * - 2: error 错误（阻止提交）
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // type 枚举（必须为以下之一）
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // bug 修复
        'docs',     // 文档变更
        'style',    // 代码格式（不影响功能）
        'refactor', // 重构（既不是新增功能也不是修复 bug）
        'perf',     // 性能优化
        'test',     // 新增/修改测试
        'build',    // 构建系统或外部依赖变更
        'ci',       // CI 配置变更
        'chore',    // 杂项（不修改 src 或测试）
        'revert',   // 回滚 commit
      ],
    ],
    // type 不能为空
    'type-empty': [2, 'never'],
    // subject 不能为空
    'subject-empty': [2, 'never'],
    // subject 不超过 100 字符
    'subject-max-length': [2, 'always', 100],
    // subject 不要求句号结尾（中文场景）
    'subject-full-stop': [0],
    // subject 不强制小写（中文场景）
    'subject-case': [0],
    // header 不超过 120 字符
    'header-max-length': [2, 'always', 120],
    // body 每行不超过 200 字符
    'body-max-line-length': [1, 'always', 200],
    // footer 每行不超过 200 字符
    'footer-max-line-length': [1, 'always', 200],
  },
}
