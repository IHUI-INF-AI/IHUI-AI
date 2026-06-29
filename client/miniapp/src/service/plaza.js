import request from "@/utils/service/index.js";

/**
 * 获取广场需求列表
 * @param {number} page - 页码
 * @param {number} limit - 每页条数
 * @param {string} category - 赛道分类
 * @param {string} keyword - 搜索关键词
 * @returns {Promise}
 */
export function getPlazaList(page = 1, limit = 20, category = '', keyword = '') {
  return request({
    url: `/plaza/list`,
    method: 'GET',
    data: { page, limit, category, keyword },
    base: 1
  });
}
