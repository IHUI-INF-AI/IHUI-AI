package com.ai.manager.small.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.domain.dto.SharePlanetPublicBatchRequest;
import com.ai.manager.small.service.CozeService;
import com.ai.manager.small.service.ResourceService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/resource") // 基础路径
@Tag(name = "资源模块")
public class ResourceController {

    @Autowired
    private ResourceService resourceService;
    @Autowired
    private CozeService cozeService;

    /**
     * 获取首页资源 (占位)
     * @return
     */
    @GetMapping("/homeResource")
    public Map<String, Object> getHomeResource() {
        Map<String, Object> result = new HashMap<>();
        result.put("code", 400);
        result.put("msg", "缺少 open_id"); // 模仿 PHP 返回
        return result;
    }

    /**
     * 首页知识星球资讯列表查询 详情页
     * @param popularCourseId
     * @return
     */
    @GetMapping("/plantInformation")
    public ResponseResultInfo getPlantInformation(@RequestParam("id") Long popularCourseId) {
        // Converted from PHP Resource.php::plantInformation
        return resourceService.getPlantInformation(popularCourseId);
    }

    // PHP: recharge - 判断是否为会员
    // Original PHP path: /api/resource/recharge

    /**
     * 判断用户是否为会员
     * @param userId
     * @return
     */
    @GetMapping("/recharge")
    public ResponseResultInfo recharge(@RequestParam("id") Long userId) {
        // Converted from PHP Resource.php::recharge
        return resourceService.recharge(userId);
    }

    /**
     * 查询商品及汇率列表
     * 商品表查询列表 显示所有的token商品
     * @param type
     * @return
     */
    @SkipLogin
    @GetMapping("/selectsGoods") // PHP 使用 GET
//    @Operation(summary = "查询商品及汇率列表")
    public ResponseResultInfo selectsGoods(@RequestParam(value = "type", required = false) Integer type) {
        // Converted from PHP Resource.php::selectsGoods
        return resourceService.selectsGoods(type);
    }


    @GetMapping("/getCoursePlanet")
//    @Operation(summary = "获取课程星球列表（分页）")
    public ResponseResultInfo getCoursePlanet() {
        // Converted from PHP Resource.php::getCoursePlanet (without pagination)
        return resourceService.getCoursePlanet(/* Pass only required params based on PHP */);
    }

    @GetMapping("/getKnowledgePlanet")
//    @Operation(summary = "获取知识星球列表（分页）")
    public ResponseResultInfo getKnowledgePlanet(@RequestParam(required = false) Integer type) {
        // Converted from PHP Resource.php::getKnowledgePlanetInfo (without pagination, with type)
        return resourceService.getKnowledgePlanet(/* Pass only required params based on PHP */ type);
    }

    @PostMapping("/addUserAgentFreeTime")
//    @Operation(summary = "添加用户代理免费时长")
    public ResponseResultInfo addUserAgentFreeTime(@RequestParam("user_id") Integer userId,
                                                    @RequestParam("agent_id") Long agentId,
                                                    @RequestParam("degree") Integer degree) {
        // Converted from PHP Resource.php::getUserAgentFreeTime (partially - the adding logic)
        return resourceService.addUserAgentFreeTime(userId, agentId, degree);
    }

    /**
     * 不确定是否有用
     * @param userId
     * @param agentId
     * @return
     */
    @GetMapping("/getUserAgentFreeTime")
//    @Operation(summary = "获取用户代理免费时长信息")
    public ResponseResultInfo getUserAgentFreeTimeInfo(@RequestParam("user_id") Integer userId,
                                                        @RequestParam("agent_id") Long agentId) {
        // Converted from PHP Resource.php::getUserAgentFreeTime (partially - the getting info logic)
        return resourceService.getUserAgentFreeTimeInfo(userId, agentId);
    }

    // PHP: getHomePageResources - 获取首页多种资源 (轮播图、课程星球、分析星球)
    // Original PHP path: /api/resource/getHomePageResources
    @GetMapping("/getHomePageResources") // PHP 使用 GET
//    @Operation(summary = "获取首页多种资源")
    public ResponseResultInfo getHomePageResources(@RequestParam(name = "position", required = false) Integer position) {
        // Converted from PHP Resource.php::getHomePageResources
        return resourceService.getHomePageResources(position);
    }
/*    *//**
     * 不确定是否有用
     * @return
     *//*
    @GetMapping("/banner")
//    @Operation(summary = "获取轮播图")
    public ResponseResultInfo getBanner() {
        // Converted from PHP Resource.php::getHomePageResources (partially)
        return resourceService.getBanner();
    }*/

    @PostMapping("/addSharePlanetPublic")
//    @Operation(summary = "批量添加公共分享星球及关联资讯")
    public ResponseResultInfo addSharePlanetPublicBatch(@RequestBody SharePlanetPublicBatchRequest requestBody) {
        // Converted from PHP Resource.php::addSharePlanetPublic (batch operation)
        return resourceService.addSharePlanetPublicBatch(requestBody);
    }
/*
    @GetMapping("/getCoursePlanetCategorized")
//    @Operation(summary = "获取课程星球分类列表 (入门/精选/热门)")
    public Map<String, Object> getCoursePlanetCategorized() {
        // Converted from PHP Resource.php::getPopularCourse and getCoursePlanet (categorized parts)
        return resourceService.getCoursePlanetCategorized();
    }*/


    // PHP: postPopularCourses - 查询所有popular_courses
    // Original PHP path: /api/resource/postPopularCourses
    @PostMapping("/postPopularCourses") // PHP 使用 POST
//    @Operation(summary = "获取所有热门课程")
    public ResponseResultInfo postPopularCourses() {
        // Converted from PHP Resource.php::postPopularCourses
        return resourceService.postPopularCourses();
    }


    // PHP: postHomeInformation - 获取首页资讯 (课程、官方推荐/喜欢、社区推荐/喜欢)
    // Original PHP path: /api/resource/postHomeInformation
    @PostMapping("/postHomeInformation") // PHP 使用 POST
//    @Operation(summary = "获取首页资讯")
    public ResponseResultInfo postHomeInformation() {
        // Converted from PHP Resource.php::postHomeInformation
        return resourceService.postHomeInformation();
    }

    @GetMapping("/getKnowledgePlanetCategorizedInfo")
//    @Operation(summary = "获取知识星球分类信息 (热门/全部)")
    public ResponseResultInfo getKnowledgePlanetCategorizedInfo(@RequestParam(name="type") Integer type) {
        // Converted from PHP Resource.php::getKnowledgePlanetInfo (categorized info)
        return resourceService.getKnowledgePlanetCategorizedInfo(type);
    }

}