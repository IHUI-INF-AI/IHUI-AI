package com.ai.manager.small.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.small.domain.AiUserFeedback;
import com.ai.manager.small.service.IAiUserFeedbackService;
import com.github.pagehelper.PageHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 用户反馈Controller
 * 
 * @author Raindrop_L
 * @date 2025-09-12
 */
@RestController
@RequestMapping("/userFeedback")
@Tag(name = "用户反馈管理")
public class AiUserFeedbackController
{
    @Autowired
    private IAiUserFeedbackService aiUserFeedbackService;

    /**
     * 查询用户反馈列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(AiUserFeedback aiUserFeedback, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid)
    {
//        aiUserFeedback.setCreator(uuid);
        PageHelper.startPage(aiUserFeedback.getPageNum(), aiUserFeedback.getPageSize(), aiUserFeedback.getOrderByColumn()).setReasonable(true);
        List<AiUserFeedback> list = aiUserFeedbackService.getList(aiUserFeedback);
        return ResponseResultInfo.success(list);
    }

    /**
     * 获取用户反馈详细信息
     */
    @GetMapping(value = "/{id}")
    @Operation(summary = "详情")
    public ResponseResultInfo getInfo(@PathVariable("id") Integer id)
    {
        return ResponseResultInfo.success(aiUserFeedbackService.getById(id));
    }

    /**
     * 新增用户反馈
     */
    @Operation(summary = "新增")
    @PostMapping
    public ResponseResultInfo add(@RequestBody AiUserFeedback aiUserFeedback, @RequestHeader(CourseConfig.PLATFORM_USER_ID) String uuid)
    {
        aiUserFeedback.setCreator(uuid);
        return ResponseResultInfo.success(aiUserFeedbackService.add(aiUserFeedback));
    }

    /**
     * 修改用户反馈
     */
    @Operation(summary = "修改")
    @PutMapping
    public ResponseResultInfo edit(@RequestBody AiUserFeedback aiUserFeedback)
    {
        return ResponseResultInfo.success(aiUserFeedbackService.edit(aiUserFeedback));
    }

    /**
     * 删除用户反馈
     */
    @Operation(summary = "删除")
	@DeleteMapping("/{ids}")
    public ResponseResultInfo remove(@PathVariable Integer[] ids)
    {
        return ResponseResultInfo.success(aiUserFeedbackService.delByIds(ids));
    }


}
