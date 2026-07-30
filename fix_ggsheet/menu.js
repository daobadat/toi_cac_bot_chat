function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('⚙️ CÔNG CỤ NHÂN SỰ')
        .addItem('➕ Đồng bộ Nhân Sự Mới', 'addNewStaff')
        .addSeparator()
        .addItem('🔄 Cập nhật thông tin Nhân sự đã chọn', 'updateBatchEmployees')
        .addSeparator()
        .addItem('🎂 Cập nhật sheet Sinh Nhật (riêng)', 'updateBirthdayOnly')
        .addSeparator()
        .addItem('🗑️ Xóa Nhân Sự', 'deleteStaff')
        .addSeparator()
        .addItem('📅 Cài đặt Trigger thâm niên hàng tháng', 'installMonthlyTrigger')
        .addSeparator()
        .addItem('🎂 Cài đặt Trigger Sinh nhật', 'openBirthdayTriggerSettings')
        .addSeparator()
        .addItem('📖 Hướng dẫn sử dụng', 'showUserGuide')
        .addToUi();
}


/**
 * Hiển thị hướng dẫn sử dụng dưới dạng HTML Dialog.
 */
function showUserGuide() {
    const html = HtmlService.createHtmlOutput(`
<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #333; padding: 16px; line-height: 1.6; }
    h2 { color: #1a73e8; margin-top: 0; border-bottom: 2px solid #1a73e8; padding-bottom: 6px; }
    h3 { color: #333; margin-bottom: 4px; margin-top: 18px; }
    .section { background: #f8f9fa; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; border-left: 4px solid #1a73e8; }
    .section.green { border-left-color: #34a853; }
    .section.orange { border-left-color: #ea8600; }
    .section.red { border-left-color: #ea4335; }
    .step { margin: 4px 0; }
    .step b { color: #1a73e8; }
    .warn { background: #fff3cd; padding: 8px 12px; border-radius: 6px; margin-top: 10px; font-size: 12px; }
    .note { background: #e8f5e9; padding: 8px 12px; border-radius: 6px; margin-top: 10px; font-size: 12px; }
    code { background: #e8eaed; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .footer { margin-top: 20px; text-align: center; font-size: 11px; color: #999; }
</style>

<h2>📖 Hướng Dẫn Sử Dụng Công Cụ Nhân Sự</h2>

<p>Tất cả chức năng đều hỗ trợ <b>chọn nhiều người cùng lúc</b> bằng cách tích ☑️ vào <b>Cột N (Checkbox)</b>.<br>
Nếu không tích checkbox, hệ thống sẽ lấy theo dòng bạn đang click.</p>

<!-- ========== ĐỒNG BỘ NHÂN SỰ ========== -->
<div class="section green">
    <h3>➕ Đồng bộ Nhân Sự Mới</h3>
    <div class="step"><b>Bước 1:</b> Điền đầy đủ thông tin nhân viên mới vào bảng Staff Info (Tên, Công ty, Phòng ban, Chức vụ, Giới tính, Ngày vào...).</div>
    <div class="step"><b>Bước 2:</b> Tích ☑️ vào <b>Cột N</b> của những người cần thêm (có thể chọn nhiều người).</div>
    <div class="step"><b>Bước 3:</b> Vào menu <code>⚙️ CÔNG CỤ NHÂN SỰ</code> → chọn <code>➕ Đồng bộ Nhân Sự Mới</code>.</div>
    <div class="step"><b>Kết quả:</b></div>
    <ul style="margin-top:2px">
        <li>Hệ thống tự tạo Mã ID duy nhất cho từng người.</li>
        <li>Tự chèn dữ liệu vào file <b>Working Time</b> (đúng vùng công ty ADD/VPA).</li>
        <li>Tự chèn vào file <b>Thưởng Lễ</b> (New Year Eve, 2/9, Labour Day) với mức thưởng phù hợp.</li>
        <li>Tự đánh lại <b>cột STT</b> (1, 2, 3...) cho toàn bộ bảng.</li>
    </ul>
    <div class="note">💡 <b>Lưu ý:</b> Người đã có Mã ID sẽ tự động được bỏ qua, không bị tạo trùng.</div>
</div>

<!-- ========== Cập Nhật Thông Tin ========== -->
<div class="section orange">
    <h3>🔄 Cập nhật thông tin Nhân Sự đã chọn</h3>
    <div class="step"><b>Bước 1:</b> Sửa thông tin nhân viên trực tiếp trong bảng Staff Info (VD: đổi tên, đổi công ty, phòng ban, giới tính, ngày vào...).</div>
    <div class="step"><b>Bước 2:</b> Tích ☑️ vào <b>Cột N</b> của những người vừa sửa.</div>
    <div class="step"><b>Bước 3:</b> Vào menu <code>⚙️ CÔNG CỤ NHÂN SỰ</code> → chọn <code>🔄Cập nhật thông tin Nhân sự đã chọn</code>.</div>
    <div class="step"><b>Kết quả:</b></div>
    <ul style="margin-top:2px">
        <li>Cập nhật <b>Tên, Giới tính, Công ty, Phòng ban</b> sang file Working Time.</li>
        <li>Nếu Công ty thay đổi (VD: ADD → VPA), hệ thống sẽ <b>tự dời nhân viên sang đúng vùng công ty mới</b>.</li>
        <li>Cập nhật <b>Tên, Ngày vào công ty</b> sang file Thưởng Lễ.</li>
    </ul>
    <div class="warn">⚠️ <b>Quan trọng:</b> Nhân viên phải có Mã ID mới đồng bộ được. Người chưa có ID sẽ bị bỏ qua.</div>
</div>

<!-- ========== XÓA NHÂN SỰ ========== -->
<div class="section red">
    <h3>🗑️ Xóa Nhân Sự</h3>
    <div class="step"><b>Bước 1:</b> Tích ☑️ vào <b>Cột N</b> của những người cần xóa (có thể chọn nhiều người).</div>
    <div class="step"><b>Bước 2:</b> Vào menu <code>⚙️ CÔNG CỤ NHÂN SỰ</code> → chọn <code>🗑️ Xóa Nhân Sự</code>.</div>
    <div class="step"><b>Bước 3:</b> Hệ thống hiện bảng xác nhận danh sách người sẽ bị xóa → nhấn <b>Yes</b> để xác nhận.</div>
    <div class="step"><b>Kết quả:</b></div>
    <ul style="margin-top:2px">
        <li>Xóa dòng trong <b>Staff Info</b>.</li>
        <li>Xóa dữ liệu liên quan trong file <b>Working Time</b>.</li>
        <li>Xóa dữ liệu liên quan trong file <b>Thưởng Lễ</b> (3 sheet).</li>
        <li>Tự đánh lại <b>cột STT</b> cho toàn bộ bảng.</li>
    </ul>
    <div class="warn">⛔ <b>Cảnh báo:</b> Hành động xóa KHÔNG THỂ hoàn tác! Hãy chắc chắn trước khi nhấn Yes.</div>
</div>

<!-- ========== LƯU Ý CHUNG ========== -->
<div class="section">
    <h3>📌 Lưu Ý Chung</h3>
    <ul>
        <li>Tất cả chức năng đều dùng <b>Cột N (Checkbox)</b> để chọn người. Nếu quên tick, hệ thống lấy dòng đang click.</li>
        <li>Sau khi chạy xong, checkbox sẽ <b>tự động bỏ tích</b>.</li>
        <li>Khi thêm/xóa xong, cột <b>STT (cột A)</b> sẽ tự đánh lại từ 1 đến người cuối cùng.</li>
        <li>Vui lòng <b>chờ cho đến khi có thông báo kết quả</b>. Không thao tác gì khác trong lúc hệ thống đang xử lý.</li>
    </ul>
</div>

<div class="footer">⚙️ Công Cụ Nhân Sự — Boosttrap HR System</div>
    `)
        .setWidth(580)
        .setHeight(680);

    SpreadsheetApp.getUi().showModalDialog(html, '📖 Hướng Dẫn Sử Dụng');
}

