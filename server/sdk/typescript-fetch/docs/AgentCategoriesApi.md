# AgentCategoriesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**deleteCategoryApiV1AgentsCategoryIdDelete**](AgentCategoriesApi.md#deletecategoryapiv1agentscategoryiddelete) | **DELETE** /api/v1/agents/{category_id} | Delete agent category |
| [**getCategoryDetailApiV1AgentsCategoryIdGet**](AgentCategoriesApi.md#getcategorydetailapiv1agentscategoryidget) | **GET** /api/v1/agents/{category_id} | Get category detail |
| [**updateCategoryApiV1AgentsCategoryIdPut**](AgentCategoriesApi.md#updatecategoryapiv1agentscategoryidput) | **PUT** /api/v1/agents/{category_id} | Update agent category |



## deleteCategoryApiV1AgentsCategoryIdDelete

> any deleteCategoryApiV1AgentsCategoryIdDelete(categoryId)

Delete agent category

### Example

```ts
import {
  Configuration,
  AgentCategoriesApi,
} from '';
import type { DeleteCategoryApiV1AgentsCategoryIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCategoriesApi(config);

  const body = {
    // number
    categoryId: 56,
  } satisfies DeleteCategoryApiV1AgentsCategoryIdDeleteRequest;

  try {
    const data = await api.deleteCategoryApiV1AgentsCategoryIdDelete(body);
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
| **categoryId** | `number` |  | [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getCategoryDetailApiV1AgentsCategoryIdGet

> any getCategoryDetailApiV1AgentsCategoryIdGet(categoryId)

Get category detail

### Example

```ts
import {
  Configuration,
  AgentCategoriesApi,
} from '';
import type { GetCategoryDetailApiV1AgentsCategoryIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AgentCategoriesApi();

  const body = {
    // number
    categoryId: 56,
  } satisfies GetCategoryDetailApiV1AgentsCategoryIdGetRequest;

  try {
    const data = await api.getCategoryDetailApiV1AgentsCategoryIdGet(body);
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
| **categoryId** | `number` |  | [Defaults to `undefined`] |

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


## updateCategoryApiV1AgentsCategoryIdPut

> any updateCategoryApiV1AgentsCategoryIdPut(categoryId, categoryUpdateBody)

Update agent category

### Example

```ts
import {
  Configuration,
  AgentCategoriesApi,
} from '';
import type { UpdateCategoryApiV1AgentsCategoryIdPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCategoriesApi(config);

  const body = {
    // number
    categoryId: 56,
    // CategoryUpdateBody
    categoryUpdateBody: ...,
  } satisfies UpdateCategoryApiV1AgentsCategoryIdPutRequest;

  try {
    const data = await api.updateCategoryApiV1AgentsCategoryIdPut(body);
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
| **categoryId** | `number` |  | [Defaults to `undefined`] |
| **categoryUpdateBody** | [CategoryUpdateBody](CategoryUpdateBody.md) |  | |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

