# \AgentRuleParamsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateRuleParamApiV1Post**](AgentRuleParamsAPI.md#CreateRuleParamApiV1Post) | **Post** /api/v1/ | Create rule param
[**DeleteRuleParamsApiV1ItemIdsDelete**](AgentRuleParamsAPI.md#DeleteRuleParamsApiV1ItemIdsDelete) | **Delete** /api/v1/{item_ids} | Delete rule params
[**GetRuleParamApiV1ItemIdGet**](AgentRuleParamsAPI.md#GetRuleParamApiV1ItemIdGet) | **Get** /api/v1/{item_id} | Get rule param detail
[**ListRuleParamsApiV1ListGet**](AgentRuleParamsAPI.md#ListRuleParamsApiV1ListGet) | **Get** /api/v1/list | List rule params
[**UpdateRuleParamApiV1Put**](AgentRuleParamsAPI.md#UpdateRuleParamApiV1Put) | **Put** /api/v1/ | Update rule param



## CreateRuleParamApiV1Post

> interface{} CreateRuleParamApiV1Post(ctx).RuleParamCreate(ruleParamCreate).Execute()

Create rule param

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
	ruleParamCreate := *openapiclient.NewRuleParamCreate(int32(123), "ParamName_example") // RuleParamCreate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRuleParamsAPI.CreateRuleParamApiV1Post(context.Background()).RuleParamCreate(ruleParamCreate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRuleParamsAPI.CreateRuleParamApiV1Post``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateRuleParamApiV1Post`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRuleParamsAPI.CreateRuleParamApiV1Post`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateRuleParamApiV1PostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ruleParamCreate** | [**RuleParamCreate**](RuleParamCreate.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## DeleteRuleParamsApiV1ItemIdsDelete

> interface{} DeleteRuleParamsApiV1ItemIdsDelete(ctx, itemIds).Execute()

Delete rule params

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
	itemIds := "itemIds_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRuleParamsAPI.DeleteRuleParamsApiV1ItemIdsDelete(context.Background(), itemIds).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRuleParamsAPI.DeleteRuleParamsApiV1ItemIdsDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteRuleParamsApiV1ItemIdsDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRuleParamsAPI.DeleteRuleParamsApiV1ItemIdsDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemIds** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteRuleParamsApiV1ItemIdsDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## GetRuleParamApiV1ItemIdGet

> interface{} GetRuleParamApiV1ItemIdGet(ctx, itemId).Execute()

Get rule param detail

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
	itemId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRuleParamsAPI.GetRuleParamApiV1ItemIdGet(context.Background(), itemId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRuleParamsAPI.GetRuleParamApiV1ItemIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetRuleParamApiV1ItemIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRuleParamsAPI.GetRuleParamApiV1ItemIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**itemId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetRuleParamApiV1ItemIdGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


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


## ListRuleParamsApiV1ListGet

> interface{} ListRuleParamsApiV1ListGet(ctx).Page(page).Limit(limit).RuleId(ruleId).Execute()

List rule params

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
	ruleId := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRuleParamsAPI.ListRuleParamsApiV1ListGet(context.Background()).Page(page).Limit(limit).RuleId(ruleId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRuleParamsAPI.ListRuleParamsApiV1ListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListRuleParamsApiV1ListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRuleParamsAPI.ListRuleParamsApiV1ListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListRuleParamsApiV1ListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **ruleId** | **int32** |  | 

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


## UpdateRuleParamApiV1Put

> interface{} UpdateRuleParamApiV1Put(ctx).RuleParamUpdate(ruleParamUpdate).Execute()

Update rule param

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
	ruleParamUpdate := *openapiclient.NewRuleParamUpdate(int32(123)) // RuleParamUpdate | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentRuleParamsAPI.UpdateRuleParamApiV1Put(context.Background()).RuleParamUpdate(ruleParamUpdate).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentRuleParamsAPI.UpdateRuleParamApiV1Put``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateRuleParamApiV1Put`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentRuleParamsAPI.UpdateRuleParamApiV1Put`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateRuleParamApiV1PutRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ruleParamUpdate** | [**RuleParamUpdate**](RuleParamUpdate.md) |  | 

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

