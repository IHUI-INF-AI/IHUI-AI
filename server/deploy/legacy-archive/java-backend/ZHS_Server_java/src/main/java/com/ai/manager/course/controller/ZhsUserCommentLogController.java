package com.ai.manager.course.controller;

import com.ai.manager.core.annotation.CourseHeaderCheck;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.course.domain.ZhsUserCommentLog;
import com.ai.manager.course.service.IZhsUserCommentLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.util.List;


/**
 * 用户评论点赞记录Controller
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/userCommentLog")
@Tag(name = "用户评论点赞记录管理")
public class ZhsUserCommentLogController {
    @Autowired
    private IZhsUserCommentLogService zhsUserCommentLogService;

    /**
     * 查询用户评论点赞记录列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(ZhsUserCommentLog zhsUserCommentLog) {
//        startPage();
        List<ZhsUserCommentLog> list = zhsUserCommentLogService.getList(zhsUserCommentLog);
        return ResponseResultInfo.success(list);
    }

    /**
     * 获取用户评论点赞记录详细信息
     */
    @GetMapping(value = "/{id}")
    @Operation(summary = "详情")
    public ResponseResultInfo getInfo(@PathVariable("id") Integer id) {
        return ResponseResultInfo.success(zhsUserCommentLogService.getById(id));
    }

    /**
     * 新增用户评论点赞记录
     */
    @CourseHeaderCheck
    @Operation(summary = "新增")
    @PostMapping
    public ResponseResultInfo add(@RequestBody ZhsUserCommentLog zhsUserCommentLog) {
        return ResponseResultInfo.success(zhsUserCommentLogService.add(zhsUserCommentLog));
    }

    /**
     * 修改用户评论点赞记录
     */
    @Operation(summary = "修改")
    @PutMapping
    public ResponseResultInfo edit(@RequestBody ZhsUserCommentLog zhsUserCommentLog) {
        return ResponseResultInfo.success(zhsUserCommentLogService.edit(zhsUserCommentLog));
    }

    /**
     * 删除用户评论点赞记录
     */
    @Operation(summary = "删除")
    @DeleteMapping("/{ids}")
    public ResponseResultInfo remove(@PathVariable Integer[] ids) {
        return ResponseResultInfo.success(zhsUserCommentLogService.delByIds(ids));
    }
}
