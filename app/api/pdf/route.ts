// app/api/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';

export async function GET(req: NextRequest) {
  try {
    const filename = req.nextUrl.searchParams.get('filename');
    if (!filename) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    if (filename.includes('..') || /[\\/]/.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), process.env.NODE_ENV === 'production' 
      ? 'tmp/uploads' : 'public/uploads');
    const filePath = join(uploadsDir, filename);
    
    const data = await fs.readFile(filePath);
    
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': data.length.toString(),
      },
    });

  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
