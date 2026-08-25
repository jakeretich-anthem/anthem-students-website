export const SETTINGS_KEY = "settings:org";

export const DEFAULT_ROSTER_SETTINGS = {
  ministryName: "Anthem Students",
  campus: "",
  logoUrl: "",
  logoEnabled: false,
  logoTone: "light",
  gradeTabs: {
    hs: { label: "High School", grades: [9, 10, 11, 12] },
    ms: { label: "Middle School", grades: [6, 7, 8] },
  },
  meetingDay: "sunday",
  weekStartsOn: "sunday",
  tracking: {
    hangoutNotes: true,
    tags: false,
    birthdays: true,
    showGrade: true,
    school: true,
    age: true,
  },
  defaults: {
    newStudentStatus: "new",
    autoArchive: false,
    autoArchiveWeeks: 8,
  },
  // A family connected with once in September is not still "connected" the
  // following June, but nothing in the sheet ever said so — column C stayed
  // ticked until somebody manually unticked it. After `resetAfterMonths` with
  // no new connection the card flips itself to "Needs Connection", and with
  // `autoReset` on the sheet's column C is put back to "Not Connected" too, so
  // the two don't drift apart.
  connections: {
    resetAfterMonths: 3,
    autoReset: true,
  },
  access: {
    mode: "leaders-only",
    passcode: "",
    passcodePermissions: {
      viewRoster: true,
      viewAttendance: false,
      viewNotes: false,
      viewPrayer: false,
    },
  },
  appearance: {
    theme: "auto",
    compactMode: false,
    stickyBottomTabs: true,
  },
  permissions: {
    roles: ["pending", "approved", "leader", "admin"],
    levels: ["none", "view", "edit", "admin"],
    modules: {
      roster: { pending: "view", approved: "edit", leader: "edit", admin: "admin" },
      activity: { pending: "view", approved: "view", leader: "edit", admin: "admin" },
      brainDump: { pending: "none", approved: "edit", leader: "edit", admin: "admin" },
      attendance: { pending: "view", approved: "edit", leader: "edit", admin: "admin" },
      hangoutNotes: { pending: "none", approved: "edit", leader: "edit", admin: "admin" },
      adminland: { pending: "none", approved: "none", leader: "none", admin: "admin" },
      dashboard: { pending: "view", approved: "view", leader: "view", admin: "admin" },
    },
  },
};

export function deepMerge(...sources: object[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const src of sources) {
    if (!src) continue;
    for (const key of Object.keys(src)) {
      const value = (src as Record<string, unknown>)[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        result[key] = deepMerge((result[key] as object) || {}, value as object);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}
