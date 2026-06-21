/**
 * 共享 UI 组件库
 * 无 Element Plus 依赖的展示组件
 */
import Empty from './Empty.vue'
import Button from './Button.vue'
import Card from './Card.vue'

const components = {
  Empty,
  Button,
  Card
}

export function install(app) {
  Object.keys(components).forEach(key => {
    app.component(components[key].name, components[key])
  })
}

export { Empty, Button, Card }
export default components
