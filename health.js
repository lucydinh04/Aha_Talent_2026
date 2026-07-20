module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  const configured = Boolean(
    process.env.GOOGLE_SHEET_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );

  return res.status(configured ? 200 : 503).json({
    ok: configured,
    service: "Aha Talent 2026 Registration API",
    googleSheetsConfigured: configured
  });
};
