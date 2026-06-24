/**
 * Netlify Function: /api/image/:id
 * --------------------------------------------------------------
 * GET /api/image/<id>  =>  يخدم صورة من Netlify Blobs بمعرّفها.
 *
 * يُرجع البايتات الأصلية + رؤوس Content-Type + Cache طويلة لأن المحتوى ثابت.
 */

import { getStore } from "@netlify/blobs";

const IMAGES_STORE = "tayf-store-images";

export default async (req) => {
  const url = new URL(req.url);
  // المسار: /api/image/<id>
  const id = decodeURIComponent(url.pathname.replace(/^\/api\/image\//, ""));
  if (!id) {
    return new Response("Missing image id", { status: 400 });
  }

  try {
    const store = getStore({ name: IMAGES_STORE, consistency: "strong" });
    const result = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!result || !result.data) {
      return new Response("Not found", { status: 404 });
    }
    const contentType = (result.metadata && result.metadata.contentType) || "image/jpeg";
    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // كاش طويل لأن الـ ID فريد ولا يتغيّر محتواه أبداً
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("image fetch error", e);
    return new Response("Server error: " + String(e.message || e), { status: 500 });
  }
};

export const config = { path: "/api/image/*" };
