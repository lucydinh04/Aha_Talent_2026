const { google } = require("googleapis");
const crypto = require("node:crypto");

const REGISTRATION_SHEET = "Đăng ký";
const MEMBER_SHEET = "Thành viên";
const TIME_ZONE = "Asia/Ho_Chi_Minh";

function normalizeTelegram(value = "") {
  const cleaned = String(value).trim().replace(/^@+/, "");
  return cleaned ? `@${cleaned}` : "";
}

function safeCell(value = "") {
  const text = String(value ?? "").trim();
  // Prevent spreadsheet formula injection.
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function formatVietnamTime(date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date).replace(",", "");
}

function createRegistrationId(location = "ALL") {
  const stamp = new Date().toISOString()
    .replace(/\D/g, "")
    .slice(2, 14);
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `AHA26-${safeCell(location || "ALL")}-${stamp}-${random}`;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Dữ liệu đăng ký không hợp lệ.");
  }

  const representative = payload.representative || {};
  const act = payload.act || {};

  const required = [
    [payload.location, "Vui lòng chọn đầu cầu."],
    [payload.participationType, "Vui lòng chọn hình thức dự thi."],
    [representative.name, "Vui lòng nhập họ tên người đại diện."],
    [representative.telegramUsername, "Vui lòng nhập username Telegram."],
    [representative.department, "Vui lòng chọn phòng ban."],
    [representative.email, "Vui lòng nhập email."],
    [representative.phone, "Vui lòng nhập số điện thoại."],
    [act.name, "Vui lòng nhập tên tiết mục."],
    [act.talentType, "Vui lòng chọn loại hình biểu diễn."],
    [act.direction, "Vui lòng chọn hướng thể hiện chủ đề."],
    [act.description, "Vui lòng mô tả ý tưởng tiết mục."],
    [act.transformationMoment, "Vui lòng mô tả điểm nhấn chuyển mình."]
  ];

  for (const [value, message] of required) {
    if (!String(value || "").trim()) throw new Error(message);
  }

  const members = Array.isArray(payload.members) ? payload.members : [];
  if (payload.participationType === "Cặp đôi" && members.length !== 1) {
    throw new Error("Cặp đôi cần đúng 02 thành viên tính cả người đại diện.");
  }
  if (payload.participationType === "Nhóm" && (members.length < 2 || members.length > 11)) {
    throw new Error("Nhóm cần từ 03 đến 12 thành viên tính cả người đại diện.");
  }

  const maxDuration = payload.participationType === "Nhóm" ? 5 : 4;
  const duration = Number(act.durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0 || duration > maxDuration) {
    throw new Error(`Thời lượng tối đa là ${maxDuration} phút.`);
  }
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !privateKey || !spreadsheetId) {
    throw new Error("Máy chủ chưa được cấu hình đủ biến môi trường Google Sheets.");
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Chỉ hỗ trợ phương thức POST." });
  }

  try {
    const allowedOrigin = process.env.ALLOWED_ORIGIN;
    const requestOrigin = req.headers.origin;
    if (allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) {
      return res.status(403).json({ ok: false, error: "Nguồn gửi đăng ký không hợp lệ." });
    }

    const payload = req.body;
    validatePayload(payload);

    const { sheets, spreadsheetId } = getSheetsClient();
    const now = new Date();
    const submittedAt = formatVietnamTime(now);
    const registrationId = createRegistrationId(payload.location);

    const representative = payload.representative || {};
    const act = payload.act || {};
    const production = payload.production || {};
    const members = Array.isArray(payload.members) ? payload.members : [];
    const totalMembers = 1 + members.length;

    const memberSummary = members
      .map((member) =>
        `${safeCell(member.name)} (${normalizeTelegram(member.telegramUsername)}) — ${safeCell(member.department)}`
      )
      .join("\n");

    const registrationRow = [[
      registrationId,
      submittedAt,
      safeCell(payload.eventContext || "Văn nghệ Sinh nhật Ahamove 11 tuổi — Chuyển mình bứt phá"),
      safeCell(payload.location),
      safeCell(payload.participationType),
      safeCell(act.name),
      safeCell(act.talentType),
      safeCell(act.direction),
      Number(act.durationMinutes),
      safeCell(representative.name),
      safeCell(normalizeTelegram(representative.telegramUsername)),
      safeCell(representative.department),
      safeCell(representative.email),
      safeCell(representative.phone),
      totalMembers,
      safeCell(memberSummary),
      safeCell(act.description),
      safeCell(act.transformationMoment),
      safeCell(act.costumeDirection),
      safeCell(act.technologyUse),
      safeCell(production.musicLink),
      safeCell(production.videoDemo),
      safeCell(production.technicalNeeds),
      safeCell(production.propsAndBackstage),
      "Mới đăng ký",
      "",
      submittedAt
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${REGISTRATION_SHEET}'!A:AA`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: registrationRow }
    });

    const memberRows = [
      [
        registrationId,
        safeCell(payload.location),
        safeCell(act.name),
        "Đại diện",
        safeCell(representative.name),
        safeCell(normalizeTelegram(representative.telegramUsername)),
        safeCell(representative.department)
      ],
      ...members.map((member) => [
        registrationId,
        safeCell(payload.location),
        safeCell(act.name),
        "Thành viên",
        safeCell(member.name),
        safeCell(normalizeTelegram(member.telegramUsername)),
        safeCell(member.department)
      ])
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${MEMBER_SHEET}'!A:G`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: memberRows }
    });

    return res.status(200).json({
      ok: true,
      registrationId,
      submittedAt
    });
  } catch (error) {
    console.error("Submit error:", error);
    return res.status(400).json({
      ok: false,
      error: error && error.message
        ? error.message
        : "Không thể ghi nhận đăng ký."
    });
  }
};
