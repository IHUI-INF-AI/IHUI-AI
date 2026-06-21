/**
 * AI生成组件统一导出
 * 
 * @module components/ai-generation
 * @version 1.0.0
 */

// 资源管理库
export { default as ResourceLibrary } from './ResourceLibrary.vue'

// 短剧剧本编辑器
export { default as DramaScriptExcel } from './DramaScriptExcel.vue'

// 图像生成组件
export { default as ImageGenQwen } from './ImageGenQwen.vue'
export { default as ImageGenQwenI2I } from './ImageGenQwenI2I.vue'
export { default as ImageEditQwen } from './ImageEditQwen.vue'
export { default as ImageGenDoubao } from './ImageGenDoubao.vue'
export { default as ImageGenJimeng } from './ImageGenJimeng.vue'

// 视频生成组件
export { default as VideoGenQwen } from './VideoGenQwen.vue'
export { default as VideoGenKling } from './VideoGenKling.vue'
export { default as VideoGenOneClick } from './VideoGenOneClick.vue'

// 3D模型生成组件
export { default as Model3DGenHunyuan } from './Model3DGenHunyuan.vue'

// 视觉分析组件
export { default as VisionAnalysis } from './VisionAnalysis.vue'
