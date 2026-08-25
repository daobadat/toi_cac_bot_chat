# CHANGELOG - PROJECT TRACKING & CALENDAR TO SHEET EXTRACTOR

**Ngày cập nhật**: 24/08/2026  
**Thực hiện bởi**: Antigravity AI (Google DeepMind) pair programming cùng User  
**Dự án**: Calendar to Sheet (Đồng bộ Google Calendar sang Google Sheet)

---

## [24/08/2026] - Bổ sung Bộ lọc Trích xuất VPA & Cấu hình Kiểm tra Cố định cho Ngày 21/08 (T6) và 22/08 (T7)

### 📄 [sheetManager.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/sheetManager.js)
- **Thêm hàm `isVpaProjectEvent(calendarName, eventTitle)`**: Lọc chính xác các sự kiện thuộc Dự án VPA dựa trên Tên lịch (chứa `"VPA"`) hoặc Tiêu đề sự kiện (chứa/bắt đầu bằng mã `"VPA"`).
- **Cập nhật quy tắc trích xuất & dọn dẹp Sheet `CalendarData`**:
  - `processMultiCalendarToSheet()`, `syncMultiCalendarToSheet()`, `syncMultiCalendarForDateRange()`: CHỈ trích xuất và lưu các sự kiện thuộc Dự án VPA vào Sheet. Bỏ qua các sự kiện ADD, các sự kiện thuộc dự án khác không phải VPA hoặc lịch cá nhân không gắn mã VPA.
  - `isIncompleteOrBlankRow()`: Tự động dọn dẹp các dòng không phải sự kiện Dự án VPA ra khỏi Sheet `CalendarData`.

### 📄 [scheduleValidator.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/scheduleValidator.js) & [code.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/code.js)
- **Ngoại lệ ngày làm việc cố định (22/08/2026 - Thứ 7)**: Đã thêm cờ `isSpecialWorkSaturday` trong `checkStaffScheduleForDate()` để KHÔNG bỏ qua Thứ 7 ngày 22/08/2026 như ngày cuối tuần thông thường mà vẫn kiểm tra đủ lịch làm việc.
- **Cập nhật giao diện `dryRunCheckSchedule()`**: Cấu hình cố định 2 mốc kiểm tra cho **Thứ 6 (21/08/2026)** và **Thứ 7 (22/08/2026)** với tiêu đề và cột kết quả tương ứng.
- **Thêm hàm `isStaffPersonalCalendar(calId, calName, staff)`**: Nhận diện lịch cá nhân nhân viên bằng cách so sánh email, username, tên đầy đủ (không dấu) với ID và Tên lịch — khắc phục lỗi hệ thống không nhận diện được lịch cá nhân khi calendarId khác email đăng ký.
- **Nâng cấp `isEventInvolvingStaff()`**:
  - Hỗ trợ cross-domain email: Tự động kiểm tra cả `@add-group.net` và `@planadd.com` khi tìm nhân viên trong danh sách `creators` và `guests`.
  - Nới lỏng điều kiện khớp tên: Chỉ cần tên cuối (lastName) ≥ 2 ký tự và sử dụng word boundary regex thay vì so sánh chuỗi cứng, giúp nhận diện đúng các tên ngắn như "Tâm", "Thảo", "Giang".
- **Nâng cấp `collectAllStaffEvents()`**:
  - Sử dụng `isStaffPersonalCalendar()` mới thay vì so sánh `calId === staffEmail` cũ (gây sót khi tên miền email khác nhau).
  - Quét song song cả 2 domain email (`@add-group.net` / `@planadd.com`) khi thu thập sự kiện cá nhân trực tiếp từ Google Calendar API.
  - Cải thiện nhận diện sự kiện VPA trong tiêu đề sự kiện: Dùng regex `\bVPA\b` (word boundary) để phát hiện mã VPA nằm ở giữa tiêu đề.

---

## [20/08/2026] - Nâng cấp Logic Kiểm tra Lịch Chặt chẽ theo Giờ & Phân loại Nhân viên

### 📄 [sheetManager.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/sheetManager.js) & [scheduleValidator.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/scheduleValidator.js)
- **Tách bạch 2 Tính năng Chính của Hệ thống**:
  1. **Tính năng Trích xuất Dữ liệu Lịch Dự án VPA (`exportAllVpaCalendarsToSheet`)**:
     - Cố định hàm `getAllVpaCalendarIds()` chỉ quét và trích xuất **duy nhất các Lịch thuộc Dự án VPA** (tên bắt đầu bằng `VPA` hoặc `vpa@planadd.com`).
     - Tuyệt đối KHÔNG trích xuất các lịch cá nhân, lịch ADC, team 200, team 300 vào Sheet dữ liệu VPA.
  2. **Tính năng Kiểm tra Lịch làm việc 6-8h Nhân viên (`scheduleValidator.js`)**:
     - Tiếp tục sử dụng `getAllTargetCalendarIds()` quét toàn bộ 42 Lịch công việc/dự án/cá nhân để tính đúng tổng giờ làm việc 6-8h cho nhân viên làm dự án ADC, ADD, team 200, team 300...

### 📄 [EmailNotifier.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/EmailNotifier.js)
- **Bổ sung cột "Tổng giờ" & "Lý do vi phạm"** trong email Báo cáo Tổng gửi cho Quản lý.
- **Cập nhật mẫu email gửi cá nhân cho Nhân viên**: Hiển thị rõ tiêu chuẩn 6-8h, buổi sáng & chiều và chi tiết lý do bị nhắc nhở.

### 📄 [code.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/code.js)
- **Nâng cấp giao diện `dryRunCheckSchedule()`**: Chuyển từ hộp thoại chữ thô (`alert`) sang **Giao diện Bảng HTML (Modal Dialog)** cuộn được, tô màu xanh/đỏ chuyên nghiệp cho trạng thái từng nhân viên cho cả ngày **Hôm qua** và **Hôm nay** mà không bị giới hạn độ dài văn bản.
- **Nâng cấp Trigger 11:45 AM (`setupDaily1145AMTrigger` & `ensureDaily1145AMTrigger`)**: Tự động hóa việc kiểm tra lịch và báo cáo lúc 11:45 AM hàng ngày theo logic kiểm tra đủ 6-8 tiếng và kiểm tra lịch sáng/chiều mới.

---

## [12/08/2026] - Nâng cấp Bộ lọc Lọc sự kiện Trùng lặp Nội dung (Cột A đến J)

### 📄 [calendarService.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/calendarService.js)

#### 1. Bổ sung các hàm helper tạo Fingerprint và kiểm tra Trùng lặp
- **`normalizeFieldValue(val)`**: Chuẩn hóa dữ liệu ô (xử lý kiểu `Date`, `null`, loại bỏ khoảng trắng dư thừa, chuẩn hóa ký tự xuống dòng `\r\n` thành `\n`).
- **`createEventFingerprint(...)`**: Tạo chuỗi Fingerprint độc nhất gộp từ 8 cột nội dung chính:
  - Cột A: Tên lịch (`calName`)
  - Cột D: Tên sự kiện (`title`)
  - Cột E: Thời gian bắt đầu (`startTimeStr`)
  - Cột F: Thời gian kết thúc (`endTimeStr`)
  - Cột G: Thời lượng (`duration`)
  - Cột H: Người tạo (`creators`)
  - Cột I: Khách mời & Trạng thái (`guests`)
  - Cột J: Mô tả (`description`)
  - *Bỏ qua Cột B (Event ID) và Cột C (STT)* để xử lý trường hợp người dùng copy/nhân bản sự kiện trong Google Calendar (Google tạo Event ID mới nhưng toàn bộ 8 cột nội dung đều trùng y hệt).
- **`createRowFingerprint(rowValues)`**: Tạo Fingerprint từ 1 mảng dữ liệu 10 cột trong Sheet.
- **`getExistingEventKeys(sheet)`**: Đọc sheet và trả về cả 2 bảng hash: `ids` (Event ID) và `fingerprints` (Chuỗi nội dung trùng lặp).

---

### 📄 [sheetManager.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/sheetManager.js)

#### 2. Nâng cấp hàm `cleanupBlankAndIncompleteRows(sheet)`
- Bổ sung logic lọc dòng trùng lặp nội dung từ Cột A đến Cột J dựa trên Fingerprint (`seenFingerprints[fp]`).
- Tự động đánh lại **STT (Cột C)** theo từng nhóm lịch để đảm bảo chuỗi STT liên tục, không bị đứt đoạn sau khi xóa các dòng trùng.

#### 3. Nâng cấp các hàm Trích xuất & Đồng bộ dữ liệu Lịch
- **`processMultiCalendarToSheet()`**: Gọi `cleanupBlankAndIncompleteRows(sheet)` trước khi quét và kiểm tra cả `!existingKeys.ids[event.id]` VÀ `!existingKeys.fingerprints[fp]` trước khi chèn dòng mới. Nếu 8 cột nội dung trùng khớp 100% với dữ liệu đã có thì chỉ ghi 1 dòng duy nhất.
- **`syncMultiCalendarToSheet()`**: Cập nhật logic đồng bộ tự động daily / manual sync today với kiểm tra Fingerprint trùng lặp.
- **`syncMultiCalendarForDateRange()`**: Cập nhật logic đồng bộ theo khoảng thời gian với kiểm tra Fingerprint trùng lặp.

---

### 📄 [code.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/code.js)

#### 4. Cập nhật thông báo dọn dẹp
- Cập nhật thông báo alert trong `manualCleanupBlankRows()` hiển thị rõ số dòng trùng lặp / rỗng / thiếu dữ liệu đã được dọn dẹp.

---

## [06/08/2026] - Cập nhật Email Báo cáo & Nhận diện Từ khóa Nghỉ phép

### 📄 [EmailNotifier.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/EmailNotifier.js)

#### 1. Bỏ chữ "Hôm qua" ở cột **Thời gian** trong email báo cáo tổng
- **Trước**: Cột Thời gian trong bảng danh sách nhân viên vi phạm hiển thị chữ `Hôm qua` cứng.
- **Sau**: Chỉ hiển thị ngày cụ thể dạng `dd/MM/yyyy` (ví dụ: `05/08/2026`).
- Logic tự động loại bỏ chữ `"Hôm qua"` và ngoặc đơn thừa từ `displayLabel` trước khi render vào bảng HTML.

#### 2. Bổ sung từ tiếng Việt **"Vắng mặt"** cho từ khóa `"Out of office"`
- Trong phần **Quy trình khắc phục** (email gửi cho nhân viên) và **Lưu ý Quản lý** (email tổng báo cáo), dòng hướng dẫn từ khóa nghỉ phép được cập nhật:
  > *"Day Off"*, *"Nghỉ phép"*, *"Out of office"* (hoặc *"Vắng mặt"*)
- Giúp nhân viên biết có thể dùng tiếng Việt `Vắng mặt` thay cho `Out of office`.

#### 3. Cải tiến hàm `sendSummaryScheduleAlert()`
- `dateText` giờ được lấy từ `yesterdayStr` thực tế (ngày dạng `dd/MM/yyyy`) thay vì cứng là `"Hôm qua"`.
- Tiêu đề email báo cáo tổng cũng dùng ngày thực tế: `[BÁO CÁO TỔNG] Cảnh báo nhân viên chưa làm lịch VPA - ngày dd/MM/yyyy`.
- Mỗi dòng trong bảng hiển thị ngày vi phạm riêng của từng nhân viên (lấy từ `item.missingDates`) thay vì dùng chung 1 `dateText`.

#### 4. Cải tiến hàm `sendIndividualScheduleAlert()`
- Tự động strip chữ `"Hôm qua"` ra khỏi `missingDates` khi hiển thị, chỉ giữ ngày `dd/MM/yyyy`.
- Loại bỏ fallback cứng `"ngày Hôm qua"` / `"Hôm qua"` trong trường hợp `legacyDateStr`.

---

### 📄 [scheduleValidator.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/scheduleValidator.js)

#### 5. Bổ sung từ khóa nhận diện nghỉ phép mới vào `DAY_OFF_KEYWORDS`
- Thêm: `"out of office"`, `"vắng mặt"`, `"vang mat"` vào mảng `DAY_OFF_KEYWORDS`.

#### 6. Nâng cấp hàm `isDayOffEvent()` — Ưu tiên kiểm tra cụm từ chính xác TRƯỚC
- **Thứ tự kiểm tra mới**:
  1. **Kiểm tra `exactPhrases` TRƯỚC** (bao gồm `"out of office"`, `"vắng mặt"`, `"day off"`, `"nghỉ phép"`, ...) → trả về `true` ngay nếu khớp.
  2. Sau đó mới kiểm tra `workExcludeKeywords` (loại trừ: `"office"`, `"kick off"`, ...) → trả về `false` nếu khớp.
  3. Cuối cùng kiểm tra từ đơn lẻ (`"off"`, `"nghỉ"`, `"leave"`, `"phép"`).
- **Lý do**: Trước đây `"Out of office"` bị chặn nhầm bởi từ loại trừ `"office"`, dẫn đến hệ thống không nhận ra sự kiện nghỉ phép hợp lệ.

#### 7. Cập nhật `displayLabel` trong `checkStaffScheduleForDate()`
- **Trước**: `displayLabel = dateLabel + " (" + dateStr + ")"` → hiển thị kiểu `Hôm qua (05/08/2026)`.
- **Sau**: `displayLabel = dateStr` → chỉ hiển thị `05/08/2026`.
- `reason` cũng cập nhật thành `"Chưa làm lịch VPA cho ngày dd/MM/yyyy"`.

---

---

## 1. Vấn đề ghi nhận & Nâng cấp Mới

1. **Khắc phục triệt để nhận diện nhầm "Day Off"**:
   - **Nguyên nhân cũ**: Từ khóa `"off"`, `"nghi"` và `"po"` dạng chuỗi thô (`indexOf`) làm cho các sự kiện công việc như *"Kick off dự án"*, *"Hand off"*, *"Office"*, *"Nghiệm thu"* bị nhận diện nhầm thành Day Off.
   - **Giải pháp mới**:
     - Thêm danh sách loại trừ các từ công việc thông thường: `"kick off"`, `"hand off"`, `"office"`, `"offline"`, `"nghiệm thu"`, `"nghiên cứu"`, `"suy nghĩ"`.
     - Chỉ chấp nhận các cụm từ Day Off chính xác: `"day off"`, `"nghỉ phép"`, `"nghỉ làm"`, `"xin nghỉ"`, `"annual leave"`, `"sick leave"`, `"p/o"`, `"p.o"`.
     - Tách từ theo ranh giới từ (word boundary) khi kiểm tra từ đơn lẻ `"off"`, `"nghỉ"`, `"leave"`, `"phép"`.
     - Đưa tiêu đề sự kiện cụ thể phát hiện vào lý do kết quả: `Day Off ("<Tiêu đề sự kiện>")` giúp người dùng biết chính xác sự kiện nào đã kích hoạt Day Off.

2. **Chế độ Dry Run Test (Hôm qua & Hôm nay)**:
   - Menu **`🧪 [TEST] Kiểm tra lịch (Không gửi email)`** cho phép xem kết quả chi tiết từng nhân viên mà không gửi bất kỳ email nào.

3. **Danh sách Ngoại lệ Nhân viên Khai báo (Cố định)**:
   - Tự động bỏ qua 9 nhân viên lãnh đạo/miễn làm lịch (*Son Min Chang, Kim Minjeong, Đào Bá Đạt, Đỗ Phương Thảo, Nguyễn Lan Hương, Đặng Đình Thuyết, Nguyễn Văn Quyết, Nguyễn Đình Kiên, Âu Thị Hiếu*).

---

## 2. Chi tiết các File Code được Cập nhật

### 📄 [scheduleValidator.js](file:///g:/My%20TASK/toi_uu_lai_bot_chat/calendar%20to%20sheet/scheduleValidator.js)
- `isDayOffEvent(title)`: Nâng cấp bộ lọc loại trừ các sự kiện có chữ "Kick off", "Office", "Nghiệm thu"...
- `checkStaffScheduleForDate()`: Bổ sung tên sự kiện phát hiện vào lý do kết quả.

---

## 3. Hướng dẫn Kiểm tra & Vận hành

1. **Chạy lại Dry Run Test**:
   - Mở Google Sheets ➔ Menu **`📅 Công cụ Lịch`** ➔ Chọn **`🧪 [TEST] Kiểm tra lịch (Không gửi email)`**.
   - Lê Anh Quân sẽ không còn bị nhận diện nhầm thành Day Off (trừ khi có sự kiện nghỉ phép thực sự). Nếu có sự kiện Day Off, hộp thoại sẽ ghi rõ tiêu đề sự kiện đó.

---
*Nhật ký được tự động tổng hợp bởi Antigravity AI Assistant.*
