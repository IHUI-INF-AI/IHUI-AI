# CozeReviewApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getReviewStatusApiV1CozeReviewReviewStatusGet**](CozeReviewApi.md#getreviewstatusapiv1cozereviewreviewstatusget) | **GET** /api/v1/coze/review/review/status | Get Review Status |
| [**getReviewStatusApiV1CozeReviewReviewStatusGet_0**](CozeReviewApi.md#getreviewstatusapiv1cozereviewreviewstatusget_0) | **GET** /api/v1/coze/review/review/status | Get Review Status |
| [**updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost**](CozeReviewApi.md#updatereviewresultapiv1cozereviewreviewupdatereviewresultpost) | **POST** /api/v1/coze/review/review/update_review_result | Update Review Result |
| [**updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0**](CozeReviewApi.md#updatereviewresultapiv1cozereviewreviewupdatereviewresultpost_0) | **POST** /api/v1/coze/review/review/update_review_result | Update Review Result |



## getReviewStatusApiV1CozeReviewReviewStatusGet

> any getReviewStatusApiV1CozeReviewReviewStatusGet(botId, connectorId)

Get Review Status

### Example

```ts
import {
  Configuration,
  CozeReviewApi,
} from '';
import type { GetReviewStatusApiV1CozeReviewReviewStatusGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeReviewApi();

  const body = {
    // string
    botId: botId_example,
    // string
    connectorId: connectorId_example,
  } satisfies GetReviewStatusApiV1CozeReviewReviewStatusGetRequest;

  try {
    const data = await api.getReviewStatusApiV1CozeReviewReviewStatusGet(body);
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
| **botId** | `string` |  | [Defaults to `undefined`] |
| **connectorId** | `string` |  | [Defaults to `undefined`] |

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


## getReviewStatusApiV1CozeReviewReviewStatusGet_0

> any getReviewStatusApiV1CozeReviewReviewStatusGet_0(botId, connectorId)

Get Review Status

### Example

```ts
import {
  Configuration,
  CozeReviewApi,
} from '';
import type { GetReviewStatusApiV1CozeReviewReviewStatusGet0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeReviewApi();

  const body = {
    // string
    botId: botId_example,
    // string
    connectorId: connectorId_example,
  } satisfies GetReviewStatusApiV1CozeReviewReviewStatusGet0Request;

  try {
    const data = await api.getReviewStatusApiV1CozeReviewReviewStatusGet_0(body);
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
| **botId** | `string` |  | [Defaults to `undefined`] |
| **connectorId** | `string` |  | [Defaults to `undefined`] |

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


## updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost

> UpdateReviewResp updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost(updateReviewReq)

Update Review Result

### Example

```ts
import {
  Configuration,
  CozeReviewApi,
} from '';
import type { UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeReviewApi();

  const body = {
    // UpdateReviewReq
    updateReviewReq: ...,
  } satisfies UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPostRequest;

  try {
    const data = await api.updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost(body);
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
| **updateReviewReq** | [UpdateReviewReq](UpdateReviewReq.md) |  | |

### Return type

[**UpdateReviewResp**](UpdateReviewResp.md)

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


## updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0

> UpdateReviewResp updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0(updateReviewReq)

Update Review Result

### Example

```ts
import {
  Configuration,
  CozeReviewApi,
} from '';
import type { UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost0Request } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeReviewApi();

  const body = {
    // UpdateReviewReq
    updateReviewReq: ...,
  } satisfies UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost0Request;

  try {
    const data = await api.updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0(body);
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
| **updateReviewReq** | [UpdateReviewReq](UpdateReviewReq.md) |  | |

### Return type

[**UpdateReviewResp**](UpdateReviewResp.md)

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

