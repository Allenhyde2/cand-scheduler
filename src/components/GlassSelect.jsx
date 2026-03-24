import { useState, useEffect, useRef } from 'react';

export default function GlassSelect({ value, options, onChange, placeholder = "선택해주세요" }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div className="relative w-full" ref={ref}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-white/50 border border-white/60 rounded-2xl cursor-pointer hover:bg-white/70 transition-all text-sm font-bold text-slate-700 shadow-sm flex justify-between items-center group"
      >
        <span>{selectedLabel}</span>
        <svg className={`w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
      </div>

      <div className={`absolute left-0 right-0 top-full mt-2 z-[200] transition-all duration-300 ease-out origin-top ${isOpen ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'}`}>
        <div className="bg-white/90 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-xl p-1.5 overflow-hidden">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`px-3 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all ${value === opt.value ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
