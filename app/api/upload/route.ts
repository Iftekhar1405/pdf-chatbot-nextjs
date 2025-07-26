import { NextRequest } from 'next/server';
import { Form } from 'multiparty';
import { Readable } from 'stream';
import { IncomingMessage } from 'http';
import fs from 'fs/promises';
import path, { join } from 'path';
import { parsePDFWithLlama } from '@/lib/llamaparse';

// Use /tmp for serverless environments, fallback to uploads for local dev
const uploadsDir = join(process.cwd(), process.env.NODE_ENV === 'production' 
  ? 'tmp'
  : 'public/uploads');

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
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create uploads folder:', err);
    return new Response(JSON.stringify({ error: 'Failed to create uploads folder' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Invalid content-type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  const nodeRequest = bufferToMockRequestStream(buffer, req.headers);

  const form = new Form({ uploadDir: uploadsDir });

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

      const filePath = file.path;
      const markdown = await parsePDFWithLlama(filePath);

      return resolve(
        new Response(
          JSON.stringify({
            message: 'Uploaded and indexed',
            filePath: path.basename(filePath),
            markdown,
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 }
        )
      );
    });
  });
}
