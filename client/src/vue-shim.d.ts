// Vue script setup 类型支持
declare module '@vue/runtime-core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface ComponentCustomProperties {}
}

// 确保script setup中的变量能被识别
declare module '@vue/compiler-sfc' {
  export interface SFCCompilerOptions {
    scriptSetup?: boolean
  }
}
