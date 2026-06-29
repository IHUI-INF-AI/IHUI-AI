package com.ai.manager.small.mapper;


import com.ai.manager.small.domain.AppVersion;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * App版本管理Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-12-02
 */
public interface AppVersionMapper
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
    public int addAppVersion(AppVersion appVersion);

    /**
     * 修改App版本管理
     * 
     * @param appVersion App版本管理
     * @return 结果
     */
    public int edit(AppVersion appVersion);

    /**
     * 删除App版本管理
     * 
     * @param id App版本管理主键
     * @return 结果
     */
    public int delById(Long id);

    /**
     * 批量删除App版本管理
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(Long[] ids);

    AppVersion getNowVersion(@Param("appId") String appId, @Param("version") String version);
}
