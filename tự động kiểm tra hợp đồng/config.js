const BONUS_CONFIG = {
    SHEET_NAME: {
      NEW_YEAR_EVE: "New Year Eve",
      NATIONAL_DAY: "2/9",
      LABOUR_DAY: "Labour Day"
    },
  
    COLUMNS: {
      NAME: 1,
      COMPANY: 2,
      CONTRACT: 3,
      JOIN_DATE: 4,
      BONUS: 5,
      ID: 6
    },
  
    BONUS_RATES: {
      "New Year Eve": {
        "Chính thức trên 1 năm": 700000,
        "Chính thức dưới 1 năm": 500000,
        "Thử Việc": 300000,
        "Thực Tập": 300000
      },
      "2/9": {
        "Chính thức trên 1 năm": 500000,
        "Chính thức dưới 1 năm": 300000,
        "Thử Việc": 200000,
        "Thực Tập": 200000
      },
      "Labour Day": {
        "Chính thức trên 1 năm": 500000,
        "Chính thức dưới 1 năm": 300000,
        "Thử Việc": 200000,
        "Thực Tập": 200000
      }
    },
  
     SKIP_POSITION_CODES: ["CEO"],

    // =========================
    // Birthday notification
    // =========================
    BIRTHDAY: {
      SHEET_NAME_CANDIDATES: ["sinh nhật", "Sinh nhật", "Sinh Nhat"],
      // Sheet "sinh nhật": A Name, B Company, C Day, D Month, E Year, F Contract, G JoinDate, H Bonus, I ID
      COLUMNS: {
        NAME: 1,
        COMPANY: 2,
        DAY: 3,
        MONTH: 4,
        YEAR: 5,
        CONTRACT: 6,
        JOIN_DATE: 7,
        BONUS: 8,
        ID: 9
      },
      // ScriptProperties keys
      PROP_RECIPIENTS: "birthdayRecipients",
      PROP_HOUR: "birthdayHour",
      PROP_LAST_SENT_DATE: "birthdayLastSentDate"
    }
  };
  