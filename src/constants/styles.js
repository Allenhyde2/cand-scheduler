export const colorVariants = {
  blue: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30',
  red: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30',
  green: 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/30',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/30',
  edit: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200',
  delete: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
};

export const glassPanel = "bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-3xl";
export const glassInput = "w-full px-4 py-3 bg-white/50 border border-white/60 rounded-2xl focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm text-slate-800 shadow-sm placeholder-slate-400";
export const glassButtonPrimary = `w-full py-3.5 font-bold rounded-2xl shadow-lg transition-all ${colorVariants.blue}`;
export const glassButtonSecondary = "px-4 py-2 bg-white/60 hover:bg-white/90 border border-white/60 rounded-xl text-slate-700 font-bold shadow-sm transition-all text-sm";

export const statusOptions = [
  { value: 'scheduled', label: '판매예정' },
  { value: 'onSale', label: '판매중' },
  { value: 'soldOut', label: '품절' },
  { value: 'completed', label: '판매종료' }
];

export const displayOptions = [
  { value: 'true', label: '진열함 (표시)' },
  { value: 'false', label: '진열안함 (숨김)' }
];
