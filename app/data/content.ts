// Hard-coded placeholder content for screen review. No database, no fetching.

export const week = {
  seriesName: "Pressure",
  seriesWeekNumber: 2,
  seriesWeekTotal: 4,
  title: "When You Can't Hold It Together",
  bigIdea: "You were never the one holding it together.",
  verseReference: "1 Peter 5:7",
  verseTranslation: "WEB",
  verseText: "Casting all your worries on him, because he cares for you.",
  recap:
    "We looked at 1 Peter 5 and talked about the pressure to keep it together — at school, at home, online — and what it means to hand that weight to God instead of managing it alone.",
  headsUp:
    "We named anxiety directly tonight. Some students may bring it up this week. If yours does, you don't need a perfect answer — just don't change the subject.",
  starters: [
    "What's something everyone assumes you're fine about?",
    "When you're stressed, do you get loud or go quiet?",
    "What's one thing I could take off your plate this week?",
  ],
};

export type Day = {
  number: 1 | 2 | 3;
  title: string;
  minutes: number;
  passageReference: string;
  passageText: string;
  thought: string;
  question: string;
};

export const days: Day[] = [
  {
    number: 1,
    title: "The Handoff",
    minutes: 4,
    passageReference: "1 Peter 5:6–7 · WEB",
    passageText:
      '"Humble yourselves therefore under the mighty hand of God, that he may exalt you in due time; casting all your worries on him, because he cares for you."',
    thought:
      "Handing something off isn't the same as pretending it's not heavy. Peter says to cast it — throw it, deliberately — not quietly manage it until it stops hurting.",
    question: "Where do you carry something alone that you could hand off?",
  },
  {
    number: 2,
    title: "Weak Is Not Broken",
    minutes: 4,
    passageReference: "2 Corinthians 12:9 · WEB",
    passageText: '"My grace is sufficient for you, for my power is made perfect in weakness."',
    thought:
      "Paul asked God three times to take something hard away. God said no — and then told him why. The weak spot wasn't the problem. It was the place where God showed up most obviously.",
    question: "Where are you pretending to be fine?",
  },
  {
    number: 3,
    title: "The Trade",
    minutes: 4,
    passageReference: "Matthew 11:28 · WEB",
    passageText: '"Come to me, all you who labor and are heavily burdened, and I will give you rest."',
    thought:
      "It's not a trade of hard for nothing — it's hard for a lighter kind of hard, carried with someone instead of alone.",
    question: "What would it look like to actually rest this week?",
  },
];

export const verse = {
  reference: "1 Peter 5:7",
  translation: "WEB",
  text: "Casting all your worries on him, because he cares for you.",
  streak: 6,
};

export type EventItem = {
  day: string;
  month: string;
  title: string;
  timeLabel: string;
  location: string;
  detail: string;
};

export const events: EventItem[] = [
  {
    day: "27",
    month: "Aug",
    title: "Fall Kickoff Night",
    timeLabel: "6:30 PM",
    location: "Main Room",
    detail: "Bring a friend · free tacos",
  },
  {
    day: "12",
    month: "Sep",
    title: "Parent + Student Night",
    timeLabel: "6:30 PM",
    location: "Main Room",
    detail: "Come together, leave with a plan",
  },
  {
    day: "03",
    month: "Oct",
    title: "Fall Retreat",
    timeLabel: "Fri–Sun",
    location: "Oak Glen",
    detail: "$149 · Deposit due Sep 12",
  },
];

// ── archive ──────────────────────────────────────────────────────────
// Past weeks are browsable forever and open exactly like a normal week,
// just read-only. Each entry carries its own full day content so tapping
// a week in the archive actually goes somewhere.

export type ArchiveDay = {
  number: 1 | 2 | 3;
  title: string;
  passageReference: string;
  passageText: string;
  thought: string;
  question: string;
};

export type ArchiveWeek = {
  id: string;
  weekLabel: string;
  title: string;
  bigIdea: string;
  verseReference: string;
  verseText: string;
  passage: string;
  date: string;
  progress?: string;
  complete?: boolean;
  isCurrent?: boolean;
  days: ArchiveDay[];
};

export type ArchiveSeries = {
  name: string;
  weeks: ArchiveWeek[];
};

export const archive: ArchiveSeries[] = [
  {
    name: "Pressure",
    weeks: [
      {
        id: "pressure-w2",
        weekLabel: "W2",
        title: week.title,
        bigIdea: week.bigIdea,
        verseReference: week.verseReference,
        verseText: week.verseText,
        passage: "1 Peter 5",
        date: "Aug 13",
        progress: "3 of 3 done",
        complete: true,
        isCurrent: true,
        days: days.map((d) => ({
          number: d.number,
          title: d.title,
          passageReference: d.passageReference,
          passageText: d.passageText,
          thought: d.thought,
          question: d.question,
        })),
      },
      {
        id: "pressure-w1",
        weekLabel: "W1",
        title: "Everybody's Carrying Something",
        bigIdea: "You don't have to pretend the weight isn't there.",
        verseReference: "Psalm 42:11",
        verseText: "Why are you in despair, my soul? Hope in God, for I shall still praise him.",
        passage: "Psalm 42",
        date: "Aug 6",
        progress: "1 of 3 done",
        days: [
          {
            number: 1,
            title: "Permission To Not Be Fine",
            passageReference: "Psalm 42:1–3 · WEB",
            passageText:
              '"As the deer pants for the water brooks, so my soul pants after you, God... my tears have been my food day and night."',
            thought:
              "The psalmist doesn't skip the hard part to get to the hopeful part. He says the honest thing first — I'm thirsty, I'm crying — and God can handle both halves.",
            question: "What's the honest thing you haven't said out loud this week?",
          },
          {
            number: 2,
            title: "Talking To Yourself",
            passageReference: "Psalm 42:5 · WEB",
            passageText: '"Why are you in despair, my soul? ... hope in God."',
            thought:
              "He literally talks to his own soul like a coach, not a critic. That's a different move than most of us make when we're low.",
            question: "What would you say if you talked to yourself like that today?",
          },
          {
            number: 3,
            title: "Carrying It With Someone",
            passageReference: "Psalm 42:8 · WEB",
            passageText:
              '"Yahweh will command his loving kindness in the daytime. In the night his song shall be with me."',
            thought: "The chapter doesn't end with the weight gone — it ends with him not carrying it alone anymore.",
            question: "Who's one person you could actually tell this week?",
          },
        ],
      },
    ],
  },
  {
    name: "Who Jesus Says You Are",
    weeks: [
      {
        id: "who-jesus-w4",
        weekLabel: "W4",
        title: "Chosen, Not Lucky",
        bigIdea: "You weren't picked because you got lucky. You were picked on purpose.",
        verseReference: "Ephesians 1:4",
        verseText:
          "Even as he chose us in him before the foundation of the world, that we would be holy and without defect before him in love.",
        passage: "Ephesians 1",
        date: "Jul 30",
        days: [
          {
            number: 1,
            title: "Before You Did Anything",
            passageReference: "Ephesians 1:4 · WEB",
            passageText:
              '"Even as he chose us in him before the foundation of the world, that we would be holy and without defect before him in love."',
            thought: "This happened before you'd done a single thing right or wrong. It was never a performance review.",
            question: "What would change if you actually believed that?",
          },
          {
            number: 2,
            title: "Not An Accident",
            passageReference: "Ephesians 1:11 · WEB",
            passageText:
              '"...having been foreordained according to the purpose of him who works all things after the counsel of his will."',
            thought: "Chosen and planned are different from lucky. Lucky runs out. Planned doesn't.",
            question: "Where in your life does it feel like an accident instead of a plan?",
          },
          {
            number: 3,
            title: "Adopted, Not Just Allowed",
            passageReference: "Ephesians 1:5 · WEB",
            passageText:
              '"having predestined us for adoption as children through Jesus Christ to himself..."',
            thought: "Adoption is a choice made on purpose, over and over, not a one-time technicality.",
            question: "What's one place you've been waiting to be picked?",
          },
        ],
      },
      {
        id: "who-jesus-w3",
        weekLabel: "W3",
        title: "The Name You Answer To",
        bigIdea: "The name you answer to shapes the life you live.",
        verseReference: "John 1:12",
        verseText:
          "But as many as received him, to them he gave the right to become God's children, to those who believe in his name.",
        passage: "John 1",
        date: "Jul 23",
        days: [
          {
            number: 1,
            title: "The Names That Stick",
            passageReference: "John 1:12 · WEB",
            passageText:
              '"But as many as received him, to them he gave the right to become God\'s children, to those who believe in his name."',
            thought:
              "Some names get given to us by other people — a rumor, a bad week, a label that stuck. This one gets given by God.",
            question: "What's a name or label you've been carrying that isn't true anymore?",
          },
          {
            number: 2,
            title: "Known Before You Walked In",
            passageReference: "John 1:47–48 · WEB",
            passageText:
              '"Behold, an Israelite indeed, in whom is no deceit!... Before Philip called you, when you were under the fig tree, I saw you."',
            thought:
              "Jesus named Nathanael's character before Nathanael ever said a word. He sees you the same way — before the introduction.",
            question: "What do you think Jesus sees in you that you don't say out loud?",
          },
          {
            number: 3,
            title: "Becoming What You're Called",
            passageReference: "John 1:42 · WEB",
            passageText:
              '"He brought him to Jesus. Jesus looked at him, and said, \'You are Simon... You shall be called Cephas\' (which is by interpretation, Peter)."',
            thought:
              "Jesus renamed Simon before Simon had earned it — Peter means \"rock,\" and he was anything but steady yet.",
            question: "What's the name you're still growing into?",
          },
        ],
      },
      {
        id: "who-jesus-w2",
        weekLabel: "W2",
        title: "Found On Purpose",
        bigIdea: "You were never too far gone to come looking for.",
        verseReference: "Luke 15:6",
        verseText: "...he calls together his friends and his neighbors, saying, 'Rejoice with me, for I have found my sheep which was lost!'",
        passage: "Luke 15",
        date: "Jul 16",
        days: [
          {
            number: 1,
            title: "Worth Going After",
            passageReference: "Luke 15:4 · WEB",
            passageText:
              "\"What man of you, having a hundred sheep, if he loses one of them, doesn't leave the ninety-nine in the wilderness, and go after that which is lost, until he finds it?\"",
            thought: "Ninety-nine were fine. He went after the one anyway. That's not how math works — it's how love works.",
            question: "Where do you feel like the one instead of the ninety-nine?",
          },
          {
            number: 2,
            title: "The Whole Way Home",
            passageReference: "Luke 15:20 · WEB",
            passageText:
              '"But while he was still far off, his father saw him, and was moved with compassion, and ran, and fell on his neck, and kissed him."',
            thought: "The father didn't wait at the door. He was already running before the apology was finished.",
            question: "What's kept you from turning around sooner?",
          },
          {
            number: 3,
            title: "The Party Is The Point",
            passageReference: "Luke 15:23–24 · WEB",
            passageText:
              '"...bring the fattened calf, kill it, and let us eat, and celebrate; for this, my son, was dead, and is alive again..."',
            thought:
              "The story doesn't end at forgiveness. It ends at a party. Being found isn't just tolerated — it's celebrated.",
            question: "What would it look like to actually believe you're celebrated, not just allowed back?",
          },
        ],
      },
    ],
  },
];

export function findArchiveWeek(id: string): ArchiveWeek | undefined {
  for (const series of archive) {
    const found = series.weeks.find((w) => w.id === id);
    if (found) return found;
  }
  return undefined;
}
