# CozeMockApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**mockCozeAgents**](#mockcozeagents) | **GET** /cozeZhsApi/agents | Mock: Coze 智能体列表|
|[**mockCozeCategories**](#mockcozecategories) | **GET** /cozeZhsApi/cache/agent-category-dict/categories | Mock: Coze 智能体分类字典|
|[**mockCozeCategoryDetail**](#mockcozecategorydetail) | **GET** /cozeZhsApi/cache/agent-category-dict/categories/{category_id} | Mock: Coze 分类详情|

# **mockCozeAgents**
> any mockCozeAgents()


### Example

```typescript
import {
    CozeMockApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeMockApi(configuration);

const { status, data } = await apiInstance.mockCozeAgents();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockCozeCategories**
> any mockCozeCategories()


### Example

```typescript
import {
    CozeMockApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeMockApi(configuration);

const { status, data } = await apiInstance.mockCozeCategories();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mockCozeCategoryDetail**
> any mockCozeCategoryDetail()


### Example

```typescript
import {
    CozeMockApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeMockApi(configuration);

let categoryId: string; // (default to undefined)

const { status, data } = await apiInstance.mockCozeCategoryDetail(
    categoryId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

