# Workflow & Plan: Tự động hóa Xử lý Vé máy bay (STT 6 & STT 7)

Tài liệu này mô tả quy trình và kế hoạch triển khai tự động hóa việc lưu trữ vé máy bay, đặt lịch và thông báo tự động thông qua Google Apps Script.

## I. Workflow: Quy trình Tự động hóa

Workflow này mô tả quá trình từ lúc người dùng (hoặc AI) nhập thông tin đến khi các tác vụ lưu trữ, thông báo và đặt lịch hoàn tất.

1. **Thu thập Dữ liệu (Trigger):** AI thu thập thông tin vé máy bay từ biểu mẫu (Form) do người dùng điền, bao gồm: 
   - Điểm đi
   - Điểm đến
   - Mã vé
   - Ngày và Giờ khởi hành
   - Tệp vé (PDF mã hóa Base64)
   - Ghi chú (Hủy/Đổi nếu có)
2. **Gửi Dữ liệu đến Apps Script:** AI gửi một yêu cầu HTTP POST chứa dữ liệu JSON đã thu thập đến Web App (API Endpoint) của Google Apps Script.
3. **Xử lý Dữ liệu trong Apps Script:**
   - **Xác định thời gian thực:** Trích xuất ngày, tháng, năm từ thông tin ngày khởi hành hoặc hệ thống.
   - **STT 6 - Lưu vé máy bay (Phục vụ kế toán thuế):**
     - Tự động tìm/tạo thư mục tháng tương ứng (VD: `Tháng 6`, `Tháng 7`) trong thư mục gốc.
     - Đổi tên file PDF theo đúng cú pháp quy định: `<ngày> <Điểm đi- Điểm đến> <note (nếu có)>` (Ví dụ: `31 HN-HCM (Hủy)`).
     - Lưu file PDF vào Google Drive và lấy đường dẫn URL.
   - **STT 7 - Gửi vé và Đặt lịch:**
     - **Tạo sự kiện Calendar:** Gán thông tin lên lịch '200 calendar' (hoặc lịch của Boss) với các chi tiết chuyến bay và đính kèm link Drive của file vé.
     - **Gửi thông báo:** Tự động nhắn tin vào nhóm chat (thông qua Webhook) với nội dung tóm tắt chuyến bay và link tải vé.
4. **Phản hồi (Response):** Apps Script trả về kết quả (thành công/thất bại) cho AI để hoàn tất quy trình.

---

## II. Plan: Kế hoạch Triển khai (4 Bước)

### Bước 1: Chuẩn bị Môi trường và Dữ liệu
- Xác định **ID của thư mục gốc** trên Google Drive (thư mục lưu trữ chính của năm, VD: `2026`).
- Lấy **URL Webhook** của nhóm chat (Google Chat, Zalo, Slack, Telegram...).
- Xác định **ID của Google Calendar** (email lịch của Boss hoặc ID lịch dùng chung).

### Bước 2: Xây dựng Google Apps Script (Web App)
- Viết hàm `doPost(e)` để nhận dữ liệu từ AI.
- Viết logic tự động nhận diện thời gian thực và tạo thư mục con theo tháng (ví dụ: `Vé di chuyển tháng 6 - 2026`).
- Viết hàm xử lý file: Nhận chuỗi Base64 từ AI -> Chuyển thành file PDF -> Đổi tên chuẩn -> Lưu vào thư mục tháng.
- Viết API gọi đến Google Calendar để tạo sự kiện và chèn URL vé.
- Viết hàm gửi HTTP POST request (sử dụng `UrlFetchApp`) đến Webhook của nhóm chat.
- **Deploy:** Triển khai Script dưới dạng Web App để lấy Endpoint URL.

### Bước 3: Tích hợp với AI Form
- Cấu hình hệ thống AI hoặc Form để tự động cấu trúc dữ liệu thành dạng JSON.
- Đảm bảo AI mã hóa file PDF thành định dạng Base64.
- Thiết lập hành động gọi HTTP POST đến Endpoint URL của Apps Script ngay khi biểu mẫu được nộp.

### Bước 4: Kiểm thử và Vận hành
- **Test 1 (Lưu trữ):** Gửi form thử nghiệm, kiểm tra xem file PDF có được lưu đúng thư mục tháng hiện tại và đúng định dạng tên không.
- **Test 2 (Lịch):** Kiểm tra sự kiện có xuất hiện trên Google Calendar của Boss theo đúng khung giờ không.
- **Test 3 (Thông báo):** Kiểm tra tin nhắn có được bắn thành công vào nhóm chat không.
- **Test 4 (Chuyển tháng):** Thay đổi ngày giờ hệ thống hoặc đợi sang tháng sau để đảm bảo script tự động tạo thư mục tháng mới (VD: tự động chuyển từ Tháng 6 sang Tháng 7).
