import request from "@/utils/service/index.js";
import {
    getAgentDetailByCategory,
    getAgentList,
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

// 获取我的创作内容
export function getMyCreation(data, type) {
  return request({
    url: `/agent/creation/my/${type}`,
    method: "POST",
    header: {
        "content-type": "application/json",
    },
    data,
    base: 1
  });
}

export function getAgentbyCollect(data, uuid) {
    return request({
        url: `/remote/agent/by/collect/${uuid}`,
        method: "GET",
        data,
        base: 2
    });
}

// 获取 AI团队 智能体 列表
export function getAgentType(data) {
    return getAgentList(sharedRequestAdapter, data).then((res) => ({
        ...res,
        data: res.data?.list || [],
    }));
}
// 获取 AI团队 code
export function category(type = '1') {
    return request({
        url: `/remote/agent/category`,
        method: "GET",
        data: {
            type
        },
        base: 2
    });
}

// 获取 AI团队 code
export function categoryDictionary() {
    return request({
        url: `/categoryDictionary/list`,
        method: "GET",
        base: 1
    });
}

// ai团队，老员工，购买
export function aiRemoveAgent(data) {
    return request({
        url: `/remote/agent/by/pay`,
        method: "GET",
        data,
        base: 2
    });
}

// 开发者
export function getDevInfo() {
    return request({
        url: `/resource/developer/price`,
        method: "GET",
        base: 1
    });
}

// 获取智能体审核记录列表
// 2026-06-25 修复#O: 保留旧路径走外部 Java 后端 (base 3).
//   Python 后端 /api/v1/agents/examine/list 参数为 page/limit/status,
//   前端传 agent_name/start_user 等参数语义不同, 对齐会破坏功能. 后续需对齐参数.
export function getZntList(data) {
    return request({
        url: `/cozeZhsApi/agent-examine/list`,
        method: "GET",
        data,
        base: 3
    });
}
// 根据智能体ID获取收费配置
export function getChargeInfoById(id) {
    return getAgentDetailByCategory(sharedRequestAdapter, id);
}

// 创建付费记录
// 2026-06-25 修复#O: 保留旧路径走外部 Java 后端 (base 3).
//   Python 后端 /api/v1/agents/buy/create 只接受 Query agent_id,
//   前端传 body 完整数据 (agent_id/agent_name/count/prologue 等) 语义不同, 对齐会破坏功能.
export function createPayHistory(data) {
    return request({
        url: `/cozeZhsApi/agent-buy/create`,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 创建智能体收费配置
// 2026-06-25 修复#O: 保留旧路径走外部 Java 后端 (base 3).
//   Python 后端 /api/v1/agents/categories/create body 为 CategoryCreateBody,
//   字段名与前端传参不同 (agent_id vs agentId 等), 对齐会破坏功能. 后续需对齐参数.
export function createZntCharge(data) {
    return request({
        url: `/cozeZhsApi/agent-category/create`,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 修改智能体收费配置
// 2026-06-25 修复#O: 保留旧路径走外部 Java 后端 (base 3).
//   Python 后端 PUT /api/v1/agents/categories/{category_id} 期望 path category_id (int),
//   前端传 data.agent_id (string) 语义不同, 对齐会破坏功能. 后续需对齐参数.
export function putZntCharge(data) {
    return request({
        url: `/cozeZhsApi/agent-category/${data.agent_id}`,
        header: {
            "content-type": "application/json",
        },
        method: "PUT",
        data,
        base: 3
    });
}

// 删除智能体收费配置
// 2026-06-25 修复#O: 保留旧路径走外部 Java 后端 (base 3).
//   Python 后端 DELETE /api/v1/agents/categories/{category_id} 期望 path category_id (int),
//   前端传 agent_id (string) 语义不同, 对齐会破坏功能. 后续需对齐参数.
export function deleteZntCharge(id) {
    return request({
        url: `/cozeZhsApi/agent-category/${id}`,
        header: {
            "content-type": "application/json",
        },
        method: "DELETE",
        base: 3
    });
}

// 收入详情
// 2026-06-25 修复#N: 路径对齐到 Python 后端真实端点.
//   原路径 /cozeZhsApi/agent-settlement/stats/income-overview (base 3) 是外部 Java 后端路由,
//   已迁移到 Python 后端 /api/v1/agents/settlement/summary (修复#A 新前缀).
//   后端无 stats/income-overview, 用 /summary 等价 (都是收入汇总). base 改为 1 (走 api-kou 代理).
export function getBuyInfo(data) {
    return request({
        url: `/api/v1/agents/settlement/summary`,
        method: "GET",
        data,
        base: 1
    });
}

// 收入列表
// 2026-06-25 修复#M: 路径对齐到 Python 后端真实端点.
//   原路径 /cozeZhsApi/agent-settlement/list (base 3) 是外部 Java 后端路由,
//   已迁移到 Python 后端 /api/v1/agents/settlement/list. base 改为 1 (走 api-kou 代理).
export function getBuyList(data) {
    return request({
        url: `/api/v1/agents/settlement/list`,
        method: "GET",
        data,
        base: 1
    });
}

// 明细列表
// 2026-06-25 修复#J: 路径对齐到 Python 后端真实端点.
//   原路径 /cozeZhsApi/agent-withdrawal-detail/list (base 3) 是外部 Java 后端路由,
//   已迁移到 Python 后端 /api/v1/agents/withdrawal/list. base 改为 1 (走 api-kou 代理).
export function getMxList(data) {
    return request({
        url: `/api/v1/agents/withdrawal/list`,
        method: "GET",
        data,
        base: 1
    });
}

// 发布广场
export function getPlazaList(data) {
    let url = `/remote/agent/task/need/task?pageNum=${data.pageNum}
            &pageSize=${data.pageSize}&status=${data.status}
            &search=${data.search}&creator=${data.creator}`
    if (data.types.length > 0) {
        url += `&types=${data.types}`
    }
    if (data.categorys.length > 0) {
        url += `&categorys=${data.categorys}`
    }
    return request({
        url: url,
        method: "GET",
        // data,
        base: 2
    });
}

// 发布
export function addPlazaModel(data) {
    return request({
        url: `/remote/agent/task/need/task/add`,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 2
    });
}

// 发布广场，获取详情
export function getPlazaInfoById(id) {
    return request({
        url: `/remote/agent/task/need/task/add/${id}`,
        method: "GET",
        base: 2
    });
}

// 获取智能体地址列表
export function getCozeApiList() {
    return request({
        url: `/cozeZhsApi/ai-model-info/list`,
        method: "GET",
        base: 3
    });
}

// 千问文生图
export function cozeZhsApiDashscopeImageGenerate(data, url) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 千问图片修改
export function dashscopeImageEditSimple(data, url) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 千问视频生成
export function cozeZhsApiDashscopeVideoGenerate(data, url) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 腾讯混元3D，请求后等后端生成，生成好后再请求
export function tencentHunyuan3dSubmit(data, url) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 还原 3d 生成结果查询
export function tencentHunyuan3dQuery(data, url) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 谷歌图片编辑
export function cozeZhsApiLuyalaChatCompletions(data, url) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 即梦4.0
export function cozeZhsApiDoubaoSeedream40(data, url) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

//veo3
export function cozeZhsApiLuyalaVideoCreate(data, url, base=3) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: base
    });
}

export function postByUrl(data, url) {
    return request({
        url,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 音频 开始
export function audioStart(data) {
    return request({
        url: `/kling/generate/video`,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 1
    });
}

// 音频 结束
export function audioEnd(id) {
    return request({
        url: `/kling/video/info/${id}`,
        method: "GET",
        base: 1
    });
}

// 搜索模型工作流运行
export function searchModelWorkflowRun(data) {
    return request({
        url: `/cozeZhsApi/search/model/workflow/run`,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 3
    });
}

// 音频 开始
export function aliGenerateTimbre(data) {
    return request({
        url: `/ali/generate/timbre`,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 0
    });
}

// sora音频 开始
export function soraRequest(data) {
    return request({
        url: `/jianyi/sora2/generate/video`,
        header: {
            "content-type": "application/json",
        },
        method: "POST",
        data,
        base: 1
    });
}

// sora音频 结束
export function soraRequestEnd(data) {
    return request({
        url: `/jianyi/sora2/video/info`,
        method: "POST",
        header: {
            "content-type": "application/json",
        },
        data,
        base: 1
    });
}
