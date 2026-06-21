/**
 * Ripple_Yu获取首页资源 云函数 API
 * 读取 热门课程数据（type: 1 和 2 各取5条  课程类型（例如：1-爆款入门，2-爆款精选）） 知识星球数据（type: 1 和 2 各取5条  资讯类型（1-官方资讯，2-社区资讯））
 * 返回数据
 */

'use strict';

const db = uniCloud.database()
const $ = db.command.aggregate

exports.main = async (event, context) => {
  // 热门课程数据（type: 1 和 2 各取5条）
  const popularCoursesType1 = await db.collection('zhs-popular-courses')
    .orderBy('created_at', 'desc')
    .where({ type: 1 })
    .limit(5)
    .get()

  const popularCoursesType2 = await db.collection('zhs-popular-courses')
    .orderBy('created_at', 'desc')
    .where({ type: 2 })
    .limit(5)
    .get()

  // 知识星球数据（type: 1 和 2 各取5条）
  const knowledgePlanetType1 = await db.collection('zhs-knowledge-planet')
    .orderBy('created_at', 'desc')
    .where({ type: 1 })
    .limit(5)
    .get()

  const knowledgePlanetType2 = await db.collection('zhs-knowledge-planet')
    .orderBy('created_at', 'desc')
    .where({ type: 2 })
    .limit(5)
    .get()

  return {
    code: 0,
    message: '获取成功',
    data: {
      popularCourses: [
        ...popularCoursesType1.data,
        ...popularCoursesType2.data
      ],
      knowledgePlanet: [
        ...knowledgePlanetType1.data,
        ...knowledgePlanetType2.data
      ]
    }
  }
}
