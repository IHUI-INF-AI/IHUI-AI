package com.ai.manager.small.controller;


import com.ai.manager.core.utils.R;
import com.ai.manager.small.domain.ZhsAgentExamine;
import com.ai.manager.small.domain.vo.ZhsAgentExamineVO;
import com.ai.manager.small.service.IZhsAgentExamineService;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/examine")
@Tag(name = "开发者智能体审核管理")
public class ZhsAgentExamineController {

    @Autowired
    private IZhsAgentExamineService service;


    /**
     * 查询开发者智能体审核列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public R<Map<String, Object>> list(ZhsAgentExamine entity) {
        // 启动分页插件
        PageHelper.startPage(entity.getPageNum(), entity.getPageSize());
        List<ZhsAgentExamineVO> list = service.getList(entity);
        PageInfo<ZhsAgentExamineVO> pageInfo = new PageInfo<>(list);

        // 构建分页结果
        Map<String, Object> result = new HashMap<>();
        result.put("rows", list);
        result.put("total", pageInfo.getTotal());
        return R.ok(result);
    }

    /**
     * 获取开发者智能体审核详细信息
     */
    @GetMapping("/{id}")
    @Operation(summary = "详情")
    public R<ZhsAgentExamineVO> getInfo(@PathVariable String id) {
        return R.ok(service.getById(id));
    }

    /**
     * 新增开发者智能体审核
     */
    @PostMapping
    @Operation(summary = "新增")
    public R<String> add(@RequestBody ZhsAgentExamine entity) {
        service.add(entity);
        return R.ok();
    }

    /**
     * 修改开发者智能体审核
     */
    @PutMapping
    @Operation(summary = "修改")
    public R<String> edit(@RequestBody ZhsAgentExamine entity) {
        service.edit(entity);
        return R.ok();
    }

    /**
     * 删除开发者智能体审核
     */
    @DeleteMapping("/{ids}")
    @Operation(summary = "删除")
    public R<String> remove(@PathVariable String[] ids) {
        service.delByIds(ids);
        return R.ok();
    }

    /**
     * 审批智能体-通过
     */
    @PutMapping("/pass")
    @Operation(summary = "审批智能体-通过")
    public R<String> pass(@RequestBody Map<String, String> param) {
        String id = param.get("id");
        if (id == null || id.trim().isEmpty()) {
            return R.error("未找到可通过智能体！");
        }
        String remark = param.getOrDefault("remark", "");
        service.pass(id, remark);
        return R.ok();
    }

    /**
     * 审批智能体-驳回
     */
    @PutMapping("/reject")
    @Operation(summary = "审批智能体-驳回")
    public R<String> reject(@RequestBody Map<String, String> param) {
        String id = param.get("id");
        if (id == null || id.trim().isEmpty()) {
            return R.error("未找到可驳回智能体！");
        }
        String remark = param.getOrDefault("remark", "");
        service.reject(id, remark);
        return R.ok();
    }
}