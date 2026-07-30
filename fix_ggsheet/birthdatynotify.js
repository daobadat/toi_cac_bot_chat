/**
 * birthdatynotify.js
 * Trigger chạy mỗi ngày, kiểm tra cột F DOB trong sheet StaffInformation.
 * Nếu có sinh nhật hôm nay thì gửi email thông báo.
 */

function dailyBirthdayNotify() {
  return sendBirthdayNotifications_({ forceSend: false });
}

/**
 * Chạy thử từ UI dialog.
 */
function runBirthdayNotifyFromUI() {
  const result = sendBirthdayNotifications_({ forceSend: true });
  return result.message;
}

function sendBirthdayNotifications_(options) {
  const forceSend = !!(options && options.forceSend);
  const props = PropertiesService.getScriptProperties();

  const recipientsKey = CONFIG.BIRTHDAY.PROP_RECIPIENTS;
  const lastSentKey = CONFIG.BIRTHDAY.PROP_LAST_SENT_DATE;
  const recipientsRaw = String(props.getProperty(recipientsKey) || "").trim();
  const recipients = buildRecipientsList_(recipientsRaw, [
    "200announcement@planadd.com",
  ]);

  const tz = Session.getScriptTimeZone() || "Asia/Ho_Chi_Minh";
  const today = new Date();
  const day = Number(Utilities.formatDate(today, tz, "d"));
  const month = Number(Utilities.formatDate(today, tz, "M"));
  const dateKey = Utilities.formatDate(today, tz, "yyyyMMdd");

  const sentKey = String(props.getProperty(lastSentKey) || "");
  if (!forceSend && sentKey === dateKey) {
    return { sent: false, message: "ℹ️ Hôm nay đã gửi thông báo sinh nhật trước đó." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.STAFF_INFO_SHEET_NAME);
  if (!sheet) {
    return { sent: false, message: `❌ Không tìm thấy sheet "${CONFIG.STAFF_INFO_SHEET_NAME}".` };
  }

  const lastRow = sheet.getLastRow();
  const startRow = CONFIG.DATA_START_ROW || 2;
  if (lastRow < startRow) {
    return { sent: false, message: "ℹ️ Bảng nhân sự chưa có dữ liệu." };
  }

  const maxCol = sheet.getLastColumn();
  const values = sheet.getRange(startRow, 1, lastRow - startRow + 1, maxCol).getValues();

  const birthdayToday = [];
  values.forEach((row) => {
    const name = String(row[CONFIG.COLS.NAME - 1] || "").trim();
    if (!name) return;

    const dobVal = row[CONFIG.COLS.DOB - 1];
    const birthParts = extractBirthParts_(dobVal);
    const d = birthParts.day;
    const m = birthParts.month;
    if (!d || !m) return;

    if (d === day && m === month) {
      const division = String(row[CONFIG.COLS.DIVISION - 1] || "").trim();
      const company = getCompanyFromDivision(division);
      birthdayToday.push({
        name: name,
        company: company,
        id: String(row[CONFIG.COLS.ID - 1] || "").trim()
      });
    }
  });

  if (birthdayToday.length === 0) {
    return { sent: false, message: "ℹ️ Hôm nay không có sinh nhật." };
  }

  const subject = `🎂 Sinh nhật hôm nay (${Utilities.formatDate(today, tz, "dd/MM")})`;
  const lines = birthdayToday.map((p, i) =>
    `${i + 1}. ${p.name} (${p.company || "N/A"})${p.id ? " — " + p.id : ""}`
  );
  const body =
    "Chào anh/chị,\n\n" +
    `Hôm nay có ${birthdayToday.length} người sinh nhật:\n` +
    `${lines.join("\n")}\n\n` +
    `Nguồn: ${ss.getName()} — sheet ${sheet.getName()}.\n` +
    "Email tự động từ Apps Script.";

  MailApp.sendEmail({
    to: recipients,
    subject: subject,
    body: body
  });

  if (!forceSend) {
    props.setProperty(lastSentKey, dateKey);
  }

  return { sent: true, message: `✅ Đã gửi email sinh nhật (${birthdayToday.length} người) tới: ${recipients}` };
}

function buildRecipientsList_(input, fixedEmails) {
  const raw = String(input || "").trim();
  const parts = raw
    ? raw.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  const alwaysRecipients = Array.isArray(fixedEmails)
    ? fixedEmails
    : (fixedEmails ? [fixedEmails] : []);
  alwaysRecipients.forEach(email => {
    if (email) parts.push(String(email).trim());
  });

  if (parts.length === 0) {
    parts.push(Session.getActiveUser().getEmail());
  }

  const seen = {};
  const unique = [];
  parts.forEach(email => {
    const key = email.toLowerCase();
    if (!seen[key]) {
      seen[key] = true;
      unique.push(email);
    }
  });

  return unique.join(",");
}

// =========================
// Trigger UI (Birthday)
// =========================

function openBirthdayTriggerSettings() {
  const html = HtmlService.createHtmlOutputFromFile("birthday")
    .setWidth(460)
    .setHeight(620)
    .setTitle("Cài đặt Trigger Sinh nhật");
  SpreadsheetApp.getUi().showModalDialog(html, "🎂 Cài Đặt Thông Báo Sinh Nhật");
}

function getBirthdayTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  let isActive = false;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "dailyBirthdayNotify") {
      isActive = true;
    }
  });

  const props = PropertiesService.getScriptProperties();
  const savedHour = props.getProperty(CONFIG.BIRTHDAY.PROP_HOUR);
  const hour = savedHour ? parseInt(savedHour, 10) : 8;
  const recipients = props.getProperty(CONFIG.BIRTHDAY.PROP_RECIPIENTS) || "";

  return {
    isActive: isActive,
    hour: hour,
    recipients: recipients
  };
}

function installBirthdayTriggerWithHour(hour, recipients) {
  removeBirthdayTrigger_();

  ScriptApp.newTrigger("dailyBirthdayNotify")
    .timeBased()
    .everyDays(1)
    .atHour(Number(hour) || 8)
    .create();

  const props = PropertiesService.getScriptProperties();
  props.setProperty(CONFIG.BIRTHDAY.PROP_HOUR, String(Number(hour) || 8));
  props.setProperty(CONFIG.BIRTHDAY.PROP_RECIPIENTS, String(recipients || "").trim());

  return {
    message: `✅ Đã kích hoạt! Chạy mỗi ngày lúc ${Number(hour) || 8}:00 - ${(Number(hour) || 8) + 1}:00`,
    status: getBirthdayTriggerStatus()
  };
}

function removeBirthdayTriggerFromUI() {
  removeBirthdayTrigger_();
  return {
    message: "⏹️ Đã tắt trigger sinh nhật.",
    status: getBirthdayTriggerStatus()
  };
}

function removeBirthdayTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "dailyBirthdayNotify") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
