/**
 * jsdom does not implement `ImageData`, and the whole image engine is built on
 * it, so we install a spec-compatible (constructor-shape compatible) polyfill.
 * It is only ever used inside tests.
 */
if (typeof globalThis.ImageData === "undefined") {
  class ImageDataPolyfill {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace: PredefinedColorSpace = "srgb";

    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      height?: number,
    ) {
      if (typeof dataOrWidth === "number") {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height ?? Math.floor(dataOrWidth.length / 4 / widthOrHeight);
      }
    }
  }

  (globalThis as unknown as { ImageData: typeof ImageDataPolyfill }).ImageData =
    ImageDataPolyfill;
}
