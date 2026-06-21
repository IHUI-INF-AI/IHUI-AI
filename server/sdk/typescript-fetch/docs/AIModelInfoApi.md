# AIModelInfoApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**compatCreateModelApiV1AiCompatCreatePost**](AIModelInfoApi.md#compatcreatemodelapiv1aicompatcreatepost) | **POST** /api/v1/ai/compat/create | [兼容] 新增模型 (前端 aiModelInfo.add) |
| [**compatDeleteModelApiV1AiCompatDeleteGet**](AIModelInfoApi.md#compatdeletemodelapiv1aicompatdeleteget) | **GET** /api/v1/ai/compat/delete | [兼容] 删除模型 (前端 aiModelInfo.delete) |
| [**compatUpdateModelApiV1AiCompatUpdatePost**](AIModelInfoApi.md#compatupdatemodelapiv1aicompatupdatepost) | **POST** /api/v1/ai/compat/update | [兼容] 更新模型 (前端 aiModelInfo.update) |
| [**createModelApiV1AiCreatePost**](AIModelInfoApi.md#createmodelapiv1aicreatepost) | **POST** /api/v1/ai/create | 新增模型 |
| [**deleteModelApiV1AiModelIdDelete**](AIModelInfoApi.md#deletemodelapiv1aimodeliddelete) | **DELETE** /api/v1/ai/{model_id} | 删除AI模型 |
| [**updateModelApiV1AiUpdatePost**](AIModelInfoApi.md#updatemodelapiv1aiupdatepost) | **POST** /api/v1/ai/update | 更新模型 |
| [**vendorStatsApiV1AiVendorsGet**](AIModelInfoApi.md#vendorstatsapiv1aivendorsget) | **GET** /api/v1/ai/vendors | 支持的厂商统计 |



## compatCreateModelApiV1AiCompatCreatePost

> any compatCreateModelApiV1AiCompatCreatePost(name, source, img, remark, type, creator)

[兼容] 新增模型 (前端 aiModelInfo.add)

### Example

```ts
import {
  Configuration,
  AIModelInfoApi,
} from '';
import type { CompatCreateModelApiV1AiCompatCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIModelInfoApi(config);

  const body = {
    // string
    name: name_example,
    // string (optional)
    source: source_example,
    // string (optional)
    img: img_example,
    // string (optional)
    remark: remark_example,
    // number (optional)
    type: 56,
    // string (optional)
    creator: creator_example,
  } satisfies CompatCreateModelApiV1AiCompatCreatePostRequest;

  try {
    const data = await api.compatCreateModelApiV1AiCompatCreatePost(body);
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
| **name** | `string` |  | [Defaults to `undefined`] |
| **source** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **img** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **remark** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **type** | `number` |  | [Optional] [Defaults to `undefined`] |
| **creator** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## compatDeleteModelApiV1AiCompatDeleteGet

> any compatDeleteModelApiV1AiCompatDeleteGet(id, updator)

[兼容] 删除模型 (前端 aiModelInfo.delete)

逻辑删除：将 status 置为 0。前端用 GET + query params，此处兼容。

### Example

```ts
import {
  Configuration,
  AIModelInfoApi,
} from '';
import type { CompatDeleteModelApiV1AiCompatDeleteGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIModelInfoApi(config);

  const body = {
    // string
    id: id_example,
    // string (optional)
    updator: updator_example,
  } satisfies CompatDeleteModelApiV1AiCompatDeleteGetRequest;

  try {
    const data = await api.compatDeleteModelApiV1AiCompatDeleteGet(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **updator** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## compatUpdateModelApiV1AiCompatUpdatePost

> any compatUpdateModelApiV1AiCompatUpdatePost(id, name, source, img, remark, type, isDel, updator)

[兼容] 更新模型 (前端 aiModelInfo.update)

### Example

```ts
import {
  Configuration,
  AIModelInfoApi,
} from '';
import type { CompatUpdateModelApiV1AiCompatUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIModelInfoApi(config);

  const body = {
    // string
    id: id_example,
    // string (optional)
    name: name_example,
    // string (optional)
    source: source_example,
    // string (optional)
    img: img_example,
    // string (optional)
    remark: remark_example,
    // number (optional)
    type: 56,
    // number (optional)
    isDel: 56,
    // string (optional)
    updator: updator_example,
  } satisfies CompatUpdateModelApiV1AiCompatUpdatePostRequest;

  try {
    const data = await api.compatUpdateModelApiV1AiCompatUpdatePost(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |
| **name** | `string` |  | [Optional] [Defaults to `undefined`] |
| **source** | `string` |  | [Optional] [Defaults to `undefined`] |
| **img** | `string` |  | [Optional] [Defaults to `undefined`] |
| **remark** | `string` |  | [Optional] [Defaults to `undefined`] |
| **type** | `number` |  | [Optional] [Defaults to `undefined`] |
| **isDel** | `number` |  | [Optional] [Defaults to `undefined`] |
| **updator** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## createModelApiV1AiCreatePost

> any createModelApiV1AiCreatePost(vendor, modelName, description, icon)

新增模型

### Example

```ts
import {
  Configuration,
  AIModelInfoApi,
} from '';
import type { CreateModelApiV1AiCreatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIModelInfoApi(config);

  const body = {
    // string
    vendor: vendor_example,
    // string
    modelName: modelName_example,
    // string (optional)
    description: description_example,
    // string (optional)
    icon: icon_example,
  } satisfies CreateModelApiV1AiCreatePostRequest;

  try {
    const data = await api.createModelApiV1AiCreatePost(body);
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
| **vendor** | `string` |  | [Defaults to `undefined`] |
| **modelName** | `string` |  | [Defaults to `undefined`] |
| **description** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |
| **icon** | `string` |  | [Optional] [Defaults to `&#39;&#39;`] |

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


## deleteModelApiV1AiModelIdDelete

> any deleteModelApiV1AiModelIdDelete(modelId)

删除AI模型

逻辑删除：将 status 置为 0。

### Example

```ts
import {
  Configuration,
  AIModelInfoApi,
} from '';
import type { DeleteModelApiV1AiModelIdDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIModelInfoApi(config);

  const body = {
    // number
    modelId: 56,
  } satisfies DeleteModelApiV1AiModelIdDeleteRequest;

  try {
    const data = await api.deleteModelApiV1AiModelIdDelete(body);
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
| **modelId** | `number` |  | [Defaults to `undefined`] |

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


## updateModelApiV1AiUpdatePost

> any updateModelApiV1AiUpdatePost(modelId, displayName, status)

更新模型

### Example

```ts
import {
  Configuration,
  AIModelInfoApi,
} from '';
import type { UpdateModelApiV1AiUpdatePostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIModelInfoApi(config);

  const body = {
    // number
    modelId: 56,
    // string (optional)
    displayName: displayName_example,
    // number (optional)
    status: 56,
  } satisfies UpdateModelApiV1AiUpdatePostRequest;

  try {
    const data = await api.updateModelApiV1AiUpdatePost(body);
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
| **modelId** | `number` |  | [Defaults to `undefined`] |
| **displayName** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## vendorStatsApiV1AiVendorsGet

> any vendorStatsApiV1AiVendorsGet()

支持的厂商统计

### Example

```ts
import {
  Configuration,
  AIModelInfoApi,
} from '';
import type { VendorStatsApiV1AiVendorsGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AIModelInfoApi(config);

  try {
    const data = await api.vendorStatsApiV1AiVendorsGet();
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

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

