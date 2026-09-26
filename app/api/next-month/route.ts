import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { month, targets } = body;

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // מוסיף אוטומטית את הגרש לטקסט החודש כדי שגוגל לא יהפוך אותו לתאריך
    const monthKey = `'` + month;
    
    // חישוב הסך הכל המתוכנן
    const total = Number(targets.super) + Number(targets.restaurants) + Number(targets.shopping) + Number(targets.vacation) + Number(targets.transport);

    // כותב שורה חדשה בגיליון תחת לשונית יעדים חודשיים
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'יעדים_חודשיים!A:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [
            monthKey, 
            targets.super, 
            targets.restaurants, 
            targets.shopping, 
            targets.vacation, 
            targets.transport, 
            total, 
            '' // סה"כ בפועל (יישאר ריק)
          ]
        ]
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving targets:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}