import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;
    
    if (!filename) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    // Security check
    if (filename.includes('..') || /[\\/]/.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Use /tmp in production, uploads in development
    const uploadsDir = process.env.NODE_ENV === 'production' 
      ? '/tmp/uploads'
      : join(process.cwd(), 'public/uploads');
      
    const filePath = join(uploadsDir, filename);

    const data = await fs.readFile(filePath);
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': data.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error reading PDF file:', error);
    return NextResponse.json({ 
      error: 'File not found',
      filename: params?.filename || 'unknown'
    }, { status: 404 });
  }
}
