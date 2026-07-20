/**
 * AHA TALENT 2026 — Flat Vercel backend
 *
 * Không cần folder /api.
 * Sau khi deploy Google Apps Script, thay URL bên dưới bằng link kết thúc /exec.
 */
const APPS_SCRIPT_URL = "PASTE_APPS_SCRIPT_EXEC_URL_HERE";

function isConfigured() {
  return (
    APPS_SCRIPT_URL.startsWith("https://script.google.com/macros/s/") &&
    APPS_SCRIPT_URL.endsWith("/exec") &&
    !APPS_SCRIPT_URL.includes("PASTE_APPS_SCRIPT")
  );
}

function readableError(value) {
  if (!value) return "Lỗi không xác định.";
  if (typeof value === "string") return value;

  if (typeof value === "object") {
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;

    if (value.error && typeof value.error.message === "string") {
      return value.error.message;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return "Lỗi không xác định.";
    }
  }

  return String(value);
}

async function callAppsScript(method, body) {
  const options = {
    method,
    redirect: "follow"
  };

  if (method === "POST") {
    options.headers = {
      "Content-Type": "text/plain;charset=utf-8"
    };
    options.body = JSON.stringify(body || {});
  }

  const response = await fetch(APPS_SCRIPT_URL, options);
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (
    /text\/html/i.test(contentType) ||
    /^\s*<!doctype html/i.test(text) ||
    /^\s*<html/i.test(text)
  ) {
    throw new Error(
      "Apps Script đang trả về trang đăng nhập hoặc trang lỗi. Hãy deploy với Execute as: Me, Who has access: Anyone và dùng URL /exec."
    );
  }

  let result;
  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new Error(
      "Apps Script không trả về JSON. Hãy kiểm tra lại deployment và quyền truy cập Anyone."
    );
  }

  if (!response.ok || !result.ok) {
    throw new Error(readableError(result.error || result));
  }

  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const mode = String(req.query?.mode || "");

  if (!isConfigured()) {
    return res.status(500).json({
      ok: false,
      step: "config",
      error: "Chưa dán Apps Script Web App URL /exec vào file backend.js."
    });
  }

  try {
    if (mode === "health") {
      const result = await callAppsScript("GET");
      return res.status(200).json({
        ok: true,
        message: "Vercel đã kết nối thành công với Google Apps Script.",
        appsScript: result
      });
    }

    if (mode !== "submit") {
      return res.status(404).json({
        ok: false,
        error: "Đường dẫn không hợp lệ."
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({
        ok: false,
        error: "Chỉ hỗ trợ phương thức POST."
      });
    }

    const result = await callAppsScript("POST", req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    console.error("Aha Talent backend error:", error);

    return res.status(500).json({
      ok: false,
      error: readableError(error)
    });
  }
};
