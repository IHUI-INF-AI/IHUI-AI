/**
 * ESLint 自定义规则：禁止在 onUnmounted/onBeforeUnmount 中直接做定时器/事件监听器清理
 *
 * 规则名：ihui/no-manual-cleanup
 * 场景：项目已统一使用 useCleanup composable 管理清理逻辑，
 *       直接在 onUnmounted/onBeforeUnmount 中手写 clearInterval/clearTimeout/
 *       removeEventListener/cancelAnimationFrame/abort 等清理代码会导致遗漏和重复
 *
 * 规则逻辑：
 * 1. 识别 onUnmounted(...)/onBeforeUnmount(...) 调用
 * 2. 检查回调函数体内是否包含清理操作（clearInterval/clearTimeout/
 *    removeEventListener/cancelAnimationFrame/.abort()/.disconnect()/.close()）
 * 3. 若包含则报错，提示使用 useCleanup
 *
 * 豁免：
 * - 空块（只有注释）不报错
 * - 调用其他函数（如 cleanup()、stop()、dispose()）不报错，因为这些可能是封装好的清理函数
 */

'use strict'

// 需要检测的清理方法名
const CLEANUP_PATTERNS = new Set([
  'clearInterval',
  'clearTimeout',
  'removeEventListener',
  'cancelAnimationFrame',
  'cancelIdleCallback',
])

// 需要检测的实例方法名（xxx.abort()、xxx.disconnect()、xxx.close()）
const CLEANUP_METHODS = new Set(['abort', 'disconnect', 'close', 'unobserve'])

// onUnmounted/onBeforeUnmount 函数名
const TARGET_FNS = new Set(['onUnmounted', 'onBeforeUnmount'])

/**
 * 递归遍历 AST 节点，查找清理操作
 */
function findCleanupCalls(node, results) {
  if (!node) return

  switch (node.type) {
    case 'BlockStatement':
      for (const stmt of node.body) {
        findCleanupCalls(stmt, results)
      }
      break
    case 'ExpressionStatement':
      findCleanupCalls(node.expression, results)
      break
    case 'CallExpression':
      // 直接调用 clearInterval/clearTimeout/removeEventListener 等
      if (node.callee.type === 'Identifier' && CLEANUP_PATTERNS.has(node.callee.name)) {
        results.push(node.callee.name)
      }
      // 调用实例方法 xxx.abort()/xxx.disconnect()/xxx.close()
      // 也检测 xxx.removeEventListener()/xxx.clearTimeout() 等成员调用方式
      if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
        if (CLEANUP_METHODS.has(node.callee.property.name)) {
          results.push(node.callee.property.name)
        }
        if (CLEANUP_PATTERNS.has(node.callee.property.name)) {
          results.push(node.callee.property.name)
        }
      }
      // 继续遍历参数
      for (const arg of node.arguments) {
        findCleanupCalls(arg, results)
      }
      break
    case 'IfStatement':
      findCleanupCalls(node.consequent, results)
      findCleanupCalls(node.alternate, results)
      break
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      findCleanupCalls(node.body, results)
      break
    default:
      break
  }
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止在 onUnmounted/onBeforeUnmount 中直接做清理，应使用 useCleanup composable',
      recommended: true,
    },
    messages: {
      useCleanup:
        '在 {{fn}} 中直接调用 {{method}} 清理资源，请改用 useCleanup composable 统一管理清理逻辑',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        // 仅处理 onUnmounted(...)/onBeforeUnmount(...) 调用
        if (node.callee.type !== 'Identifier') return
        if (!TARGET_FNS.has(node.callee.name)) return

        const callback = node.arguments[0]
        if (!callback) return

        // 情况1：传入箭头函数 () => { ... }
        // 情况2：传入函数引用 fn（无法检测内部，跳过）
        if (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression') {
          return
        }

        const results = []
        findCleanupCalls(callback.body, results)

        if (results.length > 0) {
          context.report({
            node: node,
            messageId: 'useCleanup',
            data: {
              fn: node.callee.name,
              method: results[0],
            },
          })
        }
      },
    }
  },
}
