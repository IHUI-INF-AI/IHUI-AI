package com.ai.manager.course.controller;

import com.ai.manager.core.annotation.CourseHeaderCheck;
import com.ai.manager.core.aspect.CourseHeaderAspect;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.course.domain.ZhsCourseVideo;
import com.ai.manager.course.domain.ZhsEducationPlatform;
import com.ai.manager.course.domain.dto.ZhsCourseVideoDTO;
import com.ai.manager.course.service.IZhsCourseVideoService;
import com.github.pagehelper.PageHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;


/**
 * 课程视频Controller
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/courseVideo")
@Tag(name = "课程视频管理")
public class ZhsCourseVideoController {
    @Autowired
    private IZhsCourseVideoService zhsCourseVideoService;

    /**
     * 查询课程视频列表
     */
    @CourseHeaderCheck
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo<List<ZhsCourseVideo>> list(ZhsCourseVideoDTO zhsCourseVideo,
                                   @RequestHeader(CourseConfig.PLATFORM_TYPE) String platform,
                                   @RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid
                                   ) {
        ZhsEducationPlatform zhsEducationPlatform = CourseHeaderAspect.getPlatformCache().get(platform);
        zhsCourseVideo.setPlatform(zhsEducationPlatform.getId());
//        if(StringUtils.isBlank(zhsCourseVideo.getCourseId())){
//            return ResponseResultInfo.error(null, "未识别的课程唯一标识");
//        }

        PageHelper.startPage(zhsCourseVideo.getPageNum(), zhsCourseVideo.getPageSize(), zhsCourseVideo.getOrderByColumn()).setReasonable(true);
        ZhsCourseVideo build = ZhsCourseVideo.builder().build();
        BeanUtils.copyProperties(zhsCourseVideo, build);
        List<ZhsCourseVideo> list = zhsCourseVideoService.getList(build);
        return ResponseResultInfo.success(list);
    }
    @CourseHeaderCheck
    @GetMapping("/list/login")
    @Operation(summary = "当前用户列表")
    public ResponseResultInfo<List<ZhsCourseVideo>> listLogin(ZhsCourseVideoDTO zhsCourseVideo,
                                   @RequestHeader(CourseConfig.PLATFORM_TYPE) String platform,
                                   @RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid
                                   ) {

        ZhsEducationPlatform zhsEducationPlatform = CourseHeaderAspect.getPlatformCache().get(platform);
        zhsCourseVideo.setPlatform(zhsEducationPlatform.getId());
        zhsCourseVideo.setUserUuid(userUuid);
        if(StringUtils.isBlank(zhsCourseVideo.getCourseId())){
            return ResponseResultInfo.error(null, "未识别的课程唯一标识");
        }

        PageHelper.startPage(zhsCourseVideo.getPageNum(), zhsCourseVideo.getPageSize(), zhsCourseVideo.getOrderByColumn()).setReasonable(true);
        ZhsCourseVideo build = ZhsCourseVideo.builder().build();
        BeanUtils.copyProperties(zhsCourseVideo, build);
        List<ZhsCourseVideo> list = zhsCourseVideoService.getList(build);
        return ResponseResultInfo.success(list);
    }

    /**
     * 获取课程视频详细信息
     */
    @CourseHeaderCheck
    @GetMapping(value = "/{id}")
    @Operation(summary = "详情")
    public ResponseResultInfo getInfo(@PathVariable("id") String id,
                                      @RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid
                                      ,@RequestHeader(CourseConfig.PLATFORM_TYPE) String platform
    ) {
        return ResponseResultInfo.success(zhsCourseVideoService.getById(id, userUuid, platform));
    }

    /**
     * 新增课程视频
     */
    @CourseHeaderCheck
    @Operation(summary = "新增")
    @PostMapping
    public ResponseResultInfo add(@RequestBody ZhsCourseVideo zhsCourseVideo, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid) {
        zhsCourseVideo.setCreator(userUuid);
        return ResponseResultInfo.success(zhsCourseVideoService.add(zhsCourseVideo));
    }
    @CourseHeaderCheck
    @Operation(summary = "批量新增")
    @PostMapping("/batch")
    public ResponseResultInfo addBatch(@RequestBody List<ZhsCourseVideo> zhsCourseVideos) {
        return ResponseResultInfo.success(zhsCourseVideoService.addBatch(zhsCourseVideos));
    }

    /**
     * 修改课程视频
     */
    @CourseHeaderCheck
    @Operation(summary = "修改")
    @PutMapping
    public ResponseResultInfo edit(@RequestBody ZhsCourseVideo zhsCourseVideo, @RequestHeader(CourseConfig.PLATFORM_USER_ID)String uuid) {
        zhsCourseVideo.setUpdator(uuid);
        return ResponseResultInfo.success(zhsCourseVideoService.edit(zhsCourseVideo, uuid));
    }

    /**
     * 删除课程视频
     */
    @CourseHeaderCheck
    @Operation(summary = "删除")
    @DeleteMapping("/{ids}")
    public ResponseResultInfo remove(@PathVariable String[] ids, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid) {
        return ResponseResultInfo.success(zhsCourseVideoService.delByIds(ids,uuid));
    }

    @CourseHeaderCheck
    @Operation(summary = "移动课程视频 type: 0-置顶 1-上移 2-下移")
    @GetMapping("/move/{videoId}/{type}")
    public ResponseResultInfo move(@PathVariable String videoId, @PathVariable Integer type, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String userUuid) {
        zhsCourseVideoService.move(videoId, type, userUuid);
        return ResponseResultInfo.success();
    }

    // 上架
    @CourseHeaderCheck
    @Operation(summary = "上架")
    @PostMapping("/issue/{ids}")
    public ResponseResultInfo issue(@PathVariable String ids, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid) {
        return ResponseResultInfo.success(zhsCourseVideoService.issue(ids, uuid));
    }
}
