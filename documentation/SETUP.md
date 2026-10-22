# Objectives

This should be an all encompassing utility for creating QR codes, ready to deploy on NPM.

## App
We will create an app for this project which won't be published to npm. It will handle the docs & showcase an interactive playground etc. Do not work on this. Simply create an empty `/app` dir in the root.

## Packages
The goal is have 2 primary packages within the library. Create a `/lib` directory in the root and move the code into there.

### **Core**  
The core package handles QR code generation. It takes all the props you would want from QR code gen:


| Attribute | Available values |
| -- | -- |
| Symbol type / model | Model 1, Model 2, Micro QR, rMQR |
| Version | 1–40 (Model 2) |
| Error correction level | L, M, Q, H |
| Encoding mode | Numeric, Alphanumeric, Byte, Kanji |
| Character encoding / ECI | ISO-8859-1, UTF-8, etc. |
| Mask pattern | 0–7 |
| Segmentation strategy | Automatic or explicit segments |
| Structured append | Disabled or up to 16 symbols |
| FNC1 mode | None, first position, second position |
| Quiet zone | Minimum 4 modules (Model 2) |

plus any others you feel are relevant. Use JSDoc syntax to provide relevant descriptions and examples for each. 
For number based attributes, also allow a range parameter (i.e. versionRange). Typescript should not allow both `version` and `versionRange` to be set at the same time.
Make them all optional with well selected best practice defaults or calculated values (for example the mask pattern can be auto-selected by the package to avoid visually problematic patterns or the version can be auto-selected to be the smallest version that fits other attributes and the supplied data etc etc).  
Throw clear errors where attributes supplied are incompatible: i.e. `The supplied data is larger than the available data capacity. Data size (bits): ${bitlength}; ECC Level: ${ecc}; Available bits: ${maxBits} (Version ${version});`

The code pattern that we want for this module is an object oriented class system.

Example pattern:  
```javascript
const myQrCode = new QR(`https://web-site.com`);

const qrCodeWithOpts = new QR(`https://web-site.com`, {
    maskPattern: 6,
    errorCorrection: 'Q'
})
```

The object can then be read with various methods:  
`const result = myQrCode.dotMatrix()`

We can also create a function which handles this for us and returns a selected return type. It takes the following params:
- format / return type: use a good default but we want the package to be able to return the generated qr code in a few different ways if applicable. The current method this package uses is with a dot matrix, though if there are other typical ways of using this data then let's use that. There may have already been some developed or listed in the README. None of the return methods should return rendered data as an svg or image. This will be handled by the next package.  
So:   
```javascript
const qrDots = createQR(`https://web-site.com`); // default behavioud
const qrAlternativeDataApproach = createQR(`https://web-site.com`, { format: `${someFormatYouDecideOn}` })

```

It is important to note that we need a method of distinguishing key areas / landmarks (the functional patterns) of the qr code when it is returned from the package. This is relevant for the render process as we may wish to treat segments of the QR differently. This will only really be available when using the class approach (for now) as we can use the methods to handle how we retrieve them.

### **Render**
The other package is a render package which can take input from a QR code created by Core & render it in a variety of methods.
- SVG (default if none specified)
- PNG
- HTML (squares are divs)

i.e. 
```javascript
const myQrCode = new QR(`https://web-site.com`);
const qrRenderer = new RenderQR(myQrCode)
const qrCodeImage = qrRenderer.toPNG()
```

We should also take renderer attributes

| Attribute | Purpose | Default (?) |
| -- | -- | -- |
| size | output size of the rendered qr | 256 |
| padding | space between the borders and the QR | 0 |
| quietZone | space between the qr dots and edge (padding is added on top) - optionally can be disabled | true |
| backgroundColor | CSS compatible color value that decides the background color. Can be null for no background | white |
| color | CSS compatible color value that decides the dot / foreground color | black |
| shape | Object which handles the shape / shapes & rendering of the qr code dots or overall shape (explained below) | none - just plain squares |
| modules | allows specific styling of individual modules (explained below) | none - the function patterns are just rendered as part of the primary output |

Render output specific optional attributes:
| Attribute | Purpose | Render methods |
| -- | -- | -- |
| className | add className attribute to the output | svg, html |
| compression | DEFLATE png compression level | png |

> [!NOTE]
> The following instructions handle the manner in which the style attributes can be applied and to which modules.
> This is a fairly in-depth portion of the project and should not be worked on by you right now.
> Instead, spin up a sub agent and direct it to work on this specific style handling while you continue working on the rest of the package.
> The capabilities should be created within a /qr-styles subfolder which you import - this will allow you to work uninterrupted in the parent folder while the sub-agent handles this capability.

Link if the contents are not unrolled for you below: [documentation/style-props.md](./style-props.md)

@documentation/style-props.md
