"use client";
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, RefreshCw, Wallet, CalendarDays, History, X } from 'lucide-react';

export default function BudgetDashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // ניהול חלונות קופצים (Modals)
  const [showNextMonthModal, setShowNextMonthModal] = useState(false);
  const [showAllTxModal, setShowAllTxModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [nextTargets, setNextTargets] = useState({
    super: '',
    restaurants: '',
    shopping: '',
    vacation: '',
    transport: ''
  });

  const fetchBudget = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/budget');
      const result = await res.json();
      if (res.ok) setData(result);
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchBudget(); }, []);

  const today = new Date();
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthString = `${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${nextMonthDate.getFullYear()}`;

  const handleSaveNextMonth = async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/next-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: nextMonthString, targets: nextTargets })
      });
      alert('היעדים לחודש הבא נשמרו בהצלחה בגיליון!');
      setShowNextMonthModal(false);
    } catch (error) {
      alert('שגיאה בשמירת היעדים');
    }
    setIsSubmitting(false);
  };

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 font-bold" dir="rtl">
        <div>{isLoading ? '...טוען נתונים' : 'שגיאה בטעינת נתונים (נסה לרענן)'}</div>
      </div>
    );
  }

  const timeProgress = Math.round((today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) * 100);
  const budgetProgress = data?.totalBudget ? Math.round((data.totalSpent / data.totalBudget) * 100) : 0;

  // פונקציית עזר לעיצוב כרטיסיית קטגוריה לפי אחוזי ניצול
  const getCategoryStyle = (pct: number) => {
    if (pct >= 85) return "bg-red-50 border-red-100";
    if (pct >= 60) return "bg-orange-50 border-orange-100";
    return "bg-white border-slate-100"; // תקין ובטוח
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center pb-6 font-sans" dir="rtl">
      <div className="w-full max-w-md bg-white shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white rounded-b-[2.5rem] shadow-lg relative">
          <div className="flex justify-between items-center mb-4">
            <RefreshCw className={`w-5 h-5 text-slate-400 cursor-pointer ${isLoading ? 'animate-spin' : ''}`} onClick={fetchBudget} />
            <h1 className="text-lg font-bold tracking-wide">תקציב אישי</h1>
            <Wallet className="w-5 h-5 text-slate-400" />
          </div>
          
          <div className="flex justify-center items-center space-x-3 space-x-reverse mb-6">
            <ChevronRight className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
            <span className="text-sm font-semibold tracking-wider bg-slate-800 px-4 py-1 rounded-full border border-slate-700">
              {today.getMonth() + 1}/{today.getFullYear()}
            </span>
            <ChevronLeft className="w-4 h-4 cursor-pointer text-slate-400 hover:text-white" />
          </div>
          
          <div className="text-center mb-6">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-widest">יתרה זמינה</p>
            <h2 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-300">
              ₪{data?.totalLeft?.toLocaleString() || 0}
            </h2>
          </div>
          
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 backdrop-blur-sm">
             <div className="mb-3">
               <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                 <span>זמן חודש ({today.getDate()}/30)</span><span>{timeProgress}%</span>
               </div>
               <div className="w-full bg-slate-950 rounded-full h-1">
                 <div className="bg-blue-400 h-1 rounded-full" style={{ width: `${timeProgress}%` }}></div>
               </div>
             </div>
             <div>
               <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                 <span>ניצול ₪{data?.totalSpent?.toLocaleString() || 0} / ₪{data?.totalBudget?.toLocaleString() || 0}</span>
                 <span>{budgetProgress}%</span>
               </div>
               <div className="w-full bg-slate-950 rounded-full h-1.5">
                 <div className="bg-emerald-400 h-1.5 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]" style={{ width: `${Math.min(budgetProgress, 100)}%` }}></div>
               </div>
             </div>
          </div>
        </div>

        <div className="px-5 mt-6">
            {/* פעולות אחרונות - מקוצר */}
            <div className="flex justify-between items-end mb-3 px-1">
                <span className="text-sm font-bold text-slate-800">פעולות אחרונות</span>
                <span 
                  onClick={() => setShowAllTxModal(true)}
                  className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center cursor-pointer active:bg-blue-100 transition-colors">
                  <History className="w-3 h-3 ml-1"/> צפה הכל
                </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-2 space-y-2.5">
                {data?.recentTransactions?.slice(0, 3).map((tx: any) => (
                    <div key={tx.id} className="flex justify-between items-center text-sm border-b border-slate-50 last:border-0 pb-2.5 last:pb-1">
                        <div className="flex items-center space-x-3 space-x-reverse">
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-medium border border-slate-100">{tx.date?.split('/')[0] || ''}</div>
                            <span className="font-semibold text-slate-700">{tx.desc}</span>
                        </div>
                        <span className="font-bold text-slate-900 tracking-tight">₪{tx.amount?.toLocaleString() || 0}</span>
                    </div>
                ))}
            </div>

            {/* קטגוריות גריד - צבעוני חכם */}
            <div className="mt-6">
                <span className="text-sm font-bold text-slate-800 px-1 mb-3 block">קטגוריות</span>
                <div className="grid grid-cols-2 gap-3">
                    {data?.categories?.map((cat: any, idx: number) => (
                        <div key={idx} className={`border p-3.5 rounded-2xl shadow-sm relative overflow-hidden transition-colors ${getCategoryStyle(cat.pct)}`}>
                            <div className="flex justify-between items-start mb-4">
                                <span className={`text-lg ${cat.iconBg} rounded-xl p-1.5 bg-white shadow-sm`}>{cat.icon}</span>
                                <span className="text-[10px] font-bold text-slate-500 bg-white/70 px-2 py-0.5 rounded-full backdrop-blur-sm">{cat.pct}%</span>
                            </div>
                            <h3 className="text-xs font-bold text-slate-600 mb-0.5">{cat.name}</h3>
                            <div className={`font-black text-lg tracking-tight ${cat.pct >= 100 ? 'text-red-700' : 'text-slate-900'}`}>
                                ₪{cat.left?.toLocaleString() || 0}
                            </div>
                            <div className="absolute bottom-0 left-0 w-full bg-slate-900/5 h-1">
                                <div className={`${cat.pct >= 100 ? 'bg-red-500' : (cat.pct >= 60 ? 'bg-orange-400' : 'bg-slate-800')} h-1`} style={{ width: `${Math.min(cat.pct, 100)}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* הכנת תקציב לחודש הבא */}
            {timeProgress > 75 && (
                <div 
                  onClick={() => setShowNextMonthModal(true)}
                  className="mt-6 mb-6 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-95 transition-transform">
                    <div className="flex items-center space-x-3 space-x-reverse">
                        <CalendarDays className="text-blue-600 w-5 h-5" />
                        <div>
                            <h4 className="text-sm font-bold text-slate-900">הכן תקציב לחודש הבא</h4>
                            <p className="text-xs text-blue-700 font-medium">החודש מסתיים בעוד {30 - today.getDate()} ימים</p>
                        </div>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-blue-600" />
                </div>
            )}
        </div>

        {/* Modal: הזנת יעדים */}
        {showNextMonthModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end z-50">
            <div className="bg-white w-full rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900">יעדי {nextMonthString}</h3>
                <X className="w-6 h-6 text-slate-400 cursor-pointer hover:text-slate-700" onClick={() => setShowNextMonthModal(false)} />
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">סופר ומשק בית</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" onChange={e => setNextTargets({...nextTargets, super: e.target.value})} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">מסעדות בחוץ</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" onChange={e => setNextTargets({...nextTargets, restaurants: e.target.value})} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">קניות שונות</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" onChange={e => setNextTargets({...nextTargets, shopping: e.target.value})} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">חופשות ונופש</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" onChange={e => setNextTargets({...nextTargets, vacation: e.target.value})} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">דלק ותחבורה</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" onChange={e => setNextTargets({...nextTargets, transport: e.target.value})} />
                </div>
              </div>

              <button 
                onClick={handleSaveNextMonth}
                disabled={isSubmitting}
                className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-colors disabled:bg-slate-300">
                {isSubmitting ? 'שומר נתונים...' : 'עדכן תקציב'}
              </button>
            </div>
          </div>
        )}

        {/* Modal: כל העסקאות */}
        {showAllTxModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end z-50">
            <div className="bg-white w-full h-[85%] rounded-t-[2.5rem] p-6 shadow-2xl flex flex-col animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900">כל ההוצאות - ספטמבר</h3>
                <X className="w-6 h-6 text-slate-400 cursor-pointer hover:text-slate-700" onClick={() => setShowAllTxModal(false)} />
              </div>
              
              {/* רשימת גלילה לעסקאות */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {data?.recentTransactions?.map((tx: any) => (
                    <div key={tx.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-3 last:border-0">
                        <div className="flex items-center space-x-3 space-x-reverse">
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex flex-col items-center justify-center border border-slate-100">
                                <span className="text-xs font-bold text-slate-700">{tx.date?.split('/')[0]}</span>
                                <span className="text-[8px] font-medium text-slate-400">{tx.date?.split('/')[1]}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{tx.desc}</span>
                              {/* מציג את השעה אם קיימת, אם לא מציג טקסט ריק */}
                              <span className="text-[10px] text-slate-400">{tx.date}</span>
                            </div>
                        </div>
                        <span className="font-black text-slate-900 tracking-tight text-base">₪{tx.amount?.toLocaleString() || 0}</span>
                    </div>
                ))}
                {data?.recentTransactions?.length === 0 && (
                  <div className="text-center text-slate-500 mt-10">אין עסקאות החודש</div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}