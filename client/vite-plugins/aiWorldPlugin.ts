import type { Plugin } from 'vite'

export function aiWorldPlugin(): Plugin {
  return {
    name: 'ai-world-plugin',
    configureServer(_server) {
      // TODO: 实现 ai-world 插件
    },
  }
}

export default aiWorldPlugin
