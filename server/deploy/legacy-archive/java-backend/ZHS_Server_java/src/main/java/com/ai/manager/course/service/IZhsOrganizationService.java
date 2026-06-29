package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsOrganization;

/**
 * 平台机构Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsOrganizationService
{
    /**
     * 查询平台机构
     * 
     * @param id 平台机构主键
     * @return 平台机构
     */
    public ZhsOrganization getById(Integer id);

    /**
     * 查询平台机构列表
     * 
     * @param zhsOrganization 平台机构
     * @return 平台机构集合
     */
    public List<ZhsOrganization> getList(ZhsOrganization zhsOrganization);

    /**
     * 新增平台机构
     * 
     * @param zhsOrganization 平台机构
     * @return 结果
     */
    public int add(ZhsOrganization zhsOrganization);

    /**
     * 修改平台机构
     * 
     * @param zhsOrganization 平台机构
     * @return 结果
     */
    public int edit(ZhsOrganization zhsOrganization);

    /**
     * 批量删除平台机构
     * 
     * @param ids 需要删除的平台机构主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);

    /**
     * 删除平台机构信息
     * 
     * @param id 平台机构主键
     * @return 结果
     */
    public int delById(Integer id);
}
