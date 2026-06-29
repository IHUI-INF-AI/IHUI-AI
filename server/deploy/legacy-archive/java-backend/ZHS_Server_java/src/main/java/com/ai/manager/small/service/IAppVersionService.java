package com.ai.manager.small.service;


import com.ai.manager.small.domain.AppVersion;

import java.util.List;

/**
 * App版本管理Service接口
 * 
 * @author Raindrop_L
 * @date 2025-12-02
 */
public interface IAppVersionService
{
    /**
     * 查询App版本管理
     * 
     * @param id App版本管理主键
     * @return App版本管理
     */
    public AppVersion getById(Long id);

    /**
     * 查询App版本管理列表
     * 
     * @param appVersion App版本管理
     * @return App版本管理集合
     */
    public List<AppVersion> getList(AppVersion appVersion);

    /**
     * 新增App版本管理
     * 
     * @param appVersion App版本管理
     * @return 结果
     */
    public int add(AppVersion appVersion);

    /**
     * 修改App版本管理
     * 
     * @param appVersion App版本管理
     * @return 结果
     */
    public int edit(AppVersion appVersion);

    /**
     * 批量删除App版本管理
     * 
     * @param ids 需要删除的App版本管理主键集合
     * @return 结果
     */
    public int delByIds(Long[] ids);

    /**
     * 删除App版本管理信息
     * 
     * @param id App版本管理主键
     * @return 结果
     */
    public int delById(Long id);

    AppVersion getNowVersion(String appId, String version);
}
