import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const target = url.searchParams.get('path') || '';
    const cwd = process.cwd();
    const resolved = path.resolve(path.join(cwd, target));

    // Ensure it's inside cwd (prevent path traversal)
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const buffer = fs.readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.csv': 'text/csv',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: { 'Content-Type': contentType },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Read failed' }, { status: 500 });
  }
}
