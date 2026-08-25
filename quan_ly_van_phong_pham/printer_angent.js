/**
 * printer-agent.js
 * Chạy trên 1 máy trong mạng LAN (192.168.1.x) qua Windows Task Scheduler / cron.
 * Fetch trang counter máy in Ricoh -> parse -> POST lên Apps Script Web App.
 *
 * Setup:
 *   npm install axios cheerio dotenv winston
 *   Tạo file .env cùng thư mục:
 *     PRINTER_URL=http://192.168.1.220/web/guest/en/websys/status/getUnificationCounter.cgi
 *     WEBAPP_URL=https://script.google.com/macros/s/XXXXX/exec
 *     AGENT_TOKEN=<token lấy từ setupSecretToken() bên Apps Script>
 *
 * Lịch chạy đề xuất: mỗi ngày 1 lần lúc 23:55 (đủ để track theo ngày) hoặc theo nhu cầu.
 */

require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: 'printer-agent-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'printer-agent-combined.log' }),
    new winston.transports.Console()
  ]
});

const { PRINTER_URL, STATUS_URL, WEBAPP_URL, AGENT_TOKEN } = process.env;

if (!PRINTER_URL || !WEBAPP_URL || !AGENT_TOKEN) {
  logger.error('Thiếu biến môi trường bắt buộc: PRINTER_URL, WEBAPP_URL, AGENT_TOKEN');
  process.exit(1);
}

/**
 * Parse số nguyên an toàn, loại bỏ dấu phẩy ngăn cách hàng nghìn nếu có.
 */
function parseIntSafe(text) {
  if (!text) return 0;
  const cleaned = text.replace(/,/g, '').trim();
  const num = parseInt(cleaned, 10);
  return Number.isNaN(num) ? 0 : num;
}

/**
 * Parse HTML trang status máy in Ricoh (getStatus.cgi) để trích xuất % mức mực (Toner).
 */
function parseStatusHtml(html) {
  if (!html) return { tonerBlack: 0, tonerCyan: 0, tonerMagenta: 0, tonerYellow: 0 };
  const $ = cheerio.load(html);

  const getTonerPercent = (colorName) => {
    let percent = 0;
    $('dt.listboxdtm, dt').each((_, el) => {
      const text = $(el).text().trim();
      if (new RegExp(`^${colorName}$`, 'i').test(text)) {
        const dd = $(el).next('dd');
        
        // Thẻ img trong khối .tonerArea chính là thanh biểu diễn mức mực của Ricoh
        const tonerImg = dd.find('.tonerArea img, img[src*="deviceStt"]').first();
        const wAttr = tonerImg.attr('width');
        const styleAttr = tonerImg.attr('style') || dd.find('.tonerArea div[style*="width"]').attr('style') || '';
        const styleMatch = styleAttr.match(/width\s*:\s*([\d.]+)(px|%)/i);

        let val = 0;
        let unit = 'px';

        if (wAttr) {
          val = parseFloat(wAttr);
        } else if (styleMatch) {
          val = parseFloat(styleMatch[1]);
          unit = styleMatch[2];
        }

        if (val > 0) {
          if (unit === '%') {
            percent = Math.min(100, Math.round(val));
          } else {
            // Thanh mực Ricoh chiều rộng tối đa 160px tương ứng 100%
            percent = Math.min(100, Math.round((val / 160) * 100));
          }
        }
      }
    });
    return percent;
  };

  return {
    tonerBlack: getTonerPercent('Black'),
    tonerCyan: getTonerPercent('Cyan'),
    tonerMagenta: getTonerPercent('Magenta'),
    tonerYellow: getTonerPercent('Yellow')
  };
}

/**
 * Parse HTML trang counter máy in Ricoh, trích các số liệu trong khối "Total".
 * Cấu trúc HTML của websys Ricoh dùng bảng liệt kê "A3/DLT : X  Others : Y"
 * -> ta cộng dồn A3/DLT + Others để ra tổng số trang từng loại.
 */
function parseCounterHtml(html) {
  const $ = cheerio.load(html);

  // Làm sạch text: xóa &nbsp;, ô vuông ■, và khoảng trắng dư thừa
  const cleanText = (str) => (str || '').replace(/[\u00a0\u25a0\u25a1\u25aa\u25ab]/g, ' ').replace(/\s+/g, ' ').trim();
  const bodyText = cleanText($('body').text());

  // Hàm lấy Total (số đầu sau nhãn) của một hàng trong một khối (Copier/Printer)
  // Cấu trúc: "Full Color : 141114  A3/DLT : ..."
  const getSectionTotal = (sectionLabel, rowLabelPattern) => {
    // Tìm đoạn text bắt đầu từ tên khối (Copier/Printer) đến khối tiếp theo
    const sectionMatch = bodyText.match(new RegExp(`${sectionLabel}[\\s\\S]*?(?=Copier|Printer|Fax|Send|$)`, 'i'));
    if (!sectionMatch) return 0;
    const sectionText = sectionMatch[0];
    // Trong đoạn đó tìm hàng của rowLabelPattern và lấy số Total đầu tiên sau dấu ":"
    const rowMatch = sectionText.match(new RegExp(`${rowLabelPattern}\\s*:\\s*([\\d,]+)`, 'i'));
    return rowMatch ? parseIntSafe(rowMatch[1]) : 0;
  };

  // 2. Copier (4 trường dữ liệu Total)
  const copierFullColor   = getSectionTotal('Copier', 'Full Color');
  const copierBW          = getSectionTotal('Copier', 'Black\\s*&\\s*White');
  const copierSingleColor = getSectionTotal('Copier', 'Single Color');
  const copierTwoColor    = getSectionTotal('Copier', 'Two[- ]color');

  // 3. Printer (4 trường dữ liệu Total)
  const printerFullColor   = getSectionTotal('Printer', 'Full Color');
  const printerBW          = getSectionTotal('Printer', 'Black\\s*&\\s*White');
  const printerSingleColor = getSectionTotal('Printer', 'Single Color');
  const printerTwoColor    = getSectionTotal('Printer', 'Two[- ]color');

  logger.info(
    `Trích xuất counter thành công -> ` +
    `Copier [FC: ${copierFullColor}, BW: ${copierBW}, Single: ${copierSingleColor}, Two: ${copierTwoColor}] | ` +
    `Printer [FC: ${printerFullColor}, BW: ${printerBW}, Single: ${printerSingleColor}, Two: ${printerTwoColor}]`
  );

  return {
    copierFullColor,
    copierBW,
    copierSingleColor,
    copierTwoColor,
    printerFullColor,
    printerBW,
    printerSingleColor,
    printerTwoColor
  };
}

/**
 * Gửi dữ liệu lên Apps Script Web App, có retry với exponential backoff
 * vì Web App đôi khi cold-start chậm hoặc rớt mạng LAN tạm thời.
 */
async function postWithRetry(payload, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post(WEBAPP_URL, payload, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.data && res.data.success) {
        return res.data;
      }
      throw new Error(`Web App trả về lỗi: ${JSON.stringify(res.data)}`);
    } catch (err) {
      lastError = err;
      logger.warn(`Lần thử ${attempt}/${maxRetries} thất bại: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
  throw lastError;
}

async function run() {
  try {
    logger.info(`Đang fetch counter từ ${PRINTER_URL}`);
    const { data: counterHtml } = await axios.get(PRINTER_URL, { timeout: 10000 });
    const counters = parseCounterHtml(counterHtml);

    let toners = { tonerBlack: 0, tonerCyan: 0, tonerMagenta: 0, tonerYellow: 0 };
    if (STATUS_URL) {
      try {
        logger.info(`Đang fetch status mực từ ${STATUS_URL}`);
        const { data: statusHtml } = await axios.get(STATUS_URL, { timeout: 10000 });
        toners = parseStatusHtml(statusHtml);
        logger.info(`Trích xuất mức mực thành công -> Black: ${toners.tonerBlack}%, Cyan: ${toners.tonerCyan}%, Magenta: ${toners.tonerMagenta}%, Yellow: ${toners.tonerYellow}%`);
      } catch (stErr) {
        logger.warn(`Không thể lấy status mực (bỏ qua): ${stErr.message}`);
      }
    }

    const payload = { ...counters, ...toners, token: AGENT_TOKEN };
    logger.info(`Gửi payload: ${JSON.stringify(payload)}`);

    const result = await postWithRetry(payload);
    logger.info(`Đẩy dữ liệu lên Sheet thành công lúc ${result.timestamp}`);
  } catch (err) {
    logger.error(`Agent thất bại: ${err.message}`);
    process.exitCode = 1; // để Task Scheduler nhận biết job fail
  }
}

run();