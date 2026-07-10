import type { Plugin } from 'vite'

export function baiduSpeechPlugin(): Plugin {
  return {
    name: 'baidu-speech-plugin',
    configureServer(_server) {
      // TODO: 实现百度语音插件
    },
  }
}

export default baiduSpeechPlugin
