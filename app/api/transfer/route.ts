import { google } from 'googleapis';
import { NextResponse } from 'next/server';

// ניוד תקציב בין קטגוריות. כל הכללים נאכפים כאן בשרת (לא רק בממשק):
// 1. רק בימים 15, 16, 25, 26 לחודש (שעון ישראל)
// 2. סכום אפס: יורד ממקור ונוסף ליעד, סה"כ התקציב לא משתנה
// 3. עד 20% מהיתרה הנוכחית של קטגוריית המקור (נקרא טרי מ-סיכום_מצב)
// השורה נרשמת בלשונית ניודים; סיכום_מצב!G מחשב ממנה את "יעד מעודכן". היעד המקורי והארכיון לא משתנים.
const TRANSFER_DAYS = [15, 16, 25, 26];
const CAP_RATIO = 0.2;

const parseCurrency = (val: unknown) => Number(String(val ?? '0').replace(/[^0-9.-]+/g, '')) || 0;

function israelToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return { day: Number(get('day')), dd: get('day'), mm: get('month'), yyyy: get('year') };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const from = String(body?.from ?? '').trim();
    const to = String(body?.to ?? '').trim();
    const amount = Math.round(Number(body?.amount));
    const reason = String(body?.reason ?? '').trim().slice(0, 120);

    const { day, dd, mm, yyyy } = israelToday();
    if (!TRANSFER_DAYS.includes(day)) {
      return NextResponse.json({ error: 'ניוד אפשרי רק ב-15–16 וב-25–26 לחודש' }, { status: 403 });
    }
    if (!from || !to || from === to) {
      return NextResponse.json({ error: 'יש לבחור שתי קטגוריות שונות' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'סכום לא תקין' }, { status: 400 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // יתרה עדכנית (עמודה D כבר כוללת ניודים קודמים של החודש)
    const summary = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'סיכום_מצב'!A2:D6" });
    const rows = summary.data.values || [];
    const fromRow = rows.find(r => String(r?.[0] ?? '').trim() === from);
    const toRow = rows.find(r => String(r?.[0] ?? '').trim() === to);
    if (!fromRow || !toRow) {
      return NextResponse.json({ error: 'קטגוריה לא מוכרת' }, { status: 400 });
    }

    const cap = Math.max(0, Math.floor(parseCurrency(fromRow[3]) * CAP_RATIO));
    if (amount > cap) {
      return NextResponse.json({ error: `הסכום עובר את התקרה: עד ₪${cap.toLocaleString()} (20% מהיתרה)` }, { status: 400 });
    }

    // הגרש לפני החודש שומר אותו כטקסט MM-YYYY (כמו ביעדים_חודשיים)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "'ניודים'!A:F",
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[`${dd}/${mm}/${yyyy}`, `'${mm}-${yyyy}`, from, to, amount, reason]] },
    });

    return NextResponse.json({ success: true, from, to, amount });
  } catch (error) {
    console.error('Transfer failed:', error);
    return NextResponse.json({ error: 'הניוד נכשל, נסה שוב' }, { status: 500 });
  }
}
