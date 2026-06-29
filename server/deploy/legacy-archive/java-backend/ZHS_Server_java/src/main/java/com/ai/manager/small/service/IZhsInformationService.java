package com.ai.manager.small.service;


import com.ai.manager.small.domain.ZhsDictionary;
import com.ai.manager.small.domain.ZhsInformation;

import java.util.List;

/**
 * AI资讯库Service接口
 * 
 * @author ljd
 * @date 2025-05-27
 */
public interface IZhsInformationService 
{
    /**
     * 查询AI资讯库
     * 
     * @param id AI资讯库主键
     * @return AI资讯库
     */
    public ZhsInformation selectZhsInformationById(String id);

    /**
     * 查询AI资讯库列表
     * 
     * @param zhsInformation AI资讯库
     * @return AI资讯库集合
     */
    public List<ZhsInformation> selectZhsInformationList(ZhsInformation zhsInformation);

    /**
     * 新增AI资讯库
     * 
     * @param zhsInformation AI资讯库
     * @return 结果
     */
    public int insertZhsInformation(ZhsInformation zhsInformation);

    /**
     * 修改AI资讯库
     * 
     * @param zhsInformation AI资讯库
     * @return 结果
     */
    public int updateZhsInformation(ZhsInformation zhsInformation);

    /**
     * 批量删除AI资讯库
     * 
     * @param ids 需要删除的AI资讯库主键集合
     * @return 结果
     */
    public int deleteZhsInformationByIds(String[] ids);

    /**
     * 删除AI资讯库信息
     * 
     * @param id AI资讯库主键
     * @return 结果
     */
    public int deleteZhsInformationById(String id);

    Integer insertZhsInformationList(List<ZhsInformation> zhsInformationList);

    List<ZhsDictionary> getDictionary(ZhsDictionary dictionary);
}
