export default function GlobalStyles() {
  return (
    <style dangerouslySetInnerHTML={{__html: `
      html, body, #root {
        max-width: none !important;
        width: 100vw !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        text-align: left !important;
        overflow-x: hidden !important;
      }

      .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }

      @keyframes fadeInFast {
        0% { opacity: 0; transform: translateY(5px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out forwards; }
    `}} />
  );
}
