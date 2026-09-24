"use client";

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, RefreshCw, Lightbulb } from 'lucide-react';

export default function BudgetDashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBudget = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/budget');
      const result = await res.json();
      if (res.ok) {
        setData(result);
      } else {
        console.error(result.error);
      }
    } catch (err) {
      console.error("שגיאה במשיכת נתונים", err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBudget();
  }, []);

  if (isLoading && !data) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-indigo-600 font-bold">טוען נתונים מהגיליון...</div>;
  }

  // חישוב התקדמות החודש
  const today = new Date();
  const timeProgress = Math.round((today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) * 100);
  const budgetProgress = data ? Math.round((data.totalSpent / data.totalBudget) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center p-4 font-sans" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        
        {/* Header & Hero */}
        <div className="bg-indigo-600 p-6 text-white text-center rounded-b-3xl shadow-md">
          <div className="flex justify-between items-center mb-5">
            <RefreshCw 
                className={`w-5 h-5 text-indigo-200 cursor-pointer ${isLoading ? 'animate-spin' : ''}`} 
                onClick={fetchBudget}
            />
            <h1 className="text-xl font-bold">מעקב תקציבי</h1>
            <div className="w-5 h-5"></div>
          </div>
          
          <div className="flex justify-center items-center space-x-4 space-x-reverse mb-6 bg-indigo-700/60 rounded-full py-1.5 px-5 w-max mx-auto">
            <ChevronRight className="w-4 h-4 cursor-pointer text-indigo-300 hover:text-white" />
            <span className="text-sm font-semibold tracking-wide">ספטמבר 2026</span>
            <ChevronLeft className="w-4 h-4 cursor-pointer text-indigo-300 hover:text-white" />
          </div>
          
          <p className="text-indigo-200 text-sm mb-1">יתרה לסוף החודש</p>
          <h2 className="text-5xl font-extrabold mb-5 tracking-tight drop-shadow-md">
            ₪{data?.totalLeft.toLocaleString()}
          </h2>
          
          <div className="text-right text-xs space-y-3 relative mt-2">
            <div>
              <div className="flex justify-between text-indigo-100 mb-1 font-medium">
                <span>זמן שעבר</span><span>{timeProgress}%</span>
              </div>
              <div className="w-full bg-indigo-900/50 rounded-full h-1.5">
                <div className="bg-indigo-300 h-1.5 rounded-full" style={{ width: `${timeProgress}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-indigo-100 mb-1 font-medium">
                <span>ניצול תקציב ({data?.totalSpent.toLocaleString()} מתוך {data?.totalBudget.toLocaleString()})</span>
                <span>{budgetProgress}%</span>
              </div>
              <div className="w-full bg-indigo-900/50 rounded-full h-2.5">
                <div className="bg-green-400 h-2.5 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.5)]" style={{ width: `${Math.min(budgetProgress, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 5 עסקאות אחרונות */}
        <div className="px-5 pt-6 pb-2">
            <div className="text-sm font-bold text-gray-500 mb-3 px-1">📝 5 עסקאות אחרונות:</div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                {data?.recentTransactions.map((tx: any) => (
                    <div key={tx.id} className="flex justify-between items-center text-sm border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                        <div className="flex items-center space-x-2 space-x-reverse">
                            <span className="text-gray-400 text-xs">{tx.date}</span>
                            <span className="font-medium text-gray-700 max-w-[120px] truncate">{tx.desc}</span>
                        </div>
                        <span className="font-bold text-gray-800">₪{tx.amount.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* כרטיסיות קטגוריות */}
        <div className="p-5 space-y-4">
          <div className="text-sm font-bold text-gray-500 mb-3 px-1">חלוקה לקטגוריות:</div>
          
          {data?.categories.map((cat: any, idx: number) => (
            <div key={idx} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm cursor-pointer">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <span className={`text-xl ${cat.iconBg} rounded-full p-1.5`}>{cat.icon}</span>
                  <h3 className="font-bold text-gray-700">{cat.name}</h3>
                </div>
                <span className={`font-bold text-lg ${cat.pct >= 100 ? 'text-red-600' : cat.pct > 85 ? 'text-orange-600' : 'text-gray-800'}`}>
                  ₪{cat.left.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mb-2 font-medium">
		<span>הוצאות: {cat.spent?.toLocaleString()} מתוך {cat.target?.toLocaleString()}</span>
                <span className={`font-bold ${cat.pct >= 100 ? 'text-red-500' : cat.pct > 85 ? 'text-orange-500' : 'text-green-600'}`}>{cat.pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className={`${cat.pct >= 100 ? 'bg-red-500' : cat.color} h-2 rounded-full`} style={{ width: `${Math.min(cat.pct, 100)}%` }}></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* תובנה יומית */}
        <div className="mx-5 mb-6 mt-1 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start space-x-3 space-x-reverse shadow-sm">
          <Lightbulb className="text-blue-500 w-6 h-6 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800 leading-snug font-medium">
            הנתונים מסונכרנים בזמן אמת מול הגיליון! {data?.totalLeft > 0 ? "אתה ביתרה חיובית מדהימה." : ""}
          </p>
        </div>

      </div>
    </div>
  );
}