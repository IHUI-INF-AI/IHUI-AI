# \AgentUseDetailAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AgentUsedetailDailyStats**](AgentUseDetailAPI.md#AgentUsedetailDailyStats) | **Get** /api/v1/agent-usedetail/stats/daily | 日统计
[**AgentUsedetailDailyStats_0**](AgentUseDetailAPI.md#AgentUsedetailDailyStats_0) | **Get** /api/v1/agent-usedetail/stats/daily | 日统计
[**ListDetailsApiV1AgentUsedetailListGet**](AgentUseDetailAPI.md#ListDetailsApiV1AgentUsedetailListGet) | **Get** /api/v1/agent-usedetail/list | 使用明细
[**ListDetailsApiV1AgentUsedetailListGet_0**](AgentUseDetailAPI.md#ListDetailsApiV1AgentUsedetailListGet_0) | **Get** /api/v1/agent-usedetail/list | 使用明细
[**RecordUsageApiV1AgentUsedetailRecordPost**](AgentUseDetailAPI.md#RecordUsageApiV1AgentUsedetailRecordPost) | **Post** /api/v1/agent-usedetail/record | 记录使用
[**RecordUsageApiV1AgentUsedetailRecordPost_0**](AgentUseDetailAPI.md#RecordUsageApiV1AgentUsedetailRecordPost_0) | **Post** /api/v1/agent-usedetail/record | 记录使用
[**SummaryStatsApiV1AgentUsedetailStatsSummaryGet**](AgentUseDetailAPI.md#SummaryStatsApiV1AgentUsedetailStatsSummaryGet) | **Get** /api/v1/agent-usedetail/stats/summary | 汇总统计
[**SummaryStatsApiV1AgentUsedetailStatsSummaryGet_0**](AgentUseDetailAPI.md#SummaryStatsApiV1AgentUsedetailStatsSummaryGet_0) | **Get** /api/v1/agent-usedetail/stats/summary | 汇总统计



## AgentUsedetailDailyStats

> interface{} AgentUsedetailDailyStats(ctx).AgentId(agentId).StartDate(startDate).EndDate(endDate).Execute()

日统计

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
	agentId := "agentId_example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUseDetailAPI.AgentUsedetailDailyStats(context.Background()).AgentId(agentId).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUseDetailAPI.AgentUsedetailDailyStats``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentUsedetailDailyStats`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUseDetailAPI.AgentUsedetailDailyStats`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentUsedetailDailyStatsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## AgentUsedetailDailyStats_0

> interface{} AgentUsedetailDailyStats_0(ctx).AgentId(agentId).StartDate(startDate).EndDate(endDate).Execute()

日统计

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
	agentId := "agentId_example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUseDetailAPI.AgentUsedetailDailyStats_0(context.Background()).AgentId(agentId).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUseDetailAPI.AgentUsedetailDailyStats_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentUsedetailDailyStats_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUseDetailAPI.AgentUsedetailDailyStats_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentUsedetailDailyStats_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListDetailsApiV1AgentUsedetailListGet

> interface{} ListDetailsApiV1AgentUsedetailListGet(ctx).Page(page).Limit(limit).AgentId(agentId).UserId(userId).Type_(type_).StartDate(startDate).EndDate(endDate).Execute()

使用明细

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
	agentId := "agentId_example" // string |  (optional)
	userId := "userId_example" // string |  (optional)
	type_ := "type__example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUseDetailAPI.ListDetailsApiV1AgentUsedetailListGet(context.Background()).Page(page).Limit(limit).AgentId(agentId).UserId(userId).Type_(type_).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUseDetailAPI.ListDetailsApiV1AgentUsedetailListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDetailsApiV1AgentUsedetailListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUseDetailAPI.ListDetailsApiV1AgentUsedetailListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDetailsApiV1AgentUsedetailListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **agentId** | **string** |  | 
 **userId** | **string** |  | 
 **type_** | **string** |  | 
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListDetailsApiV1AgentUsedetailListGet_0

> interface{} ListDetailsApiV1AgentUsedetailListGet_0(ctx).Page(page).Limit(limit).AgentId(agentId).UserId(userId).Type_(type_).StartDate(startDate).EndDate(endDate).Execute()

使用明细

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
	agentId := "agentId_example" // string |  (optional)
	userId := "userId_example" // string |  (optional)
	type_ := "type__example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUseDetailAPI.ListDetailsApiV1AgentUsedetailListGet_0(context.Background()).Page(page).Limit(limit).AgentId(agentId).UserId(userId).Type_(type_).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUseDetailAPI.ListDetailsApiV1AgentUsedetailListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListDetailsApiV1AgentUsedetailListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUseDetailAPI.ListDetailsApiV1AgentUsedetailListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListDetailsApiV1AgentUsedetailListGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **agentId** | **string** |  | 
 **userId** | **string** |  | 
 **type_** | **string** |  | 
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## RecordUsageApiV1AgentUsedetailRecordPost

> interface{} RecordUsageApiV1AgentUsedetailRecordPost(ctx).AgentId(agentId).UserId(userId).Type_(type_).Model(model).Tokens(tokens).Amount(amount).Cost(cost).RequestId(requestId).Status(status).Remark(remark).Execute()

记录使用

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
	userId := "userId_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "consume")
	model := "model_example" // string |  (optional)
	tokens := int32(56) // int32 |  (optional) (default to 0)
	amount := float32(8.14) // float32 |  (optional) (default to 0)
	cost := float32(8.14) // float32 |  (optional) (default to 0)
	requestId := "requestId_example" // string |  (optional)
	status := int32(56) // int32 |  (optional) (default to 1)
	remark := "remark_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUseDetailAPI.RecordUsageApiV1AgentUsedetailRecordPost(context.Background()).AgentId(agentId).UserId(userId).Type_(type_).Model(model).Tokens(tokens).Amount(amount).Cost(cost).RequestId(requestId).Status(status).Remark(remark).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUseDetailAPI.RecordUsageApiV1AgentUsedetailRecordPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordUsageApiV1AgentUsedetailRecordPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUseDetailAPI.RecordUsageApiV1AgentUsedetailRecordPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordUsageApiV1AgentUsedetailRecordPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **userId** | **string** |  | 
 **type_** | **string** |  | [default to &quot;consume&quot;]
 **model** | **string** |  | 
 **tokens** | **int32** |  | [default to 0]
 **amount** | **float32** |  | [default to 0]
 **cost** | **float32** |  | [default to 0]
 **requestId** | **string** |  | 
 **status** | **int32** |  | [default to 1]
 **remark** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## RecordUsageApiV1AgentUsedetailRecordPost_0

> interface{} RecordUsageApiV1AgentUsedetailRecordPost_0(ctx).AgentId(agentId).UserId(userId).Type_(type_).Model(model).Tokens(tokens).Amount(amount).Cost(cost).RequestId(requestId).Status(status).Remark(remark).Execute()

记录使用

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
	userId := "userId_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "consume")
	model := "model_example" // string |  (optional)
	tokens := int32(56) // int32 |  (optional) (default to 0)
	amount := float32(8.14) // float32 |  (optional) (default to 0)
	cost := float32(8.14) // float32 |  (optional) (default to 0)
	requestId := "requestId_example" // string |  (optional)
	status := int32(56) // int32 |  (optional) (default to 1)
	remark := "remark_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUseDetailAPI.RecordUsageApiV1AgentUsedetailRecordPost_0(context.Background()).AgentId(agentId).UserId(userId).Type_(type_).Model(model).Tokens(tokens).Amount(amount).Cost(cost).RequestId(requestId).Status(status).Remark(remark).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUseDetailAPI.RecordUsageApiV1AgentUsedetailRecordPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `RecordUsageApiV1AgentUsedetailRecordPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUseDetailAPI.RecordUsageApiV1AgentUsedetailRecordPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiRecordUsageApiV1AgentUsedetailRecordPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **userId** | **string** |  | 
 **type_** | **string** |  | [default to &quot;consume&quot;]
 **model** | **string** |  | 
 **tokens** | **int32** |  | [default to 0]
 **amount** | **float32** |  | [default to 0]
 **cost** | **float32** |  | [default to 0]
 **requestId** | **string** |  | 
 **status** | **int32** |  | [default to 1]
 **remark** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SummaryStatsApiV1AgentUsedetailStatsSummaryGet

> interface{} SummaryStatsApiV1AgentUsedetailStatsSummaryGet(ctx).AgentId(agentId).StartDate(startDate).EndDate(endDate).Execute()

汇总统计

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
	agentId := "agentId_example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUseDetailAPI.SummaryStatsApiV1AgentUsedetailStatsSummaryGet(context.Background()).AgentId(agentId).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUseDetailAPI.SummaryStatsApiV1AgentUsedetailStatsSummaryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SummaryStatsApiV1AgentUsedetailStatsSummaryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUseDetailAPI.SummaryStatsApiV1AgentUsedetailStatsSummaryGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSummaryStatsApiV1AgentUsedetailStatsSummaryGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## SummaryStatsApiV1AgentUsedetailStatsSummaryGet_0

> interface{} SummaryStatsApiV1AgentUsedetailStatsSummaryGet_0(ctx).AgentId(agentId).StartDate(startDate).EndDate(endDate).Execute()

汇总统计

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
	agentId := "agentId_example" // string |  (optional)
	startDate := "startDate_example" // string |  (optional)
	endDate := "endDate_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentUseDetailAPI.SummaryStatsApiV1AgentUsedetailStatsSummaryGet_0(context.Background()).AgentId(agentId).StartDate(startDate).EndDate(endDate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentUseDetailAPI.SummaryStatsApiV1AgentUsedetailStatsSummaryGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SummaryStatsApiV1AgentUsedetailStatsSummaryGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentUseDetailAPI.SummaryStatsApiV1AgentUsedetailStatsSummaryGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSummaryStatsApiV1AgentUsedetailStatsSummaryGet_4Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **agentId** | **string** |  | 
 **startDate** | **string** |  | 
 **endDate** | **string** |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

