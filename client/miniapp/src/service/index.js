import { request } from "@/service/shared-request.ts";
import {
    getPopularCourses as sharedGetPopularCourses,
    getPlantInformation as sharedGetPlantInformation,
    getHomePageResources as sharedGetHomePageResources,
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

//热门课程 ｜ 知识星球 (列表查询)
export function postPopularCourses(type) {
    return sharedGetPopularCourses(sharedRequestAdapter, type);
}

// 根据id和type查询资讯详情
export function plantInformation(id) {
    return sharedGetPlantInformation(sharedRequestAdapter, id);
}

// 首页
export function getHomePageResources(position) {
    return sharedGetHomePageResources(sharedRequestAdapter, position);
}
