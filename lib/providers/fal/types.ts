export type FalMaskRequest = {
  // The replay snapshot is keyed by this sha256.
  inputSha256: string;
  image: Uint8Array;
  contentType: string;
};

export type Fal = {
  // BiRefNet v2 segmentation mask, as image bytes.
  backgroundMask(request: FalMaskRequest): Promise<Buffer>;
};
