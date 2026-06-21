# AIGCApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createAigcApiV1ContentAigcPost**](AIGCApi.md#createaigcapiv1contentaigcpost) | **POST** /api/v1/content/aigc | Create AIGC record |
| [**deleteAigcApiV1ContentAigcItemIdsDelete**](AIGCApi.md#deleteaigcapiv1contentaigcitemidsdelete) | **DELETE** /api/v1/content/aigc/{item_ids} | Delete AIGC records |
| [**getAigcApiV1ContentAigcItemIdGet**](AIGCApi.md#getaigcapiv1contentaigcitemidget) | **GET** /api/v1/content/aigc/{item_id} | Get AIGC detail |
| [**listAigcApiV1ContentAigcListGet**](AIGCApi.md#listaigcapiv1contentaigclistget) | **GET** /api/v1/content/aigc/list | List AIGC records |
| [**updateAigcApiV1ContentAigcPut**](AIGCApi.md#updateaigcapiv1contentaigcput) | **PUT** /api/v1/content/aigc | Update AIGC record |



## createAigcApiV1ContentAigcPost

> any createAigcApiV1ContentAigcPost(aiGcCreate)

Create AIGC record

### Example

```ts
import {
  Configuration,
  AIGCApi,
} from '';
import type { CreateAigcApiV1ContentAigcPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIGCApi();

  const body = {
    // AiGcCreate
    aiGcCreate: ...,
  } satisfies CreateAigcApiV1ContentAigcPostRequest;

  try {
    const data = await api.createAigcApiV1ContentAigcPost(body);
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
| **aiGcCreate** | [AiGcCreate](AiGcCreate.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteAigcApiV1ContentAigcItemIdsDelete

> any deleteAigcApiV1ContentAigcItemIdsDelete(itemIds)

Delete AIGC records

### Example

```ts
import {
  Configuration,
  AIGCApi,
} from '';
import type { DeleteAigcApiV1ContentAigcItemIdsDeleteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIGCApi();

  const body = {
    // string
    itemIds: itemIds_example,
  } satisfies DeleteAigcApiV1ContentAigcItemIdsDeleteRequest;

  try {
    const data = await api.deleteAigcApiV1ContentAigcItemIdsDelete(body);
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
| **itemIds** | `string` |  | [Defaults to `undefined`] |

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


## getAigcApiV1ContentAigcItemIdGet

> any getAigcApiV1ContentAigcItemIdGet(itemId)

Get AIGC detail

### Example

```ts
import {
  Configuration,
  AIGCApi,
} from '';
import type { GetAigcApiV1ContentAigcItemIdGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIGCApi();

  const body = {
    // number
    itemId: 56,
  } satisfies GetAigcApiV1ContentAigcItemIdGetRequest;

  try {
    const data = await api.getAigcApiV1ContentAigcItemIdGet(body);
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
| **itemId** | `number` |  | [Defaults to `undefined`] |

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


## listAigcApiV1ContentAigcListGet

> any listAigcApiV1ContentAigcListGet(page, limit, userUuid, gcType, status)

List AIGC records

### Example

```ts
import {
  Configuration,
  AIGCApi,
} from '';
import type { ListAigcApiV1ContentAigcListGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIGCApi();

  const body = {
    // number (optional)
    page: 56,
    // number (optional)
    limit: 56,
    // string (optional)
    userUuid: userUuid_example,
    // string (optional)
    gcType: gcType_example,
    // number (optional)
    status: 56,
  } satisfies ListAigcApiV1ContentAigcListGetRequest;

  try {
    const data = await api.listAigcApiV1ContentAigcListGet(body);
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
| **page** | `number` |  | [Optional] [Defaults to `1`] |
| **limit** | `number` |  | [Optional] [Defaults to `20`] |
| **userUuid** | `string` |  | [Optional] [Defaults to `undefined`] |
| **gcType** | `string` |  | [Optional] [Defaults to `undefined`] |
| **status** | `number` |  | [Optional] [Defaults to `undefined`] |

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


## updateAigcApiV1ContentAigcPut

> any updateAigcApiV1ContentAigcPut(aiGcUpdate)

Update AIGC record

### Example

```ts
import {
  Configuration,
  AIGCApi,
} from '';
import type { UpdateAigcApiV1ContentAigcPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AIGCApi();

  const body = {
    // AiGcUpdate
    aiGcUpdate: ...,
  } satisfies UpdateAigcApiV1ContentAigcPutRequest;

  try {
    const data = await api.updateAigcApiV1ContentAigcPut(body);
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
| **aiGcUpdate** | [AiGcUpdate](AiGcUpdate.md) |  | |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

