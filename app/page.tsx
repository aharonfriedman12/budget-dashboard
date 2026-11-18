"use client";
import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, RefreshCw, Wallet, CalendarDays, History, X, Edit3, Lightbulb } from 'lucide-react';

export default function BudgetDashboard() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // ניהול חלונות קופצים (Modals)
  const [showNextMonthModal, setShowNextMonthModal] = useState(false);
  const [showAllTxModal, setShowAllTxModal] = useState(false);
  const [txCategory, setTxCategory] = useState<string | null>(null); // סינון רשימת העסקאות לקטגוריה (null = הכל)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localNextMonthPrepared, setLocalNextMonthPrepared] = useState(false); // שומר מצב מקומי לאחר שמירה
  const [editMonth, setEditMonth] = useState<'current' | 'next'>('next'); // איזה חודש נערך בחלון היעדים
  
  const [nextTargets, setNextTargets] = useState({
    super: '',
    restaurants: '',
    shopping: '',
    vacation: '',
    transport: ''
  });

  const lastFetchRef = useRef(0);
  const viewMonthRef = useRef<string | null>(null); // החודש המוצג (null = החודש הנוכחי)
  const fetchBudget = async (month: string | null = viewMonthRef.current) => {
    viewMonthRef.current = month;
    lastFetchRef.current = Date.now();
    setIsLoading(true);
    try {
      const res = await fetch(month ? `/api/budget?month=${month}` : '/api/budget');
      const result = await res.json();
      if (res.ok) setData(result);
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchBudget(); }, []);

  // רענון אוטומטי כשחוזרים לאפליקציה (למשל אחרי רישום בבוט), לכל היותר פעם ב-30 שניות
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchRef.current > 30000) fetchBudget();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const today = new Date();
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const clientNextMonth = `${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${nextMonthDate.getFullYear()}`;
  const clientCurrentMonth = `${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
  const currentMonthKey: string = data?.currentMonth || clientCurrentMonth;
  const nextMonthKey: string = data?.nextMonth || clientNextMonth;
  const editMonthKey = editMonth === 'current' ? currentMonthKey : nextMonthKey;

  // פתיחת חלון היעדים עם הערכים הקיימים של החודש (אם יש)
  const loadTargetsFor = (which: 'current' | 'next') => {
    const key = which === 'current' ? currentMonthKey : nextMonthKey;
    const existing = data?.targets?.[key];
    setEditMonth(which);
    setNextTargets({
      super: existing ? String(existing.super) : '',
      restaurants: existing ? String(existing.restaurants) : '',
      shopping: existing ? String(existing.shopping) : '',
      vacation: existing ? String(existing.vacation) : '',
      transport: existing ? String(existing.transport) : '',
    });
  };
  const openTargetsModal = (which: 'current' | 'next') => {
    loadTargetsFor(which);
    setShowNextMonthModal(true);
  };
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate();
  const isLastWeek = daysLeft <= 7;

  const handleSaveNextMonth = async () => {
    if (Object.values(nextTargets).some(v => v === '')) {
      alert('יש למלא סכום בכל הקטגוריות');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/next-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: editMonthKey, targets: nextTargets })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || 'השמירה נכשלה');
      alert(result.mode === 'updated' ? `היעדים של ${editMonthKey} עודכנו בגיליון` : `היעדים של ${editMonthKey} נשמרו בגיליון`);
      setShowNextMonthModal(false);
      if (editMonth === 'next') setLocalNextMonthPrepared(true); // מעלים את הכפתור הגדול מיד לאחר שמירה
      fetchBudget(); // רענון הנתונים כך שהיעדים החדשים יופיעו מיד (באותו חודש מוצג)
    } catch (error: any) {
      alert(`שגיאה בשמירת היעדים: ${error.message}`);
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

  const timeProgress = Math.round((today.getDate() / daysInMonth) * 100);
  const budgetProgress = data?.totalBudget ? Math.round((data.totalSpent / data.totalBudget) * 100) : 0;

  // פונקציית עזר לעיצוב כרטיסיית קטגוריה לפי אחוזי ניצול
  const getCategoryStyle = (pct: number) => {
    if (pct >= 85) return "bg-red-50 border-red-100";
    if (pct >= 60) return "bg-orange-50 border-orange-100";
    return "bg-white border-slate-100";
  };

  // מנגנון תובנה יומית — מציג את ההתראה הדחופה ביותר, ובשורה שנייה תקציב יומי
  const dayOfMonth = today.getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1; // כולל היום
  const fmt = (n: number) => `₪${Math.round(n).toLocaleString()}`;
  const cats: any[] = data?.categories || [];
  let insightMsg = '';
  let insightColor = '';

  const exceeded = cats.filter(c => c.target > 0 && c.spent > c.target)
    .sort((a, b) => (b.spent - b.target) - (a.spent - a.target))[0];
  const projected = dayOfMonth >= 7
    ? cats.map(c => ({ ...c, proj: (c.spent / dayOfMonth) * daysInMonth }))
        .filter(c => c.target > 0 && c.proj > c.target)
        .sort((a, b) => (b.proj - b.target) - (a.proj - a.target))[0]
    : undefined;
  const aboveAvg = cats.filter(c => c.avg > 0 && c.spent > c.avg)
    .sort((a, b) => (b.spent - b.avg) - (a.spent - a.avg))[0];

  if (exceeded) {
      insightMsg = `${exceeded.name}: חריגה של ${fmt(exceeded.spent - exceeded.target)} מעל היעד`;
      insightColor = "text-red-400";
  } else if (projected) {
      insightMsg = `${projected.name}: בקצב הנוכחי ייסגר בכ-${fmt(projected.proj)}, ${fmt(projected.proj - projected.target)} מעל היעד`;
      insightColor = "text-red-400";
  } else if (aboveAvg) {
      insightMsg = `${aboveAvg.name}: ${fmt(aboveAvg.spent)} החודש, מעל הממוצע החודשי (${fmt(aboveAvg.avg)})`;
      insightColor = "text-orange-300";
  } else if (budgetProgress < timeProgress - 10) {
      insightMsg = "התנהלות מצוינת! אתה ביתרה חיובית לזמן זה";
      insightColor = "text-emerald-400";
  } else {
      insightMsg = "התקציב מתנהל בצורה מאוזנת ובהתאם לתוכנית";
      insightColor = "text-blue-300";
  }
  const dailyMsg = (data?.totalLeft ?? 0) > 0
    ? (daysRemaining === 1
        ? `נשארו ${fmt(data.totalLeft)} להיום, היום האחרון בחודש`
        : `נשארו ${fmt(data.totalLeft)} ל-${daysRemaining} ימים · כ-${fmt(data.totalLeft / daysRemaining)} ליום`)
    : `חריגה מהתקציב החודשי של ${fmt(Math.abs(data?.totalLeft ?? 0))}`;

  // קצב הוצאה: אחוז ניצול התקציב מול אחוז הזמן שעבר בחודש
  const paceGap = timeProgress - budgetProgress;          // חיובי = לפני הקצב (הוצאת פחות מהזמן שעבר)
  const expectedByNow = Math.round((data?.totalBudget || 0) * dayOfMonth / daysInMonth);
  const paceDiff = expectedByNow - (data?.totalSpent || 0); // ₪ מתחת (+) / מעל (-) לקצב
  const paceEarly = dayOfMonth <= 3;
  const paceState = paceEarly ? 'early' : paceGap >= 5 ? 'ahead' : paceGap <= -5 ? 'behind' : 'on';

  // ניווט בין חודשים
  const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const monthLabel = (key: string) => { const [m, y] = (key || '').split('-'); return m ? `${HEB_MONTHS[Number(m) - 1]} ${y}` : ''; };
  const isPast: boolean = Boolean(data?.isPastMonth);
  const selectedMonth: string = data?.selectedMonth || currentMonthKey;
  const months: string[] = data?.availableMonths || [currentMonthKey];
  const monthIdx = months.indexOf(selectedMonth);
  const prevMonth = monthIdx > 0 ? months[monthIdx - 1] : null;
  const nextNavMonth = monthIdx >= 0 && monthIdx < months.length - 1 ? months[monthIdx + 1] : null;
  const goToMonth = (m: string | null) => { if (m) fetchBudget(m === currentMonthKey ? null : m); };

  // האם להציג את פופאפ היעדים הגדול? (רק בשבוע האחרון + אם לא דווח שהוכן, ורק בחודש הנוכחי)
  const isPrepared = data?.isNextMonthPrepared || localNextMonthPrepared;
  const showBigTargetButton = isLastWeek && !isPrepared && !isPast;

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center pb-8 font-sans" dir="rtl">
      <div className="w-full max-w-md bg-slate-50 relative">
        
        {/* Header */}
        <div className="bg-slate-900 p-5 pb-8 text-white rounded-b-[2.5rem] shadow-lg relative">
          <div className="flex justify-between items-center mb-4">
            <RefreshCw className={`w-5 h-5 text-slate-400 cursor-pointer ${isLoading ? 'animate-spin' : ''}`} onClick={() => fetchBudget()} />
            <h1 className="text-lg font-bold tracking-wide">תקציב אישי</h1>
            <Wallet className="w-5 h-5 text-slate-400" />
          </div>
          
          <div className="flex justify-center items-center space-x-3 space-x-reverse mb-6">
            <ChevronRight
              onClick={() => goToMonth(prevMonth)}
              className={`w-5 h-5 ${prevMonth ? 'cursor-pointer text-slate-300 hover:text-white' : 'text-slate-700'}`} />
            <span className="text-sm font-semibold tracking-wider bg-slate-800 px-4 py-1 rounded-full border border-slate-700">
              {monthLabel(selectedMonth)}
            </span>
            <ChevronLeft
              onClick={() => goToMonth(nextNavMonth)}
              className={`w-5 h-5 ${nextNavMonth ? 'cursor-pointer text-slate-300 hover:text-white' : 'text-slate-700'}`} />
          </div>
          
          <div className="text-center mb-5">
            <p className={`text-xs mb-1 uppercase tracking-widest ${(data?.totalLeft ?? 0) < 0 ? 'text-red-400' : 'text-slate-400'}`}>{(data?.totalLeft ?? 0) < 0 ? 'חריגה מהתקציב' : (isPast ? 'נחסך בחודש' : 'יתרה זמינה')}</p>
            <h2 className="text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-300 drop-shadow-sm">
              ₪{Math.abs(data?.totalLeft ?? 0).toLocaleString()}
            </h2>
            
            {isPast ? (
              <div className="mt-3 text-[11px] font-medium text-slate-300 bg-slate-800/50 w-fit mx-auto px-3 py-1 rounded-full border border-slate-700/50">
                🔒 חודש סגור · <span className="underline cursor-pointer" onClick={() => goToMonth(currentMonthKey)}>חזרה לחודש הנוכחי</span>
              </div>
            ) : (
              <>
                {/* Daily Insight */}
                <div className={`mt-3 text-[11px] font-medium flex items-center justify-center text-center ${insightColor} bg-slate-800/50 w-fit max-w-full mx-auto px-3 py-1 rounded-full border border-slate-700/50`}>
                    <Lightbulb className="w-3 h-3 ml-1 shrink-0" /> {insightMsg}
                </div>
                <div className="mt-1.5 text-[10px] text-slate-400">{dailyMsg}</div>
              </>
            )}
          </div>
          
          {!isPast ? (
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 backdrop-blur-sm mt-6">
             <div className="mb-3">
               <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                 <span>זמן חודש ({dayOfMonth}/{daysInMonth})</span><span>{timeProgress}%</span>
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
               <div className="relative">
                 <div className="w-full bg-slate-950 rounded-full h-1.5">
                   <div className="bg-emerald-400 h-1.5 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.4)]" style={{ width: `${Math.min(budgetProgress, 100)}%` }}></div>
                 </div>
                 {/* סימון "היום" על פס הניצול */}
                 <div className="absolute -top-1 h-3.5 w-0.5 bg-blue-300 rounded" style={{ right: `${timeProgress}%` }}></div>
               </div>
             </div>
             {!paceEarly && (
               <div className="mt-2.5 text-[11px] text-slate-400">
                 {paceState === 'on'
                   ? 'ההוצאה בקצב של התקציב'
                   : paceDiff >= 0
                     ? `עד היום הוצאת ₪${paceDiff.toLocaleString()} פחות מהקצב המתוכנן`
                     : <span className="text-red-300">עד היום הוצאת ₪{Math.abs(paceDiff).toLocaleString()} יותר מהקצב המתוכנן</span>}
               </div>
             )}
          </div>
          ) : (
          <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 backdrop-blur-sm mt-6">
             <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
               <span>ניצול ₪{data?.totalSpent?.toLocaleString() || 0} / ₪{data?.totalBudget?.toLocaleString() || 0}</span>
               <span>{budgetProgress}%</span>
             </div>
             <div className="w-full bg-slate-950 rounded-full h-1.5">
               <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${Math.min(budgetProgress, 100)}%` }}></div>
             </div>
          </div>
          )}
        </div>

        <div className="px-5 mt-6 pb-6">
            {/* פעולות אחרונות - מקוצר */}
            <div className="flex justify-between items-end mb-3 px-1">
                <span className="text-sm font-bold text-slate-800">פעולות אחרונות</span>
                <span 
                  onClick={() => { setTxCategory(null); setShowAllTxModal(true); }}
                  className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center cursor-pointer active:bg-blue-100 transition-colors">
                  <History className="w-3 h-3 ml-1"/> צפה הכל
                </span>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-2 space-y-2.5">
                {(isPast ? data?.monthTransactions : data?.recentTransactions)?.slice(0, 3).map((tx: any) => (
                    <div key={tx.id} className="flex justify-between items-center text-sm border-b border-slate-50 last:border-0 pb-2.5 last:pb-1">
                        <div className="flex items-center space-x-3 space-x-reverse">
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-medium border border-slate-100">{tx.date?.split('/')[0] || ''}</div>
                            <span className="font-semibold text-slate-700 truncate">{tx.desc}</span>
                        </div>
                        <span className="flex-1 border-b-2 border-dotted border-slate-300 mx-3 self-center min-w-4"></span>
                        <span className="font-bold text-slate-900 tracking-tight shrink-0">₪{tx.amount?.toLocaleString() || 0}</span>
                    </div>
                ))}
            </div>

            {/* קטגוריות גריד */}
            <div className="mt-6">
                <div className="flex justify-between items-baseline px-1 mb-3">
                  <span className="text-sm font-bold text-slate-800">קטגוריות</span>
                  {!isPast && <span className="text-[10px] text-slate-400">הקו האנכי בכל כרטיס = היום בחודש ({timeProgress}%)</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {data?.categories?.map((cat: any, idx: number) => (
                        <div key={idx}
                          onClick={() => { setTxCategory(cat.name); setShowAllTxModal(true); }}
                          className={`border p-3.5 rounded-2xl shadow-sm relative overflow-hidden transition-colors cursor-pointer active:scale-[0.98] ${getCategoryStyle(cat.pct)}`}>
                            <div className="flex justify-between items-start mb-4">
                                <span className={`text-lg ${cat.iconBg} rounded-xl p-1.5 bg-white shadow-sm`}>{cat.icon}</span>
                                <span className={`text-[10px] font-bold bg-white/70 px-2 py-0.5 rounded-full backdrop-blur-sm ${!isPast && cat.pct > timeProgress + 10 ? 'text-red-600' : 'text-slate-500'}`}>{cat.pct}%</span>
                            </div>
                            <h3 className="text-xs font-bold text-slate-600 mb-0.5">{cat.name}</h3>
                            <div className="flex justify-between items-baseline">
                                <span className={`text-xs font-bold ${(cat.left || 0) < 0 ? 'text-red-700' : 'text-slate-600'}`}>{(cat.left || 0) < 0 ? 'חריגה' : 'יתרה'}</span>
                                <span className={`font-black text-lg tracking-tight ${(cat.left || 0) < 0 || cat.pct >= 100 ? 'text-red-700' : 'text-slate-900'}`}>₪{Math.abs(cat.left || 0).toLocaleString()}</span>
                            </div>
                            <div className="mt-1.5 mb-1 space-y-0.5 text-[10px] font-medium text-slate-500">
                                <div className="flex justify-between"><span>יעד</span><span className="font-bold text-slate-600">₪{Math.round(cat.target || 0).toLocaleString()}</span></div>
                                <div className="flex justify-between"><span>ממוצע חודשי</span><span className="font-bold text-slate-600">₪{Math.round(cat.avg || 0).toLocaleString()}</span></div>
                                <div className="flex justify-between"><span>נגרר מחודש קודם</span><span className={`font-bold ${(cat.carry || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>₪{Math.round(cat.carry || 0).toLocaleString()}</span></div>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full bg-slate-900/5 h-1">
                                <div className={`${cat.pct >= 100 ? 'bg-red-500' : (cat.pct >= 60 ? 'bg-orange-400' : 'bg-slate-800')} h-1`} style={{ width: `${Math.min(cat.pct, 100)}%` }}></div>
                                {!isPast && <div className="absolute bottom-0 h-2.5 w-0.5 bg-slate-900/70" style={{ right: `${timeProgress}%` }}></div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* הכנת תקציב לחודש הבא - מופיע רק בשבוע האחרון ואם לא הוכן */}
            {showBigTargetButton && (
                <div 
                  onClick={() => openTargetsModal('next')}
                  className="mt-6 mb-2 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-95 transition-transform shadow-sm">
                    <div className="flex items-center space-x-3 space-x-reverse">
                        <CalendarDays className="text-blue-600 w-5 h-5" />
                        <div>
                            <h4 className="text-sm font-bold text-slate-900">הכן תקציב לחודש הבא</h4>
                            <p className="text-xs text-blue-700 font-medium">החודש מסתיים בעוד {daysLeft} ימים</p>
                        </div>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-blue-600" />
                </div>
            )}
            
            {/* כפתור נסתר ועדין למטה - עריכת יעדים קבועה */}
            <div className="mt-6 text-center">
                <span 
                    onClick={() => openTargetsModal('current')}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer flex items-center justify-center transition-colors">
                    <Edit3 className="w-3 h-3 ml-1" /> עריכת יעדי תקציב
                </span>
            </div>
        </div>

        {/* Modal: הזנת יעדים */}
        {showNextMonthModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end z-50 fixed">
            <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900">יעדי {editMonthKey}</h3>
                <X className="w-6 h-6 text-slate-400 cursor-pointer hover:text-slate-700" onClick={() => setShowNextMonthModal(false)} />
              </div>
              
              <div className="flex bg-slate-100 rounded-xl p-1 mb-5 text-sm font-bold">
                {(['current', 'next'] as const).map(which => (
                  <button
                    key={which}
                    onClick={() => loadTargetsFor(which)}
                    className={`flex-1 py-2 rounded-lg transition-colors ${editMonth === which ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                    {which === 'current' ? `חודש נוכחי (${currentMonthKey})` : `חודש הבא (${nextMonthKey})`}
                  </button>
                ))}
              </div>
              <div className="text-center mb-4">
                <div className="text-[11px] font-medium text-slate-400">סה"כ תקציב לחודש</div>
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  ₪{Object.values(nextTargets).reduce((sum, v) => sum + (Number(v) || 0), 0).toLocaleString()}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mb-4 -mt-2">
                {data?.targets?.[editMonthKey] ? 'קיימים יעדים לחודש זה — השמירה תעדכן אותם' : 'אין עדיין יעדים לחודש זה — השמירה תיצור אותם'}
              </p>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">סופר ומשק בית</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" value={nextTargets.super} onChange={e => setNextTargets({...nextTargets, super: e.target.value})} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">מסעדות בחוץ</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" value={nextTargets.restaurants} onChange={e => setNextTargets({...nextTargets, restaurants: e.target.value})} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">קניות שונות</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" value={nextTargets.shopping} onChange={e => setNextTargets({...nextTargets, shopping: e.target.value})} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">חופשות ונופש</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" value={nextTargets.vacation} onChange={e => setNextTargets({...nextTargets, vacation: e.target.value})} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">דלק ותחבורה</span>
                  <input type="number" placeholder="₪" className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-sm font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:border-blue-500 focus:bg-white" value={nextTargets.transport} onChange={e => setNextTargets({...nextTargets, transport: e.target.value})} />
                </div>
              </div>

              <button 
                onClick={handleSaveNextMonth}
                disabled={isSubmitting}
                className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-colors disabled:bg-slate-300 shadow-lg shadow-blue-600/30">
                {isSubmitting ? 'שומר נתונים...' : 'עדכן תקציב'}
              </button>
            </div>
          </div>
        )}

        {/* Modal: כל העסקאות (או עסקאות של קטגוריה אחת) */}
        {showAllTxModal && (() => {
          const txList: any[] = (data?.monthTransactions || []).filter((tx: any) => !txCategory || tx.category === txCategory.trim());
          const txTotal = txList.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
          const expected = txCategory ? (data?.categories || []).find((c: any) => c.name === txCategory)?.spent || 0 : data?.totalSpent || 0;
          return (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-end z-50 fixed">
            <div className="bg-white w-full max-w-md h-[85%] rounded-t-[2.5rem] p-6 shadow-2xl flex flex-col animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900">{txCategory || 'כל ההוצאות'} · {monthLabel(selectedMonth)}</h3>
                <X className="w-6 h-6 text-slate-400 cursor-pointer hover:text-slate-700" onClick={() => { setShowAllTxModal(false); setTxCategory(null); }} />
              </div>
              
              <div className="-mt-3 mb-4 text-xs text-slate-500 font-medium">
                {txList.length} עסקאות · סה"כ <span className="font-bold text-slate-800">₪{Math.round(txTotal).toLocaleString()}</span>
                {Math.round(txTotal) !== Math.round(expected) && (
                  <div className="mt-1 text-[11px] text-orange-600">
                    לא תואם לניצול (₪{Math.round(expected).toLocaleString()}) — ייתכן שיש עסקה עם קטגוריה לא מוכרת
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[11px] font-bold text-slate-400 border-b border-slate-200 pb-2 mb-3 px-1">
                <span>תאריך · תיאור</span>
                <span>סכום</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {txList.map((tx: any) => (
                    <div key={tx.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-3 last:border-0">
                        <div className="flex items-center space-x-3 space-x-reverse">
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex flex-col items-center justify-center border border-slate-100">
                                <span className="text-xs font-bold text-slate-700">{tx.date?.split('/')[0]}</span>
                                <span className="text-[8px] font-medium text-slate-400">{tx.date?.split('/')[1]}</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-slate-800 truncate">{tx.desc}</span>
                              <span className="text-[10px] text-slate-400">{tx.date}</span>
                            </div>
                        </div>
                        <span className="flex-1 border-b-2 border-dotted border-slate-300 mx-3 self-center min-w-4"></span>
                        <span className="font-black text-slate-900 tracking-tight text-base shrink-0">₪{tx.amount?.toLocaleString() || 0}</span>
                    </div>
                ))}
                {txList.length === 0 && (
                  <div className="text-center text-slate-500 mt-10">אין עסקאות החודש</div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

      </div>
    </div>
  );
}