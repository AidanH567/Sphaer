import {
  MAX_UPLOAD_BYTES,
  UploadValidationError,
  validateImageUpload,
} from '../upload-validation';

// jsdom's Blob doesn't let us fabricate huge sizes cheaply, so we shape
// minimal { type, size } stand-ins — validateImageUpload only reads those
// two fields.
const fakeBlob = (type: string, size = 1024): Blob => ({ type, size } as Blob);

describe('validateImageUpload', () => {
  it.each(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/gif'])(
    'accepts %s',
    (type) => {
      expect(() => validateImageUpload(fakeBlob(type))).not.toThrow();
    },
  );

  it('is case-insensitive on the MIME type', () => {
    expect(() => validateImageUpload(fakeBlob('IMAGE/JPEG'))).not.toThrow();
  });

  it('rejects executables and other non-image types', () => {
    expect(() => validateImageUpload(fakeBlob('application/x-msdownload'))).toThrow(
      UploadValidationError,
    );
    expect(() => validateImageUpload(fakeBlob('text/html'))).toThrow(UploadValidationError);
    expect(() => validateImageUpload(fakeBlob('video/mp4'))).toThrow(UploadValidationError);
  });

  it('rejects an empty MIME type (cannot guess safely)', () => {
    expect(() => validateImageUpload(fakeBlob(''))).toThrow(UploadValidationError);
  });

  it('rejects oversized blobs with a readable message', () => {
    expect(() =>
      validateImageUpload(fakeBlob('image/jpeg', MAX_UPLOAD_BYTES + 1)),
    ).toThrow(/too large/i);
  });

  it('accepts a blob exactly at the size cap', () => {
    expect(() =>
      validateImageUpload(fakeBlob('image/jpeg', MAX_UPLOAD_BYTES)),
    ).not.toThrow();
  });
});
