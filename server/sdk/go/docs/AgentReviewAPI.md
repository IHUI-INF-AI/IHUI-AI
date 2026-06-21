# \AgentReviewAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ApproveExamineApiV1AgentsRecordIdApprovePut**](AgentReviewAPI.md#ApproveExamineApiV1AgentsRecordIdApprovePut) | **Put** /api/v1/agents/{record_id}/approve | Approve agent examination
[**ExamineStatsApiV1AgentsStatsSummaryGet**](AgentReviewAPI.md#ExamineStatsApiV1AgentsStatsSummaryGet) | **Get** /api/v1/agents/stats/summary | Examination statistics
[**RejectExamineApiV1AgentsRecordIdRejectPut**](AgentReviewAPI.md#RejectExamineApiV1AgentsRecordIdRejectPut) | **Put** /api/v1/agents/{record_id}/reject | Reject agent examination
[**SubmitExamineApiV1AgentsSubmitPost**](AgentReviewAPI.md#SubmitExamineApiV1AgentsSubmitPost) | **Post** /api/v1/agents/submit | Submit agent for examination



## ApproveExamineApiV1AgentsRecordIdApprovePut

> interface{} ApproveExamineApiV1AgentsRecordIdApprovePut(ctx, recordId).BodyApproveExamineApiV1AgentsRecordIdApprovePut(bodyApproveExamineApiV1AgentsRecordIdApprovePut).Execute()

Approve agent examination

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	recordId := int32(56) // int32 | 
	bodyApproveExamineApiV1AgentsRecordIdApprovePut := *openapiclient.NewBodyApproveExamineApiV1AgentsRecordIdApprovePut() // BodyApproveExamineApiV1AgentsRecordIdApprovePut |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentReviewAPI.ApproveExamineApiV1AgentsRecordIdApprovePut(context.Background(), recordId).BodyApproveExamineApiV1AgentsRecordIdApprovePut(bodyApproveExamineApiV1AgentsRecordIdApprovePut).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentReviewAPI.ApproveExamineApiV1AgentsRecordIdApprovePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ApproveExamineApiV1AgentsRecordIdApprovePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentReviewAPI.ApproveExamineApiV1AgentsRecordIdApprovePut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**recordId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiApproveExamineApiV1AgentsRecordIdApprovePutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **bodyApproveExamineApiV1AgentsRecordIdApprovePut** | [**BodyApproveExamineApiV1AgentsRecordIdApprovePut**](BodyApproveExamineApiV1AgentsRecordIdApprovePut.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ExamineStatsApiV1AgentsStatsSummaryGet

> interface{} ExamineStatsApiV1AgentsStatsSummaryGet(ctx).Execute()

Examination statistics

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentReviewAPI.ExamineStatsApiV1AgentsStatsSummaryGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentReviewAPI.ExamineStatsApiV1AgentsStatsSummaryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExamineStatsApiV1AgentsStatsSummaryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentReviewAPI.ExamineStatsApiV1AgentsStatsSummaryGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiExamineStatsApiV1AgentsStatsSummaryGetRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## RejectExamineApiV1AgentsRecordIdRejectPut

> interface{} RejectExamineApiV1AgentsRecordIdRejectPut(ctx, recordId).BodyRejectExamineApiV1AgentsRecordIdRejectPut(bodyRejectExamineApiV1AgentsRecordIdRejectPut).Execute()

Reject agent examination

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	recordId := int32(56) // int32 | 
	bodyRejectExamineApiV1AgentsRecordIdRejectPut := *openapiclient.NewBodyRejectExamineApiV1AgentsRecordIdRejectPut("RejectReason_example") // BodyRejectExamineApiV1AgentsRecordIdRejectPut | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentReviewAPI.RejectExamineApiV1AgentsRecordIdRejectPut(context.Background(), recordId).BodyRejectExamineApiV1AgentsRecordIdRejectPut(bodyRejectExamineApiV1AgentsRecordIdRejectPut).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentReviewAPI.RejectExamineApiV1AgentsRecordIdRejectPut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RejectExamineApiV1AgentsRecordIdRejectPut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentReviewAPI.RejectExamineApiV1AgentsRecordIdRejectPut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**recordId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiRejectExamineApiV1AgentsRecordIdRejectPutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **bodyRejectExamineApiV1AgentsRecordIdRejectPut** | [**BodyRejectExamineApiV1AgentsRecordIdRejectPut**](BodyRejectExamineApiV1AgentsRecordIdRejectPut.md) |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SubmitExamineApiV1AgentsSubmitPost

> interface{} SubmitExamineApiV1AgentsSubmitPost(ctx).AgentId(agentId).Execute()

Submit agent for examination

### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	agentId := "agentId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentReviewAPI.SubmitExamineApiV1AgentsSubmitPost(context.Background()).AgentId(agentId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentReviewAPI.SubmitExamineApiV1AgentsSubmitPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SubmitExamineApiV1AgentsSubmitPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentReviewAPI.SubmitExamineApiV1AgentsSubmitPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSubmitExamineApiV1AgentsSubmitPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

