# CHANGELOG - Quản Lý Văn Phòng Phẩm (Trích Xuất Dữ Liệu Máy In)

> Ngày thực hiện: 17/08/2026

---

## Tổng quan hệ thống

Hệ thống gồm 2 thành phần phối hợp với nhau:

| Thành phần | File | Môi trường |
|---|---|---|
| Local Agent | `printer_angent.js` | Máy tính nội bộ (Node.js) |
| Web App Endpoint | `code.js` | Google Apps Script (Cloud) |
| Cấu hình | `.env` | Máy tính nội bộ |

**Luồng hoạt động:**
`Máy in Ricoh (192.168.1.220)` → `printer_angent.js` (fetch & parse HTML) → `WEBAPP_URL` (POST JSON) → `code.js` (ghi vào Google Sheet)

---

## Các thay đổi đã thực hiện

### [v1.0] - Khởi tạo cấu trúc ban đầu
- Tạo file `printer_angent.js`: Node.js agent chạy trong mạng LAN, fetch trang counter máy in Ricoh, parse HTML, POST lên Apps Script.
- Tạo file `code.js`: Google Apps Script nhận dữ liệu từ agent và ghi vào Google Sheet.

---

### [v1.1] - Cấu hình thực tế
- Cập nhật `SHEET_ID` trong `code.js`: `1VW3pew5yR3T-anFuRZwSEyqZlacKyrAzy6yRnq4ldHM`
- Đổi `SHEET_NAME` từ `Theo dõi máy in` → `dữ liệu in ra` để ghi vào đúng tab sheet của người dùng.

---

### [v1.5] - Đổi tên tab Sheet thành `Data`
- Cập nhật `SHEET_NAME` trong `code.js`: `'dữ liệu in ra'` → **`'Data'`**
- Tab Google Sheet hiện tại: **Data**
- ✅ Dữ liệu đã xác nhận ghi thành công vào sheet `Data` với đầy đủ 6 cột.
- Thiết lập `Script Properties` trên Google Apps Script:
  - Property: `PRINTER_AGENT_TOKEN`
  - Value: `PrinterToken2026` (mã bảo mật tự đặt)
- Tạo file `.env` dưới máy local:
  ```
  PRINTER_URL=http://192.168.1.220/web/guest/en/websys/status/getUnificationCounter.cgi
  WEBAPP_URL=https://script.google.com/macros/s/.../exec
  AGENT_TOKEN=PrinterToken2026
  ```
- Deploy Web App lần đầu (Version 1) trên Google Apps Script.

---

### [v1.2] - Sửa lỗi tất cả dữ liệu trả về `0`
**Nguyên nhân:** Trang web máy in Ricoh có ký tự đặc biệt `■` (ô vuông đen) trước mỗi nhãn và khoảng trắng `&nbsp;` làm thuật toán tìm kiếm label bị sai.

**Khắc phục trong `printer_angent.js`:**
- Viết lại hàm `parseCounterHtml` với bộ lọc `cleanText` để xóa ký tự `■` (`\u25a0`) và `&nbsp;` (`\u00a0`) trước khi xử lý.
- Đổi sang dùng regex khớp text trên toàn bộ `bodyText` thay vì duyệt từng `<tr>`.

---

### [v1.3] - Thu hẹp dữ liệu lấy theo yêu cầu
**Yêu cầu:** Chỉ lấy dữ liệu từ khối **Total** của trang máy in, không cộng tổng.

**Dữ liệu cần trích xuất (phiên bản 1):**
- `Total Counter`
- `Full Color` → Simplex → **Others** (cột đầu)
- `Black & White` → Simplex → **Others** (cột đầu)

**Thay đổi trong `printer_angent.js`:**
- Xóa các trường không cần: `fullColorDuplex`, `bwSimplex`, `bwDuplex`, `singleColor*`, `twoColor*`.
- Chỉ giữ 3 trường: `totalCounter`, `fullColorOthersSimplex`, `bwOthersSimplex`.

**Thay đổi trong `code.js`:**
- Cập nhật schema validation chỉ kiểm tra 3 trường mới.
- Cập nhật tiêu đề cột sheet thành:
  - `Thời gian ghi nhận` | `Total Counter` | `Full Color (Others Simplex)` | `Black & White (Others Simplex)`
- Code tự tạo sheet `dữ liệu in ra` nếu chưa tồn tại.
- Code tự thêm hàng tiêu đề nếu sheet đang trống.

---

### [v1.4] - Mở rộng lấy thêm Others Duplex (Other1 & Other2)
**Yêu cầu:** Lấy thêm cột **Others Duplex** (cột bên phải trong bảng) để phân biệt 2 loại:
- **Other1** = Others Simplex (in 1 mặt)
- **Other2** = Others Duplex (in 2 mặt)

**Dữ liệu mục tiêu cuối cùng (theo hình khoanh đỏ):**

| Trường | Giá trị ví dụ |
|---|---|
| Total Counter | 1,270,842 |
| Full Color (Other1) | 237,458 *(Simplex)* |
| Full Color (Other2) | 141,684 *(Duplex)* |
| Black & White (Other1) | 432,355 *(Simplex)* |
| Black & White (Other2) | 111,407 *(Duplex)* |

**Thay đổi trong `printer_angent.js`:**
- Dùng regex 2 nhóm bắt để lấy cả 2 số `Others` trong 1 hàng:
  ```js
  /Full Color.*?Others\s*:\s*([\d,]+).*?Others\s*:\s*([\d,]+)/i
  /Black\s*&\s*White.*?Others\s*:\s*([\d,]+).*?Others\s*:\s*([\d,]+)/i
  ```
- Trả về 4 trường mới: `fullColorOther1`, `fullColorOther2`, `bwOther1`, `bwOther2`.

**Thay đổi trong `code.js`:**
- Cập nhật schema validation cho 5 trường: `totalCounter`, `fullColorOther1`, `fullColorOther2`, `bwOther1`, `bwOther2`.
- Cập nhật tiêu đề cột sheet thành 6 cột:
  - `Thời gian ghi nhận` | `Total Counter` | `Full Color (Other1)` | `Full Color (Other2)` | `Black & White (Other1)` | `Black & White (Other2)`

---

### [v1.14] - Chuyển sang `insertRowBefore(2)` để không dính định dạng Dòng tiêu đề 1
**Nguyên nhân phát hiện:** `insertRowAfter(1)` khiến Google Sheets tự động thừa kế kiểu in đậm và màu nền xanh/vàng từ Dòng tiêu đề 1.

**Giải pháp:**
- Đổi sang `sheet.insertRowBefore(2)`: Chèn dòng phía TRÊN Dòng 2. Việc này giúp Google Sheets tự động thừa kế định dạng từ Dòng 2 cũ (là dòng dữ liệu bình thường, nền trắng chữ thường).
- Kết hợp `copyTo` định dạng từ Dòng 3 sang Dòng 2 để đảm bảo 100% không bị dính màu nền.

---

### [v1.13] - Xóa triệt để định dạng thừa kế bằng `clearFormat()`
**Giải pháp triệt để:**
- Dùng `newRange.clearFormat()` ngay sau khi `insertRowAfter(1)` để xóa sạch toàn bộ style thừa kế (chữ in đậm, màu nền xanh/vàng, viền khung) của Dòng tiêu đề 1.
- Tự thiết lập lại định dạng chuẩn: `setFontWeight('normal')`, `setBackground('#ffffff')`, `setHorizontalAlignment('left')`, và `setNumberFormat('dd/MM/yyyy HH:mm:ss')`.

---

### [v1.12] - Ép định dạng Dòng 2 khớp 100% với Dòng 3 (Chữ thường, Nền trắng `#ffffff`)
**Khắc phục:**
- Dùng `copyTo` sao chép trực tiếp định dạng chuẩn từ Dòng 3 đè lên Dòng 2.
- Ép thêm `setFontWeight('normal')` và `setBackground('#ffffff')` mã màu trắng tinh để triệt tiêu toàn bộ màu xanh/vàng thừa kế từ dòng tiêu đề Dòng 1.

---

### [v1.11] - Bỏ in đậm & Bỏ màu nền cho dòng dữ liệu mới
**Yêu cầu:** Khi chèn dòng mới ở Dòng 2, dữ liệu không được in đậm (dùng chữ thường) và không bị dính màu nền (như màu xanh/vàng thừa kế từ dòng tiêu đề Dòng 1).

**Thay đổi trong `code.js`:**
- Thêm `newRange.setFontWeight('normal')` để chữ ở dạng thường.
- Thêm `newRange.setBackground(null)` để xóa màu nền thừa kế, trả về nền trắng chuẩn.

---

### [v1.10] - Sửa lỗi tính sai phần trăm mức mực (Toner 16%)
**Nguyên nhân:** Mã cũ vô tình chọn lầm chiều rộng mặc định của icon hoặc thẻ hình nền tĩnh, khiến cả 4 màu mực đều bị tính ra cố định `16%`.

**Khắc phục:**
- Nhắm mục tiêu chính xác vào thẻ `<div class="fnet-1" style="width:XXpx;">` trong từng dòng màu (`Black`, `Cyan`, `Magenta`, `Yellow`).
- Tính phần trăm chính xác: `(width / 160) * 100` để cho ra đúng % thực tế của từng hộp mực.

---

### [v1.9] - Bổ sung trích xuất phần trăm mức mực (Toner 4 màu)
**Yêu cầu:** Fetch dữ liệu từ trang `getStatus.cgi` để lấy % mức mực 4 màu: **Black**, **Cyan**, **Magenta**, **Yellow** và lưu lên Sheet.

**Cấu trúc dữ liệu ghi vào Google Sheet (13 cột):**
1. `Thời gian` (Cột A)
2. `Copier - Black & White (Total)` (Cột B)
3. `Printer - Black & White (Total)` (Cột C)
4. `Copier - Full Color (Total)` (Cột D)
5. `Copier - Single Color (Total)` (Cột E)
6. `Copier - Two-color (Total)` (Cột F)
7. `Printer - Full Color (Total)` (Cột G)
8. `Printer - Single Color (Total)` (Cột H)
9. `Printer - Two-color (Total)` (Cột I)
10. `Toner - Black (%)` (Cột J)
11. `Toner - Cyan (%)` (Cột K)
12. `Toner - Magenta (%)` (Cột L)
13. `Toner - Yellow (%)` (Cột M)

**Thay đổi:**
- Thêm `STATUS_URL` vào `.env`.
- Cập nhật `printer_angent.js`: Thêm hàm `parseStatusHtml` để lấy % mực từ `getStatus.cgi` và gửi kèm trong payload.
- Cập nhật `code.js`: Nhận 4 trường `tonerBlack`, `tonerCyan`, `tonerMagenta`, `tonerYellow` và bổ sung 4 cột mới vào sheet.

---

### [v1.8] - Định dạng căn trái dữ liệu & Hiển thị ngày giờ đầy đủ
**Yêu cầu:**
1. Căn lề trái (Left Align) cho toàn bộ hàng dữ liệu mới được chèn.
2. Cột `Thời gian` phải luôn hiển thị đầy đủ cả Ngày và Giờ (`dd/MM/yyyy HH:mm:ss`).

**Thay đổi trong `code.js`:**
- Thêm `newRange.setHorizontalAlignment('left')` cho dòng 2.
- Thêm `sheet.getRange(2, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss')` cho ô thời gian ở cột A.

---

### [v1.7] - Khớp thứ tự cột theo yêu cầu thực tế & Chèn dòng mới lên đầu (Row Above)
**Yêu cầu:** 
1. Sắp xếp thứ tự các cột khớp chính xác với ảnh chụp Google Sheet thực tế của người dùng.
2. Dữ liệu mới ghi vào luôn luôn được **chèn lên dòng 2** (ngay dưới dòng tiêu đề A1:I1), đẩy dữ liệu cũ xuống dưới.

**Cấu trúc dữ liệu ghi vào Google Sheet (9 cột):**
1. `Thời gian` (Cột A)
2. `Copier - Black & White (Total)` (Cột B)
3. `Printer - Black & White (Total)` (Cột C)
4. `Copier - Full Color (Total)` (Cột D)
5. `Copier - Single Color (Total)` (Cột E)
6. `Copier - Two-color (Total)` (Cột F)
7. `Printer - Full Color (Total)` (Cột G)
8. `Printer - Single Color (Total)` (Cột H)
9. `Printer - Two-color (Total)` (Cột I)

**Thay đổi trong `code.js`:**
- Thay đổi `sheet.appendRow(row)` thành `sheet.insertRowAfter(1)` và `sheet.getRange(2, 1, 1, row.length).setValues([row])` để luôn chèn dữ liệu mới lên trên cùng (dòng 2).
- Khớp mảng `row` và `headers` theo thứ tự chính xác từng cột từ A đến I.

---

## Hướng dẫn vận hành

### Cập nhật Apps Script sau mỗi lần sửa `code.js`:
1. Dán nội dung `code.js` mới vào `Code.gs` trên [script.google.com](https://script.google.com).
2. Bấm **Deploy** > **Manage deployments** > Biểu tượng ✏️ > Version: **New version** > **Deploy**.

### Chạy thủ công:
```bash
node printer_angent.js
```

### Đặt lịch tự động Hàng Ngày (Trigger bằng Windows Task Scheduler):

1. **Mở Task Scheduler trên Windows 11**:
   - Bấm phím `Windows` > Gõ `Task Scheduler` > Nhấn `Enter`.
2. **Tạo Tác vụ mới**:
   - Ở cột bên phải (**Actions**), chọn **`Create Basic Task...`**
   - **Name (Tên)**: Điền `Cap_Nhat_May_In_Hang_Ngay` > Bấm **Next**.
3. **Đặt Lịch Chạy**:
   - Chọn **`Daily`** (Hàng ngày) > Bấm **Next**.
   - **Start time**: Chọn giờ tự động chạy mỗi ngày (ví dụ: `17:30:00` hoặc `23:55:00`).
   - Recur every: `1` days > Bấm **Next**.
4. **Chọn Hành Động**:
   - Chọn **`Start a program`** > Bấm **Next**.
   - **Program/script**: Bấm *Browse...* chọn file `g:\My TASK\toi_uu_lai_bot_chat\quan_ly_van_phong_pham\run_printer_agent.bat`
   - **Start in (optional)**: Điền thư mục `g:\My TASK\toi_uu_lai_bot_chat\quan_ly_van_phong_pham`
   - Bấm **Next**.
5. **Cấu Hình Chạy Bù Khi Tắt Máy**:
   - Tích chọn **`Open the Properties dialog for this task when I click Finish`** > Bấm **Finish**.
   - Trong bảng vừa hiện ra, chuyển sang tab **`Settings`**: Tích chọn **`Run task as soon as possible after a scheduled start is missed`** *(Giúp máy tự động chạy bù nếu lỡ giờ hẹn lúc máy tính bị tắt)*.
   - Bấm **OK** để lưu.

---

## Lưu ý quan trọng

> ⚠️ File `printer_angent.js` và `.env` phải chạy trên máy tính **kết nối cùng mạng LAN nội bộ** với máy in (`192.168.1.220`). Nếu tắt máy tính, script sẽ không chạy được.

> ⚠️ Mỗi lần sửa `code.js`, phải **Deploy lại phiên bản mới** trên Google Apps Script thì thay đổi mới có hiệu lực.

> ⚠️ Mỗi khi thay đổi cấu trúc cột, cần **xóa các dòng cũ** trên sheet để tiêu đề cột được tạo lại đúng format mới.
