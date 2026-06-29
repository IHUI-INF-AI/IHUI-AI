package com.ai.manager.small.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.domain.AgentNeedTask;
import com.ai.manager.small.domain.dto.AgentNeedTaskDTO;
import com.ai.manager.small.service.IAgentNeedTaskService;
import com.alibaba.druid.support.json.JSONUtils;
import com.github.pagehelper.PageHelper;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/remote/agent/task")
@Tag(name = "第三方设备请求方法-智能体任务相关")
public class RemoteDeviceByTaskController {

    @Autowired
    private IAgentNeedTaskService needTaskService;

    // 查询智能体需求任务
    @PostMapping("/need/task/add")
    public ResponseResultInfo addNeedTask(@RequestBody AgentNeedTaskDTO task){
        needTaskService.add(task);
        return ResponseResultInfo.success(null);
    }
    // 查询智能体需求任务
    @SkipLogin
    @PostMapping("/need/task")
    public ResponseResultInfo needTaskList(@RequestBody AgentNeedTaskDTO task){
        PageHelper.startPage(task.getPageNum(), task.getPageSize(), task.getOrderByColumn()).setReasonable(true);
        System.out.println(JSONUtils.toJSONString(task));
        List<AgentNeedTask> list = needTaskService.getList(task);
        return ResponseResultInfo.success(list);
    }

    // 查询任务详情
    @GetMapping("/need/task/{id}")
    public ResponseResultInfo<AgentNeedTask> needTask(@PathVariable("id") String id){
        return ResponseResultInfo.success(needTaskService.getById(id));
    }


}
