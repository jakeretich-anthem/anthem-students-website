import { NextResponse } from "next/server";
import { kvGet, kvList, kvPut } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

// Crop is metadata about how to display a photo (zoom + pan), never baked into
// pixels, so it lives in roster_kv beside goals/notes rather than the sheet —
// see goals/route.ts for the same rationale (keyed by the student's stable
// sheet ID, not row position, which shifts on every add/delete above them).

export type PhotoCrop = { zoom: number; offX: number; offY: number };

function keyFor(sk: string | null, id: string | null): string | null {
  if (!sk || !id) return null;
  return `photoCrop:${sk}:${id}`;
}

export async function GET(request: Request) {
  const perm = await requirePermission("roster", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const url = new URL(request.url);
  const sk = url.searchParams.get("sk");
  const id = url.searchParams.get("id");
  if (!sk) return NextResponse.json({ error: "sk is required" }, { status: 400 });

  // No id: return every student's crop for this tab as an id -> crop map, so
  // the roster grid can load them all in one request instead of one per card.
  if (!id) {
    const prefix = `photoCrop:${sk}:`;
    const { keys } = await kvList(prefix);
    const entries = await Promise.all(
      keys.map(async ({ name }) => [name.slice(prefix.length), await kvGet<PhotoCrop>(name)] as const)
    );
    return NextResponse.json(Object.fromEntries(entries));
  }

  const data = await kvGet<PhotoCrop>(keyFor(sk, id)!);
  return NextResponse.json(data || null);
}

export async function PUT(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const key = keyFor(body.sk, body.id);
  if (!key) return NextResponse.json({ error: "sk and id are required" }, { status: 400 });
  if (typeof body.zoom !== "number" || typeof body.offX !== "number" || typeof body.offY !== "number") {
    return NextResponse.json({ error: "zoom, offX, and offY are required" }, { status: 400 });
  }

  await kvPut(key, { zoom: body.zoom, offX: body.offX, offY: body.offY } satisfies PhotoCrop);

  return NextResponse.json({ success: true });
}
