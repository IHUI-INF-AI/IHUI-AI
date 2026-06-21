# CozeAsyncWorkflowsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost**](CozeAsyncWorkflowsApi.md#runworkflowasyncapiv1cozeworkflowsasyncworkflowsasyncpost) | **POST** /api/v1/coze/workflows/async/workflows/async | Run Workflow Async |
| [**streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost**](CozeAsyncWorkflowsApi.md#streamworkflowasyncapiv1cozeworkflowsasyncworkflowsasyncstreampost) | **POST** /api/v1/coze/workflows/async/workflows/async/stream | Stream Workflow Async |
| [**workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost**](CozeAsyncWorkflowsApi.md#workflowchatapiv1cozeworkflowsasyncworkflowsasyncchatpost) | **POST** /api/v1/coze/workflows/async/workflows/async/chat | Workflow Chat |



## runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost

> any runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost(asyncWorkflowReq)

Run Workflow Async

### Example

```ts
import {
  Configuration,
  CozeAsyncWorkflowsApi,
} from '';
import type { RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAsyncWorkflowsApi();

  const body = {
    // AsyncWorkflowReq
    asyncWorkflowReq: ...,
  } satisfies RunWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPostRequest;

  try {
    const data = await api.runWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncPost(body);
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
| **asyncWorkflowReq** | [AsyncWorkflowReq](AsyncWorkflowReq.md) |  | |

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


## streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost

> any streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost(asyncWorkflowStreamReq)

Stream Workflow Async

### Example

```ts
import {
  Configuration,
  CozeAsyncWorkflowsApi,
} from '';
import type { StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAsyncWorkflowsApi();

  const body = {
    // AsyncWorkflowStreamReq
    asyncWorkflowStreamReq: ...,
  } satisfies StreamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPostRequest;

  try {
    const data = await api.streamWorkflowAsyncApiV1CozeWorkflowsAsyncWorkflowsAsyncStreamPost(body);
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
| **asyncWorkflowStreamReq** | [AsyncWorkflowStreamReq](AsyncWorkflowStreamReq.md) |  | |

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


## workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost

> any workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost(asyncWorkflowStreamReq)

Workflow Chat

### Example

```ts
import {
  Configuration,
  CozeAsyncWorkflowsApi,
} from '';
import type { WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new CozeAsyncWorkflowsApi();

  const body = {
    // AsyncWorkflowStreamReq
    asyncWorkflowStreamReq: ...,
  } satisfies WorkflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPostRequest;

  try {
    const data = await api.workflowChatApiV1CozeWorkflowsAsyncWorkflowsAsyncChatPost(body);
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
| **asyncWorkflowStreamReq** | [AsyncWorkflowStreamReq](AsyncWorkflowStreamReq.md) |  | |

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

