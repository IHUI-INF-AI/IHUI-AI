# AgentReviewApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**approveExamineApiV1AgentsRecordIdApprovePut**](AgentReviewApi.md#approveexamineapiv1agentsrecordidapproveput) | **PUT** /api/v1/agents/{record_id}/approve | Approve agent examination |
| [**examineStatsApiV1AgentsStatsSummaryGet**](AgentReviewApi.md#examinestatsapiv1agentsstatssummaryget) | **GET** /api/v1/agents/stats/summary | Examination statistics |
| [**rejectExamineApiV1AgentsRecordIdRejectPut**](AgentReviewApi.md#rejectexamineapiv1agentsrecordidrejectput) | **PUT** /api/v1/agents/{record_id}/reject | Reject agent examination |
| [**submitExamineApiV1AgentsSubmitPost**](AgentReviewApi.md#submitexamineapiv1agentssubmitpost) | **POST** /api/v1/agents/submit | Submit agent for examination |



## approveExamineApiV1AgentsRecordIdApprovePut

> any approveExamineApiV1AgentsRecordIdApprovePut(recordId, bodyApproveExamineApiV1AgentsRecordIdApprovePut)

Approve agent examination

### Example

```ts
import {
  Configuration,
  AgentReviewApi,
} from '';
import type { ApproveExamineApiV1AgentsRecordIdApprovePutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentReviewApi(config);

  const body = {
    // number
    recordId: 56,
    // BodyApproveExamineApiV1AgentsRecordIdApprovePut (optional)
    bodyApproveExamineApiV1AgentsRecordIdApprovePut: ...,
  } satisfies ApproveExamineApiV1AgentsRecordIdApprovePutRequest;

  try {
    const data = await api.approveExamineApiV1AgentsRecordIdApprovePut(body);
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
| **recordId** | `number` |  | [Defaults to `undefined`] |
| **bodyApproveExamineApiV1AgentsRecordIdApprovePut** | [BodyApproveExamineApiV1AgentsRecordIdApprovePut](BodyApproveExamineApiV1AgentsRecordIdApprovePut.md) |  | [Optional] |

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


## examineStatsApiV1AgentsStatsSummaryGet

> any examineStatsApiV1AgentsStatsSummaryGet()

Examination statistics

### Example

```ts
import {
  Configuration,
  AgentReviewApi,
} from '';
import type { ExamineStatsApiV1AgentsStatsSummaryGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentReviewApi(config);

  try {
    const data = await api.examineStatsApiV1AgentsStatsSummaryGet();
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


## rejectExamineApiV1AgentsRecordIdRejectPut

> any rejectExamineApiV1AgentsRecordIdRejectPut(recordId, bodyRejectExamineApiV1AgentsRecordIdRejectPut)

Reject agent examination

### Example

```ts
import {
  Configuration,
  AgentReviewApi,
} from '';
import type { RejectExamineApiV1AgentsRecordIdRejectPutRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentReviewApi(config);

  const body = {
    // number
    recordId: 56,
    // BodyRejectExamineApiV1AgentsRecordIdRejectPut
    bodyRejectExamineApiV1AgentsRecordIdRejectPut: ...,
  } satisfies RejectExamineApiV1AgentsRecordIdRejectPutRequest;

  try {
    const data = await api.rejectExamineApiV1AgentsRecordIdRejectPut(body);
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
| **recordId** | `number` |  | [Defaults to `undefined`] |
| **bodyRejectExamineApiV1AgentsRecordIdRejectPut** | [BodyRejectExamineApiV1AgentsRecordIdRejectPut](BodyRejectExamineApiV1AgentsRecordIdRejectPut.md) |  | |

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


## submitExamineApiV1AgentsSubmitPost

> any submitExamineApiV1AgentsSubmitPost(agentId)

Submit agent for examination

### Example

```ts
import {
  Configuration,
  AgentReviewApi,
} from '';
import type { SubmitExamineApiV1AgentsSubmitPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentReviewApi(config);

  const body = {
    // string
    agentId: agentId_example,
  } satisfies SubmitExamineApiV1AgentsSubmitPostRequest;

  try {
    const data = await api.submitExamineApiV1AgentsSubmitPost(body);
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
| **agentId** | `string` |  | [Defaults to `undefined`] |

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

