package com.ai.manager.course.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.course.domain.ZhsEducationPlatform;
import com.ai.manager.course.service.IZhsEducationPlatformService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.util.List;


/**
 * 平台发布管理Controller
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/educationPlatform")
@Tag(name = "平台发布管理管理")
public class ZhsEducationPlatformController {
    @Autowired
    private IZhsEducationPlatformService zhsEducationPlatformService;

    /**
     * 查询平台发布管理列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(ZhsEducationPlatform zhsEducationPlatform) {
//        startPage();
        List<ZhsEducationPlatform> list = zhsEducationPlatformService.getList(zhsEducationPlatform);
        return ResponseResultInfo.success(list);
    }

    /**
     * 获取平台发布管理详细信息
     */
    @GetMapping(value = "/{sort}")
    @Operation(summary = "详情")
    public ResponseResultInfo getInfo(@PathVariable("sort") Integer sort) {
        return ResponseResultInfo.success(zhsEducationPlatformService.getBySort(sort));
    }

    /**
     * 新增平台发布管理
     */
    @Operation(summary = "新增")
    @PostMapping
    public ResponseResultInfo add(@RequestBody ZhsEducationPlatform zhsEducationPlatform) {
        return ResponseResultInfo.success(zhsEducationPlatformService.add(zhsEducationPlatform));
    }

    /**
     * 修改平台发布管理
     */
    @Operation(summary = "修改")
    @PutMapping
    public ResponseResultInfo edit(@RequestBody ZhsEducationPlatform zhsEducationPlatform) {
        return ResponseResultInfo.success(zhsEducationPlatformService.edit(zhsEducationPlatform));
    }

    /**
     * 删除平台发布管理
     */
    @Operation(summary = "删除")
    @DeleteMapping("/{sorts}")
    public ResponseResultInfo remove(@PathVariable Integer[] sorts) {
        return ResponseResultInfo.success(zhsEducationPlatformService.delBySorts(sorts));
    }
}
