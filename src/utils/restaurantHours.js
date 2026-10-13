export const DEFAULT_WEEKLY_HOURS = Array.from({ length: 7 }, (_, weekday) => ({
  weekday, closed: weekday === 0, opens: '09:00', closes: '21:00',
}));

function minutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

// Local time in Nigeria; returns Sunday=0 ... Saturday=6.
function lagosClock(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', weekday: 'short', hour: '2-digit',
    minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return {
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(value('weekday')),
    minute: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

export function restaurantAcceptingBySchedule(weeklyHours, now = new Date()) {
  const { weekday, minute } = lagosClock(now);
  if (weekday < 0 || !Array.isArray(weeklyHours)) return false;
  const today = weeklyHours.find((day) => day.weekday === weekday);
  const yesterday = weeklyHours.find((day) => day.weekday === (weekday + 6) % 7);
  const currentInterval = today && !today.closed
    && (minutes(today.closes) > minutes(today.opens)
      ? minute >= minutes(today.opens) && minute < minutes(today.closes)
      : minute >= minutes(today.opens));
  const overnightFromYesterday = yesterday && !yesterday.closed
    && minutes(yesterday.closes) < minutes(yesterday.opens)
    && minute < minutes(yesterday.closes);
  return Boolean(currentInterval || overnightFromYesterday);
}
