/**知识星球 */
import request from "@/utils/service/index.js";
import {
    getKnowledgePlanetInfo as sharedGetKnowledgePlanetInfo,
    getInformationDictionary,
    getInformationList as sharedGetInformationList,
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

/**
 * @param {*} type  1->   官方资讯     2->社区资讯    3->  ai圈
 */
export function getKnowledgePlanetInfo(type) {
    return sharedGetKnowledgePlanetInfo(sharedRequestAdapter, type);
}

//获取资讯分类列表
export function information() {
    return getInformationDictionary(sharedRequestAdapter);
}

//获取每日资讯列表
export function getinformationListnews(insertTime, informationType, type) {
    return sharedGetInformationList(sharedRequestAdapter, { insertTime, informationType, type });
}

//获取资讯列表
export function getinformationList(type) {
    return sharedGetInformationList(sharedRequestAdapter, { type });
}
