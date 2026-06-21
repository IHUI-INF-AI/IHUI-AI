/**
 * ESLint 自定义规则：检测响应式对象中未使用 markRaw 包装的组件 icon
 *
 * 规则名：ihui/markraw-icon
 * 场景：在 ref()/reactive()/computed() 包装的对象数组中，若 icon/component 字段值为
 *       从 @element-plus/icons-vue 或其他组件库导入的组件对象，且未用 markRaw 包装，
 *       会触发 Vue 警告 "Vue received a Component which was made a reactive object"
 *
 * 规则逻辑：
 * 1. 识别 ref(...)/reactive(...)/computed(...) 调用
 * 2. 在其参数中查找对象字面量（数组元素或对象属性）
 * 3. 检查 icon/component 字段值是否为标识符（未包装的组件引用）
 * 4. 若是则报错，提示用 markRaw 包装
 *
 * 已知限制：仅检测直接标识符，不检测函数调用结果或复杂表达式
 */

'use strict'

const REACTIVE_FNS = new Set(['ref', 'reactive', 'computed', 'shallowRef', 'shallowReactive'])

// 需要检测的组件字段名（icon 和 component 都可能存储组件对象）
const COMPONENT_FIELDS = new Set(['icon', 'component'])

/**
 * 判断对象字面量中是否包含 icon/component 字段且值为未包装的标识符
 */
function checkObjectExpression(node, context) {
  if (!node || node.type !== 'ObjectExpression') return

  for (const prop of node.properties) {
    if (prop.type !== 'Property') continue
    const keyName = prop.key && (prop.key.name || prop.key.value)
    if (!COMPONENT_FIELDS.has(keyName)) continue

    // 字段值是标识符（组件引用），且不是 markRaw(...) 调用
    if (prop.value.type === 'Identifier') {
      const iconName = prop.value.name
      context.report({
        node: prop.value,
        messageId: 'markRawRequired',
        data: { icon: iconName, field: keyName },
        fix: (fixer) => fixer.replaceText(prop.value, `markRaw(${iconName})`),
      })
    }
  }
}

/**
 * 递归查找数组表达式中的所有对象字面量
 */
function checkArrayExpression(node, context) {
  if (!node) return
  if (node.type === 'ObjectExpression') {
    checkObjectExpression(node, context)
  } else if (node.type === 'ArrayExpression') {
    for (const element of node.elements) {
      checkArrayExpression(element, context)
    }
  }
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: '要求 ref/reactive/computed 中的组件 icon 使用 markRaw 包装',
      recommended: true,
    },
    fixable: 'code',
    messages: {
      markRawRequired:
        '响应式对象中的组件 {{field}} "{{icon}}" 必须使用 markRaw() 包装，否则会触发 Vue 响应式代理警告',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        // 仅处理 ref/reactive/computed/shallowRef/shallowReactive 调用
        if (node.callee.type !== 'Identifier') return
        if (!REACTIVE_FNS.has(node.callee.name)) return

        const arg = node.arguments[0]
        if (!arg) return

        // 情况1：直接传入数组 ref([...])
        if (arg.type === 'ArrayExpression') {
          checkArrayExpression(arg, context)
        }
        // 情况2：computed(() => [...]) 箭头函数返回数组
        else if (
          arg.type === 'ArrowFunctionExpression' &&
          arg.body &&
          (arg.body.type === 'ArrayExpression' || arg.body.type === 'ObjectExpression')
        ) {
          checkArrayExpression(arg.body, context)
        }
        // 情况3：直接传入对象 reactive({...})
        else if (arg.type === 'ObjectExpression') {
          checkObjectExpression(arg, context)
        }
      },
    }
  },
}
