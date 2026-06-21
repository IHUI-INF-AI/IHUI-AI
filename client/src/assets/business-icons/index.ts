/**
 * 业务 SVG 图标(从 G:\code\edu 整合,剥离 style 改为 currentColor)
 * 通过 <SvgIcon name="lesson" /> 使用
 */
import articleSvg from './article.svg?raw'
import askSvg from './ask.svg?raw'
import circleSvg from './circle.svg?raw'
import examSvg from './exam.svg?raw'
import lessonSvg from './lesson.svg?raw'
import liveSvg from './live.svg?raw'
import newsSvg from './news.svg?raw'
import resourceSvg from './resource.svg?raw'

export const businessIcons: Record<string, string> = {
  article: articleSvg,
  ask: askSvg,
  circle: circleSvg,
  exam: examSvg,
  lesson: lessonSvg,
  live: liveSvg,
  news: newsSvg,
  resource: resourceSvg,
}

export default businessIcons
