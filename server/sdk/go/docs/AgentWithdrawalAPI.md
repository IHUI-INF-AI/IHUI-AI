# \AgentWithdrawalAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ApplyWithdrawalApiV1AgentsApplyPost**](AgentWithdrawalAPI.md#ApplyWithdrawalApiV1AgentsApplyPost) | **Post** /api/v1/agents/apply | 申请 Agent 提现
[**GetWithdrawalApiV1AgentsWithdrawalIdGet**](AgentWithdrawalAPI.md#GetWithdrawalApiV1AgentsWithdrawalIdGet) | **Get** /api/v1/agents/{withdrawal_id} | 提现详情



## ApplyWithdrawalApiV1AgentsApplyPost

> interface{} ApplyWithdrawalApiV1AgentsApplyPost(ctx).Amount(amount).OrderIds(orderIds).Execute()

申请 Agent 提现

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
	amount := int32(56) // int32 | 提现金额（分）
	orderIds := "orderIds_example" // string | 关联订单号，逗号分隔 (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentWithdrawalAPI.ApplyWithdrawalApiV1AgentsApplyPost(context.Background()).Amount(amount).OrderIds(orderIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentWithdrawalAPI.ApplyWithdrawalApiV1AgentsApplyPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ApplyWithdrawalApiV1AgentsApplyPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentWithdrawalAPI.ApplyWithdrawalApiV1AgentsApplyPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiApplyWithdrawalApiV1AgentsApplyPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **amount** | **int32** | 提现金额（分） | 
 **orderIds** | **string** | 关联订单号，逗号分隔 | [default to &quot;&quot;]

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


## GetWithdrawalApiV1AgentsWithdrawalIdGet

> interface{} GetWithdrawalApiV1AgentsWithdrawalIdGet(ctx, withdrawalId).Execute()

提现详情

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
	withdrawalId := "withdrawalId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentWithdrawalAPI.GetWithdrawalApiV1AgentsWithdrawalIdGet(context.Background(), withdrawalId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentWithdrawalAPI.GetWithdrawalApiV1AgentsWithdrawalIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetWithdrawalApiV1AgentsWithdrawalIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentWithdrawalAPI.GetWithdrawalApiV1AgentsWithdrawalIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**withdrawalId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetWithdrawalApiV1AgentsWithdrawalIdGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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

