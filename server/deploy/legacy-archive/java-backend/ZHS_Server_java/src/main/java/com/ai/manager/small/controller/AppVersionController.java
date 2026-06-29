package com.ai.manager.small.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.domain.AppVersion;
import com.ai.manager.small.service.IAppVersionService;
import com.github.pagehelper.PageHelper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletResponse;
import java.util.List;

/**
 * App版本管理Controller
 * 
 * @author Raindrop_L
 * @date 2025-12-02
 */
@RestController
@RequestMapping("/appVersion")
@Tag(name = "App版本管理管理")
public class AppVersionController
{
    @Autowired
    private IAppVersionService appVersionService;

    /**
     * 查询App版本管理列表
     */
    @GetMapping("/list")
    @Operation(summary = "列表")
    public ResponseResultInfo list(AppVersion appVersion)
    {
        PageHelper.startPage(appVersion.getPageNum(), appVersion.getPageSize(), appVersion.getOrderByColumn()).setReasonable(true);
        List<AppVersion> list = appVersionService.getList(appVersion);
        return ResponseResultInfo.success(list);
    }

    /**
     * 获取App版本管理详细信息
     */
    @GetMapping(value = "/{id}")
    @Operation(summary = "详情")
    public ResponseResultInfo getInfo(@PathVariable("id") Long id)
    {
        return ResponseResultInfo.success(appVersionService.getById(id));
    }

    /**
     * 新增App版本管理
     */
    @Operation(summary = "新增")
    @PostMapping
    public ResponseResultInfo add(@RequestBody AppVersion appVersion)
    {
        return ResponseResultInfo.success(appVersionService.add(appVersion));
    }

    /**
     * 修改App版本管理
     */
    @Operation(summary = "修改")
    @PutMapping
    public ResponseResultInfo edit(@RequestBody AppVersion appVersion)
    {
        return ResponseResultInfo.success(appVersionService.edit(appVersion));
    }

    /**
     * 删除App版本管理
     */
    @Operation(summary = "删除")
	@DeleteMapping("/{ids}")
    public ResponseResultInfo remove(@PathVariable Long[] ids)
    {
        return ResponseResultInfo.success(appVersionService.delByIds(ids));
    }


    @SkipLogin
    @GetMapping(value = "/{appId}/{version}")
    @Operation(summary = "详情")
    public ResponseResultInfo getInfo(@PathVariable("appId") String appId,@PathVariable("version") String version)
    {
        return ResponseResultInfo.success(appVersionService.getNowVersion(appId,version));
    }

}
