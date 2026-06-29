package com.ai.manager.course.controller;

import com.ai.manager.core.annotation.CourseHeaderCheck;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.course.domain.ZhsUserPlatform;
import com.ai.manager.course.service.IZhsUserPlatformService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;


/**
 * 用户与平台关系Controller
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/userPlatform")
@Tag(name = "用户与平台关系管理")
public class ZhsUserPlatformController {
    @Autowired
    private IZhsUserPlatformService zhsUserPlatformService;

    /**
     * 获取用户与平台关系详细信息
     */
    @CourseHeaderCheck
    @GetMapping(value = "/{userId}")
    @Operation(summary = "获取用户与平台关系详细信息")
    public ResponseResultInfo getInfo(@PathVariable("userId") Integer id, @RequestHeader(CourseConfig.PLATFORM_TYPE)String courseHeader) {
        return ResponseResultInfo.success(zhsUserPlatformService.getByUserId(id, courseHeader));
    }

    /**
     * 新增用户与平台关系
     */
    @CourseHeaderCheck
    @Operation(summary = "绑定用户与平台关系")
    @PostMapping
    public ResponseResultInfo add(@RequestBody ZhsUserPlatform zhsUserPlatform, @RequestHeader(CourseConfig.PLATFORM_TYPE)String courseHeader) {
        return ResponseResultInfo.success(zhsUserPlatformService.add(zhsUserPlatform, courseHeader));
    }
}
