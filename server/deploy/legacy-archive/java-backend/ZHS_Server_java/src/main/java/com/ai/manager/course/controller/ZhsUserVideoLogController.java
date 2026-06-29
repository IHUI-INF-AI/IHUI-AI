package com.ai.manager.course.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.course.domain.ZhsCourseVideo;
import com.ai.manager.course.domain.ZhsUserVideoLog;
import com.ai.manager.course.service.IZhsUserVideoLogService;
import com.github.pagehelper.PageHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;





/**
 * 用户操作课程视频Controller
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/userVideoLog")
@Tag(name = "用户操作课程视频管理")
public class ZhsUserVideoLogController
{
    @Autowired
    private IZhsUserVideoLogService zhsUserVideoLogService;

    /**
     * 查询用户操作课程视频列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(ZhsUserVideoLog zhsUserVideoLog, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String userId, @RequestHeader(CourseConfig.PLATFORM_TYPE)String platform)
    {
//        startPage();
        zhsUserVideoLog.setUserUuid(userId);
        zhsUserVideoLog.setPlatformId(platform);
        PageHelper.startPage(zhsUserVideoLog.getPageNum(), zhsUserVideoLog.getPageSize(), zhsUserVideoLog.getOrderByColumn()).setReasonable(true);
        List<ZhsCourseVideo> list = zhsUserVideoLogService.getList(zhsUserVideoLog);
        return ResponseResultInfo.success(list);
    }

    /**
     * 新增用户操作课程视频
     */
    @Operation(summary = "用户操作 type 0分享 1点赞 2收藏")
    @GetMapping("/operate/{videoId}/{type}")
    public ResponseResultInfo add(@PathVariable("type") Integer type,
                                  @PathVariable("videoId") String videoId,
                                  @RequestHeader(CourseConfig.PLATFORM_USER_ID)String userId,
                                  @RequestHeader(CourseConfig.PLATFORM_TYPE)String platform)
    {
        ZhsUserVideoLog zhsUserVideoLog = ZhsUserVideoLog.builder()
                .videoId(videoId)
                .type(type)
                .userUuid(userId)
                .platformId(platform)
                .build();
        return ResponseResultInfo.success(zhsUserVideoLogService.add(zhsUserVideoLog));
    }

    @Operation(summary = "删除")
    @DeleteMapping("/{ids}")
    public ResponseResultInfo remove(@PathVariable Integer[] ids)
    {
        return ResponseResultInfo.success(zhsUserVideoLogService.delByIds(ids));
    }
}
