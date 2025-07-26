// app/api/upload/route.ts
import { NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { Form } from 'multiparty';
import { Readable } from 'stream';
import { IncomingMessage } from 'http';
import { parsePDFWithLlama } from '@/lib/llamaparse';
import fs from 'fs/promises';

export const config = {
  api: {
    bodyParser: false,
  },
};

function bufferToMockRequestStream(buffer: Buffer, headers: Headers): IncomingMessage {
  const stream = Readable.from(buffer);
  const nodeHeaders: Record<string, string> = Object.fromEntries(headers.entries());
  return Object.assign(stream, {
    headers: nodeHeaders,
    method: 'POST',
    url: '',
    on: stream.on.bind(stream),
    once: stream.once.bind(stream),
    removeListener: stream.removeListener.bind(stream),
  }) as IncomingMessage;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Invalid content-type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  const nodeRequest = bufferToMockRequestStream(buffer, req.headers);

  // Use /tmp for temporary processing
  const form = new Form({ uploadDir: '/tmp' });

  return await new Promise<Response>((resolve) => {
    form.parse(nodeRequest, async (err, fields, files) => {
      if (err) {
        console.error('Form parse error:', err);
        return resolve(
          new Response(JSON.stringify({ error: 'Form parse failed', details: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      const file = files.pdf?.[0];
      if (!file || !file.path) {
        return resolve(
          new Response(JSON.stringify({ error: 'No file uploaded' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }

      try {
        // Read the temporary file
        const fileBuffer = await fs.readFile(file.path);
        
        // Upload to Vercel Blob
        const filename = file.originalFilename || `${Date.now()}.pdf`;
        const blob = await put(filename, fileBuffer, {
          access: 'public', // or 'private' if you need authentication
          contentType: 'application/pdf',
        });

        console.log('File uploaded to Vercel Blob:', blob.url);

        // Process with LlamaIndex using the temp file
        const markdown = await parsePDFWithLlama(file.path);

        // Clean up temp file
        await fs.unlink(file.path).catch(() => {});

        return resolve(
          new Response(
            JSON.stringify({
              message: 'Uploaded and indexed',
              blobUrl: blob.url,
              filename: filename,
              markdown: markdown,
            }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 }
          )
        );
      } catch (error) {
        console.error('Upload/processing error:', error);
        // Clean up temp file on error
        await fs.unlink(file.path).catch(() => {});
        
        return resolve(
          new Response(JSON.stringify({ 
            error: 'Upload failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
    });
  });
}
