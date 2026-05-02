import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon';
import './css/BackToTop.css';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  // Exclude AI Planner as requested
  const isAiPlanner = location.pathname === '/plan/ai';

  const checkScroll = useCallback(() => {
    // Show after scrolling down 400px
    if (window.scrollY > 400) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', checkScroll, { passive: true });
    return () => window.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (isAiPlanner || !visible) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
    >
      <Icon name="arrow_upward" size={24} />
    </button>
  );
}
