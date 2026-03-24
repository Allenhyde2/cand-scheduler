import { useState, useEffect, useRef } from 'react';

export default function useSidebar(activeTab) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });
  const navRef = useRef(null);

  useEffect(() => {
    const updateIndicator = () => {
      if (navRef.current) {
        const activeElement = navRef.current.querySelector('[data-active="true"]');
        if (activeElement) {
          setIndicatorStyle({
            top: activeElement.offsetTop,
            height: activeElement.offsetHeight,
            opacity: 1
          });
        }
      }
    };

    updateIndicator();
    const timer = setTimeout(updateIndicator, 50);
    window.addEventListener('resize', updateIndicator);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [activeTab, isSidebarOpen]);

  useEffect(() => {
    const handleResize = () => { setIsSidebarOpen(window.innerWidth > 768); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isSidebarOpen, setIsSidebarOpen, indicatorStyle, navRef };
}
