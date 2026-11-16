export type Storage = {
  // Paths are relative to the bucket, for example "<intakeId>/3-work.jpg".
  put(
    bucket: string,
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void>;
  remove(bucket: string, paths: string[]): Promise<void>;
};
