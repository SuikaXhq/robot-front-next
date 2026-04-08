import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, data, targetDir } = body as {
      name?: string;
      data?: string;
      targetDir?: string;
    };

    if (!name || typeof data !== 'string') {
      return NextResponse.json(
        { error: 'Invalid upload payload' },
        { status: 400 }
      );
    }

    const base64Payload = data.includes(',') ? data.split(',')[1] : data;
    const buffer = Buffer.from(base64Payload, 'base64');

    const cwd = process.cwd();
    const targetDirRaw = typeof targetDir === 'string' && targetDir.trim()
      ? targetDir.trim()
      : '.claude-uploads';

    const resolvedTarget = path.resolve(path.join(cwd, targetDirRaw));
    const resolvedCwd = path.resolve(cwd);

    // Prevent path traversal: resolvedTarget must be inside resolvedCwd
    const relativeToCwd = path.relative(resolvedCwd, resolvedTarget);
    if (
      relativeToCwd.startsWith('..') ||
      path.isAbsolute(relativeToCwd)
    ) {
      return NextResponse.json(
        { error: 'Invalid target directory' },
        { status: 400 }
      );
    }

    fs.mkdirSync(resolvedTarget, { recursive: true });

    const fileName = `${Date.now()}-${name}`;
    const filePath = path.join(resolvedTarget, fileName);
    fs.writeFileSync(filePath, buffer);

    const relativePath = path.relative(cwd, filePath).replace(/\\/g, '/');
    return NextResponse.json({ path: relativePath });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
