#### Style Props

**shape**  
```typescript
type CSSRadiusAttribute = string | number // e.g. 23 | "12px" | "1rem" | "15px"
type VariedLengthTuple =
  | CSSRadiusAttribute
  | [
      CSSRadiusAttribute,
      CSSRadiusAttribute?,
      CSSRadiusAttribute?,
      CSSRadiusAttribute?
    ];
type BorderRadius = CSSRadiusAttribute | string | number // i.e. "0 20 0 20" | 50 | ["20px", "5%"]

// if alignmentOffset is turned on, it rotates the mapping of any VariedLengthTuple attributes based on the corner the object is closest to
// i.e. 
// For a square in the top left of the qr code, a border radius tuple maps to [tl, tr, br, bl]
// For a square in the top right of the qr code, a border radius tuple maps to [tr, br, bl, tl] (rotated once 90deg)
// For a square in the bottom right of the qr code, a border radius tuple maps to [bl, tl, tr, br] (rotated once 90deg)

/**
 * `mirror` applies the same corner-relative mapping as `alignmentOffset`,
 * but reflects the resulting tuple instead of simply rotating it.
 *
 * For all corners except top-left, the second and fourth values
 * (indices 1 and 3) are swapped after rotation.
 *
 * This preserves the aligned corner and its diagonal opposite,
 * while reversing the positions of the two adjacent corners.
 *
 * Example — top-right alignment:
 *   Standard: [tr, br, bl, tl]
 *   Mirrored: [tr, tl, bl, br]
 *
 * Top-left alignment remains unchanged.
 */

/** distanceWeight is an array of 2 numbers (from 0-1) which multiples the values based on proximity to center where distanceWeight[0] is is applied to objects closer to the center and distanceWeight[1] is applied to objects further from the center.

For example: if the distanceWeight of [0,1] and a borderRadius of 20 is set, then a dot at the center of the object would have a borderRadius of 0, while a dot at the edge would have a borderRadius of 20
*/

type BaseQRShape = {
    borderRadius?: VariedLengthTuple; // css attributes for border radius
    alignmentOffset?: boolean | 'mirror';
    distanceWeight?: [number, number]
}

type QRShape = BaseQRShape | {
    individual?: BaseQRShape
    global?: BaseQRShape
}
```

The default functionality of QRShape is to apply the props to the global shape (i.e. a border radius would impact the overall QR code itself if set to global), though individual and global can be set separately - where individual controls how individual dots are rendered.
---


**modules**  
`modules` is an object which allows us to declare a function pattern and set specific attributes just for that pattern.  
The available attributes: 
- color
- shape

The object input type looks like so:
```typescript

type QRStyleProps = {
    color: QRColor;
    shape: QRShape;
}

type QRCornerStyleTuple = QRStyleProps | [QRStyleProps | null | undefined, (QRStyleProps | null | undefined)?, (QRStyleProps | null | undefined)?, (QRStyleProps | null | undefined)?]; // top-left, top-right, bottom-right, bottom-left -> style corners differently and use null or undefined for other corners to only target specific corners

type ModulesOption = {
    finder?: QRCornerStyleTuple | {
        inner?: QRCornerStyleTuple
        outer?: QRCornerStyleTuple
    } // allows you to style the inner part of the finderPattern differently to the outer part
    alignment?: QRStyleProps;
    timing?: QRStyleProps;
}
```

defining a functional module within this schema then removes that region from the processes which renderes the main component and allows it to be rendered with its own style props.

---

For a reference on some of the more advanced ways that these css emulation style attributes can be setup - investigate the source for `motion` which uses this approach a lot:
 [motion](https://github.com/motiondivision/motion)