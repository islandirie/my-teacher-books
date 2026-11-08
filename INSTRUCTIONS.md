# 📚 My Teacher Books — Teacher User Manual

Welcome to **My Teacher Books**! This application was built specifically for elementary classroom teachers to manage their classroom book collections and let students independently check out books in seconds.

---

## 🌟 Key Features
- **100% Teacher-Managed & Free:** No accounts, no passwords, no subscriptions, and zero maintenance.
- **Works Offline:** All your books, students, and loans stay safely stored right inside your web browser (IndexedDB). Flurries of school Wi-Fi outages will never interrupt reading time.
- **Kid-Friendly Kiosk:** Designed for grades K–5 with big picture avatars, bold colors, animated celebration graphics (🚀 🦕 ⭐), and cheerful audio chimes.
- **Your Data Stays Yours:** Export your entire catalog to CSV (Excel/Google Sheets) anytime, or transfer your library to a new device with one click.
- **Multiple Libraries:** Keep separate libraries for your classroom, home shelf, book club, or any reading group — switch between them from the dashboard.
- **Cross-Device Sync (optional):** Sign in with Google to keep the same book catalog on your phone, tablet, and computer, all through your own Google Sheet.

---

## 🚀 Quick Start (First-Time Setup)

### 1. Open the App
Open **https://myteacherbooks.com** in Safari, Chrome, or Edge on your phone, tablet, or laptop. The first time, it asks for the Teacher PIN (factory default **`1234`**).

> **Coming from an earlier address (like a test link)?** Your books live in the browser on the address where you entered them, so the new site starts empty. On the old address go to **Settings & Backup → Download Full Backup (JSON)**, then on https://myteacherbooks.com restore it (see *Backups & Moving to a New Device* below).

### 2. Install to Your Home Screen (Optional but Recommended)
- **On Chromebook/Android/Laptop:** Look for the **"Install App"** button in the teacher dashboard header. It appears when Chrome offers to install the app, usually after you have used the page for a little while. You can also tap the browser menu (three dots) and click **"Install My Teacher Books"** or **"Add to Home Screen"**.
- **On iPad/iPhone:** Tap the **Share** button in Safari, scroll down, and tap **"Add to Home Screen"**. The Install App button does not appear on iPad or iPhone.
- Now it opens full-screen just like a native app, even with no internet connection!

---

## 👩‍🏫 Teacher Dashboard Guide

The app starts in **Teacher Admin** mode. Opening the dashboard asks for the **Teacher PIN** (default `1234`, changeable in Settings). The PIN is asked again in each new browser tab, but a page reload in the same tab does not ask again.

### 📂 Managing Multiple Libraries
At the top of the dashboard, next to the app logo, you'll see a library selector. My Teacher Books starts you with **"Library 1"**, but you can:

- **Switch libraries:** Use the dropdown selector to switch between your libraries. Each library keeps its own books, students, loans, settings, and kiosk.
- **Create a new library:** Tap **"+ New Library"** and give it a name (e.g., *Room 14*, *Home Shelf*, *Summer Book Club*).
- **Rename a library:** Tap the **✏️ pencil icon** next to the selector to rename the active library.

Use the tabs along the top to manage the selected library:

### 1. 📚 Books Catalog
- **Add a Book Manually:** Tap **"+ Add Book"**. Type the title and author, pick a bin location (e.g., "Bin 3 - Animals"), and tap **"Add to Library"**. If you type an ISBN barcode, tap **"Lookup"** to auto-fetch the title, author, illustrator, and cover!
- **Scan Shelf (Continuous Mode):** Tap **"Scan Shelf"**. Point your phone or tablet camera at book barcodes one after another. The app automatically fetches the details and adds each book with a pleasant beep.
- **Duplicate Copies:** If you own 3 copies of *Charlotte's Web*, the app tracks `2 of 3 on shelf`. When students check them out, the count updates automatically without needing custom stickers.

### 2. 👥 Student Roster
- Tap **"Add Student"**.
- Enter the student's first name and optional last initial (e.g., `Mia K.`).
- Pick a friendly avatar mascot (🐶, 🐱, 🚀, 🦖, ⭐, 🦄) and a badge color. For kindergarten and 1st graders who are still learning to read, this visual cue makes finding their tile effortless.
- *(Optional)* Add a personal 4-digit PIN if you want older students to confirm their identity.

### 3. ⏱️ Circulation & Loans
- See all currently borrowed books, who has them, and how many days they've been checked out.
- Overdue books are automatically highlighted with an alert badge.
- View your classroom's **"Favorites Leaderboard"** to see which books are read the most.

### 4. ⚙️ Settings & Backup
- **Appearance & Theme:** Choose between the crisp daylight **Light Theme** and the eye-friendly **Midnight Dark** theme. You can toggle themes instantly with one click using the Sun/Moon button (☀️/🌙) in the dashboard header.
- **Teacher Admin PIN:** Set your private 4-digit PIN (default is `1234`). You will need this PIN to exit Student Kiosk mode.
- **Kiosk Entry Mode:**
  - *Class-Wide Gate PIN (Default):* All students enter a simple class code (default `1234`) to unlock the kiosk.
  - *Individual Student PIN:* Each student enters their own PIN before checking out.
  - *Open:* Students simply tap their avatar tile directly.
- **Loan Policies:** Set checkout limits (e.g., 2 books at a time), the default loan period (7 days, 14 days, or no due date), and the **Max Copies Per Book** upper limit (default 10) used when adding or editing books.
- **Celebration Theme:** Choose your classroom celebration mascot (🚀 Rocket, 🦕 Dinosaur, ⭐ Star, 🐛 Bookworm, 🦄 Unicorn) and customize the congratulations message.

---

## ☁️ Google Account Sync (Cross-Device — Optional)

If you want the same book catalog on your phone, tablet, and classroom computer, sign in with Google in the **Google Account Sync** section of Settings. Sync runs **only when you tap "Sync Now"** — nothing is sent unless you choose to, and checkouts and returns never trigger network calls.

### How it works:
1. In Settings, under **Google Account Sync**, tap **Sign in with Google**.
2. After signing in, tap **Sync Now**. The app finds or creates a spreadsheet named `My Teacher Books – <your library name>` in your Google Drive and syncs your book catalog into its **Books** tab.
3. On another device, sign in with the same Google account, make sure your library has the same name, and tap **Sync Now**. The app finds the existing sheet and pulls your books.

> **Syncing is manual only** — you must tap "Sync Now" each time you want to share changes. Google sign-in tokens expire after about an hour, so you may be asked to re-approve when you tap Sync Now. This prompt only appears on that click, never in the student kiosk.

### What syncs:
- **Books:** The whole catalog (title, author, copies, on-shelf availability, and borrowing stats) syncs across all your devices.
- **Loans (opt-in):** If you turn on **"Include who checked out each book"** in the Loan Policies section, loans also sync, so any device can show which student has each book. Only the student's first name and last initial are shared, in your own Google Sheet.

### What does NOT sync:
- The student roster (names, avatars, PINs, colors) stays on each device.
- The **Teacher PIN** and settings stay local per device.

### If you prefer no sign-in:
The legacy **Google Sheets Webhook** (one-way push) remains available just below the Account Sync section. Paste an Apps Script URL and tap **Sync Now** — no Google sign-in required.

---

## 🧒 Student Kiosk Mode (Daily Classroom Use)

Station an iPad or tablet near your classroom bookshelf:

1. On the Teacher Dashboard, tap the purple **"🚀 Launch Student Kiosk"** button.
2. The interface locks into full-screen child mode. Administrative tabs, edit buttons, and deletion controls are completely hidden.

### How a Student Checks Out a Book:
1. Student enters the class code (if enabled).
2. Student taps their large avatar card from the grid.
3. Student taps **"Scan Book to Check Out"**.
4. Student points the camera at the book's barcode.
5. **Celebration!** Confetti flies, a cheerful chime plays, and a message appears (*"Great choice, Mia! Enjoy reading Charlotte's Web!"*).
6. The screen automatically resets after 3 seconds for the next classmate in line.

### How a Student Returns a Book:
- **Scan-First (Quick Return Bin):** Tap the green **"Returning a Book? Tap Here!"** button and scan the barcode. The book is instantly marked returned!
- **From Profile:** Tap their name → see their borrowed books → tap **"Return"**.

### Exiting Kiosk Mode (Teacher Only):
- Tap the **Padlock icon (🔒)** in the top right corner.
- Enter your 4-digit Teacher PIN (`1234` by default).
- You are returned safely to the Teacher Dashboard.

---

## 💾 Backups & Moving to a New Device

Because your data lives in your device's browser, you should periodically download a backup:

### To Back Up:
1. Go to **Settings & Backup**.
2. Tap **"Export Books (CSV)"** or **"Export Loan History (CSV)"** to open your library in Google Sheets or Microsoft Excel.
3. Tap **"Download Full Backup (JSON)"** to save a complete, restorable snapshot file to your computer or Google Drive.

### To Move to a New iPad or Laptop:
1. Open My Teacher Books on the new device.
2. Go to **Settings & Backup**.
3. Under *Data Backup & Migration*, tap **"Restore Entire Database from JSON Backup"** and select your backup file.
4. All your books, students, loan history, and settings will instantly appear on the new device!

> **Tip:** The full JSON backup saves all your libraries at once. So does Google Account Sync — after restoring, each library that had sync enabled will reconnect to its sheet when you Sync Now.

---

## ❓ Frequently Asked Questions (FAQ)

**Q: Does this cost anything?**  
**A:** No. My Teacher Books is free for teachers, with no accounts, subscriptions, or fees. It is open-source, and your data stays on your own device.

**Q: What if our school Wi-Fi goes down?**  
**A:** My Teacher Books continues running with full functionality offline. Checkouts, returns, roster management, and local searches all work without an internet connection. Only online barcode metadata lookups require Wi-Fi.

**Q: I forgot my Teacher PIN! How do I get back in?**  
**A:** Don't panic — your PIN lives in the app's local data, and you can reset it in about two minutes:
1. **Back up first if you can't remember the last time you did:** skip to step 2 if you have no backup — without the PIN you can't export from inside the app.
2. **Erase the app's local data:** if you installed the app, delete it from your home screen; if you use it in a browser, clear the site's data in browser settings.
3. **Reopen the app** and sign in with the factory PIN `1234`.
4. **Restore your latest JSON backup** (see *Backups & Moving to a New Device* above) to bring your books, students, and loans back.
5. **Right away**, go to *Settings → Teacher Admin PIN* and set a PIN you'll remember — the restore also restores your old PIN!

**Q: Is student privacy protected (FERPA/COPPA)?**  
**A:** Yes. The student roster (names, avatars, PINs, colors) never leaves your device. If you turn on "Include who checked out each book" in the Loan Policies section of Settings, only the student's first name and last initial (e.g., "Mia K.") appears on the synced loan rows inside your own Google Sheet. The setting is off by default and per library. A school Google account is recommended when the setting is on.

**Q: Can I share my library with another teacher?**  
**A:** Yes — if you both sign in with the same Google account and give your library the same name, the book catalog syncs between your devices. Or use the **Google Sheets Webhook** (no sign-in needed) to push your books one-way to a shared Google Sheet.

**Q: Google says sign-in is blocked by my administrator. What now?**  
**A:** Some school Google accounts don't allow third-party apps. Ask your IT administrator to allow My Teacher Books, or sign in with a personal Google account. Signing in is optional — the app works fully without it, and you can still move your data with the JSON backup.

**Q: What if a book doesn't have a barcode or isn't found online?**  
**A:** Tap **"+ Add Book"** in the catalog. You can type in any title, author, and bin location manually, and even snap a photo of the book cover with your phone camera!

**Q: What is the default Teacher PIN?**  
**A:** `1234`. You can change this to any 4-digit code in the **Settings & Backup** tab.