/**
 * Netlify Function: /api/login
 * --------------------------------------------------------------
 * تحقق من كلمة مرور المدير دون كشف القيمة الحقيقية للواجهة.
 * تطبّق نفس مبدأ data.js: مقارنة الكلمة المُرسَلة مع متغيّر البيئة ADMIN_PASSWORD.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: CORS_HEADERS });
  }

  const expectedPwd = process.env.ADMIN_PASSWORD || "";
  if (!expectedPwd) {
    return new Response(JSON.stringify({
      error: "لم يتم ضبط ADMIN_PASSWORD في إعدادات Netlify (Site settings → Environment variables)."
    }), { status: 500, headers: CORS_HEADERS });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "JSON غير صالح" }),
    { status: 400, headers: CORS_HEADERS }); }

  const pwd = (body && body.password) ? String(body.password) : "";
  if (pwd !== expectedPwd) {
    // تأخير صغير ضد محاولات التخمين
    await new Promise(r => setTimeout(r, 400));
    return new Response(JSON.stringify({ ok: false, error: "كلمة المرور غير صحيحة" }),
      { status: 401, headers: CORS_HEADERS });
  }

  // نُعيد التوكن (هو نفسه كلمة المرور هنا - يُستخدم في رؤوس Authorization لاحقاً)
  return new Response(JSON.stringify({ ok: true, token: pwd }),
    { status: 200, headers: CORS_HEADERS });
};

export const config = { path: "/api/login" };
