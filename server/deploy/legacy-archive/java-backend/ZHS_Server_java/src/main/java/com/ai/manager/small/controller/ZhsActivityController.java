package com.ai.manager.small.controller;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.constants.ResultConfig;
import com.ai.manager.small.domain.ZhsActivity;
import com.ai.manager.small.service.IZhsActivityService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 活动Controller
 * 
 * @author raindrop_l
 * @date 2025-06-05
 */
@RestController
@RequestMapping("/zhs_activity")
@Tag(name = "资讯相关")
public class ZhsActivityController
{
    @Autowired
    private IZhsActivityService zhsActivityService;

    /**
     * 查询活动列表
     */
    @GetMapping("/get")
    public ResponseResultInfo list(ZhsActivity zhsActivity)
    {
//        startPage();
        List<ZhsActivity> list = zhsActivityService.selectZhsActivityList(zhsActivity);
        return ResponseResultInfo.builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(list.get(0)).build();
    }

    /**
     * 获取活动详细信息
     */
    @GetMapping("/{id}")
    public ResponseResultInfo getInfo(@PathVariable("id") String id)
    {
        return ResponseResultInfo.builder().code(ResultConfig.SUCCESS_CODE.toString()).msg(ResultConfig.SUCCESS).data(zhsActivityService.selectZhsActivityById(id)).build();
    }

}
