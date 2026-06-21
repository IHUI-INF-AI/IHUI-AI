# VisionImageInfo

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ImageUrl** | **string** | 图片URL | 
**Width** | Pointer to **NullableInt32** |  | [optional] 
**Height** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewVisionImageInfo

`func NewVisionImageInfo(imageUrl string, ) *VisionImageInfo`

NewVisionImageInfo instantiates a new VisionImageInfo object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVisionImageInfoWithDefaults

`func NewVisionImageInfoWithDefaults() *VisionImageInfo`

NewVisionImageInfoWithDefaults instantiates a new VisionImageInfo object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetImageUrl

`func (o *VisionImageInfo) GetImageUrl() string`

GetImageUrl returns the ImageUrl field if non-nil, zero value otherwise.

### GetImageUrlOk

`func (o *VisionImageInfo) GetImageUrlOk() (*string, bool)`

GetImageUrlOk returns a tuple with the ImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageUrl

`func (o *VisionImageInfo) SetImageUrl(v string)`

SetImageUrl sets ImageUrl field to given value.


### GetWidth

`func (o *VisionImageInfo) GetWidth() int32`

GetWidth returns the Width field if non-nil, zero value otherwise.

### GetWidthOk

`func (o *VisionImageInfo) GetWidthOk() (*int32, bool)`

GetWidthOk returns a tuple with the Width field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWidth

`func (o *VisionImageInfo) SetWidth(v int32)`

SetWidth sets Width field to given value.

### HasWidth

`func (o *VisionImageInfo) HasWidth() bool`

HasWidth returns a boolean if a field has been set.

### SetWidthNil

`func (o *VisionImageInfo) SetWidthNil(b bool)`

 SetWidthNil sets the value for Width to be an explicit nil

### UnsetWidth
`func (o *VisionImageInfo) UnsetWidth()`

UnsetWidth ensures that no value is present for Width, not even an explicit nil
### GetHeight

`func (o *VisionImageInfo) GetHeight() int32`

GetHeight returns the Height field if non-nil, zero value otherwise.

### GetHeightOk

`func (o *VisionImageInfo) GetHeightOk() (*int32, bool)`

GetHeightOk returns a tuple with the Height field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetHeight

`func (o *VisionImageInfo) SetHeight(v int32)`

SetHeight sets Height field to given value.

### HasHeight

`func (o *VisionImageInfo) HasHeight() bool`

HasHeight returns a boolean if a field has been set.

### SetHeightNil

`func (o *VisionImageInfo) SetHeightNil(b bool)`

 SetHeightNil sets the value for Height to be an explicit nil

### UnsetHeight
`func (o *VisionImageInfo) UnsetHeight()`

UnsetHeight ensures that no value is present for Height, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


