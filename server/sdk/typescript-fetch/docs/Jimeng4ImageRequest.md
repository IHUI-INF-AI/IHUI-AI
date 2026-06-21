
# Jimeng4ImageRequest

JiMeng 4.0 text-to-image request (mirrors official API fields).

## Properties

Name | Type
------------ | -------------
`prompt` | string
`imageUrls` | Array&lt;string&gt;
`size` | number
`width` | number
`height` | number
`seed` | number
`scale` | number
`forceSingle` | boolean
`minRatio` | number
`maxRatio` | number
`returnUrl` | boolean

## Example

```typescript
import type { Jimeng4ImageRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "imageUrls": null,
  "size": null,
  "width": null,
  "height": null,
  "seed": null,
  "scale": null,
  "forceSingle": null,
  "minRatio": null,
  "maxRatio": null,
  "returnUrl": null,
} satisfies Jimeng4ImageRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Jimeng4ImageRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


