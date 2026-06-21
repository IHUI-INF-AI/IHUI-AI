# CozeWorkflowsAsyncApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost**](#runworkflowasyncapiv1cozeworkflowsasyncworkflowsasyncpost) | **POST** /api/v1/coze/workflows/async/workflows/async | Run Workflow Async|
|[**streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost**](#streamworkflowasyncapiv1cozeworkflowsasyncworkflowsasyncstreampost) | **POST** /api/v1/coze/workflows/async/workflows/async/stream | Stream Workflow Async|
|[**workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost**](#workflowchatapiv1cozeworkflowsasyncworkflowsasyncchatpost) | **POST** /api/v1/coze/workflows/async/workflows/async/chat | Workflow Chat|

# **runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost**
> any runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost(asyncWorkflowReq)


### Example

```typescript
import {
    CozeWorkflowsAsyncApi,
    Configuration,
    AsyncWorkflowReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsAsyncApi(configuration);

let asyncWorkflowReq: AsyncWorkflowReq; //

const { status, data } = await apiInstance.runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost(
    asyncWorkflowReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **asyncWorkflowReq** | **AsyncWorkflowReq**|  | |


### Return type

**any**

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

# **streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost**
> any streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost(asyncWorkflowStreamReq)


### Example

```typescript
import {
    CozeWorkflowsAsyncApi,
    Configuration,
    AsyncWorkflowStreamReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsAsyncApi(configuration);

let asyncWorkflowStreamReq: AsyncWorkflowStreamReq; //

const { status, data } = await apiInstance.streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost(
    asyncWorkflowStreamReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **asyncWorkflowStreamReq** | **AsyncWorkflowStreamReq**|  | |


### Return type

**any**

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

# **workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost**
> any workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost(asyncWorkflowStreamReq)


### Example

```typescript
import {
    CozeWorkflowsAsyncApi,
    Configuration,
    AsyncWorkflowStreamReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeWorkflowsAsyncApi(configuration);

let asyncWorkflowStreamReq: AsyncWorkflowStreamReq; //

const { status, data } = await apiInstance.workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost(
    asyncWorkflowStreamReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **asyncWorkflowStreamReq** | **AsyncWorkflowStreamReq**|  | |


### Return type

**any**

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

