import { NextResponse } from 'next/server';
import { google } from 'googleapis';

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
    
    // משיכת נתונים משתי לשוניות במקביל לחסכון בזמן
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.SPREADSHEET_ID,
      ranges: ['סיכום_מצב!A:F', "'מעקב תקציב שבועי ויעדי פרישה'!A:F"], 
    });

    const summaryRows = response.data.valueRanges?.[0]?.values || [];
    const transactionRows = response.data.valueRanges?.[1]?.values || [];

    if (summaryRows.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו נתוני סיכום. ודא שללשונית קוראים סיכום_מצב' }, { status: 404 });
    }

    const categories = [];
    let totalBudget = 0;
    let totalSpent = 0;
    let totalLeft = 0;

    const parseCurrency = (val: string) => Number(String(val).replace(/[^0-9.-]+/g,""));

    // קריאת 5 קטגוריות הסיכום (שורות 2 עד 6 בלשונית החדשה)
    for (let i = 1; i <= 5; i++) {
      const row = summaryRows[i];
      if (!row || !row[0]) continue;
      
      const name = row[0];
      const target = parseCurrency(row[1] || '0'); // עכשיו זה עמודה B
      const spent = parseCurrency(row[2] || '0');  // עמודה C
      const left = parseCurrency(row[3] || '0');   // עמודה D

      let icon = '🛒'; let iconBg = 'bg-gray-50'; let color = 'bg-green-500';
      if (name.includes('סופר')) { icon = '🛒'; iconBg = 'bg-green-50'; }
      if (name.includes('מסעדות')) { icon = '🍔'; iconBg = 'bg-orange-50'; }
      if (name.includes('קניות')) { icon = '🛍️'; iconBg = 'bg-purple-50'; }
      if (name.includes('חופשות')) { icon = '✈️'; iconBg = 'bg-red-50'; color = 'bg-orange-400'; }
      if (name.includes('דלק')) { icon = '⛽'; iconBg = 'bg-gray-50'; }

      const pct = target > 0 ? Math.round((spent / target) * 100) : 0;
      categories.push({ name, target, spent, left, icon, iconBg, color, pct });
      
      totalBudget += target;
      totalSpent += spent;
      totalLeft += left;
    }

    // חילוץ כל העסקאות מהלשונית המקורית (סריקה מהסוף להתחלה)
    const recentTransactions = [];
    for (let i = transactionRows.length - 1; i >= 0; i--) {
       const row = transactionRows[i];
       if (row && row[0] && row[0].includes('/') && row[4]) {
           recentTransactions.push({
               id: i,
               date: row[0],
               // פירוט העסק מעמודה D (אינדקס 3), ואם ריק לוקח מעמודה C
               desc: row[3] || row[2] || 'ללא תיאור',
               amount: parseCurrency(row[4])
           });
       }
    }

    return NextResponse.json({
       categories,
       totalBudget,
       totalSpent,
       totalLeft,
       recentTransactions
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}