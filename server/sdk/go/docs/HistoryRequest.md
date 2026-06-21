# HistoryRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Type** | Pointer to **string** | Time range: w&#x3D;week, m&#x3D;month, y&#x3D;year, a&#x3D;all | [optional] [default to "a"]
**Page** | Pointer to **int32** |  | [optional] [default to 1]
**PageSize** | Pointer to **int32** |  | [optional] [default to 10]

## Methods

### NewHistoryRequest

`func NewHistoryRequest() *HistoryRequest`

NewHistoryRequest instantiates a new HistoryRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewHistoryRequestWithDefaults

`func NewHistoryRequestWithDefaults() *HistoryRequest`

NewHistoryRequestWithDefaults instantiates a new HistoryRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetType

`func (o *HistoryRequest) GetType() string`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *HistoryRequest) GetTypeOk() (*string, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *HistoryRequest) SetType(v string)`

SetType sets Type field to given value.

### HasType

`func (o *HistoryRequest) HasType() bool`

HasType returns a boolean if a field has been set.

### GetPage

`func (o *HistoryRequest) GetPage() int32`

GetPage returns the Page field if non-nil, zero value otherwise.

### GetPageOk

`func (o *HistoryRequest) GetPageOk() (*int32, bool)`

GetPageOk returns a tuple with the Page field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPage

`func (o *HistoryRequest) SetPage(v int32)`

SetPage sets Page field to given value.

### HasPage

`func (o *HistoryRequest) HasPage() bool`

HasPage returns a boolean if a field has been set.

### GetPageSize

`func (o *HistoryRequest) GetPageSize() int32`

GetPageSize returns the PageSize field if non-nil, zero value otherwise.

### GetPageSizeOk

`func (o *HistoryRequest) GetPageSizeOk() (*int32, bool)`

GetPageSizeOk returns a tuple with the PageSize field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPageSize

`func (o *HistoryRequest) SetPageSize(v int32)`

SetPageSize sets PageSize field to given value.

### HasPageSize

`func (o *HistoryRequest) HasPageSize() bool`

HasPageSize returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


