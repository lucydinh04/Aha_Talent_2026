/**
 * Vercel API proxy → Google Apps Script backend.
 *
 * Sau khi deploy Apps Script, thay URL bên dưới bằng link kết thúc /exec.
 */
const APPS_SCRIPT_URL = "PASTE_APPS_SCRIPT_EXEC_URL_HERE";

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: "Chỉ hỗ trợ phương thức POST."
    });
  }

  if (!APPS_SCRIPT_URL.startsWith("https://script.google.com/macros/s/")
      || !APPS_SCRIPT_URL.endsWith("/exec")) {
    return res.status(500).json({
      ok: false,
      error: "Chưa cấu hình đúng Apps Script Web App URL trong api/submit.js."
    });
  }

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(req.body || {}),
      redirect: "follow"
    });

    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("Apps Script không trả về dữ liệu JSON hợp lệ.");
    }

    if (!response.ok || !result.ok) {
      return res.status(400).json({
        ok: false,
        error: result.error || `Apps Script HTTP ${response.status}`
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Proxy error:", error);
    return res.status(500).json({
      ok: false,
      error: error && error.message
        ? error.message
        : "Không thể kết nối Google Sheet."
    });
  }
};
