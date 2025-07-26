import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { join } from 'path';

function getUploadDir() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production') {
    return '/tmp';
  } else {
    return join(process.cwd(), 'uploads');
  }
}

export async function GET(req: NextRequest) {
  try {
    const filename = req.nextUrl.searchParams.get('filename');
    
    if (!filename) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    console.log('Requested filename:', filename);

    // Security check
    if (filename.includes('..') || /[\\/]/.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const uploadsDir = getUploadDir();
    const filePath = join(uploadsDir, filename);
    
    console.log('Looking for file at:', filePath);
    console.log('Upload directory:', uploadsDir);

    // Check if file exists first
    try {
      await fs.access(filePath);
    } catch {
      console.log('File does not exist:', filePath);
      return NextResponse.json({ 
        error: 'File not found',
        filePath,
        uploadsDir 
      }, { status: 404 });
    }

    const data = await fs.readFile(filePath);
    
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': data.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error reading PDF file:', error);
    return NextResponse.json({ 
      error: 'File read error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
