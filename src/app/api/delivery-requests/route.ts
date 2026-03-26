import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE_URL = process.env.BACKEND_URL || "http://localhost:8000";

function buildForwardHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie) headers.cookie = cookie;
  return headers;
}

async function forwardJsonResponse(upstream: Response) {
  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "application/json";
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}

export async function GET(request: NextRequest) {
  try {
    const upstream = await fetch(`${BACKEND_BASE_URL}/api/delivery-requests`, {
      method: "GET",
      headers: buildForwardHeaders(request),
      cache: "no-store",
    });
    return forwardJsonResponse(upstream);
  } catch {
    return NextResponse.json({ detail: "Backend unavailable" }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const upstream = await fetch(`${BACKEND_BASE_URL}/api/delivery-requests`, {
      method: "POST",
      headers: {
        ...buildForwardHeaders(request),
        "content-type": "application/json",
      },
      body,
    });
    return forwardJsonResponse(upstream);
  } catch {
    return NextResponse.json({ detail: "Backend unavailable" }, { status: 503 });
  }
}
