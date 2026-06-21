# \AgentSettlementAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ListUnsettledApiV1AgentsUnsettledGet**](AgentSettlementAPI.md#ListUnsettledApiV1AgentsUnsettledGet) | **Get** /api/v1/agents/unsettled | 查询未结算记录
[**SettlementSummaryApiV1AgentsSummaryGet**](AgentSettlementAPI.md#SettlementSummaryApiV1AgentsSummaryGet) | **Get** /api/v1/agents/summary | 结算汇总
[**TriggerSettleApiV1AgentsSettlePost**](AgentSettlementAPI.md#TriggerSettleApiV1AgentsSettlePost) | **Post** /api/v1/agents/settle | 触发单条结算



## ListUnsettledApiV1AgentsUnsettledGet

> interface{} ListUnsettledApiV1AgentsUnsettledGet(ctx).Execute()

查询未结算记录

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
	resp, r, err := apiClient.AgentSettlementAPI.ListUnsettledApiV1AgentsUnsettledGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentSettlementAPI.ListUnsettledApiV1AgentsUnsettledGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListUnsettledApiV1AgentsUnsettledGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentSettlementAPI.ListUnsettledApiV1AgentsUnsettledGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListUnsettledApiV1AgentsUnsettledGetRequest struct via the builder pattern


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


## SettlementSummaryApiV1AgentsSummaryGet

> interface{} SettlementSummaryApiV1AgentsSummaryGet(ctx).Execute()

结算汇总

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
	resp, r, err := apiClient.AgentSettlementAPI.SettlementSummaryApiV1AgentsSummaryGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentSettlementAPI.SettlementSummaryApiV1AgentsSummaryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SettlementSummaryApiV1AgentsSummaryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentSettlementAPI.SettlementSummaryApiV1AgentsSummaryGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiSettlementSummaryApiV1AgentsSummaryGetRequest struct via the builder pattern


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


## TriggerSettleApiV1AgentsSettlePost

> interface{} TriggerSettleApiV1AgentsSettlePost(ctx).SettlementId(settlementId).Execute()

触发单条结算

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
	settlementId := "settlementId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentSettlementAPI.TriggerSettleApiV1AgentsSettlePost(context.Background()).SettlementId(settlementId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentSettlementAPI.TriggerSettleApiV1AgentsSettlePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `TriggerSettleApiV1AgentsSettlePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentSettlementAPI.TriggerSettleApiV1AgentsSettlePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiTriggerSettleApiV1AgentsSettlePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **settlementId** | **string** |  | 

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

