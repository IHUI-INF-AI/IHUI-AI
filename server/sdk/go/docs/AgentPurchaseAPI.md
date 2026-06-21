# \AgentPurchaseAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ExpirePurchaseApiV1AgentsRecordIdExpirePut**](AgentPurchaseAPI.md#ExpirePurchaseApiV1AgentsRecordIdExpirePut) | **Put** /api/v1/agents/{record_id}/expire | Mark purchase record as expired
[**GetPurchaseByOrderApiV1AgentsOrderOrderNoGet**](AgentPurchaseAPI.md#GetPurchaseByOrderApiV1AgentsOrderOrderNoGet) | **Get** /api/v1/agents/order/{order_no} | Query by order number
[**GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet**](AgentPurchaseAPI.md#GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet) | **Get** /api/v1/agents/user/{user_uuid}/agent/{agent_id} | Query by user and agent
[**ListExpiredPurchasesApiV1AgentsExpiredGet**](AgentPurchaseAPI.md#ListExpiredPurchasesApiV1AgentsExpiredGet) | **Get** /api/v1/agents/expired | List expired purchase records



## ExpirePurchaseApiV1AgentsRecordIdExpirePut

> interface{} ExpirePurchaseApiV1AgentsRecordIdExpirePut(ctx, recordId).Execute()

Mark purchase record as expired

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

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentPurchaseAPI.ExpirePurchaseApiV1AgentsRecordIdExpirePut(context.Background(), recordId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentPurchaseAPI.ExpirePurchaseApiV1AgentsRecordIdExpirePut``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ExpirePurchaseApiV1AgentsRecordIdExpirePut`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentPurchaseAPI.ExpirePurchaseApiV1AgentsRecordIdExpirePut`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**recordId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiExpirePurchaseApiV1AgentsRecordIdExpirePutRequest struct via the builder pattern


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


## GetPurchaseByOrderApiV1AgentsOrderOrderNoGet

> interface{} GetPurchaseByOrderApiV1AgentsOrderOrderNoGet(ctx, orderNo).Execute()

Query by order number

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
	orderNo := "orderNo_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentPurchaseAPI.GetPurchaseByOrderApiV1AgentsOrderOrderNoGet(context.Background(), orderNo).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentPurchaseAPI.GetPurchaseByOrderApiV1AgentsOrderOrderNoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPurchaseByOrderApiV1AgentsOrderOrderNoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentPurchaseAPI.GetPurchaseByOrderApiV1AgentsOrderOrderNoGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**orderNo** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetPurchaseByOrderApiV1AgentsOrderOrderNoGetRequest struct via the builder pattern


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


## GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet

> interface{} GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet(ctx, userUuid, agentId).Page(page).Limit(limit).Execute()

Query by user and agent

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
	userUuid := "userUuid_example" // string | 
	agentId := "agentId_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentPurchaseAPI.GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet(context.Background(), userUuid, agentId).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentPurchaseAPI.GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentPurchaseAPI.GetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**userUuid** | **string** |  | 
**agentId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetPurchaseByUserAgentApiV1AgentsUserUserUuidAgentAgentIdGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListExpiredPurchasesApiV1AgentsExpiredGet

> interface{} ListExpiredPurchasesApiV1AgentsExpiredGet(ctx).Page(page).Limit(limit).Execute()

List expired purchase records

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
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentPurchaseAPI.ListExpiredPurchasesApiV1AgentsExpiredGet(context.Background()).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentPurchaseAPI.ListExpiredPurchasesApiV1AgentsExpiredGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListExpiredPurchasesApiV1AgentsExpiredGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentPurchaseAPI.ListExpiredPurchasesApiV1AgentsExpiredGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListExpiredPurchasesApiV1AgentsExpiredGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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

