# CozeMockApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**mockCozeAgents**](CozeMockApi.md#mockcozeagents) | **GET** /cozeZhsApi/agents | Mock: Coze 智能体列表 |
| [**mockCozeCategories**](CozeMockApi.md#mockcozecategories) | **GET** /cozeZhsApi/cache/agent-category-dict/categories | Mock: Coze 智能体分类字典 |
| [**mockCozeCategoryDetail**](CozeMockApi.md#mockcozecategorydetail) | **GET** /cozeZhsApi/cache/agent-category-dict/categories/{category_id} | Mock: Coze 分类详情 |



## mockCozeAgents

> any mockCozeAgents()

Mock: Coze 智能体列表

### Example

```ts
import {
  Configuration,
  CozeMockApi,
} from '';
import type { MockCozeAgentsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeMockApi();

  try {
    const data = await api.mockCozeAgents();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockCozeCategories

> any mockCozeCategories()

Mock: Coze 智能体分类字典

### Example

```ts
import {
  Configuration,
  CozeMockApi,
} from '';
import type { MockCozeCategoriesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeMockApi();

  try {
    const data = await api.mockCozeCategories();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## mockCozeCategoryDetail

> any mockCozeCategoryDetail(categoryId)

Mock: Coze 分类详情

### Example

```ts
import {
  Configuration,
  CozeMockApi,
} from '';
import type { MockCozeCategoryDetailRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeMockApi();

  const body = {
    // string
    categoryId: categoryId_example,
  } satisfies MockCozeCategoryDetailRequest;

  try {
    const data = await api.mockCozeCategoryDetail(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **categoryId** | `string` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

