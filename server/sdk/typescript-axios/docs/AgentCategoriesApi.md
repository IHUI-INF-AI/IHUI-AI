# AgentCategoriesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**deleteCategoryApiV1AgentsCategoryIdDelete**](#deletecategoryapiv1agentscategoryiddelete) | **DELETE** /api/v1/agents/{category_id} | Delete agent category|
|[**getCategoryDetailApiV1AgentsCategoryIdGet**](#getcategorydetailapiv1agentscategoryidget) | **GET** /api/v1/agents/{category_id} | Get category detail|
|[**updateCategoryApiV1AgentsCategoryIdPut**](#updatecategoryapiv1agentscategoryidput) | **PUT** /api/v1/agents/{category_id} | Update agent category|

# **deleteCategoryApiV1AgentsCategoryIdDelete**
> any deleteCategoryApiV1AgentsCategoryIdDelete()


### Example

```typescript
import {
    AgentCategoriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCategoriesApi(configuration);

let categoryId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteCategoryApiV1AgentsCategoryIdDelete(
    categoryId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getCategoryDetailApiV1AgentsCategoryIdGet**
> any getCategoryDetailApiV1AgentsCategoryIdGet()


### Example

```typescript
import {
    AgentCategoriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCategoriesApi(configuration);

let categoryId: number; // (default to undefined)

const { status, data } = await apiInstance.getCategoryDetailApiV1AgentsCategoryIdGet(
    categoryId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryId** | [**number**] |  | defaults to undefined|


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

# **updateCategoryApiV1AgentsCategoryIdPut**
> any updateCategoryApiV1AgentsCategoryIdPut(categoryUpdateBody)


### Example

```typescript
import {
    AgentCategoriesApi,
    Configuration,
    CategoryUpdateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCategoriesApi(configuration);

let categoryId: number; // (default to undefined)
let categoryUpdateBody: CategoryUpdateBody; //

const { status, data } = await apiInstance.updateCategoryApiV1AgentsCategoryIdPut(
    categoryId,
    categoryUpdateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **categoryUpdateBody** | **CategoryUpdateBody**|  | |
| **categoryId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

