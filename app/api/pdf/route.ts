// app/api/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const blobUrl = req.nextUrl.searchParams.get('url');
    
    if (!blobUrl) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    // Validate it's a Vercel Blob URL for security
    if (!blobUrl.includes('blob.vercel-storage.com')) {
      return NextResponse.json({ error: 'Invalid blob URL' }, { status: 400 });
    }

    // Fetch from Vercel Blob
    const response = await fetch(blobUrl);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const data = await response.arrayBuffer();
    
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': data.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });

  } catch (error) {
    console.error('Error serving PDF:', error);
    return NextResponse.json({ error: 'Failed to serve PDF' }, { status: 500 });
  }
}
