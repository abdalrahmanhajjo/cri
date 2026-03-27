import { useState, useEffect, useRef } from 'react';
import Icon from './Icon';
import './Calendar.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function DateRangeCalendar({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  locale = 'en-GB',
  hintStart = 'Select start date',
  hintEnd = 'Select end date',
  showHint = true,
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(() => {
    const from = startDate ? parseLocalDate(startDate) : today;
    return from ? new Date(from.getFullYear(), from.getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selecting, setSelecting] = useState('start'); // 'start' | 'end'
  const gridRef = useRef(null);

  const start = startDate ? parseLocalDate(startDate) : null;
  const end = endDate ? parseLocalDate(endDate) : null;
  const min = minDate ? parseLocalDate(minDate) : null;
  const max = maxDate ? parseLocalDate(maxDate) : null;

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();

  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));

  const isInRange = (date) => {
    if (!date || !start || !end) return false;
    const t = date.getTime();
    return t >= start.getTime() && t <= end.getTime();
  };
  const isSelected = (date) => {
    if (!date) return false;
    const str = toDateStr(date);
    return str === startDate || str === endDate;
  };
  const isDisabled = (date) => {
    if (!date) return true;
    if (min && date < min) return true;
    if (max && date > max) return true;
    return false;
  };

  const handleDayClick = (date) => {
    if (!date || isDisabled(date)) return;
    const str = toDateStr(date);
    if (selecting === 'start') {
      if (end && parseLocalDate(end).getTime() < date.getTime()) {
        onChange(str, str);
        setSelecting('end');
      } else {
        onChange(str, endDate || str);
        setSelecting('end');
      }
    } else {
      const s = startDate || str;
      const startTime = parseLocalDate(s).getTime();
      if (date.getTime() < startTime) {
        onChange(str, s);
      } else {
        onChange(s, str);
      }
      setSelecting('start');
    }
  };

  const goPrevMonth = () => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNextMonth = () => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const viewMonthStart = viewMonth.getTime();
  const canPrev = !min || viewMonthStart > new Date(min.getFullYear(), min.getMonth(), 1).getTime();
  const canNext = !max || viewMonthStart < new Date(max.getFullYear(), max.getMonth(), 1).getTime();

  useEffect(() => {
    if (!startDate) setSelecting('start');
    else setSelecting('end');
  }, [startDate]);

  return (
    <div className="calendar calendar--range" role="application" aria-label="Choose date range">
      <div className="calendar-header">
        <button type="button" className="calendar-nav" onClick={goPrevMonth} disabled={!canPrev} aria-label="Previous month">
          <Icon name="chevron_left" size={24} />
        </button>
        <h3 className="calendar-title" id="calendar-month">
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </h3>
        <button type="button" className="calendar-nav" onClick={goNextMonth} disabled={!canNext} aria-label="Next month">
          <Icon name="chevron_right" size={24} />
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((wd) => (
          <span key={wd} className="calendar-weekday">{wd}</span>
        ))}
      </div>
      <div ref={gridRef} className="calendar-grid" role="grid" aria-labelledby="calendar-month" aria-readonly="false">
        {days.map((date, i) => {
          const disabled = date ? isDisabled(date) : true;
          const inRange = date && isInRange(date);
          const selected = date && isSelected(date);
          return (
            <button
              key={i}
              type="button"
              className={`calendar-day ${!date ? 'calendar-day--pad' : ''} ${disabled ? 'calendar-day--disabled' : ''} ${inRange ? 'calendar-day--range' : ''} ${selected ? 'calendar-day--selected' : ''}`}
              disabled={disabled}
              onClick={() => handleDayClick(date)}
              aria-label={date ? date.toLocaleDateString(locale) : ''}
              aria-selected={selected}
            >
              {date ? date.getDate() : ''}
            </button>
          );
        })}
      </div>
      {showHint ? (
        <p className="calendar-hint" aria-live="polite">
          {selecting === 'start' ? hintStart : hintEnd}
        </p>
      ) : null}
    </div>
  );
}
