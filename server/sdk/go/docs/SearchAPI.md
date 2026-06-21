# \SearchAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddHotKeywordApiV1SearchHotKeywordPost**](SearchAPI.md#AddHotKeywordApiV1SearchHotKeywordPost) | **Post** /api/v1/search/hot/keyword | 添加热搜词
[**AddHotKeywordApiV1SearchHotKeywordPost_0**](SearchAPI.md#AddHotKeywordApiV1SearchHotKeywordPost_0) | **Post** /api/v1/search/hot/keyword | 添加热搜词
[**AddIndexApiV1SearchIndexPost**](SearchAPI.md#AddIndexApiV1SearchIndexPost) | **Post** /api/v1/search/index | 添加/更新索引
[**AddIndexApiV1SearchIndexPost_0**](SearchAPI.md#AddIndexApiV1SearchIndexPost_0) | **Post** /api/v1/search/index | 添加/更新索引
[**DeleteByTargetApiV1SearchIndexByTargetDelete**](SearchAPI.md#DeleteByTargetApiV1SearchIndexByTargetDelete) | **Delete** /api/v1/search/index/by-target | 按目标删除索引
[**DeleteByTargetApiV1SearchIndexByTargetDelete_0**](SearchAPI.md#DeleteByTargetApiV1SearchIndexByTargetDelete_0) | **Delete** /api/v1/search/index/by-target | 按目标删除索引
[**DeleteHotKeywordApiV1SearchHotKeywordKidDelete**](SearchAPI.md#DeleteHotKeywordApiV1SearchHotKeywordKidDelete) | **Delete** /api/v1/search/hot/keyword/{kid} | 删除热搜词
[**DeleteHotKeywordApiV1SearchHotKeywordKidDelete_0**](SearchAPI.md#DeleteHotKeywordApiV1SearchHotKeywordKidDelete_0) | **Delete** /api/v1/search/hot/keyword/{kid} | 删除热搜词
[**DeleteIndexApiV1SearchIndexIdxIdDelete**](SearchAPI.md#DeleteIndexApiV1SearchIndexIdxIdDelete) | **Delete** /api/v1/search/index/{idx_id} | 删除索引
[**DeleteIndexApiV1SearchIndexIdxIdDelete_0**](SearchAPI.md#DeleteIndexApiV1SearchIndexIdxIdDelete_0) | **Delete** /api/v1/search/index/{idx_id} | 删除索引
[**HotKeywordsApiV1SearchHotGet**](SearchAPI.md#HotKeywordsApiV1SearchHotGet) | **Get** /api/v1/search/hot | 热搜词
[**HotKeywordsApiV1SearchHotGet_0**](SearchAPI.md#HotKeywordsApiV1SearchHotGet_0) | **Get** /api/v1/search/hot | 热搜词
[**QueryApiV1SearchQueryGet**](SearchAPI.md#QueryApiV1SearchQueryGet) | **Get** /api/v1/search/query | 全文搜索
[**QueryApiV1SearchQueryGet_0**](SearchAPI.md#QueryApiV1SearchQueryGet_0) | **Get** /api/v1/search/query | 全文搜索
[**SearchLogList**](SearchAPI.md#SearchLogList) | **Get** /api/v1/search/log/list | 搜索日志
[**SearchLogList_0**](SearchAPI.md#SearchLogList_0) | **Get** /api/v1/search/log/list | 搜索日志
[**SuggestApiV1SearchSuggestGet**](SearchAPI.md#SuggestApiV1SearchSuggestGet) | **Get** /api/v1/search/suggest | 搜索建议
[**SuggestApiV1SearchSuggestGet_0**](SearchAPI.md#SuggestApiV1SearchSuggestGet_0) | **Get** /api/v1/search/suggest | 搜索建议



## AddHotKeywordApiV1SearchHotKeywordPost

> interface{} AddHotKeywordApiV1SearchHotKeywordPost(ctx).Keyword(keyword).IsHot(isHot).SortOrder(sortOrder).Execute()

添加热搜词

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
	keyword := "keyword_example" // string | 
	isHot := true // bool |  (optional) (default to false)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.AddHotKeywordApiV1SearchHotKeywordPost(context.Background()).Keyword(keyword).IsHot(isHot).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.AddHotKeywordApiV1SearchHotKeywordPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddHotKeywordApiV1SearchHotKeywordPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.AddHotKeywordApiV1SearchHotKeywordPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddHotKeywordApiV1SearchHotKeywordPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **string** |  | 
 **isHot** | **bool** |  | [default to false]
 **sortOrder** | **int32** |  | [default to 0]

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


## AddHotKeywordApiV1SearchHotKeywordPost_0

> interface{} AddHotKeywordApiV1SearchHotKeywordPost_0(ctx).Keyword(keyword).IsHot(isHot).SortOrder(sortOrder).Execute()

添加热搜词

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
	keyword := "keyword_example" // string | 
	isHot := true // bool |  (optional) (default to false)
	sortOrder := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.AddHotKeywordApiV1SearchHotKeywordPost_0(context.Background()).Keyword(keyword).IsHot(isHot).SortOrder(sortOrder).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.AddHotKeywordApiV1SearchHotKeywordPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddHotKeywordApiV1SearchHotKeywordPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.AddHotKeywordApiV1SearchHotKeywordPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddHotKeywordApiV1SearchHotKeywordPost_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **string** |  | 
 **isHot** | **bool** |  | [default to false]
 **sortOrder** | **int32** |  | [default to 0]

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


## AddIndexApiV1SearchIndexPost

> interface{} AddIndexApiV1SearchIndexPost(ctx).TargetType(targetType).TargetId(targetId).Title(title).Content(content).Keywords(keywords).Category(category).Tags(tags).Cover(cover).Url(url).UserId(userId).UserName(userName).Weight(weight).Execute()

添加/更新索引

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
	targetType := "targetType_example" // string | 
	targetId := int32(56) // int32 | 
	title := "title_example" // string | 
	content := "content_example" // string |  (optional)
	keywords := "keywords_example" // string |  (optional)
	category := "category_example" // string |  (optional)
	tags := "tags_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)
	url := "url_example" // string |  (optional)
	userId := "userId_example" // string |  (optional)
	userName := "userName_example" // string |  (optional)
	weight := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.AddIndexApiV1SearchIndexPost(context.Background()).TargetType(targetType).TargetId(targetId).Title(title).Content(content).Keywords(keywords).Category(category).Tags(tags).Cover(cover).Url(url).UserId(userId).UserName(userName).Weight(weight).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.AddIndexApiV1SearchIndexPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddIndexApiV1SearchIndexPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.AddIndexApiV1SearchIndexPost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddIndexApiV1SearchIndexPostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** |  | 
 **targetId** | **int32** |  | 
 **title** | **string** |  | 
 **content** | **string** |  | 
 **keywords** | **string** |  | 
 **category** | **string** |  | 
 **tags** | **string** |  | 
 **cover** | **string** |  | 
 **url** | **string** |  | 
 **userId** | **string** |  | 
 **userName** | **string** |  | 
 **weight** | **int32** |  | [default to 0]

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


## AddIndexApiV1SearchIndexPost_0

> interface{} AddIndexApiV1SearchIndexPost_0(ctx).TargetType(targetType).TargetId(targetId).Title(title).Content(content).Keywords(keywords).Category(category).Tags(tags).Cover(cover).Url(url).UserId(userId).UserName(userName).Weight(weight).Execute()

添加/更新索引

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
	targetType := "targetType_example" // string | 
	targetId := int32(56) // int32 | 
	title := "title_example" // string | 
	content := "content_example" // string |  (optional)
	keywords := "keywords_example" // string |  (optional)
	category := "category_example" // string |  (optional)
	tags := "tags_example" // string |  (optional)
	cover := "cover_example" // string |  (optional)
	url := "url_example" // string |  (optional)
	userId := "userId_example" // string |  (optional)
	userName := "userName_example" // string |  (optional)
	weight := int32(56) // int32 |  (optional) (default to 0)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.AddIndexApiV1SearchIndexPost_0(context.Background()).TargetType(targetType).TargetId(targetId).Title(title).Content(content).Keywords(keywords).Category(category).Tags(tags).Cover(cover).Url(url).UserId(userId).UserName(userName).Weight(weight).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.AddIndexApiV1SearchIndexPost_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `AddIndexApiV1SearchIndexPost_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.AddIndexApiV1SearchIndexPost_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiAddIndexApiV1SearchIndexPost_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** |  | 
 **targetId** | **int32** |  | 
 **title** | **string** |  | 
 **content** | **string** |  | 
 **keywords** | **string** |  | 
 **category** | **string** |  | 
 **tags** | **string** |  | 
 **cover** | **string** |  | 
 **url** | **string** |  | 
 **userId** | **string** |  | 
 **userName** | **string** |  | 
 **weight** | **int32** |  | [default to 0]

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


## DeleteByTargetApiV1SearchIndexByTargetDelete

> interface{} DeleteByTargetApiV1SearchIndexByTargetDelete(ctx).TargetType(targetType).TargetId(targetId).Execute()

按目标删除索引

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
	targetType := "targetType_example" // string | 
	targetId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.DeleteByTargetApiV1SearchIndexByTargetDelete(context.Background()).TargetType(targetType).TargetId(targetId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.DeleteByTargetApiV1SearchIndexByTargetDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteByTargetApiV1SearchIndexByTargetDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.DeleteByTargetApiV1SearchIndexByTargetDelete`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteByTargetApiV1SearchIndexByTargetDeleteRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** |  | 
 **targetId** | **int32** |  | 

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


## DeleteByTargetApiV1SearchIndexByTargetDelete_0

> interface{} DeleteByTargetApiV1SearchIndexByTargetDelete_0(ctx).TargetType(targetType).TargetId(targetId).Execute()

按目标删除索引

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
	targetType := "targetType_example" // string | 
	targetId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.DeleteByTargetApiV1SearchIndexByTargetDelete_0(context.Background()).TargetType(targetType).TargetId(targetId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.DeleteByTargetApiV1SearchIndexByTargetDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteByTargetApiV1SearchIndexByTargetDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.DeleteByTargetApiV1SearchIndexByTargetDelete_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteByTargetApiV1SearchIndexByTargetDelete_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **targetType** | **string** |  | 
 **targetId** | **int32** |  | 

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


## DeleteHotKeywordApiV1SearchHotKeywordKidDelete

> interface{} DeleteHotKeywordApiV1SearchHotKeywordKidDelete(ctx, kid).Execute()

删除热搜词

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
	kid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.DeleteHotKeywordApiV1SearchHotKeywordKidDelete(context.Background(), kid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.DeleteHotKeywordApiV1SearchHotKeywordKidDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteHotKeywordApiV1SearchHotKeywordKidDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.DeleteHotKeywordApiV1SearchHotKeywordKidDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**kid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteHotKeywordApiV1SearchHotKeywordKidDeleteRequest struct via the builder pattern


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


## DeleteHotKeywordApiV1SearchHotKeywordKidDelete_0

> interface{} DeleteHotKeywordApiV1SearchHotKeywordKidDelete_0(ctx, kid).Execute()

删除热搜词

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
	kid := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.DeleteHotKeywordApiV1SearchHotKeywordKidDelete_0(context.Background(), kid).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.DeleteHotKeywordApiV1SearchHotKeywordKidDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteHotKeywordApiV1SearchHotKeywordKidDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.DeleteHotKeywordApiV1SearchHotKeywordKidDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**kid** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteHotKeywordApiV1SearchHotKeywordKidDelete_4Request struct via the builder pattern


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


## DeleteIndexApiV1SearchIndexIdxIdDelete

> interface{} DeleteIndexApiV1SearchIndexIdxIdDelete(ctx, idxId).Execute()

删除索引

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
	idxId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.DeleteIndexApiV1SearchIndexIdxIdDelete(context.Background(), idxId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.DeleteIndexApiV1SearchIndexIdxIdDelete``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteIndexApiV1SearchIndexIdxIdDelete`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.DeleteIndexApiV1SearchIndexIdxIdDelete`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**idxId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteIndexApiV1SearchIndexIdxIdDeleteRequest struct via the builder pattern


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


## DeleteIndexApiV1SearchIndexIdxIdDelete_0

> interface{} DeleteIndexApiV1SearchIndexIdxIdDelete_0(ctx, idxId).Execute()

删除索引

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
	idxId := int32(56) // int32 | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.DeleteIndexApiV1SearchIndexIdxIdDelete_0(context.Background(), idxId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.DeleteIndexApiV1SearchIndexIdxIdDelete_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteIndexApiV1SearchIndexIdxIdDelete_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.DeleteIndexApiV1SearchIndexIdxIdDelete_0`: %v\n", resp)
}
```

### Path Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
**ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
**idxId** | **int32** |  | 

### Other Parameters

Other parameters are passed through a pointer to a apiDeleteIndexApiV1SearchIndexIdxIdDelete_5Request struct via the builder pattern


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


## HotKeywordsApiV1SearchHotGet

> interface{} HotKeywordsApiV1SearchHotGet(ctx).Limit(limit).Execute()

热搜词

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
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.HotKeywordsApiV1SearchHotGet(context.Background()).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.HotKeywordsApiV1SearchHotGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HotKeywordsApiV1SearchHotGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.HotKeywordsApiV1SearchHotGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiHotKeywordsApiV1SearchHotGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int32** |  | [default to 20]

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


## HotKeywordsApiV1SearchHotGet_0

> interface{} HotKeywordsApiV1SearchHotGet_0(ctx).Limit(limit).Execute()

热搜词

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
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.HotKeywordsApiV1SearchHotGet_0(context.Background()).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.HotKeywordsApiV1SearchHotGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `HotKeywordsApiV1SearchHotGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.HotKeywordsApiV1SearchHotGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiHotKeywordsApiV1SearchHotGet_6Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int32** |  | [default to 20]

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


## QueryApiV1SearchQueryGet

> interface{} QueryApiV1SearchQueryGet(ctx).Keyword(keyword).Page(page).Limit(limit).TargetType(targetType).Category(category).OrderBy(orderBy).Execute()

全文搜索

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
	keyword := "keyword_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	targetType := "targetType_example" // string |  (optional)
	category := "category_example" // string |  (optional)
	orderBy := "orderBy_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.QueryApiV1SearchQueryGet(context.Background()).Keyword(keyword).Page(page).Limit(limit).TargetType(targetType).Category(category).OrderBy(orderBy).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.QueryApiV1SearchQueryGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryApiV1SearchQueryGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.QueryApiV1SearchQueryGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQueryApiV1SearchQueryGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **targetType** | **string** |  | 
 **category** | **string** |  | 
 **orderBy** | **string** |  | 

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


## QueryApiV1SearchQueryGet_0

> interface{} QueryApiV1SearchQueryGet_0(ctx).Keyword(keyword).Page(page).Limit(limit).TargetType(targetType).Category(category).OrderBy(orderBy).Execute()

全文搜索

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
	keyword := "keyword_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)
	targetType := "targetType_example" // string |  (optional)
	category := "category_example" // string |  (optional)
	orderBy := "orderBy_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.QueryApiV1SearchQueryGet_0(context.Background()).Keyword(keyword).Page(page).Limit(limit).TargetType(targetType).Category(category).OrderBy(orderBy).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.QueryApiV1SearchQueryGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `QueryApiV1SearchQueryGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.QueryApiV1SearchQueryGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiQueryApiV1SearchQueryGet_7Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **targetType** | **string** |  | 
 **category** | **string** |  | 
 **orderBy** | **string** |  | 

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


## SearchLogList

> interface{} SearchLogList(ctx).Page(page).Limit(limit).UserId(userId).Keyword(keyword).Execute()

搜索日志

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
	userId := "userId_example" // string |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.SearchLogList(context.Background()).Page(page).Limit(limit).UserId(userId).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.SearchLogList``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SearchLogList`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.SearchLogList`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSearchLogListRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **keyword** | **string** |  | 

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


## SearchLogList_0

> interface{} SearchLogList_0(ctx).Page(page).Limit(limit).UserId(userId).Keyword(keyword).Execute()

搜索日志

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
	userId := "userId_example" // string |  (optional)
	keyword := "keyword_example" // string |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.SearchLogList_0(context.Background()).Page(page).Limit(limit).UserId(userId).Keyword(keyword).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.SearchLogList_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SearchLogList_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.SearchLogList_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSearchLogList_8Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]
 **userId** | **string** |  | 
 **keyword** | **string** |  | 

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


## SuggestApiV1SearchSuggestGet

> interface{} SuggestApiV1SearchSuggestGet(ctx).Keyword(keyword).Limit(limit).Execute()

搜索建议

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
	keyword := "keyword_example" // string | 
	limit := int32(56) // int32 |  (optional) (default to 10)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.SuggestApiV1SearchSuggestGet(context.Background()).Keyword(keyword).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.SuggestApiV1SearchSuggestGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SuggestApiV1SearchSuggestGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.SuggestApiV1SearchSuggestGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSuggestApiV1SearchSuggestGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **string** |  | 
 **limit** | **int32** |  | [default to 10]

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


## SuggestApiV1SearchSuggestGet_0

> interface{} SuggestApiV1SearchSuggestGet_0(ctx).Keyword(keyword).Limit(limit).Execute()

搜索建议

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
	keyword := "keyword_example" // string | 
	limit := int32(56) // int32 |  (optional) (default to 10)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.SearchAPI.SuggestApiV1SearchSuggestGet_0(context.Background()).Keyword(keyword).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `SearchAPI.SuggestApiV1SearchSuggestGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `SuggestApiV1SearchSuggestGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `SearchAPI.SuggestApiV1SearchSuggestGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiSuggestApiV1SearchSuggestGet_9Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **string** |  | 
 **limit** | **int32** |  | [default to 10]

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

