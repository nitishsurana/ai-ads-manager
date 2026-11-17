export type Storage = {
  // Paths are relative to the bucket, for example "<intakeId>/3-work.jpg".
  put(
    bucket: string,
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<void>;
  // Null when the object doesn't exist.
  get(bucket: string, path: string): Promise<Buffer | null>;
  remove(bucket: string, paths: string[]): Promise<void>;
  // Deletes every object directly under "<prefix>/".
  removePrefix(bucket: string, prefix: string): Promise<void>;
};
