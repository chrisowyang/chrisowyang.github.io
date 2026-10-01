// Small helpers shared by fam:check and fam:build.
export function parseJson(text, file) {
  try {
    return JSON.parse(text);
  } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    if (m) {
      const upTo = text.slice(0, Number(m[1]));
      const line = upTo.split('\n').length;
      const col = upTo.length - upTo.lastIndexOf('\n');
      throw new Error(`${file} is not valid JSON (line ${line}, column ${col}): ${e.message}`);
    }
    throw new Error(`${file} is not valid JSON: ${e.message}`);
  }
}

// Today's date in New York (or the given zone) as YYYY-MM-DD.
export const nyToday = (tz = 'America/New_York') => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
