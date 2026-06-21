# \RankingAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AgentRankingApiV1RankingAgentGet**](RankingAPI.md#AgentRankingApiV1RankingAgentGet) | **Get** /api/v1/ranking/agent | Agent排行榜
[**AgentRankingApiV1RankingAgentGet_0**](RankingAPI.md#AgentRankingApiV1RankingAgentGet_0) | **Get** /api/v1/ranking/agent | Agent排行榜
[**CourseRankingApiV1RankingCourseGet**](RankingAPI.md#CourseRankingApiV1RankingCourseGet) | **Get** /api/v1/ranking/course | 课程排行榜
[**CourseRankingApiV1RankingCourseGet_0**](RankingAPI.md#CourseRankingApiV1RankingCourseGet_0) | **Get** /api/v1/ranking/course | 课程排行榜
[**CreateRankingApiV1RankingPost**](RankingAPI.md#CreateRankingApiV1RankingPost) | **Post** /api/v1/ranking | 创建榜单
[**CreateRankingApiV1RankingPost_0**](RankingAPI.md#CreateRankingApiV1RankingPost_0) | **Post** /api/v1/ranking | 创建榜单
[**ListRankingsApiV1RankingListGet**](RankingAPI.md#ListRankingsApiV1RankingListGet) | **Get** /api/v1/ranking/list | 排行榜列表
[**ListRankingsApiV1RankingListGet_0**](RankingAPI.md#ListRankingsApiV1RankingListGet_0) | **Get** /api/v1/ranking/list | 排行榜列表
[**UserRankingApiV1RankingUserGet**](RankingAPI.md#UserRankingApiV1RankingUserGet) | **Get** /api/v1/ranking/user | 用户积分排行榜
[**UserRankingApiV1RankingUserGet_0**](RankingAPI.md#UserRankingApiV1RankingUserGet_0) | **Get** /api/v1/ranking/user | 用户积分排行榜



## AgentRankingApiV1RankingAgentGet

> interface{} AgentRankingApiV1RankingAgentGet(ctx).Period(period).Limit(limit).Execute()

Agent排行榜

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
	period := "period_example" // string |  (optional) (default to "all")
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RankingAPI.AgentRankingApiV1RankingAgentGet(context.Background()).Period(period).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.AgentRankingApiV1RankingAgentGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentRankingApiV1RankingAgentGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.AgentRankingApiV1RankingAgentGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentRankingApiV1RankingAgentGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **period** | **string** |  | [default to &quot;all&quot;]
 **limit** | **int32** |  | [default to 50]

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


## AgentRankingApiV1RankingAgentGet_0

> interface{} AgentRankingApiV1RankingAgentGet_0(ctx).Period(period).Limit(limit).Execute()

Agent排行榜

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
	period := "period_example" // string |  (optional) (default to "all")
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RankingAPI.AgentRankingApiV1RankingAgentGet_0(context.Background()).Period(period).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.AgentRankingApiV1RankingAgentGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AgentRankingApiV1RankingAgentGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.AgentRankingApiV1RankingAgentGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAgentRankingApiV1RankingAgentGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **period** | **string** |  | [default to &quot;all&quot;]
 **limit** | **int32** |  | [default to 50]

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


## CourseRankingApiV1RankingCourseGet

> interface{} CourseRankingApiV1RankingCourseGet(ctx).Limit(limit).Execute()

课程排行榜

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
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RankingAPI.CourseRankingApiV1RankingCourseGet(context.Background()).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.CourseRankingApiV1RankingCourseGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CourseRankingApiV1RankingCourseGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.CourseRankingApiV1RankingCourseGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCourseRankingApiV1RankingCourseGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int32** |  | [default to 50]

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


## CourseRankingApiV1RankingCourseGet_0

> interface{} CourseRankingApiV1RankingCourseGet_0(ctx).Limit(limit).Execute()

课程排行榜

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
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RankingAPI.CourseRankingApiV1RankingCourseGet_0(context.Background()).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.CourseRankingApiV1RankingCourseGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CourseRankingApiV1RankingCourseGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.CourseRankingApiV1RankingCourseGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCourseRankingApiV1RankingCourseGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int32** |  | [default to 50]

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


## CreateRankingApiV1RankingPost

> interface{} CreateRankingApiV1RankingPost(ctx).Name(name).Code(code).Type_(type_).Period(period).Description(description).Execute()

创建榜单

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
	name := "name_example" // string | 
	code := "code_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "agent")
	period := "period_example" // string |  (optional) (default to "day")
	description := "description_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RankingAPI.CreateRankingApiV1RankingPost(context.Background()).Name(name).Code(code).Type_(type_).Period(period).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.CreateRankingApiV1RankingPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateRankingApiV1RankingPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.CreateRankingApiV1RankingPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateRankingApiV1RankingPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **code** | **string** |  | 
 **type_** | **string** |  | [default to &quot;agent&quot;]
 **period** | **string** |  | [default to &quot;day&quot;]
 **description** | **string** |  | 

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


## CreateRankingApiV1RankingPost_0

> interface{} CreateRankingApiV1RankingPost_0(ctx).Name(name).Code(code).Type_(type_).Period(period).Description(description).Execute()

创建榜单

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
	name := "name_example" // string | 
	code := "code_example" // string | 
	type_ := "type__example" // string |  (optional) (default to "agent")
	period := "period_example" // string |  (optional) (default to "day")
	description := "description_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RankingAPI.CreateRankingApiV1RankingPost_0(context.Background()).Name(name).Code(code).Type_(type_).Period(period).Description(description).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.CreateRankingApiV1RankingPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateRankingApiV1RankingPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.CreateRankingApiV1RankingPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateRankingApiV1RankingPost_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **code** | **string** |  | 
 **type_** | **string** |  | [default to &quot;agent&quot;]
 **period** | **string** |  | [default to &quot;day&quot;]
 **description** | **string** |  | 

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


## ListRankingsApiV1RankingListGet

> interface{} ListRankingsApiV1RankingListGet(ctx).Execute()

排行榜列表

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
	resp, r, err := apiClient.RankingAPI.ListRankingsApiV1RankingListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.ListRankingsApiV1RankingListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListRankingsApiV1RankingListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.ListRankingsApiV1RankingListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListRankingsApiV1RankingListGetRequest struct via the builder pattern


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


## ListRankingsApiV1RankingListGet_0

> interface{} ListRankingsApiV1RankingListGet_0(ctx).Execute()

排行榜列表

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
	resp, r, err := apiClient.RankingAPI.ListRankingsApiV1RankingListGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.ListRankingsApiV1RankingListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListRankingsApiV1RankingListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.ListRankingsApiV1RankingListGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiListRankingsApiV1RankingListGet_4Request struct via the builder pattern


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


## UserRankingApiV1RankingUserGet

> interface{} UserRankingApiV1RankingUserGet(ctx).Period(period).Limit(limit).Execute()

用户积分排行榜

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
	period := "period_example" // string |  (optional) (default to "all")
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RankingAPI.UserRankingApiV1RankingUserGet(context.Background()).Period(period).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.UserRankingApiV1RankingUserGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserRankingApiV1RankingUserGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.UserRankingApiV1RankingUserGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserRankingApiV1RankingUserGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **period** | **string** |  | [default to &quot;all&quot;]
 **limit** | **int32** |  | [default to 50]

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


## UserRankingApiV1RankingUserGet_0

> interface{} UserRankingApiV1RankingUserGet_0(ctx).Period(period).Limit(limit).Execute()

用户积分排行榜

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
	period := "period_example" // string |  (optional) (default to "all")
	limit := int32(56) // int32 |  (optional) (default to 50)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.RankingAPI.UserRankingApiV1RankingUserGet_0(context.Background()).Period(period).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RankingAPI.UserRankingApiV1RankingUserGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UserRankingApiV1RankingUserGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RankingAPI.UserRankingApiV1RankingUserGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUserRankingApiV1RankingUserGet_5Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **period** | **string** |  | [default to &quot;all&quot;]
 **limit** | **int32** |  | [default to 50]

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

