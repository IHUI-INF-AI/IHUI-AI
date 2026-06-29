import request from "@/utils/service/index.js";

/**
 * 获取文章评论列表
 * @param {string|number} aid - 文章ID
 * @param {number} page - 页码
 * @param {number} limit - 每页条数
 * @returns {Promise}
 */
export function getArticleComments(aid, page = 1, limit = 20) {
  return request({
    url: `/news/article/${aid}/comments`,
    method: 'GET',
    data: { page, limit },
    base: 1
  });
}
