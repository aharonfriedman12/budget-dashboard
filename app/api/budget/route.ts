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

// MM-YYYY -> מספר להשוואה ומיון (YYYYMM)
const monthOrder = (key: string) => {
  const [m, y] = key.split('-');
  return Number(y) * 100 + Number(m);
};
// MM-YYYY של החודש הקודם
const prevMonthKey = (key: string) => {
  const [m, y] = key.split('-').map(Number);
  return m === 1 ? `12-${y - 1}` : `${String(m - 1).padStart(2, '0')}-${y}`;
};

const parseCurrency = (val: unknown) => Number(String(val ?? '0').replace(/[^0-9.-]+/g, '')) || 0;
const cleanKey = (val: unknown) => String(val ?? '').replace(/^'/, '').trim();

function categoryStyle(name: string) {
  let icon = '🛒'; let iconBg = 'bg-gray-50'; let color = 'bg-green-500';
  if (name.includes('סופר')) { icon = '🛒'; iconBg = 'bg-green-50'; }
  if (name.includes('מסעדות')) { icon = '🍔'; iconBg = 'bg-orange-50'; }
  if (name.includes('קניות')) { icon = '🛍️'; iconBg = 'bg-purple-50'; }
  if (name.includes('חופשות')) { icon = '✈️'; iconBg = 'bg-red-50'; color = 'bg-orange-400'; }
  if (name.includes('דלק')) { icon = '⛽'; iconBg = 'bg-gray-50'; }
  return { icon, iconBg, color };
}

export async function GET(request: Request) {
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
      ranges: [
        "'סיכום_מצב'!A:G",
        "'מעקב תקציב שבועי ויעדי פרישה'!A:F",
        "'יעדים_חודשיים'!A:F",
        "'ארכיון_ביצועים'!A:H",
        "'ניודים'!A:F",
      ],
    });

    const summaryRows = response.data.valueRanges?.[0]?.values || [];
    const transactionRows = response.data.valueRanges?.[1]?.values || [];
    const targetRows = response.data.valueRanges?.[2]?.values || [];
    const archiveRows = (response.data.valueRanges?.[3]?.values || []).slice(1);
    const transferRows = (response.data.valueRanges?.[4]?.values || []).slice(1);

    if (summaryRows.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו נתוני סיכום. ודא שללשונית קוראים סיכום_מצב' }, { status: 404 });
    }

    const currentMonth = israelMonthKey(0);
    const nextMonth = israelMonthKey(1);

    // חודשים זמינים לניווט: מהחודש הראשון בארכיון ועד החודש הנוכחי
    const availableMonths = Array.from(new Set(archiveRows.map(r => cleanKey(r[0])).filter(k => /^\d{2}-\d{4}$/.test(k))))
      .filter(k => monthOrder(k) <= monthOrder(currentMonth))
      .sort((a, b) => monthOrder(a) - monthOrder(b));
    if (!availableMonths.includes(currentMonth)) availableMonths.push(currentMonth);

    const requested = cleanKey(new URL(request.url).searchParams.get('month'));
    const selectedMonth = availableMonths.includes(requested) ? requested : currentMonth;
    const isPastMonth = selectedMonth !== currentMonth;

    // שורת ארכיון לפי חודש וקטגוריה
    const archiveRow = (month: string, name: string) =>
      archiveRows.find(r => cleanKey(r[0]) === month && String(r[1] ?? '').trim() === name.trim());

    const categories = [];
    let totalBudget = 0;
    let totalSpent = 0;
    let totalLeft = 0;

    // סדר הקטגוריות נלקח תמיד מ-סיכום_מצב, כדי שהתצוגה תהיה עקבית בין חודשים
    for (let i = 1; i <= 5; i++) {
      const row = summaryRows[i];
      if (!row || !row[0]) continue;
      const name = String(row[0]);

      // target = יעד אחרי ניודים (עמודה G), targetOriginal = היעד שנקבע (עמודה B).
      // הארכיון והממוצע נשארים על היעד המקורי.
      let target: number, targetOriginal: number, spent: number, left: number, avg: number, carry: number;
      if (!isPastMonth) {
        targetOriginal = parseCurrency(row[1]);
        target = row[6] != null && String(row[6]).trim() !== '' ? parseCurrency(row[6]) : targetOriginal;
        spent = parseCurrency(row[2]);
        left = parseCurrency(row[3]);
        avg = parseCurrency(row[4]);   // ממוצע (מתוך ארכיון_ביצועים)
        carry = parseCurrency(row[5]); // יתרה נגררת מהחודש הקודם (מידע בלבד)
      } else {
        // חודש שעבר: הנתונים מהארכיון. ממוצע ויתרה נגררת — מהשורה של החודש שלפניו, כמו בחודש הנוכחי
        const a = archiveRow(selectedMonth, name);
        const p = archiveRow(prevMonthKey(selectedMonth), name);
        target = parseCurrency(a?.[2]);
        targetOriginal = target;
        spent = parseCurrency(a?.[3]);
        left = parseCurrency(a?.[4]);
        avg = parseCurrency(p?.[5]);
        carry = parseCurrency(p?.[4]);
      }

      const pct = target > 0 ? Math.round((spent / target) * 100) : 0;
      categories.push({ name, target, targetOriginal, spent, left, avg, carry, ...categoryStyle(name), pct });

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
          category: String(row[2] || '').trim(),
          amount: parseCurrency(row[4]),
        });
      }
    }

    // עסקאות החודש הנבחר בלבד (התאריך בגיליון בפורמט dd/mm/yyyy)
    const monthTransactions = recentTransactions.filter(tx => {
      const [, m, y] = String(tx.date).split('/');
      return m && y && `${m.padStart(2, '0')}-${y.trim().slice(0, 4)}` === selectedMonth;
    });
    const monthTotal = monthTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    // יעדים קיימים לחודש הנוכחי ולחודש הבא (לטובת מילוי מראש של חלון העריכה)
    const targets: Record<string, Record<string, number>> = {};
    for (const row of targetRows.slice(1)) {
      const key = cleanKey(row?.[0]);
      if ((key === currentMonth || key === nextMonth) && !targets[key]) {
        targets[key] = Object.fromEntries(TARGET_KEYS.map((k, idx) => [k, parseCurrency(row[idx + 1])]));
      }
    }

    // ניודים של החודש הנבחר (מהחדש לישן)
    const transfers = transferRows
      .filter(r => cleanKey(r?.[1]) === selectedMonth && r?.[2] && r?.[3])
      .map(r => ({
        date: String(r[0] ?? ''),
        from: String(r[2]).trim(),
        to: String(r[3]).trim(),
        amount: parseCurrency(r[4]),
        reason: String(r[5] ?? '').trim(),
      }))
      .reverse();

    return NextResponse.json({
      categories,
      transfers,
      totalBudget,
      totalSpent,
      totalLeft,
      recentTransactions,
      monthTransactions,
      monthTotal,
      currentMonth,
      nextMonth,
      selectedMonth,
      isPastMonth,
      availableMonths,
      targets,
      isNextMonthPrepared: Boolean(targets[nextMonth]),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
