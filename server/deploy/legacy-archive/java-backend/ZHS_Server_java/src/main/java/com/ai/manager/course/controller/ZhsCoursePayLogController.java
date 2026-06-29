package com.ai.manager.course.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.course.domain.ZhsCoursePayLog;
import com.ai.manager.course.service.IZhsCoursePayLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;


/**
 * 用户购买课程记录Controller
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/coursePayLog")
@Tag(name = "用户购买课程记录管理")
public class ZhsCoursePayLogController {
    @Autowired
    private IZhsCoursePayLogService zhsCoursePayLogService;

    /**
     * 查询用户购买课程记录列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(ZhsCoursePayLog zhsCoursePayLog) {
        List<ZhsCoursePayLog> list = zhsCoursePayLogService.getList(zhsCoursePayLog);
        return ResponseResultInfo.success(list);
    }

}
