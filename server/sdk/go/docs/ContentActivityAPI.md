# \ContentActivityAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetActivityApiV1ContentActivityActivityIdGet**](ContentActivityAPI.md#GetActivityApiV1ContentActivityActivityIdGet) | **Get** /api/v1/content/activity/{activity_id} | 活动详情
[**ListActivitiesApiV1ContentActivityListGet**](ContentActivityAPI.md#ListActivitiesApiV1ContentActivityListGet) | **Get** /api/v1/content/activity/list | 活动列表



## GetActivityApiV1ContentActivityActivityIdGet

> interface{} GetActivityApiV1ContentActivityActivityIdGet(ctx, activityId).Execute()

活动详情



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
	activityId := "activityId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentActivityAPI.GetActivityApiV1ContentActivityActivityIdGet(context.Background(), activityId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentActivityAPI.GetActivityApiV1ContentActivityActivityIdGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `GetActivityApiV1ContentActivityActivityIdGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentActivityAPI.GetActivityApiV1ContentActivityActivityIdGet`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**activityId** | **string** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiGetActivityApiV1ContentActivityActivityIdGetRequest struct via the builder pattern


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


## ListActivitiesApiV1ContentActivityListGet

> interface{} ListActivitiesApiV1ContentActivityListGet(ctx).Page(page).Limit(limit).Status(status).Execute()

活动列表



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
	status := int32(56) // int32 | 筛选状态: 0=关闭 1=开启 (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ContentActivityAPI.ListActivitiesApiV1ContentActivityListGet(context.Background()).Page(page).Limit(limit).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ContentActivityAPI.ListActivitiesApiV1ContentActivityListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListActivitiesApiV1ContentActivityListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `ContentActivityAPI.ListActivitiesApiV1ContentActivityListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListActivitiesApiV1ContentActivityListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **status** | **int32** | 筛选状态: 0&#x3D;关闭 1&#x3D;开启 | 

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

