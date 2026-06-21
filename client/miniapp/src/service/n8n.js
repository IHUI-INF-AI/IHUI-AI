import request from "@/utils/service/index.js";

// 添加n8n智能体
export function addN8nAgent(data) {
    return request({
        url: "/api/agent/upload",
        method: "POST",
        header: {
            "content-type": "application/json",
        },
        data,
        base: 1
    });
}


// 调用n8n智能体
export function processN8nAgent(data) {
    return request({
        url: "/api/agent/process",
        method: "POST",
        header: {
            "content-type": "application/json",
        },
        data,
        base: 1,
        responseType: "arraybuffer"
    });
}
