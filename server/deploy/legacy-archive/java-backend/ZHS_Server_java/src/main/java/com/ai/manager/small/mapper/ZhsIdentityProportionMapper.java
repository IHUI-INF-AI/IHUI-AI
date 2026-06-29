package com.ai.manager.small.mapper;


import com.ai.manager.small.domain.ZhsIdentityProportion;

import java.util.List;

/**
 * 当前分润比例Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-06-10
 */
public interface ZhsIdentityProportionMapper 
{
    /**
     * 查询当前分润比例
     * 
     * @param id 当前分润比例主键
     * @return 当前分润比例
     */
    public ZhsIdentityProportion selectZhsIdentityProportionById(String id);

    /**
     * 查询当前分润比例列表
     * 
     * @param zhsIdentityProportion 当前分润比例
     * @return 当前分润比例集合
     */
    public List<ZhsIdentityProportion> selectZhsIdentityProportionList(ZhsIdentityProportion zhsIdentityProportion);

    /**
     * 新增当前分润比例
     * 
     * @param zhsIdentityProportion 当前分润比例
     * @return 结果
     */
    public int insertZhsIdentityProportion(ZhsIdentityProportion zhsIdentityProportion);

    /**
     * 修改当前分润比例
     * 
     * @param zhsIdentityProportion 当前分润比例
     * @return 结果
     */
    public int updateZhsIdentityProportion(ZhsIdentityProportion zhsIdentityProportion);

    /**
     * 删除当前分润比例
     * 
     * @param id 当前分润比例主键
     * @return 结果
     */
    public int deleteZhsIdentityProportionById(String id);

    /**
     * 批量删除当前分润比例
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deleteZhsIdentityProportionByIds(String[] ids);

    ZhsIdentityProportion getCrankUpProportion();

}
