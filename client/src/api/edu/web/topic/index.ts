// @ts-nocheck
// 自动生成: 用户端 API re-export shim，re-export 自 @/api/edu/web-api
import { topicApi } from '@/api/edu/web-api'

export const getTopicList = topicApi.getTopicList

import router from '@/router'
export function gotoTopic(item) {
  if (item.type === 'comment' || item.type === 'reply_comment') return
  switch (item.topicType) {
    case 'lesson': router.push({ path: '/edu/learn/detail', query: { id: item.topicId } }); break
    case 'news': router.push({ path: '/edu/news/detail', query: { id: item.topicId } }); break
    case 'channel': router.push({ path: '/edu/live/detail', query: { id: item.topicId } }); break
    case 'article': router.push({ path: '/edu/article/detail', query: { id: item.topicId } }); break
    case 'resource': router.push({ path: '/edu/resource/detail', query: { id: item.topicId } }); break
    case 'question': router.push({ path: '/edu/ask/question', query: { id: item.topicId } }); break
    case 'answer': router.push({ path: '/edu/ask/question', query: { id: item.question ? item.question.id : item.topic.parentTopic.id } }); break
    case 'dynamic': router.push({ path: '/edu/circle/detail', query: { id: item.topicId } }); break
  }
}
