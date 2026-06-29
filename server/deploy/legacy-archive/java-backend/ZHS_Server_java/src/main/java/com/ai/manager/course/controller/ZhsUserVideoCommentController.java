package com.ai.manager.course.controller;

import com.ai.manager.core.annotation.CourseHeaderCheck;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.course.domain.ZhsUserVideoComment;
import com.ai.manager.course.service.IZhsUserVideoCommentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;


/**
 * 用户评论Controller
 *
 * @author Raindrop_L
 * @date 2025-08-29
 */
@RestController
@RequestMapping("/userVideoComment")
@Tag(name = "用户评论管理")
public class ZhsUserVideoCommentController {
    @Autowired
    private IZhsUserVideoCommentService zhsUserVideoCommentService;

    /**
     * 查询用户评论列表
     */
    @CourseHeaderCheck
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(ZhsUserVideoComment zhsUserVideoComment) {
//        startPage();
        List<ZhsUserVideoComment> list = zhsUserVideoCommentService.getList(zhsUserVideoComment);
        return ResponseResultInfo.success(list);
    }

    /**
     * 新增用户评论
     */
    @CourseHeaderCheck
    @Operation(summary = "新增")
    @PostMapping
    public ResponseResultInfo add(@RequestBody ZhsUserVideoComment zhsUserVideoComment,
                                  @RequestHeader(CourseConfig.PLATFORM_USER_ID) String userId) {
        zhsUserVideoComment.setUserUuid(userId);
        return ResponseResultInfo.success(zhsUserVideoCommentService.add(zhsUserVideoComment));
    }

    /**
     * 删除用户评论
     */
    @CourseHeaderCheck
    @Operation(summary = "删除")
    @DeleteMapping("/{ids}")
    public ResponseResultInfo remove(@PathVariable String[] ids,
                                     @RequestHeader(CourseConfig.PLATFORM_USER_ID) String userId) {
        return ResponseResultInfo.success(zhsUserVideoCommentService.delByIds(ids,userId));
    }

    /**
     * 查询用户评论列表
     */
    @CourseHeaderCheck
    @GetMapping("/list/up")
    @Operation(summary = "列表")
    public ResponseResultInfo uplist() {
//        startPage();
        List<ZhsUserVideoComment> list = zhsUserVideoCommentService.getListByParentIds("0");
        return ResponseResultInfo.success(list);
    }
}
