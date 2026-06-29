import request from "@/utils/service/index.js";
import {
    getAigcList as sharedGetAigcList,
} from "@/vendor/shared-services.bundle.js";

const sharedRequestAdapter = {
    request(config) {
        return request({
            url: config.url,
            method: config.method || "GET",
            data: config.params || config.data || {},
            header: config.headers || {},
            timeout: config.timeout,
            base: config.base,
        });
    },
};

// 获取智能体历史对话
export function getList(pageNum = 1, pageSize = 6, fileType = '') {
    return sharedGetAigcList(sharedRequestAdapter, { pageNum, pageSize, fileType });
}

/**
 * 获取 AIGC 内容列表
 * @param {number} page - 页码
 * @param {number} limit - 每页条数
 * @param {number|string} gc_type - 内容类型：1=图片 2=视频 3=音频 4=文本
 * @returns {Promise}
 */
export function getContentList(page = 1, limit = 10, gc_type = '') {
    return request({
        url: `/content/aigc/list`,
        method: 'GET',
        data: { page, limit, gc_type },
        base: 1
    });
}
