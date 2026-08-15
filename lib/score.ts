// Light Score; the pure engine (no I/O), PORTED DELIBERATELY from v2
// (declared reuse; LIGHT_SCORE_EXTENSION_SPEC: "v2's Light Score was one
// of its strongest, best-tested systems and is reused with its design
// untouched"). What changed in the port, stated plainly:
//
//  - Weights arrive as parameters (rails, per build law) instead of
//    constants; the shipped rail values ARE the v2 constants (answer 5,
//    debate 1, per-discussion participation cap 10).
//  - v2's votes-received inputs (agree/insightful/disagree) do not exist
//    in v3; the platform replaced post-voting with tips, and tips are
//    DELIBERATELY not a score input (LIGHT_SCORE §3: the buy-reputation
//    loop). The disagreement-neutral principle those inputs encoded
//    survives structurally: nothing in v3 scores positions at all.
//
// Principles encoded here, v2 verbatim:
//  - Insight over volume: participation points are capped PER DISCUSSION
//    so raw volume can't be farmed.
//  - Disagreement is NEUTRAL, never punitive.
//  - Per-face, per-pillar; the caller derives one pillar at a time; the
//    anti-sum guard lives in lib/lightScore.ts.

export interface ScoreWeights {
  answer: number; // rail: lightScore.answerPoints
  debatePost: number; // rail: lightScore.debatePostPoints
  participationCapPerDiscussion: number; // rail: lightScore.participationCapPerDiscussion
}

/** One discussion's worth of a face's contributions within a pillar. */
export interface DiscussionContribution {
  discussionId: string;
  answers: number; // top-level posts; the substantive contribution
  debatePosts: number; // threaded replies
}

export interface ScoreLine {
  label: string;
  points: number;
}

export interface ScoreResult {
  points: number;
  lines: ScoreLine[];
}

/** Score one face's Discussion contributions within one pillar. */
export function scorePillar(
  contributions: DiscussionContribution[],
  w: ScoreWeights
): ScoreResult {
  let answers = 0;
  let debate = 0;
  let overCap = 0;

  for (const d of contributions) {
    answers += d.answers;
    debate += d.debatePosts;
    const participation = d.answers * w.answer + d.debatePosts * w.debatePost;
    if (participation > w.participationCapPerDiscussion) {
      overCap += participation - w.participationCapPerDiscussion;
    }
  }

  const answerPts = answers * w.answer;
  const debatePts = debate * w.debatePost;

  const lines: ScoreLine[] = [];
  if (answers) lines.push({ label: `Answers (${answers})`, points: answerPts });
  if (debate) lines.push({ label: `Debate replies (${debate})`, points: debatePts });
  if (overCap) lines.push({ label: "Per-discussion participation cap", points: -overCap });

  return { points: answerPts + debatePts - overCap, lines };
}
