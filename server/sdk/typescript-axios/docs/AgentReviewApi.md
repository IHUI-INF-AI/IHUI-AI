# AgentReviewApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**approveExamineApiV1AgentsRecordIdApprovePut**](#approveexamineapiv1agentsrecordidapproveput) | **PUT** /api/v1/agents/{record_id}/approve | Approve agent examination|
|[**examineStatsApiV1AgentsStatsSummaryGet**](#examinestatsapiv1agentsstatssummaryget) | **GET** /api/v1/agents/stats/summary | Examination statistics|
|[**rejectExamineApiV1AgentsRecordIdRejectPut**](#rejectexamineapiv1agentsrecordidrejectput) | **PUT** /api/v1/agents/{record_id}/reject | Reject agent examination|
|[**submitExamineApiV1AgentsSubmitPost**](#submitexamineapiv1agentssubmitpost) | **POST** /api/v1/agents/submit | Submit agent for examination|

# **approveExamineApiV1AgentsRecordIdApprovePut**
> any approveExamineApiV1AgentsRecordIdApprovePut()


### Example

```typescript
import {
    AgentReviewApi,
    Configuration,
    BodyApproveExamineApiV1AgentsRecordIdApprovePut
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentReviewApi(configuration);

let recordId: number; // (default to undefined)
let bodyApproveExamineApiV1AgentsRecordIdApprovePut: BodyApproveExamineApiV1AgentsRecordIdApprovePut; // (optional)

const { status, data } = await apiInstance.approveExamineApiV1AgentsRecordIdApprovePut(
    recordId,
    bodyApproveExamineApiV1AgentsRecordIdApprovePut
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyApproveExamineApiV1AgentsRecordIdApprovePut** | **BodyApproveExamineApiV1AgentsRecordIdApprovePut**|  | |
| **recordId** | [**number**] |  | defaults to undefined|


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

# **examineStatsApiV1AgentsStatsSummaryGet**
> any examineStatsApiV1AgentsStatsSummaryGet()


### Example

```typescript
import {
    AgentReviewApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentReviewApi(configuration);

const { status, data } = await apiInstance.examineStatsApiV1AgentsStatsSummaryGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **rejectExamineApiV1AgentsRecordIdRejectPut**
> any rejectExamineApiV1AgentsRecordIdRejectPut(bodyRejectExamineApiV1AgentsRecordIdRejectPut)


### Example

```typescript
import {
    AgentReviewApi,
    Configuration,
    BodyRejectExamineApiV1AgentsRecordIdRejectPut
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentReviewApi(configuration);

let recordId: number; // (default to undefined)
let bodyRejectExamineApiV1AgentsRecordIdRejectPut: BodyRejectExamineApiV1AgentsRecordIdRejectPut; //

const { status, data } = await apiInstance.rejectExamineApiV1AgentsRecordIdRejectPut(
    recordId,
    bodyRejectExamineApiV1AgentsRecordIdRejectPut
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyRejectExamineApiV1AgentsRecordIdRejectPut** | **BodyRejectExamineApiV1AgentsRecordIdRejectPut**|  | |
| **recordId** | [**number**] |  | defaults to undefined|


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

# **submitExamineApiV1AgentsSubmitPost**
> any submitExamineApiV1AgentsSubmitPost()


### Example

```typescript
import {
    AgentReviewApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentReviewApi(configuration);

let agentId: string; // (default to undefined)

const { status, data } = await apiInstance.submitExamineApiV1AgentsSubmitPost(
    agentId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentId** | [**string**] |  | defaults to undefined|


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

