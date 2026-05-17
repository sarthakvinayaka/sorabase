/**
 * Browser/client file storage port (MVP scaffold).
 * Server-side uploads should prefer calling the API once file routes exist.
 */
export type FileStoragePort = {
  putBytes(relPath: string, data: Uint8Array): Promise<void>;
};
