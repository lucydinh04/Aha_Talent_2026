/**
 * AHA TALENT 2026 — Google Apps Script backend
 * Tạo project này từ Google Sheet: Extensions → Apps Script.
 */

const CONFIG = Object.freeze({
  REGISTRATION_SHEET: 'Đăng ký',
  MEMBER_SHEET: 'Thành viên',
  DASHBOARD_SHEET: 'Dashboard',
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  SEND_CONFIRMATION_EMAIL: false
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
  'Link nhạc',
  'Link video demo',
  'Nhu cầu kỹ thuật',
  'Đạo cụ & hậu đài',
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
  setupSheets_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Aha Talent 2026 | Đăng ký tiết mục')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Chạy thủ công 1 lần để khởi tạo hoặc làm mới cấu trúc tracking. */
function setupSheets() {
  setupSheets_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Đã khởi tạo các sheet tracking Aha Talent 2026.');
}

/** Hàm được gọi từ Index.html bằng google.script.run. */
function saveRegistration(payload) {
  validatePayload_(payload);
  setupSheets_();

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const registrations = ss.getSheetByName(CONFIG.REGISTRATION_SHEET);
    const membersSheet = ss.getSheetByName(CONFIG.MEMBER_SHEET);
    const now = new Date();
    const registrationId = createRegistrationId_(payload.location, registrations);

    const representative = payload.representative || {};
    const act = payload.act || {};
    const production = payload.production || {};
    const members = Array.isArray(payload.members) ? payload.members : [];
    const totalMembers = 1 + members.length;
    const memberSummary = members
      .map((member) => `${member.name || ''} (${normalizeTelegram_(member.telegramUsername || '')}) — ${member.department || ''}`)
      .join('\n');

    registrations.appendRow([
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
      totalMembers,
      safeCell_(memberSummary),
      safeCell_(act.description),
      safeCell_(act.transformationMoment),
      safeCell_(act.costumeDirection),
      safeCell_(act.technologyUse),
      safeCell_(production.musicLink),
      safeCell_(production.videoDemo),
      safeCell_(production.technicalNeeds),
      safeCell_(production.propsAndBackstage),
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
      membersSheet
        .getRange(membersSheet.getLastRow() + 1, 1, memberRows.length, MEMBER_HEADERS.length)
        .setValues(memberRows);
    }

    if (CONFIG.SEND_CONFIRMATION_EMAIL && representative.email) {
      sendConfirmationEmail_(representative.email, representative.name, act.name, registrationId);
    }

    SpreadsheetApp.flush();
    return {
      ok: true,
      registrationId,
      submittedAt: Utilities.formatDate(now, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss')
    };
  } finally {
    lock.releaseLock();
  }
}

function setupSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const registrations = getOrCreateSheet_(ss, CONFIG.REGISTRATION_SHEET);
  const members = getOrCreateSheet_(ss, CONFIG.MEMBER_SHEET);
  const dashboard = getOrCreateSheet_(ss, CONFIG.DASHBOARD_SHEET);

  setupHeader_(registrations, REGISTRATION_HEADERS);
  setupHeader_(members, MEMBER_HEADERS);
  setupRegistrationTracking_(registrations);
  setupDashboard_(dashboard);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function setupHeader_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (current.join('|') !== headers.join('|')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#ff7f32')
    .setFontColor('#ffffff')
    .setWrap(true);
  sheet.autoResizeColumns(1, headers.length);
}

function setupRegistrationTracking_(sheet) {
  const statusColumn = REGISTRATION_HEADERS.indexOf('Trạng thái') + 1;
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const statusRange = sheet.getRange(2, statusColumn, maxRows, 1);
  const validation = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      'Mới đăng ký',
      'Đang sơ tuyển',
      'Cần bổ sung',
      'Đã chọn biểu diễn',
      'Không vào vòng diễn',
      'Đã rút đăng ký'
    ], true)
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(validation);

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Mới đăng ký')
      .setBackground('#fff2cc')
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Đã chọn biểu diễn')
      .setBackground('#d9ead3')
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Cần bổ sung')
      .setBackground('#fce5cd')
      .setRanges([statusRange])
      .build()
  ];
  sheet.setConditionalFormatRules(rules);

  if (!sheet.getFilter() && sheet.getLastColumn() > 0) {
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), sheet.getLastColumn()).createFilter();
  }

  const timestampColumn = REGISTRATION_HEADERS.indexOf('Thời gian gửi') + 1;
  const updateColumn = REGISTRATION_HEADERS.indexOf('Ngày cập nhật') + 1;
  sheet.getRange(2, timestampColumn, maxRows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sheet.getRange(2, updateColumn, maxRows, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

function setupDashboard_(sheet) {
  sheet.clear();
  sheet.getRange('A1:B1').setValues([['AHA TALENT 2026', 'TRACKING DASHBOARD']]);
  sheet.getRange('A1:B1')
    .setFontWeight('bold')
    .setFontSize(16)
    .setBackground('#0d4073')
    .setFontColor('#ffffff');

  const rows = [
    ['Chỉ số', 'Số lượng'],
    ['Tổng đăng ký', `=COUNTA('${CONFIG.REGISTRATION_SHEET}'!A2:A)`],
    ['SGN', `=COUNTIF('${CONFIG.REGISTRATION_SHEET}'!D2:D,"SGN")`],
    ['HAN', `=COUNTIF('${CONFIG.REGISTRATION_SHEET}'!D2:D,"HAN")`],
    ['Cá nhân', `=COUNTIF('${CONFIG.REGISTRATION_SHEET}'!E2:E,"Cá nhân")`],
    ['Cặp đôi', `=COUNTIF('${CONFIG.REGISTRATION_SHEET}'!E2:E,"Cặp đôi")`],
    ['Nhóm', `=COUNTIF('${CONFIG.REGISTRATION_SHEET}'!E2:E,"Nhóm")`],
    ['Mới đăng ký', `=COUNTIF('${CONFIG.REGISTRATION_SHEET}'!Y2:Y,"Mới đăng ký")`],
    ['Đã chọn biểu diễn', `=COUNTIF('${CONFIG.REGISTRATION_SHEET}'!Y2:Y,"Đã chọn biểu diễn")`]
  ];
  sheet.getRange(3, 1, rows.length, 2).setValues(rows);
  sheet.getRange(3, 1, 1, 2)
    .setFontWeight('bold')
    .setBackground('#ff7f32')
    .setFontColor('#ffffff');
  sheet.getRange(4, 2, rows.length - 1, 1).setNumberFormat('0');
  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidth(2, 150);
  sheet.setFrozenRows(3);
}

function createRegistrationId_(location, sheet) {
  const prefix = String(location || 'AHA').toUpperCase();
  const sequence = Math.max(sheet.getLastRow(), 1);
  return `AHA26-${prefix}-${String(sequence).padStart(3, '0')}`;
}

function normalizeTelegram_(value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return clean.startsWith('@') ? clean : `@${clean}`;
}

function safeCell_(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (/^[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Dữ liệu đăng ký không hợp lệ.');
  if (!['SGN', 'HAN'].includes(payload.location)) throw new Error('Vui lòng chọn đầu cầu SGN hoặc HAN.');
  if (!['Cá nhân', 'Cặp đôi', 'Nhóm'].includes(payload.participationType)) throw new Error('Hình thức tham gia không hợp lệ.');

  const representative = payload.representative || {};
  const act = payload.act || {};
  const required = [
    representative.name,
    representative.telegramUsername,
    representative.department,
    representative.email,
    representative.phone,
    act.name,
    act.talentType,
    act.direction,
    act.durationMinutes,
    act.description,
    act.transformationMoment,
    (payload.production || {}).videoDemo
  ];
  if (required.some((value) => !String(value || '').trim())) {
    throw new Error('Vui lòng hoàn thành đầy đủ các thông tin bắt buộc.');
  }

  const members = Array.isArray(payload.members) ? payload.members : [];
  if (payload.participationType === 'Cặp đôi' && members.length !== 1) {
    throw new Error('Cặp đôi cần có đúng 01 thành viên ngoài người đại diện.');
  }
  if (payload.participationType === 'Nhóm' && (members.length < 2 || members.length > 11)) {
    throw new Error('Nhóm cần từ 3 đến 12 người tính cả người đại diện.');
  }

  const duration = Number(act.durationMinutes);
  const maxDuration = payload.participationType === 'Nhóm' ? 5 : 4;
  if (!Number.isFinite(duration) || duration <= 0 || duration > maxDuration) {
    throw new Error(`Thời lượng tối đa của hình thức ${payload.participationType} là ${maxDuration} phút.`);
  }
}

function sendConfirmationEmail_(email, name, actName, registrationId) {
  const subject = `[Aha Talent 2026] Xác nhận đăng ký ${registrationId}`;
  const body = [
    `Thân gửi ${name || 'Ahamover'},`,
    '',
    `Ban Tổ chức đã ghi nhận tiết mục: ${actName}.`,
    `Mã đăng ký: ${registrationId}.`,
    '',
    'Ban Tổ chức sẽ liên hệ với bạn qua Telegram sau khi hoàn tất sơ tuyển.',
    '',
    'Aha Talent 2026 — Chuyển mình bứt phá'
  ].join('\n');
  MailApp.sendEmail(email, subject, body);
}
