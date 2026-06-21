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
