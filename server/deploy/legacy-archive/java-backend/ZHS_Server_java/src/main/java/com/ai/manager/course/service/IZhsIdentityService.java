package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsIdentity;

/**
 * 平台身份Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsIdentityService
{
    /**
     * 查询平台身份
     * 
     * @param id 平台身份主键
     * @return 平台身份
     */
    public ZhsIdentity getById(Integer id);

    /**
     * 查询平台身份列表
     * 
     * @param zhsIdentity 平台身份
     * @return 平台身份集合
     */
    public List<ZhsIdentity> getList(ZhsIdentity zhsIdentity);

    /**
     * 新增平台身份
     * 
     * @param zhsIdentity 平台身份
     * @return 结果
     */
    public int add(ZhsIdentity zhsIdentity);

    /**
     * 修改平台身份
     * 
     * @param zhsIdentity 平台身份
     * @return 结果
     */
    public int edit(ZhsIdentity zhsIdentity);

    /**
     * 批量删除平台身份
     * 
     * @param ids 需要删除的平台身份主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);

    /**
     * 删除平台身份信息
     * 
     * @param id 平台身份主键
     * @return 结果
     */
    public int delById(Integer id);
}
