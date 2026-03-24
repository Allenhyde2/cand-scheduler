import { useState } from 'react';
import { colorVariants } from '../constants/styles';

export default function GlassDateTimePicker({ date, time, onDateChange, onTimeChange, onConfirm, onCancel }) {
  const today = new Date();
  const initialDate = date ? new Date(date) : today;
  const [currentMonth, setCurrentMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(date ? initialDate : null);
  const [hour, setHour] = useState(time ? time.split(':')[0] : '12');
  const [minute, setMinute] = useState(time ? time.split(':')[1] : '00');

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const startDay = currentMonth.getDay();
  const days = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handleConfirm = () => {
    if (!selectedDate) return;
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const finalDateStr = `${y}-${m}-${d}`;
    const finalTimeStr = `${hour}:${minute}`;
    onDateChange(finalDateStr);
    onTimeChange(finalTimeStr);
    onConfirm(finalDateStr, finalTimeStr);
  };

  return (
    <div className="bg-white/95 backdrop-blur-2xl border border-white/60 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.3)] rounded-3xl p-6 w-[320px] max-w-[90vw] animate-fade-in-fast">
      <div className="flex justify-between items-center mb-5">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg></button>
        <span className="font-extrabold text-slate-800 text-sm">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg></button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-3 text-center">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} className="text-[10px] font-extrabold text-slate-400">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-6">
        {days.map((d, i) => {
          if (!d) return <div key={i} className="h-8"></div>;
          const thisDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
          const isSelected = selectedDate && thisDate.getTime() === selectedDate.getTime();
          const isPast = thisDate.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

          return (
            <button
              key={i}
              disabled={isPast}
              onClick={() => setSelectedDate(thisDate)}
              className={`h-8 w-8 rounded-full text-xs font-bold mx-auto flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-110'
                  : isPast
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-blue-50 hover:text-blue-600'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-200/50 pt-5 mb-6">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">시간 설정</label>
        <div className="flex items-center gap-3">
          <select value={hour} onChange={e => setHour(e.target.value)} className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-mono font-bold text-slate-700 outline-none focus:border-blue-400 shadow-sm cursor-pointer hover:bg-white transition-colors">
            {Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
          <span className="font-bold text-slate-400">:</span>
          <select value={minute} onChange={e => setMinute(e.target.value)} className="flex-1 bg-slate-50/50 border border-slate-200 rounded-xl px-3 py-2.5 text-center font-mono font-bold text-slate-700 outline-none focus:border-blue-400 shadow-sm cursor-pointer hover:bg-white transition-colors">
            {Array.from({length: 60}, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}분</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm">취소</button>
        <button type="button" onClick={handleConfirm} className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${colorVariants.blue}`}>적용하기</button>
      </div>
    </div>
  );
}
