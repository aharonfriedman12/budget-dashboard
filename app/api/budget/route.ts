import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// מפתחות היעדים לפי סדר העמודות B..F בלשונית יעדים_חודשיים
const TARGET_KEYS = ['super', 'restaurants', 'shopping', 'vacation', 'transport'] as const;

// מחזיר מפתח חודש בפורמט MM-YYYY לפי שעון ישראל (השרת של Vercel רץ ב-UTC)
function israelMonthKey(offset = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  let year = Number(parts.find(p => p.type === 'year')?.value);
  let monthIndex = Number(parts.find(p => p.type === 'month')?.value) - 1 + offset;
  year += Math.floor(monthIndex / 12);
  monthIndex = ((monthIndex % 12) + 12) % 12;
  return `${String(monthIndex + 1).padStart(2, '0')}-${year}`;
}

const parseCurrency = (val: unknown) => Number(String(val ?? '0').replace(/[^0-9.-]+/g, '')) || 0;

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.SPREADSHEET_ID,
      ranges: ["'סיכום_מצב'!A:F", "'מעקב תקציב שבועי ויעדי פרישה'!A:F", "'יעדים_חודשיים'!A:F"],
    });

    const summaryRows = response.data.valueRanges?.[0]?.values || [];
    const transactionRows = response.data.valueRanges?.[1]?.values || [];
    const targetRows = response.data.valueRanges?.[2]?.values || [];

    if (summaryRows.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו נתוני סיכום. ודא שללשונית קוראים סיכום_מצב' }, { status: 404 });
    }

    const categories = [];
    let totalBudget = 0;
    let totalSpent = 0;
    let totalLeft = 0;

    for (let i = 1; i <= 5; i++) {
      const row = summaryRows[i];
      if (!row || !row[0]) continue;

      const name = row[0];
      const target = parseCurrency(row[1]);
      const spent = parseCurrency(row[2]);
      const left = parseCurrency(row[3]);
      const avg = parseCurrency(row[4]);   // ממוצע רבעוני (מתוך ארכיון_ביצועים)
      const carry = parseCurrency(row[5]); // יתרה נגררת מהחודש הקודם (מידע בלבד)

      let icon = '🛒'; let iconBg = 'bg-gray-50'; let color = 'bg-green-500';
      if (name.includes('סופר')) { icon = '🛒'; iconBg = 'bg-green-50'; }
      if (name.includes('מסעדות')) { icon = '🍔'; iconBg = 'bg-orange-50'; }
      if (name.includes('קניות')) { icon = '🛍️'; iconBg = 'bg-purple-50'; }
      if (name.includes('חופשות')) { icon = '✈️'; iconBg = 'bg-red-50'; color = 'bg-orange-400'; }
      if (name.includes('דלק')) { icon = '⛽'; iconBg = 'bg-gray-50'; }

      const pct = target > 0 ? Math.round((spent / target) * 100) : 0;
      categories.push({ name, target, spent, left, avg, carry, icon, iconBg, color, pct });

      totalBudget += target;
      totalSpent += spent;
      totalLeft += left;
    }

    const recentTransactions = [];
    for (let i = transactionRows.length - 1; i >= 0; i--) {
      const row = transactionRows[i];
      if (row && row[0] && row[0].includes('/') && row[4]) {
        recentTransactions.push({
          id: i,
          date: row[0],
          desc: row[3] || row[2] || 'ללא תיאור',
          amount: parseCurrency(row[4]),
        });
      }
    }

    // יעדים קיימים לחודש הנוכחי ולחודש הבא (לטובת מילוי מראש של חלון העריכה)
    const currentMonth = israelMonthKey(0);
    const nextMonth = israelMonthKey(1);

    // עסקאות החודש הנוכחי בלבד (התאריך בגיליון בפורמט dd/mm/yyyy)
    const monthTransactions = recentTransactions.filter(tx => {
      const [, m, y] = String(tx.date).split('/');
      return m && y && `${m.padStart(2, '0')}-${y.trim().slice(0, 4)}` === currentMonth;
    });
    const monthTotal = monthTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const targets: Record<string, Record<string, number>> = {};
    for (const row of targetRows.slice(1)) {
      const key = String(row?.[0] ?? '').replace(/^'/, '').trim();
      if ((key === currentMonth || key === nextMonth) && !targets[key]) {
        targets[key] = Object.fromEntries(TARGET_KEYS.map((k, idx) => [k, parseCurrency(row[idx + 1])]));
      }
    }

    return NextResponse.json({
      categories,
      totalBudget,
      totalSpent,
      totalLeft,
      recentTransactions,
      monthTransactions,
      monthTotal,
      currentMonth,
      nextMonth,
      targets,
      isNextMonthPrepared: Boolean(targets[nextMonth]),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
