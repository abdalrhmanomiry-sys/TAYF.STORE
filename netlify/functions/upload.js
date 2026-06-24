/**
 * Netlify Function: /api/upload
 * --------------------------------------------------------------
 * POST /api/upload  =>  يستقبل صورة (multipart/form-data أو raw binary)
 *                       ويحفظها في Netlify Blobs ويُعيد URL يصلح للعرض.
 *
 * طريقة الإرسال المعتمدة (الأبسط): raw body مع رؤوس:
 *   Content-Type:  image/jpeg | image/png | image/webp | image/gif
 *   X-Filename:    اسم الملف الأصلي (اختياري - فقط للتسمية)
 *   Authorization: Bearer <ADMIN_PASSWORD>
 *
 * الإستجابة:
 *   { ok: true, url: "/api/image/<id>", id: "<id>", size: 12345 }
 */

import { getStore } from "@netlify/blobs";

const IMAGES_STORE = "tayf-store-images";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 6 * 1024 * 1024; // 6MB قبل الضغط (المتصفّح يضغط أولاً)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Filename",
  "Cache-Control": "no-store",
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function randomId() {
  // 16 بايت عشوائية -> hex
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function extFromType(t) {
  return ({
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/gif":  "gif",
  })[t] || "bin";
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // التحقق من الصلاحية
  const expectedPwd = process.env.ADMIN_PASSWORD || "";
  if (!expectedPwd) return json({ error: "ADMIN_PASSWORD غير مضبوط على Netlify." }, 500);
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== expectedPwd) return json({ error: "غير مصرّح. كلمة المرور خاطئة." }, 401);

  // التحقق من نوع المحتوى
  const ctype = (req.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_TYPES.includes(ctype)) {
    return json({ error: `نوع الصورة غير مدعوم: ${ctype}. المدعوم: JPG, PNG, WebP, GIF.` }, 400);
  }

  // قراءة الجسم
  let buffer;
  try {
    const ab = await req.arrayBuffer();
    buffer = new Uint8Array(ab);
  } catch (e) {
    return json({ error: "تعذّر قراءة بيانات الصورة." }, 400);
  }

  if (!buffer.byteLength) return json({ error: "الملف فارغ." }, 400);
  if (buffer.byteLength > MAX_SIZE) {
    return json({ error: `حجم الصورة كبير جداً (${(buffer.byteLength/1024/1024).toFixed(2)}MB). الحد الأقصى ${MAX_SIZE/1024/1024}MB.` }, 413);
  }

  // توليد ID فريد
  const id = `${Date.now()}-${randomId()}.${extFromType(ctype)}`;

  try {
    const store = getStore({ name: IMAGES_STORE, consistency: "strong" });
    // نحفظ البايتات + ميتاداتا (نوع المحتوى)
    await store.set(id, buffer, { metadata: { contentType: ctype, size: buffer.byteLength } });
  } catch (e) {
    console.error("upload error", e);
    return json({ error: "تعذّر حفظ الصورة: " + String(e.message || e) }, 500);
  }

  return json({
    ok: true,
    id,
    url: `/api/image/${id}`,
    size: buffer.byteLength,
    type: ctype,
  });
};

export const config = { path: "/api/upload" };
