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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.text();
    const upstream = await fetch(`${BACKEND_BASE_URL}/api/delivery-requests/${id}`, {
      method: "PATCH",
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
