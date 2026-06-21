# ViewImage

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**View** | **string** | 视角: left / right / back | 
**ImageBase64** | Pointer to **NullableString** |  | [optional] 
**ImageUrl** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewViewImage

`func NewViewImage(view string, ) *ViewImage`

NewViewImage instantiates a new ViewImage object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewViewImageWithDefaults

`func NewViewImageWithDefaults() *ViewImage`

NewViewImageWithDefaults instantiates a new ViewImage object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetView

`func (o *ViewImage) GetView() string`

GetView returns the View field if non-nil, zero value otherwise.

### GetViewOk

`func (o *ViewImage) GetViewOk() (*string, bool)`

GetViewOk returns a tuple with the View field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetView

`func (o *ViewImage) SetView(v string)`

SetView sets View field to given value.


### GetImageBase64

`func (o *ViewImage) GetImageBase64() string`

GetImageBase64 returns the ImageBase64 field if non-nil, zero value otherwise.

### GetImageBase64Ok

`func (o *ViewImage) GetImageBase64Ok() (*string, bool)`

GetImageBase64Ok returns a tuple with the ImageBase64 field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageBase64

`func (o *ViewImage) SetImageBase64(v string)`

SetImageBase64 sets ImageBase64 field to given value.

### HasImageBase64

`func (o *ViewImage) HasImageBase64() bool`

HasImageBase64 returns a boolean if a field has been set.

### SetImageBase64Nil

`func (o *ViewImage) SetImageBase64Nil(b bool)`

 SetImageBase64Nil sets the value for ImageBase64 to be an explicit nil

### UnsetImageBase64
`func (o *ViewImage) UnsetImageBase64()`

UnsetImageBase64 ensures that no value is present for ImageBase64, not even an explicit nil
### GetImageUrl

`func (o *ViewImage) GetImageUrl() string`

GetImageUrl returns the ImageUrl field if non-nil, zero value otherwise.

### GetImageUrlOk

`func (o *ViewImage) GetImageUrlOk() (*string, bool)`

GetImageUrlOk returns a tuple with the ImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageUrl

`func (o *ViewImage) SetImageUrl(v string)`

SetImageUrl sets ImageUrl field to given value.

### HasImageUrl

`func (o *ViewImage) HasImageUrl() bool`

HasImageUrl returns a boolean if a field has been set.

### SetImageUrlNil

`func (o *ViewImage) SetImageUrlNil(b bool)`

 SetImageUrlNil sets the value for ImageUrl to be an explicit nil

### UnsetImageUrl
`func (o *ViewImage) UnsetImageUrl()`

UnsetImageUrl ensures that no value is present for ImageUrl, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


