import { NextRequest } from 'next/server';
import { Form } from 'multiparty';
import { Readable } from 'stream';
import { parsePDFWithLlama } from '@/lib/llamaparse';
import { IncomingMessage } from 'http';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Convert Buffer into a mock IncomingMessage stream
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

  const form = new Form({ uploadDir: './public/uploads' });

  return await new Promise<Response>((resolve) => {
    form.parse(nodeRequest, async (err, fields, files) => {
      if (err) {
        console.error('Form parse error:', err);
        return resolve(
          new Response(JSON.stringify({ error: 'Form parse failed' }), {
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
          JSON.stringify({ message: 'Uploaded and indexed', filePath: filePath.split('/').at(-1), markdown: markdown }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 }
        )
      );
    });
  });
}
