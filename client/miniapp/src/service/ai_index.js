import { request } from "@/service/shared-request.ts";
import {
    getPlazaList as sharedGetPlazaList,
    addPlazaTask as sharedAddPlazaTask,
    getPlazaTaskInfo as sharedGetPlazaTaskInfo,
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

// 获取 AI团队 智能体 列表
export function getModelChat(data) {
    return request({
        url: `/cozeZhsApi/user-model-chat/query`,
        method: "POST",
        header: {
            "content-type": "application/json",
        },
        data,
        base: 3
    });
}

export function createModelChat(data) {
    return request({
        url: `/cozeZhsApi/user-model-chat/create`,
        method: "POST",
        header: {
            "content-type": "application/json",
        },
        data,
        base: 3
    });
}

export function queryAgentContext(data) {
    return request({
        url: `/cozeZhsApi/user-agent-context/query`,
        method: "POST",
        header: {
            "content-type": "application/json",
        },
        data,
        base: 3
    });
}


export function updateMark(data) {
    return request({
        url: `/cozeZhsApi/user-model-chat/update/mark`,
        method: "POST",
        header: {
            "content-type": "application/json",
        },
        data,
        base: 3
    });
}


export function removeModelChat(id) {
    return request({
        url: `/cozeZhsApi/user-model-chat/${id}`,
        method: "delete",
        header: {
            "content-type": "application/json",
        },
        base: 3
    });
}

// 检查首次分享状态
export function checkFirstShareStatus() {
    return request({
        url: `/resource/first/share/show`,
        method: "GET",
        header: {
            "content-type": "application/json",
        },
        base: 1
    });
}

// 首次分享领智汇值
export function firstShare() {
    return request({
        url: `/resource/first/share`,
        method: "GET",
        header: {
            "content-type": "application/json",
        },
        base: 1
    });
}
