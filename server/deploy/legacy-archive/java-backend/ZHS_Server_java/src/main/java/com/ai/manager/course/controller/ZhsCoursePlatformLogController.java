package com.ai.manager.course.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.course.domain.ZhsCoursePlatformLog;
import com.ai.manager.course.service.IZhsCoursePlatformLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.util.List;


/**
 * 视频发布平台记录Controller
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/coursePlatformLog")
@Tag(name = "视频发布平台记录管理")
public class ZhsCoursePlatformLogController {
    @Autowired
    private IZhsCoursePlatformLogService zhsCoursePlatformLogService;

    /**
     * 查询视频发布平台记录列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(ZhsCoursePlatformLog zhsCoursePlatformLog) {
//        startPage();
        List<ZhsCoursePlatformLog> list = zhsCoursePlatformLogService.getList(zhsCoursePlatformLog);
        return ResponseResultInfo.success(list);
    }

    /**
     * 获取视频发布平台记录详细信息
     */
    @GetMapping(value = "/{id}")
    @Operation(summary = "详情")
    public ResponseResultInfo getInfo(@PathVariable("id") String id) {
        return ResponseResultInfo.success(zhsCoursePlatformLogService.getById(id));
    }

    /**
     * 新增视频发布平台记录
     */
    @Operation(summary = "新增")
    @PostMapping
    public ResponseResultInfo add(@RequestBody ZhsCoursePlatformLog zhsCoursePlatformLog) {
        return ResponseResultInfo.success(zhsCoursePlatformLogService.add(zhsCoursePlatformLog));
    }

    /**
     * 修改视频发布平台记录
     */
    @Operation(summary = "修改")
    @PutMapping
    public ResponseResultInfo edit(@RequestBody ZhsCoursePlatformLog zhsCoursePlatformLog) {
        return ResponseResultInfo.success(zhsCoursePlatformLogService.edit(zhsCoursePlatformLog));
    }

    /**
     * 删除视频发布平台记录
     */
    @Operation(summary = "删除")
    @DeleteMapping("/{ids}")
    public ResponseResultInfo remove(@PathVariable String[] ids) {
        return ResponseResultInfo.success(zhsCoursePlatformLogService.delByIds(ids));
    }
}
