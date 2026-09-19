import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:5000';
const TOKEN = process.env.APISHIELD_OPERATOR_TOKEN || '';

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context, 'GET');
}
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context, 'POST');
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }, method: string) {
  if (!TOKEN) {
    return NextResponse.json(
      { error: { code: 'PROXY_MISCONFIGURED', message: 'APISHIELD_OPERATOR_TOKEN is not set on the Next.js server.' } },
      { status: 500 },
    );
  }
  const { path } = await context.params;
  const search = request.nextUrl.search;
  const target = `${BACKEND}/${path.join('/')}${search}`;
  const headers = new Headers();
  headers.set('authorization', `Bearer ${TOKEN}`);
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  const init: RequestInit = { method, headers, redirect: 'manual' };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.text();
  }
  try {
    const response = await fetch(target, init);
    const body = await response.arrayBuffer();
    const output = new NextResponse(body, { status: response.status });
    const type = response.headers.get('content-type');
    if (type) {
      output.headers.set('content-type', type);
    }
    return output;
  } catch {
    return NextResponse.json(
      { error: { code: 'BACKEND_UNAVAILABLE', message: 'Control API is not reachable on the configured BACKEND_URL.' } },
      { status: 502 },
    );
  }
}
