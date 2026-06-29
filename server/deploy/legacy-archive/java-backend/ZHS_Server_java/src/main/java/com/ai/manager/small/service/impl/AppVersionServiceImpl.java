package com.ai.manager.small.service.impl;

import com.ai.manager.small.domain.AppVersion;
import com.ai.manager.small.mapper.AppVersionMapper;
import com.ai.manager.small.service.IAppVersionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

/**
 * App版本管理Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-12-02
 */
@Service
public class AppVersionServiceImpl implements IAppVersionService
{
    @Autowired
    private AppVersionMapper appVersionMapper;

    /**
     * 查询App版本管理
     * 
     * @param id App版本管理主键
     * @return App版本管理
     */
    @Override
    public AppVersion getById(Long id)
    {
        return appVersionMapper.getById(id);
    }

    /**
     * 查询App版本管理列表
     * 
     * @param appVersion App版本管理
     * @return App版本管理
     */
    @Override
    public List<AppVersion> getList(AppVersion appVersion)
    {
        return appVersionMapper.getList(appVersion);
    }

    /**
     * 新增App版本管理
     * 
     * @param appVersion App版本管理
     * @return 结果
     */
    @Override
    public int add(AppVersion appVersion)
    {
        return appVersionMapper.addAppVersion(appVersion);
    }

    /**
     * 修改App版本管理
     * 
     * @param appVersion App版本管理
     * @return 结果
     */
    @Override
    public int edit(AppVersion appVersion)
    {
        return appVersionMapper.edit(appVersion);
    }

    /**
     * 批量删除App版本管理
     * 
     * @param ids 需要删除的App版本管理主键
     * @return 结果
     */
    @Override
    public int delByIds(Long[] ids)
    {
        return appVersionMapper.delByIds(ids);
    }

    /**
     * 删除App版本管理信息
     * 
     * @param id App版本管理主键
     * @return 结果
     */
    @Override
    public int delById(Long id)
    {
        return appVersionMapper.delById(id);
    }

    @Override
    public AppVersion getNowVersion(String appId,String version) {
        AppVersion nowVersion = appVersionMapper.getNowVersion(appId, version);
        if(Objects.isNull(nowVersion)){
            return AppVersion.builder().needUpdate(0).build();
        }
        return nowVersion;
    }
}
