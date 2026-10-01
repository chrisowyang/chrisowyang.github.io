// All time logic runs on New York wall-clock time (config.timezone), whatever
// the device's own time zone is. Dates and times are compared as wall-clock
// values, so no UTC offsets are involved.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOURS_KEYS = { 5: 'fri', 6: 'sat', 0: 'sun' };

const parts = (date) => date.split('-').map(Number);

// Minutes since the epoch, treating the wall-clock value as if it were UTC.
// Only used for comparing and offsetting wall-clock times.
export function wallMinutes(date, time = '00:00') {
  const [y, m, d] = parts(date);
  return Date.UTC(y, m - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5))) / 60000;
}

export function createClock(timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return function now() {
    const p = {};
    for (const { type, value } of fmt.formatToParts(new Date())) p[type] = value;
    const date = `${p.year}-${p.month}-${p.day}`;
    const time = `${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
    return { date, time, minutes: wallMinutes(date, time) };
  };
}

export const weekday = (date) => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
export const hoursKey = (date) => HOURS_KEYS[weekday(date)] || null;

// "Fri, Oct 2"
export function formatDate(date) {
  const [, m, d] = parts(date);
  return `${DAYS[weekday(date)]}, ${MONTHS[m - 1]} ${d}`;
}
// "Oct 17"
export function formatMonthDay(date) {
  const [, m, d] = parts(date);
  return `${MONTHS[m - 1]} ${d}`;
}
export const shortDay = (date) => DAYS[weekday(date)];

// "17:00" -> "5:00pm"
export function formatTime(t) {
  const h = Number(t.slice(0, 2));
  return `${h % 12 || 12}:${t.slice(3, 5)}${h >= 12 ? 'pm' : 'am'}`;
}

// "12:00-19:00" -> "12-7pm", "11:30-18:00" -> "11:30am-6pm"
export function formatRange(range) {
  const [a, b] = range.split('-').map((t) => {
    const h = Number(t.slice(0, 2)) % 24;
    const m = t.slice(3, 5);
    return { n: `${h % 12 || 12}${m === '00' ? '' : `:${m}`}`, s: h >= 12 ? 'pm' : 'am' };
  });
  return a.s === b.s ? `${a.n}-${b.n}${b.s}` : `${a.n}${a.s}-${b.n}${b.s}`;
}

// true / false, or null when we don't know the hours for that day.
export function isOpenAt(hours, key, time) {
  if (!hours || !key || !(key in hours)) return null;
  const r = hours[key];
  if (r === null) return false;
  const [open, close] = r.split('-');
  return time >= open && time < close;
}
