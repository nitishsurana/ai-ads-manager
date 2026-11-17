export type FalMaskRequest = {
  // The replay snapshot is keyed by this sha256.
  inputSha256: string;
  image: Uint8Array;
  contentType: string;
};

export type FalEditRequest = {
  // The replay snapshot is keyed by this digest of what built the canvas: the photo, the product's box, the seed and the instruction.
  inputSha256: string;
  instruction: string;
  // The product on a flat grey canvas, and the mask whose white area is repainted (both PNG).
  canvas: Uint8Array;
  mask: Uint8Array;
  seed: number;
};

export type Fal = {
  // BiRefNet v2 segmentation mask, as image bytes.
  backgroundMask(request: FalMaskRequest): Promise<Buffer>;
  // Bria FIBO 2 masked edit: the repainted canvas, as image bytes.
  backgroundEdit(request: FalEditRequest): Promise<Buffer>;
};
