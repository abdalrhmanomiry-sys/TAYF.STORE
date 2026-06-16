/**
 * Netlify Function: /api/data
 * --------------------------------------------------------------
 * - GET  /api/data           => تُرجع جميع بيانات المتجر (إعدادات، أقسام، منتجات، بانرات)
 * - PUT  /api/data           => تحفظ البيانات (تتطلب رأس Authorization: Bearer <ADMIN_PASSWORD>)
 *
 * التخزين: Netlify Blobs (مدمج ومجاني)
 * إذا لم تُنشأ البيانات بعد، يُعاد تحميلها من ملف data-default.json
 */

import { getStore } from "@netlify/blobs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const STORE_NAME = "tayf-store-data";
const KEY = "store.json";

// رؤوس CORS عامة
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

async function loadDefaults() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // ملف data-default.json موجود في جذر المشروع
    const candidates = [
      join(here, "..", "..", "..", "data-default.json"),
      join(here, "..", "..", "data-default.json"),
      join(process.cwd(), "data-default.json"),
    ];
    for (const p of candidates) {
      try {
        const txt = await readFile(p, "utf-8");
        return JSON.parse(txt);
      } catch (_) { /* ignore and try next */ }
    }
  } catch (e) {
    console.error("loadDefaults error", e);
  }
  // قيم احتياطية (إذا تعذّر قراءة الملف)
  return {
    settings: {
      storeName: "متجر طيف",
      description: "كتب ومنتجات مختارة بعناية.",
      email: "",
      whatsapp: "",
      instagram: "",
      deliveryNote: "يوجد توصيل إلى جميع المحافظات."
    },
    banners: [],
    categories: [
      { slug: "books", name: "كتب" },
      { slug: "accessories", name: "إكسسوارات" }
    ],
    products: []
  };
}

export default async (req, context) => {
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS_HEADERS });
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  // ============ قراءة البيانات ============
  if (method === "GET") {
    try {
      let data = await store.get(KEY, { type: "json" });
      if (!data) {
        data = await loadDefaults();
        // نحفظ البيانات الافتراضية في أول طلب لتصبح قابلة للتعديل
        await store.setJSON(KEY, data);
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: CORS_HEADERS,
      });
    } catch (e) {
      console.error("GET error", e);
      return new Response(JSON.stringify({ error: "تعذّر قراءة البيانات", details: String(e) }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  // ============ حفظ البيانات (محمي) ============
  if (method === "PUT") {
    // التحقق من كلمة المرور
    const expectedPwd = process.env.ADMIN_PASSWORD || "";
    if (!expectedPwd) {
      return new Response(JSON.stringify({
        error: "لم يتم ضبط ADMIN_PASSWORD في متغيرات البيئة على Netlify."
      }), { status: 500, headers: CORS_HEADERS });
    }
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== expectedPwd) {
      return new Response(JSON.stringify({ error: "كلمة المرور غير صحيحة" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }

    // قراءة الجسم
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "JSON غير صالح" }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    // تحقق سريع من البنية
    if (!body || typeof body !== "object"
        || !body.settings || !Array.isArray(body.products)
        || !Array.isArray(body.categories) || !Array.isArray(body.banners)) {
      return new Response(JSON.stringify({
        error: "بنية البيانات غير صالحة. مطلوب: settings, banners[], categories[], products[]"
      }), { status: 400, headers: CORS_HEADERS });
    }

    try {
      await store.setJSON(KEY, body);
      return new Response(JSON.stringify({ ok: true, savedAt: Date.now() }), {
        status: 200,
        headers: CORS_HEADERS,
      });
    } catch (e) {
      console.error("PUT error", e);
      return new Response(JSON.stringify({ error: "تعذّر حفظ البيانات", details: String(e) }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: CORS_HEADERS,
  });
};

export const config = { path: "/api/data" };
