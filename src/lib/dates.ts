// Pure date helpers. The barangay runs on Manila time, whatever timezone the server or phone is in.
const manilaYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Manila calendar date of `d`, as YYYY-MM-DD. */
export const manilaDateString = (d: Date) => manilaYmd.format(d);

/** The Manila calendar date of `d`, as a UTC-midnight Date (what Postgres `@db.Date` columns expect). */
export const manilaDay = (d: Date) => new Date(`${manilaDateString(d)}T00:00:00.000Z`);
