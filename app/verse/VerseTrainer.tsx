"use client";

import { useEffect, useMemo, useState } from "react";
import StudentScreen from "../components/StudentScreen";
import type { MenuSummary } from "../lib/data";

const LEVEL_LABELS = ["Read it", "Fill the gaps", "Mostly gone", "From memory"];
const LEVEL_FRACTIONS = [0, 0.25, 0.65, 1];
const STREAK_KEY = "anthemVerseStreakDates";

function significance(word: string) {
  return word.replace(/[^a-zA-Z']/g, "").length;
}

function blankedIndicesForLevel(words: string[], level: number): Set<number> {
  const fraction = LEVEL_FRACTIONS[level - 1];
  const count = Math.round(words.length * fraction);
  if (count === 0) return new Set();
  const ranked = words
    .map((w, i) => ({ i, score: significance(w) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, count)
    .map((x) => x.i);
  return new Set(ranked);
}

// Local, on-device streak: today's date gets recorded the moment the
// trainer is opened, and the streak counts back from today across
// consecutive calendar days. No server table — same "stays on the
// device" rule as journal entries.
function recordVisitAndComputeStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    const dates: string[] = raw ? JSON.parse(raw) : [];
    const today = new Date().toISOString().slice(0, 10);
    const set = new Set(dates);
    set.add(today);
    const sorted = [...set].sort().slice(-60);
    localStorage.setItem(STREAK_KEY, JSON.stringify(sorted));

    let streak = 0;
    const cursor = new Date(`${today}T00:00:00Z`);
    while (set.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  } catch {
    return 0;
  }
}

export default function VerseTrainer({
  reference,
  text,
  menu,
}: {
  reference: string;
  text: string;
  menu: MenuSummary;
}) {
  const words = useMemo(() => text.split(" "), [text]);
  const [level, setLevel] = useState(2);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(recordVisitAndComputeStreak());
  }, []);

  const blanked = useMemo(() => blankedIndicesForLevel(words, level), [words, level]);

  function goToLevel(next: number) {
    setLevel(Math.min(4, Math.max(1, next)));
    setRevealed(new Set());
  }

  function reveal(i: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }

  return (
    <StudentScreen appbar={{ mode: "back", href: "/", label: "This week", step: "Memory verse" }} menu={menu}>
      <h1 className="sr-only">Memory verse</h1>

      {/* The level control used to be four 3px bars with no label and no
          tap target — the level's name lived only in an aria-label. */}
      <div className="levelbar" role="group" aria-label="How much of the verse to hide">
        {[1, 2, 3, 4].map((l) => (
          <button key={l} type="button" aria-pressed={l === level} onClick={() => goToLevel(l)}>
            <b>{l}</b>
            <small>{LEVEL_LABELS[l - 1]}</small>
            <i className={l <= level ? "on" : ""} />
          </button>
        ))}
      </div>

      <div className="versecard">
        <div className="versetext">
          &ldquo;
          {words.map((word, i) => {
            const isBlank = blanked.has(i);
            const isRevealed = revealed.has(i);
            if (!isBlank || isRevealed) {
              return <span key={i}>{word} </span>;
            }
            return (
              // The trailing space matters: without it a blank runs straight
              // into the next word ("____all your").
              <span key={i}>
                <button
                  type="button"
                  className="blank"
                  aria-label="Tap to reveal word"
                  onClick={() => reveal(i)}
                  style={{ width: `${Math.max(2, word.length) * 0.62}em` }}
                />{" "}
              </span>
            );
          })}
          &rdquo;
        </div>
        <div className="verseref">{reference}</div>
      </div>

      {blanked.size > 0 && <p className="hintline">Tap any blank to reveal that word.</p>}

      <div className="stat">
        <b>{streak}</b>
        <span>Day streak</span>
      </div>

      <div className="stack snug">
        {level < 4 ? (
          <button className="btn pink" onClick={() => goToLevel(level + 1)}>
            Hide more words
          </button>
        ) : (
          <button className="btn pink" disabled>
            All words hidden
          </button>
        )}

        {level > 1 ? (
          <button className="btn ghost" onClick={() => goToLevel(level - 1)}>
            Show more words
          </button>
        ) : (
          <button className="btn ghost" onClick={() => goToLevel(4)}>
            Say it from memory
          </button>
        )}
      </div>
    </StudentScreen>
  );
}
