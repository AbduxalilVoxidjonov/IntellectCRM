// Groups & Teachers — extend mock data
(function () {
  const D = window.MockData;
  const rng = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };
  const rand = rng(99);
  const between = (a, b) => Math.floor(rand() * (b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const TIMESLOTS = ["09:00 – 10:30", "11:00 – 12:30", "14:00 – 15:30", "16:00 – 17:30", "18:00 – 19:30", "19:30 – 21:00"];
  const DAYS = ["Du, Cho, Ju", "Se, Pa, Sh", "Du, Se, Pa", "Cho, Ju, Sh", "Du, Cho", "Se, Pa"];

  const GROUPS = D.COURSES.flatMap((course, ci) => Array.from({ length: 2 + (ci % 2) }, (_, gi) => {
    const teacher = D.TEACHERS[(ci + gi) % D.TEACHERS.length];
    const capacity = pick([12, 14, 16, 18, 20]);
    const enrolled = between(Math.floor(capacity * 0.6), capacity);
    return {
      id: `GRP-${3000 + ci * 10 + gi}`,
      name: `${course.split(" ")[0]}-${gi + 1}`,
      course,
      teacher,
      schedule: pick(DAYS),
      time: pick(TIMESLOTS),
      room: `Room ${between(101, 305)}`,
      capacity,
      enrolled,
      level: pick(["Beginner", "Intermediate", "Advanced"]),
      revenue: enrolled * between(4, 8) * 100000,
      attendance: between(78, 98),
      status: pick(["Active", "Active", "Active", "Forming"]),
    };
  })).slice(0, 18);

  const TEACHERS_FULL = D.TEACHERS.concat(["Olim N.", "Shahnoza P.", "Rustam H.", "Dilnoza K.", "Aziz S.", "Kamol O."]).slice(0, 12).map((name, i) => ({
    id: `TCH-${4000 + i}`,
    name,
    role: pick(["Senior Teacher", "Lead Teacher", "Teacher", "Junior Teacher"]),
    subjects: Array.from({ length: between(1, 3) }, () => pick(D.COURSES)).filter((s, idx, a) => a.indexOf(s) === idx),
    groups: between(2, 6),
    students: between(28, 86),
    rating: (4 + rand() * 1).toFixed(2),
    salary: between(80, 220) * 10000,
    yearsAt: between(1, 8),
    phone: `+998 ${between(90,99)} ${between(100,999)}-${String(between(10,99))}-${String(between(10,99))}`,
    status: i < 10 ? "Active" : "On leave",
  }));

  D.GROUPS = GROUPS;
  D.TEACHERS_FULL = TEACHERS_FULL;
})();
