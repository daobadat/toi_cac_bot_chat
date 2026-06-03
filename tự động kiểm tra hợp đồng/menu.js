function onOpen() {
    SpreadsheetApp.getUi()
      .createMenu('⚙️ QUẢN LÝ THƯỞNG')
      .addItem('🔄 Kiểm tra & Cập nhật Hợp đồng', 'runContractCheck')
      .addSeparator()
      .addItem('⏰ Cài đặt Kiểm tra tự động', 'openTriggerSettings')
      .addItem('🎂 Cài đặt Thông báo Sinh nhật', 'openBirthdayTriggerSettings')
      .addToUi();
  }
  
  
  