import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  try {
    // 1. התחברות מאובטחת לגוגל
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // 2. משיכת כל עמודות A עד F
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'A:F', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'לא נמצאו נתונים' }, { status: 404 });
    }

    // 3. איתור דינמי של שורת הסיכום (הגנה מפני דחיפת שורות של Make)
    const summaryHeaderIndex = rows.findIndex(row => row[0] && row[0].includes('סיכום שבועי וחודשי'));
    
    if (summaryHeaderIndex === -1) {
      return NextResponse.json({ error: 'טבלת הסיכום לא נמצאה' }, { status: 404 });
    }

    const categories = [];
    let totalBudget = 0;
    let totalSpent = 0;
    let totalLeft = 0;

    // פונקציית עזר לניקוי סימני ₪ ופסיקים והמרה למספר
    const parseCurrency = (val: string) => Number(String(val).replace(/[^0-9.-]+/g,""));

    // 4. קריאת 5 קטגוריות הסיכום (עמודות: A=שם, D=יעד, E=בפועל, F=יתרה)
    for (let i = 1; i <= 5; i++) {
      const row = rows[summaryHeaderIndex + i];
      if (!row) continue;
      
      const name = row[0];
      const target = parseCurrency(row[3] || '0');
      const spent = parseCurrency(row[4] || '0');
      const left = parseCurrency(row[5] || '0');
      
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

    // 5. חילוץ 5 העסקאות האחרונות (סורק אחורה מהסיכום למעלה)
    const recentTransactions = [];
    for (let i = summaryHeaderIndex - 1; i >= 0; i--) {
       const row = rows[i];
       // בודק שיש תאריך בעמודה A וסכום בעמודה E
       if (row && row[0] && row[0].includes('/') && row[4]) {
           recentTransactions.push({
               id: i,
               date: row[0],
               desc: row[2] || 'ללא תיאור',
               amount: parseCurrency(row[4])
           });
       }
       if (recentTransactions.length >= 5) break;
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