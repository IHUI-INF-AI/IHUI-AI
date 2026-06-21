# CozeReviewApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getReviewStatusApiV1CozeReviewReviewStatusGet**](#getreviewstatusapiv1cozereviewreviewstatusget) | **GET** /api/v1/coze/review/review/status | Get Review Status|
|[**getReviewStatusApiV1CozeReviewReviewStatusGet_0**](#getreviewstatusapiv1cozereviewreviewstatusget_0) | **GET** /api/v1/coze/review/review/status | Get Review Status|
|[**updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost**](#updatereviewresultapiv1cozereviewreviewupdatereviewresultpost) | **POST** /api/v1/coze/review/review/update_review_result | Update Review Result|
|[**updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0**](#updatereviewresultapiv1cozereviewreviewupdatereviewresultpost_0) | **POST** /api/v1/coze/review/review/update_review_result | Update Review Result|

# **getReviewStatusApiV1CozeReviewReviewStatusGet**
> any getReviewStatusApiV1CozeReviewReviewStatusGet()


### Example

```typescript
import {
    CozeReviewApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeReviewApi(configuration);

let botId: string; // (default to undefined)
let connectorId: string; // (default to undefined)

const { status, data } = await apiInstance.getReviewStatusApiV1CozeReviewReviewStatusGet(
    botId,
    connectorId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|
| **connectorId** | [**string**] |  | defaults to undefined|


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

# **getReviewStatusApiV1CozeReviewReviewStatusGet_0**
> any getReviewStatusApiV1CozeReviewReviewStatusGet_0()


### Example

```typescript
import {
    CozeReviewApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeReviewApi(configuration);

let botId: string; // (default to undefined)
let connectorId: string; // (default to undefined)

const { status, data } = await apiInstance.getReviewStatusApiV1CozeReviewReviewStatusGet_0(
    botId,
    connectorId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **botId** | [**string**] |  | defaults to undefined|
| **connectorId** | [**string**] |  | defaults to undefined|


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

# **updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost**
> UpdateReviewResp updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost(updateReviewReq)


### Example

```typescript
import {
    CozeReviewApi,
    Configuration,
    UpdateReviewReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeReviewApi(configuration);

let updateReviewReq: UpdateReviewReq; //

const { status, data } = await apiInstance.updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost(
    updateReviewReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateReviewReq** | **UpdateReviewReq**|  | |


### Return type

**UpdateReviewResp**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0**
> UpdateReviewResp updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0(updateReviewReq)


### Example

```typescript
import {
    CozeReviewApi,
    Configuration,
    UpdateReviewReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeReviewApi(configuration);

let updateReviewReq: UpdateReviewReq; //

const { status, data } = await apiInstance.updateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0(
    updateReviewReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateReviewReq** | **UpdateReviewReq**|  | |


### Return type

**UpdateReviewResp**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

