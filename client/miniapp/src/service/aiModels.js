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
export function getBuyInfo(data) {
    return request({
        url: `/cozeZhsApi/agent-settlement/stats/income-overview`,
        method: "GET",
        data,
        base: 3
    });
}

// 收入列表
export function getBuyList(data) {
    return request({
        url: `/cozeZhsApi/agent-settlement/list`,
        method: "GET",
        data,
        base: 3
    });
}

// 明细列表
export function getMxList(data) {
    return request({
        url: `/cozeZhsApi/agent-withdrawal-detail/list`,
        method: "GET",
        data,
        base: 3
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
