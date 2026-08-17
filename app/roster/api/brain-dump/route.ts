import { NextResponse } from "next/server";
import { requirePermission } from "../../lib/auth";

export async function POST(request: Request) {
  const perm = await requirePermission("brainDump", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const { text, roster } = await request.json();
  if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

  const parsed = parseTextForStudents(text, roster || []);
  return NextResponse.json({ parsed });
}

/**
 * Parses free-form text and matches mentions to known student names.
 * Simple but effective: splits into sentences, matches on first/last name fragments.
 */
function parseTextForStudents(text: string, roster: string[]) {
  const results = new Map<string, string[]>();

  const sentences = text
    .split(/(?<=[.!?\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const nameIndex = roster.map((name) => ({
    canonical: name,
    parts: name.toLowerCase().split(/\s+/).filter((p) => p.length > 2),
  }));

  for (const sentence of sentences) {
    const sentLower = sentence.toLowerCase();
    for (const { canonical, parts } of nameIndex) {
      if (parts.some((p) => sentLower.includes(p))) {
        if (!results.has(canonical)) results.set(canonical, []);
        results.get(canonical)!.push(sentence);
        break;
      }
    }
  }

  const namePattern = /\b(?:with|and|saw|hung out with|talked to|caught up with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = namePattern.exec(text)) !== null) {
    const mentioned = m[1];
    const found = roster.find((n) => n.toLowerCase().includes(mentioned.toLowerCase()));
    if (found && !results.has(found)) {
      const start = Math.max(0, m.index - 60);
      const end = Math.min(text.length, m.index + 200);
      results.set(found, [text.slice(start, end).trim()]);
    }
  }

  return [...results.entries()].map(([name, sentences]) => ({
    name,
    summary: sentences.join(" ").slice(0, 500),
    matched: true,
  }));
}
