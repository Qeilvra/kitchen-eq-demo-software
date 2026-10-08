import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { authorize } from "@/lib/auth";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await authorize("documents");
  const { id } = await params;
  const db = await supabase();
  const { data } = await db.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Document unavailable." }, { status: 404 });
  const { data: link, error } = await db.storage
    .from("airmech-documents")
    .createSignedUrl(data.storage_path, 60);
  if (error || !link) return NextResponse.json({ error: "Document unavailable." }, { status: 404 });
  return NextResponse.redirect(link.signedUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
