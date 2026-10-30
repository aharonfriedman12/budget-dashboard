import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// שומר יעדים לחודש: אם כבר קיימת שורה לחודש — מעדכן אותה, אחרת מוסיף שורה חדשה.
// (הגיליון קורא את השורה הראשונה של כל חודש, ולכן אסור ליצור שורות כפולות)
const SHEET = "'יעדים_חודשיים'";
const KEYS = ['super', 'restaurants', 'shopping', 'vacation', 'transport'] as const;

export async function POST(request: Request) {
  try {
    const { month, targets } = await request.json();

    if (typeof month !== 'string' || !/^\d{2}-\d{4}$/.test(month)) {
      return NextResponse.json({ error: 'חודש לא תקין' }, { status: 400 });
    }
    const values = KEYS.map(k => Number(targets?.[k]));
    if (values.some(v => !Number.isFinite(v) || v < 0) || KEYS.some(k => targets?.[k] === '' || targets?.[k] == null)) {
      return NextResponse.json({ error: 'יש למלא סכום תקין בכל הקטגוריות' }, { status: 400 });
    }
    const total = values.reduce((a, b) => a + b, 0);

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // איתור שורה קיימת לחודש
    const colA = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SHEET}!A:A` });
    const rows = colA.data.values || [];
    const index = rows.findIndex(r => String(r?.[0] ?? '').replace(/^'/, '').trim() === month);

    // הגרש בתחילת החודש מונע מגוגל להפוך אותו לתאריך. עמודה H (סה"כ בפועל) לא נוגעים בה.
    const rowValues = [[`'${month}`, ...values, total]];

    if (index >= 1) {
      const rowNumber = index + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET}!A${rowNumber}:G${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rowValues },
      });
      return NextResponse.json({ success: true, mode: 'updated' });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET}!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rowValues },
    });
    return NextResponse.json({ success: true, mode: 'created' });
  } catch (error) {
    console.error('Error saving targets:', error);
    return NextResponse.json({ error: 'השמירה לגיליון נכשלה' }, { status: 500 });
  }
}
