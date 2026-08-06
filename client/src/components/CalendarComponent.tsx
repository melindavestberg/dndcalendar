import { useState, useEffect } from 'react';
import { getSwedenHolidaysForYear, getHolidayName } from '../utils/swedishHolidays';
import { AvailabilityByDate, AvailabilityRecord, DisabledDateRecord } from '../types';

interface CalendarComponentProps {
  month: number;
  year: number;
  myAvailabilities: AvailabilityRecord[];
  availabilityByDate: AvailabilityByDate;
  disabledDates: DisabledDateRecord[];
  onToggleDate: (dateKey: string) => void;
  onAdminToggleDate?: (dateKey: string, isCurrentlyDisabled: boolean) => void;
  adminDisableMode: boolean;
  inspectMode: boolean;
  selectedDateForInspect: string | null;
  onSelectDateForInspect: (dateKey: string | null) => void;
}

function CalendarComponent({
  month,
  year,
  myAvailabilities,
  availabilityByDate,
  disabledDates,
  onToggleDate,
  onAdminToggleDate,
  adminDisableMode,
  inspectMode,
  selectedDateForInspect,
  onSelectDateForInspect
}: CalendarComponentProps) {
  const [swedishHolidays, setSwedishHolidays] = useState<string[]>([]);
  const [holidayNames, setHolidayNames] = useState<Record<string, string | null>>({});

  // Fetch Swedish holidays on mount and when year changes
  useEffect(() => {
    const fetchHolidays = async () => {
      const holidays = await getSwedenHolidaysForYear(year);
      setSwedishHolidays(holidays || []);
    };
    fetchHolidays();
  }, [year]);

  const getHolidayNameCached = async (dateStr: string) => {
    if (holidayNames[dateStr]) {
      return holidayNames[dateStr];
    }
    const name = await getHolidayName(dateStr);
    setHolidayNames(prev => ({ ...prev, [dateStr]: name }));
    return name;
  };

  const isHoliday = (dateKey: string | null) => Boolean(dateKey) && swedishHolidays.includes(dateKey as string);

  const isWeekend = (day: number | null) => {
    if (!day) return false;
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const getDaysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();
  // getDay() returns 0=Sun..6=Sat; shift so Monday=0, Sunday=6
  const getFirstDayOfMonth = (m: number, y: number) => (new Date(y, m - 1, 1).getDay() + 6) % 7;

  const daysInMonth = getDaysInMonth(month, year);
  const firstDay = getFirstDayOfMonth(month, year);
  const days: (number | null)[] = [];

  // Add empty cells
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Add days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getDateKey = (day: number | null): string | null => {
    if (!day) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toISOString().split('T')[0];
  };

  const getDateStatus = (day: number | null): 'disabled' | 'available' | 'unavailable' | null => {
    if (!day) return null;

    const dateKey = getDateKey(day);

    const isDisabled = disabledDates.some((dd) => {
      const disabledKey = new Date(dd.date_ymd).toISOString().split('T')[0];
      return disabledKey === dateKey;
    });

    if (isDisabled) return 'disabled';

    const isAvailable = myAvailabilities.some((av) => {
      const avKey = new Date(av.date_ymd).toISOString().split('T')[0];
      return avKey === dateKey && av.available;
    });

    return isAvailable ? 'available' : 'unavailable';
  };

  const isPastDate = (day: number | null) => {
    if (!day) return false;
    const dateKey = getDateKey(day);
    const today = new Date();
    const todayKey = today.toISOString().split('T')[0];
    return (dateKey as string) < todayKey;
  };

  const handleDayClick = (day: number | null) => {
    if (!day || isPastDate(day)) return;

    const dateKey = getDateKey(day) as string;

    if (inspectMode) {
      onSelectDateForInspect(selectedDateForInspect === dateKey ? null : dateKey);
      return;
    }

    const status = getDateStatus(day);

    if (adminDisableMode && onAdminToggleDate) {
      onAdminToggleDate(dateKey, status === 'disabled');
      return;
    }

    if (status === 'disabled') return;
    onToggleDate(dateKey);
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="calendar-grid">
      {dayNames.map((name) => (
        <div key={name} className="calendar-day-header">
          {name}
        </div>
      ))}
      {days.map((day, index) => {
        const status = getDateStatus(day);
        const dateKey = getDateKey(day);
        const dayUsers = dateKey ? (availabilityByDate[dateKey] || []) : [];
        const visibleUsers = dayUsers.slice(0, 10);
        const hiddenCount = dayUsers.length - visibleUsers.length;
        const dayTooltip = dayUsers
          .map((u) => u.username)
          .join(', ');

         return (
           <div
             key={index}
              className={`calendar-day ${day ? status : 'empty'} ${isPastDate(day) ? 'past' : ''} ${dateKey && isHoliday(dateKey) ? 'holiday' : ''} ${isWeekend(day) ? 'weekend' : ''} ${dateKey && selectedDateForInspect === dateKey ? 'selected' : ''} ${adminDisableMode ? 'admin-mode' : ''}`}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => {
                if (dateKey && isHoliday(dateKey)) {
                  getHolidayNameCached(dateKey);
                }
              }}
              title={dateKey && holidayNames[dateKey] ? (holidayNames[dateKey] as string) : ''}
            >
             {day && (
               <>
                 <span className="day-number">{day}
                 {dateKey && isHoliday(dateKey) && (
                   <span className="holiday-badge" title={holidayNames[dateKey] || 'Swedish Holiday'}>🇸🇪</span>
                 )}
                   </span>
                <div className="day-dots" title={dayTooltip}>
                  {inspectMode && visibleUsers.length > 0 ? (
                      <span className="inspect-count">{visibleUsers.length}</span>
                  ) : (
                      visibleUsers.map((user) => (
                            <span
                                key={user.userId}
                                className="user-dot"
                                style={{ backgroundColor: user.color }}
                                title={user.username}
                            ></span>
                      ))
                  )}

                  {hiddenCount > 0 && <span className="more-dots">+{hiddenCount}</span>}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default CalendarComponent;
