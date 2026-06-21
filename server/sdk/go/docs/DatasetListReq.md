# DatasetListReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**SpaceId** | **string** |  | 
**Limit** | Pointer to **NullableInt32** |  | [optional] 
**Offset** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewDatasetListReq

`func NewDatasetListReq(spaceId string, ) *DatasetListReq`

NewDatasetListReq instantiates a new DatasetListReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewDatasetListReqWithDefaults

`func NewDatasetListReqWithDefaults() *DatasetListReq`

NewDatasetListReqWithDefaults instantiates a new DatasetListReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSpaceId

`func (o *DatasetListReq) GetSpaceId() string`

GetSpaceId returns the SpaceId field if non-nil, zero value otherwise.

### GetSpaceIdOk

`func (o *DatasetListReq) GetSpaceIdOk() (*string, bool)`

GetSpaceIdOk returns a tuple with the SpaceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpaceId

`func (o *DatasetListReq) SetSpaceId(v string)`

SetSpaceId sets SpaceId field to given value.


### GetLimit

`func (o *DatasetListReq) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *DatasetListReq) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *DatasetListReq) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *DatasetListReq) HasLimit() bool`

HasLimit returns a boolean if a field has been set.

### SetLimitNil

`func (o *DatasetListReq) SetLimitNil(b bool)`

 SetLimitNil sets the value for Limit to be an explicit nil

### UnsetLimit
`func (o *DatasetListReq) UnsetLimit()`

UnsetLimit ensures that no value is present for Limit, not even an explicit nil
### GetOffset

`func (o *DatasetListReq) GetOffset() int32`

GetOffset returns the Offset field if non-nil, zero value otherwise.

### GetOffsetOk

`func (o *DatasetListReq) GetOffsetOk() (*int32, bool)`

GetOffsetOk returns a tuple with the Offset field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOffset

`func (o *DatasetListReq) SetOffset(v int32)`

SetOffset sets Offset field to given value.

### HasOffset

`func (o *DatasetListReq) HasOffset() bool`

HasOffset returns a boolean if a field has been set.

### SetOffsetNil

`func (o *DatasetListReq) SetOffsetNil(b bool)`

 SetOffsetNil sets the value for Offset to be an explicit nil

### UnsetOffset
`func (o *DatasetListReq) UnsetOffset()`

UnsetOffset ensures that no value is present for Offset, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


