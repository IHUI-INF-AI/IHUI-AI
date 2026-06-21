# \CozeReviewAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetReviewStatusApiV1CozeReviewReviewStatusGet**](CozeReviewAPI.md#GetReviewStatusApiV1CozeReviewReviewStatusGet) | **Get** /api/v1/coze/review/review/status | Get Review Status
[**GetReviewStatusApiV1CozeReviewReviewStatusGet_0**](CozeReviewAPI.md#GetReviewStatusApiV1CozeReviewReviewStatusGet_0) | **Get** /api/v1/coze/review/review/status | Get Review Status
[**UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost**](CozeReviewAPI.md#UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost) | **Post** /api/v1/coze/review/review/update_review_result | Update Review Result
[**UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0**](CozeReviewAPI.md#UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0) | **Post** /api/v1/coze/review/review/update_review_result | Update Review Result



## GetReviewStatusApiV1CozeReviewReviewStatusGet

> interface{} GetReviewStatusApiV1CozeReviewReviewStatusGet(ctx).BotId(botId).ConnectorId(connectorId).Execute()

Get Review Status

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
	botId := "botId_example" // string | 
	connectorId := "connectorId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeReviewAPI.GetReviewStatusApiV1CozeReviewReviewStatusGet(context.Background()).BotId(botId).ConnectorId(connectorId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeReviewAPI.GetReviewStatusApiV1CozeReviewReviewStatusGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetReviewStatusApiV1CozeReviewReviewStatusGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeReviewAPI.GetReviewStatusApiV1CozeReviewReviewStatusGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetReviewStatusApiV1CozeReviewReviewStatusGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 
 **connectorId** | **string** |  | 

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


## GetReviewStatusApiV1CozeReviewReviewStatusGet_0

> interface{} GetReviewStatusApiV1CozeReviewReviewStatusGet_0(ctx).BotId(botId).ConnectorId(connectorId).Execute()

Get Review Status

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
	botId := "botId_example" // string | 
	connectorId := "connectorId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeReviewAPI.GetReviewStatusApiV1CozeReviewReviewStatusGet_0(context.Background()).BotId(botId).ConnectorId(connectorId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeReviewAPI.GetReviewStatusApiV1CozeReviewReviewStatusGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetReviewStatusApiV1CozeReviewReviewStatusGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeReviewAPI.GetReviewStatusApiV1CozeReviewReviewStatusGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiGetReviewStatusApiV1CozeReviewReviewStatusGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **botId** | **string** |  | 
 **connectorId** | **string** |  | 

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


## UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost

> UpdateReviewResp UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost(ctx).UpdateReviewReq(updateReviewReq).Execute()

Update Review Result

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
	updateReviewReq := *openapiclient.NewUpdateReviewReq("BotId_example", "ConnectorId_example", int32(123)) // UpdateReviewReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeReviewAPI.UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost(context.Background()).UpdateReviewReq(updateReviewReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeReviewAPI.UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost`: UpdateReviewResp
	fmt.Fprintf(os.Stdout, "Response from `CozeReviewAPI.UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateReviewReq** | [**UpdateReviewReq**](UpdateReviewReq.md) |  | 

### Return type

[**UpdateReviewResp**](UpdateReviewResp.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0

> UpdateReviewResp UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0(ctx).UpdateReviewReq(updateReviewReq).Execute()

Update Review Result

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
	updateReviewReq := *openapiclient.NewUpdateReviewReq("BotId_example", "ConnectorId_example", int32(123)) // UpdateReviewReq | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeReviewAPI.UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0(context.Background()).UpdateReviewReq(updateReviewReq).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeReviewAPI.UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0`: UpdateReviewResp
	fmt.Fprintf(os.Stdout, "Response from `CozeReviewAPI.UpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateReviewResultApiV1CozeReviewReviewUpdateReviewResultPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **updateReviewReq** | [**UpdateReviewReq**](UpdateReviewReq.md) |  | 

### Return type

[**UpdateReviewResp**](UpdateReviewResp.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

