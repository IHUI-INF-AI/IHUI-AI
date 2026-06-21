import request from "@/utils/service/index.js";
import {
    getGroupList as sharedGetGroupList,
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
export function getGroupList(id, token) {
    return sharedGetGroupList(sharedRequestAdapter);
}
