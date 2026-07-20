/**
 * AHA TALENT 2026 — Backend ghi dữ liệu từ Vercel vào Google Sheet.
 *
 * Google Sheet:
 * https://docs.google.com/spreadsheets/d/1D-kqGPIj6N2_xv0b0PxmYU8dOe2P8wGull7dBZX3yX4/edit?gid=1096028765
 */

const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1D-kqGPIj6N2_xv0b0PxmYU8dOe2P8wGull7dBZX3yX4',
  TARGET_SHEET_GID: 1096028765,
  MEMBER_SHEET: 'Thành viên',
  TIMEZONE: 'Asia/Ho_Chi_Minh'
});

const REGISTRATION_HEADERS = [
  'Mã đăng ký',
  'Thời gian gửi',
  'Bối cảnh chương trình',
  'Đầu cầu',
  'Hình thức',
  'Tên tiết mục',
  'Loại hình biểu diễn',
  'Hướng thể hiện chủ đề',
  'Thời lượng (phút)',
  'Người đại diện',
  'Telegram đại diện',
  'Phòng ban đại diện',
  'Email',
  'Số điện thoại',
  'Tổng số thành viên',
  'Danh sách thành viên',
  'Mô tả ý tưởng',
  'Điểm nhấn chuyển mình',
  'Ý tưởng trang phục',
  'Ứng dụng AI/công nghệ',
  'Cần BTC hỗ trợ?',
  'Mô tả nhu cầu hỗ trợ',
  'Trạng thái',
  'Ghi chú BTC',
  'Ngày cập nhật'
];

const MEMBER_HEADERS = [
  'Mã đăng ký',
  'Đầu cầu',
  'Tên tiết mục',
  'Vai trò',
  'Họ và tên',
  'Username Telegram',
  'Phòng ban'
];

function doGet() {
  return jsonOutput_({
    ok: true,
    service: 'Aha Talent 2026 Registration Backend'
  });
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    validatePayload_(payload);

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const result = saveRegistration_(payload);
      return jsonOutput_(result);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return jsonOutput_({
      ok: false,
      error: error && error.message
        ? error.message
        : 'Không thể ghi nhận đăng ký.'
    });
  }
}

/**
 * Chạy thủ công 1 lần trước khi deploy để cấp quyền và kiểm tra Sheet.
 */
function setupAhaTalentBackend() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const registrationSheet = getSheetByGid_(ss, CONFIG.TARGET_SHEET_GID);
  ensureHeaders_(registrationSheet, REGISTRATION_HEADERS);

  const memberSheet = ss.getSheetByName(CONFIG.MEMBER_SHEET)
    || ss.insertSheet(CONFIG.MEMBER_SHEET);
  ensureHeaders_(memberSheet, MEMBER_HEADERS);

  SpreadsheetApp.flush();
  Logger.log('Backend đã sẵn sàng.');
}

function saveRegistration_(payload) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const registrationSheet = getSheetByGid_(ss, CONFIG.TARGET_SHEET_GID);
  ensureHeaders_(registrationSheet, REGISTRATION_HEADERS);

  const memberSheet = ss.getSheetByName(CONFIG.MEMBER_SHEET)
    || ss.insertSheet(CONFIG.MEMBER_SHEET);
  ensureHeaders_(memberSheet, MEMBER_HEADERS);

  const now = new Date();
  const registrationId = createRegistrationId_(payload.location, now);

  const representative = payload.representative || {};
  const act = payload.act || {};
  const support = payload.support || {};
  const members = Array.isArray(payload.members) ? payload.members : [];

  const memberSummary = members.length
    ? members.map((member, index) =>
        `${index + 2}. ${member.name || ''} | ${normalizeTelegram_(member.telegramUsername)} | ${member.department || ''}`
      ).join('\n')
    : 'Không có thành viên bổ sung';

  registrationSheet.appendRow([
    registrationId,
    now,
    safeCell_(payload.eventContext),
    safeCell_(payload.location),
    safeCell_(payload.participationType),
    safeCell_(act.name),
    safeCell_(act.talentType),
    safeCell_(act.direction),
    Number(act.durationMinutes) || '',
    safeCell_(representative.name),
    safeCell_(normalizeTelegram_(representative.telegramUsername)),
    safeCell_(representative.department),
    safeCell_(representative.email),
    safeCell_(representative.phone),
    1 + members.length,
    safeCell_(memberSummary),
    safeCell_(act.description),
    safeCell_(act.transformationMoment),
    safeCell_(act.costumeDirection),
    safeCell_(act.technologyUse),
    safeCell_(support.needed),
    safeCell_(support.details),
    'Mới đăng ký',
    '',
    now
  ]);

  const memberRows = [
    [
      registrationId,
      safeCell_(payload.location),
      safeCell_(act.name),
      'Đại diện',
      safeCell_(representative.name),
      safeCell_(normalizeTelegram_(representative.telegramUsername)),
      safeCell_(representative.department)
    ],
    ...members.map((member) => [
      registrationId,
      safeCell_(payload.location),
      safeCell_(act.name),
      'Thành viên',
      safeCell_(member.name),
      safeCell_(normalizeTelegram_(member.telegramUsername)),
      safeCell_(member.department)
    ])
  ];

  if (memberRows.length) {
    memberSheet
      .getRange(memberSheet.getLastRow() + 1, 1, memberRows.length, MEMBER_HEADERS.length)
      .setValues(memberRows);
  }

  SpreadsheetApp.flush();

  return {
    ok: true,
    registrationId,
    submittedAt: Utilities.formatDate(now, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss')
  };
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Không nhận được dữ liệu đăng ký.');
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('Dữ liệu gửi lên không đúng định dạng.');
  }
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Dữ liệu đăng ký không hợp lệ.');
  }

  if (!['SGN', 'HAN'].includes(payload.location)) {
    throw new Error('Đầu cầu tham gia không hợp lệ.');
  }

  if (!['Cá nhân', 'Cặp đôi', 'Nhóm'].includes(payload.participationType)) {
    throw new Error('Hình thức tham gia không hợp lệ.');
  }

  const representative = payload.representative || {};
  const act = payload.act || {};
  const support = payload.support || {};

  const required = [
    [representative.name, 'Thiếu họ tên người đại diện.'],
    [representative.telegramUsername, 'Thiếu username Telegram.'],
    [representative.department, 'Thiếu phòng ban người đại diện.'],
    [representative.email, 'Thiếu email người đại diện.'],
    [representative.phone, 'Thiếu số điện thoại người đại diện.'],
    [act.name, 'Thiếu tên tiết mục.'],
    [act.talentType, 'Thiếu loại hình biểu diễn.'],
    [act.direction, 'Thiếu hướng thể hiện chủ đề.'],
    [act.durationMinutes, 'Thiếu thời lượng dự kiến.'],
    [act.description, 'Thiếu mô tả ý tưởng tiết mục.'],
    [act.transformationMoment, 'Thiếu điểm nhấn chuyển mình.'],
    [support.needed, 'Thiếu lựa chọn nhu cầu hỗ trợ.']
  ];

  required.forEach(([value, message]) => {
    if (!String(value || '').trim()) throw new Error(message);
  });

  if (support.needed === 'Có' && !String(support.details || '').trim()) {
    throw new Error('Thiếu mô tả nhu cầu hỗ trợ.');
  }

  const members = Array.isArray(payload.members) ? payload.members : [];
  if (payload.participationType === 'Cặp đôi' && members.length !== 1) {
    throw new Error('Cặp đôi cần đúng 02 thành viên tính cả người đại diện.');
  }

  if (payload.participationType === 'Nhóm' && (members.length < 2 || members.length > 11)) {
    throw new Error('Nhóm cần từ 03 đến 12 thành viên tính cả người đại diện.');
  }
}

function getSheetByGid_(spreadsheet, gid) {
  const sheet = spreadsheet.getSheets().find((item) => item.getSheetId() === Number(gid));
  if (!sheet) {
    throw new Error(`Không tìm thấy tab Google Sheet có gid=${gid}.`);
  }
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  const hasAnyHeader = firstRow.some((value) => String(value).trim());

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#ff7f32')
      .setFontColor('#ffffff')
      .setWrap(true);
  }
}

function createRegistrationId_(location, date) {
  const timestamp = Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyMMddHHmmss');
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AHA26-${String(location || 'ALL').toUpperCase()}-${timestamp}-${random}`;
}

function normalizeTelegram_(value) {
  const clean = String(value || '').trim().replace(/^@+/, '');
  return clean ? `@${clean}` : '';
}

function safeCell_(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
