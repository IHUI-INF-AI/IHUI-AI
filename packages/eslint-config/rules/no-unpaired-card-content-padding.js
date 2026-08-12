/**
 * @ihui/eslint-plugin/internal
 * 自定义 ESLint 规则集合(项目级、共享包导出)
 * 适配 ESLint 9 flat config 的 ESM 写法
 */

/**
 * no-unpaired-card-content-padding(2026-08-12 立)
 *
 * 防止 <CardContent className="...p-X..."> 偏离默认 p-4 时无响应式限定。
 * 当前 CardContent 默认 = 'p-4'(2026-08-12,见当日记忆),
 *
 *   - 自定义 className 含 'p-4':与默认一致,无差异,允许。
 *   - 自定义 className 含 'p-X' 且 X != 4:偏离默认,需加 min-[640px]:p-Y 限定,
 *     否则未来 CardContent 默认值再次改成响应式时会出现移动宽屏 padding 不一致。
 *   - 自定义 className 含 'p-0':零 padding 锁定,允许。
 *
 * 例外:同时含 min-[640px]:pt-X 或 pb-X 的精细控制。
 *       className 为变量/拼接时无法静态分析,跳过。
 */

const P_DIGIT_RE = /\bp-(?:0|[1-9]|1\d|2\d)\b/;
const MIN_640_P_RE = /\bmin-\[640px\]:p-(?:0|[1-9]|1\d|2\d)\b/;
const MIN_PT_RE = /\bmin-\[640px\]:(pt|pb)-(?:0|[1-9]|1\d|2\d)\b/;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止 <CardContent className="...p-X...">(X≠4)缺少响应式 padding 限定，避免偏离默认 p-4 时未来响应式断点不一致。',
    },
    schema: [],
    messages: {
      unpairedPadding:
        '<CardContent className="...p-X..."> 中 X ≠ 当前默认 p-4，必须配对 min-[640px]:p-Y（或同时含 min-[640px]:pt-X / pb-X）响应式限定。例外：p-0、p-4。CardContent 默认 p-4（2026-08-12 改动），未来若默认重新引入 min-[640px]:p-Z 响应式，单写 X≠4 的 p-X 会在响应式断点出现非预期。',
    },
  },
  create(context) {
    function isCardContentName(nameNode) {
      if (!nameNode) return false;
      if (nameNode.type === 'JSXIdentifier') return nameNode.name === 'CardContent';
      if (nameNode.type === 'JSXMemberExpression') {
        const propName = nameNode.property?.name;
        return propName === 'CardContent';
      }
      if (typeof nameNode.name === 'string') return nameNode.name === 'CardContent';
      return false;
    }

    function lintJSXElement(node) {
      // ESLint espree AST 字段名是 openingElement / closingElement, 不是 opening / closing
      const openingElement = node.openingElement;
      if (!openingElement) return;
      if (!isCardContentName(openingElement.name)) return;
      const attrs = openingElement.attributes || [];
      if (!attrs.length) return;
      let classAttrValue = null;
      let skipDynamic = false;
      for (const attr of attrs) {
        if (attr.type !== 'JSXAttribute') continue;
        if (!attr.name || attr.name.name !== 'className') continue;
        const v = attr.value;
        if (!v) return;
        if (v.type === 'Literal' && typeof v.value === 'string') {
          classAttrValue = v.value;
          break;
        }
        if (v.type === 'JSXExpressionContainer') {
          const e = v.expression;
          if (e && e.type === 'Literal' && typeof e.value === 'string') {
            classAttrValue = e.value;
            break;
          }
          if (e && e.type === 'TemplateLiteral' && e.quasis && e.quasis.length === 1) {
            classAttrValue = e.quasis[0].value.cooked || '';
            break;
          }
          // 动态值(变量/拼接/三目): 无法静态分析,跳过
          skipDynamic = true;
          break;
        }
        return;
      }
      if (skipDynamic) return;
      if (typeof classAttrValue !== 'string') return;
      if (!P_DIGIT_RE.test(classAttrValue)) return;
      if (MIN_640_P_RE.test(classAttrValue) || MIN_PT_RE.test(classAttrValue)) return;
      const paddingClasses = (classAttrValue.match(/\bp-(?:0|[1-9]|1\d|2\d)\b/g) || []).filter(Boolean);
      // 例外: padding 类中没有 X≠0 且 X≠4 的(即全部都是 p-0 / p-4)
      // 注:p-0 与 p-4 同时出现是 CSS 异常用法,但仍视为允许(显式把 padding 拉到 0/4 不需响应式)
      const hasNonDefault = paddingClasses.some((c) => c !== 'p-0' && c !== 'p-4');
      if (!hasNonDefault) return;
      context.report({ node, messageId: 'unpairedPadding' });
    }

    return {
      JSXElement: lintJSXElement,
    };
  },
};

export const noUnpairedCardContentPadding = rule;

export default { rules: { 'no-unpaired-card-content-padding': rule } };
