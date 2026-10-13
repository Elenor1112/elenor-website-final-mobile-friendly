import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getCurrentUser, can } from '@/server/auth/rbac';
import { isModelFilename } from '@/db/schema/media';

const IMAGE_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  // No image/svg+xml: an SVG can carry script that runs when the file is opened.
];

// .glb/.gltf have real IANA types; .fbx/.obj do not, so browsers send an empty
// type or octet-stream. The extension check below is the actual gate.
const MODEL_CONTENT_TYPES = [
  'model/gltf-binary',
  'model/gltf+json',
  'application/octet-stream',
  'text/plain', // some browsers report .obj (plain text) this way
];

const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // files are webp-compressed client-side first
const MODEL_MAX_BYTES = 100 * 1024 * 1024;

// Token handler for direct client → Vercel Blob uploads. The browser asks
// this route for a scoped upload token, then streams the file straight to
// Blob storage — never through a serverless function body (1MB/4.5MB limits).
// After the upload completes the client calls the `registerUpload` server
// action to create the media row (works on localhost, unlike the
// onUploadCompleted webhook which requires a public callback URL).
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user || !can(user, 'media:write')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // The size cap is decided per file: 3D models legitimately run to tens of
      // MB, but images must not quietly gain a 100MB allowance. `pathname` is
      // the filename the client asked to upload, so the extension gates which
      // limit and which content types apply.
      onBeforeGenerateToken: async (pathname) => {
        const isModel = isModelFilename(pathname);
        return {
          allowedContentTypes: isModel ? MODEL_CONTENT_TYPES : IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: isModel ? MODEL_MAX_BYTES : IMAGE_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      // Registration happens via the registerUpload server action instead.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    );
  }
}
