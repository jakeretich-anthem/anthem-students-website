"use client";

import { useMemo, useState } from "react";
import StudentScreen from "../components/StudentScreen";
import { verse } from "../data/content";

const LEVEL_LABELS = ["Read it", "Fill the gaps", "Mostly gone", "From memory"];
const LEVEL_FRACTIONS = [0, 0.25, 0.65, 1];

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

export default function VersePage() {
  const words = useMemo(() => verse.text.split(" "), []);
  const [level, setLevel] = useState(2);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

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
    <StudentScreen appbar={{ mode: "back", href: "/", label: "This week", step: "Memory verse" }}>
      <div className="tape">
        Level {level} of 4 · {LEVEL_LABELS[level - 1]}
      </div>

      <div className="levelbar" role="group" aria-label="Choose difficulty level">
        {[1, 2, 3, 4].map((l) => (
          <button
            key={l}
            aria-label={`Level ${l}: ${LEVEL_LABELS[l - 1]}`}
            aria-pressed={l === level}
            onClick={() => goToLevel(l)}
          >
            <i className={l <= level ? "on" : ""} />
          </button>
        ))}
      </div>

      <div className="versecard" style={{ padding: "21px 18px" }}>
        <div className="versetext" style={{ fontSize: 19, lineHeight: 1.6 }}>
          &ldquo;
          {words.map((word, i) => {
            const isBlank = blanked.has(i);
            const isRevealed = revealed.has(i);
            if (!isBlank || isRevealed) {
              return <span key={i}>{word} </span>;
            }
            return (
              <button
                key={i}
                className="blank"
                aria-label="Tap to reveal word"
                onClick={() => reveal(i)}
                style={{ width: `${Math.max(2, word.length) * 0.62}em` }}
              />
            );
          })}
          &rdquo;
        </div>
        <div className="verseref">{verse.reference}</div>
      </div>

      <div style={{ height: 12 }} />

      {blanked.size > 0 && (
        <div className="card" style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10,
              letterSpacing: ".16em",
              color: "var(--ash)",
              textTransform: "uppercase",
            }}
          >
            Tap a blank to reveal it
          </div>
        </div>
      )}

      <div style={{ height: 12 }} />

      <div className="stat">
        <b>{verse.streak}</b>
        <span>Day streak</span>
      </div>

      <div style={{ height: 4 }} />

      {level < 4 ? (
        <button className="btn pink" onClick={() => goToLevel(level + 1)}>
          Hide more words
        </button>
      ) : (
        <button className="btn pink" disabled>
          All words hidden
        </button>
      )}

      <div style={{ height: 9 }} />

      {level > 1 ? (
        <button className="btn ghost" onClick={() => goToLevel(level - 1)}>
          Show more words
        </button>
      ) : (
        <button className="btn ghost" onClick={() => goToLevel(4)}>
          Say it from memory
        </button>
      )}
    </StudentScreen>
  );
}
