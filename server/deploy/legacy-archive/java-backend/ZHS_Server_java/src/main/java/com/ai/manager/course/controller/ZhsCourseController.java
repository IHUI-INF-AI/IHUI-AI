package com.ai.manager.course.controller;

import com.ai.manager.core.annotation.CourseHeaderCheck;
import com.ai.manager.core.aspect.CourseHeaderAspect;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.course.domain.ZhsCourse;
import com.ai.manager.course.domain.ZhsEducationPlatform;
import com.ai.manager.course.domain.dto.ZhsCourseDTO;
import com.ai.manager.course.service.IZhsCourseService;
import com.github.pagehelper.PageHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.SneakyThrows;
import org.apache.commons.beanutils.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;


/**
 * 课程Controller
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/course")
@Tag(name = "课程管理")
public class ZhsCourseController {
    @Autowired
    private IZhsCourseService zhsCourseService;

    /**
     * 查询课程列表
     */
//    @SkipLogin
    @SneakyThrows
    @CourseHeaderCheck
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo<List<ZhsCourse>> list(ZhsCourseDTO zhsCourse,
                                                    @RequestHeader(CourseConfig.PLATFORM_TYPE) String platform
    ) {
        ZhsEducationPlatform zhsEducationPlatform = CourseHeaderAspect.getPlatformCache().get(platform);
        zhsCourse.setPlatform(zhsEducationPlatform.getId());

        PageHelper.startPage(zhsCourse.getPageNum(), zhsCourse.getPageSize(), zhsCourse.getOrderByColumn()).setReasonable(true);
        ZhsCourse build = ZhsCourse.builder().build();
        BeanUtils.copyProperties(build, zhsCourse);
        List<ZhsCourse> list = zhsCourseService.getList(build);
        return ResponseResultInfo.success(list);
    }

    /**
     * 获取课程详细信息
     */
    @CourseHeaderCheck
    @GetMapping(value = "/{id}")
    @Operation(summary = "详情")
    public ResponseResultInfo getInfo(@PathVariable("id") String id) {
        return ResponseResultInfo.success(zhsCourseService.getById(id));
    }

    /**
     * 新增课程
     */
    @CourseHeaderCheck
    @Operation(summary = "新增")
    @PostMapping
    public ResponseResultInfo add(@RequestBody ZhsCourse zhsCourse, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid, @RequestHeader(CourseConfig.PLATFORM_TYPE) String platform) {
        zhsCourse.setCreator(uuid);
        ZhsEducationPlatform zhsEducationPlatform = CourseHeaderAspect.getPlatformCache().get(platform);
        zhsCourse.setPlatform(zhsEducationPlatform.getId());
        return ResponseResultInfo.success(zhsCourseService.add(zhsCourse));
    }

    /**
     * 修改课程
     */
    @CourseHeaderCheck
    @Operation(summary = "修改")
    @PutMapping
    public ResponseResultInfo edit(@RequestBody ZhsCourse zhsCourse, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid) {
        zhsCourse.setUpdator(uuid);
        return ResponseResultInfo.success(zhsCourseService.edit(zhsCourse));
    }

    /**
     * 删除课程
     */
    @CourseHeaderCheck
    @Operation(summary = "删除")
    @DeleteMapping("/{ids}")
    public ResponseResultInfo remove(@PathVariable String[] ids, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid) {
        return ResponseResultInfo.success(zhsCourseService.delByIds(ids, uuid));
    }


    // 上架
    @CourseHeaderCheck
    @Operation(summary = "下架")
    @PostMapping("/delist/{ids}")
    public ResponseResultInfo delist(@PathVariable String ids, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid) {
        return ResponseResultInfo.success(zhsCourseService.delist(ids, uuid));
    }
}
