# DocListReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**DatasetId** | **string** |  | 
**Limit** | Pointer to **NullableInt32** |  | [optional] 
**Offset** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewDocListReq

`func NewDocListReq(datasetId string, ) *DocListReq`

NewDocListReq instantiates a new DocListReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewDocListReqWithDefaults

`func NewDocListReqWithDefaults() *DocListReq`

NewDocListReqWithDefaults instantiates a new DocListReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetDatasetId

`func (o *DocListReq) GetDatasetId() string`

GetDatasetId returns the DatasetId field if non-nil, zero value otherwise.

### GetDatasetIdOk

`func (o *DocListReq) GetDatasetIdOk() (*string, bool)`

GetDatasetIdOk returns a tuple with the DatasetId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDatasetId

`func (o *DocListReq) SetDatasetId(v string)`

SetDatasetId sets DatasetId field to given value.


### GetLimit

`func (o *DocListReq) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *DocListReq) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *DocListReq) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *DocListReq) HasLimit() bool`

HasLimit returns a boolean if a field has been set.

### SetLimitNil

`func (o *DocListReq) SetLimitNil(b bool)`

 SetLimitNil sets the value for Limit to be an explicit nil

### UnsetLimit
`func (o *DocListReq) UnsetLimit()`

UnsetLimit ensures that no value is present for Limit, not even an explicit nil
### GetOffset

`func (o *DocListReq) GetOffset() int32`

GetOffset returns the Offset field if non-nil, zero value otherwise.

### GetOffsetOk

`func (o *DocListReq) GetOffsetOk() (*int32, bool)`

GetOffsetOk returns a tuple with the Offset field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOffset

`func (o *DocListReq) SetOffset(v int32)`

SetOffset sets Offset field to given value.

### HasOffset

`func (o *DocListReq) HasOffset() bool`

HasOffset returns a boolean if a field has been set.

### SetOffsetNil

`func (o *DocListReq) SetOffsetNil(b bool)`

 SetOffsetNil sets the value for Offset to be an explicit nil

### UnsetOffset
`func (o *DocListReq) UnsetOffset()`

UnsetOffset ensures that no value is present for Offset, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


