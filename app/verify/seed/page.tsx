import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { activeFace } from "@/lib/webSession";
import { seedQuestions } from "@/lib/valuesSeed";
import { submitSeedAnswer } from "@/app/actions";

export const dynamic = "force-dynamic";

// Stage 5 — the values seed: one OUSIA question per pillar. Encouraged,
// never blocking; answers are matchmaking-only and never public.
export default async function SeedPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; m?: string }>;
}) {
  const { returnTo, m } = await searchParams;
  const face = await activeFace();
  if (!face) redirect("/verify");

  const [questions, answers] = await Promise.all([
    seedQuestions(db),
    db.valuesAnswer.findMany({ where: { profileId: face.id } }),
  ]);
  const answeredIds = new Set(answers.map((a) => a.questionId));
  const done = questions.filter((q) => answeredIds.has(q.id)).length;
  const finishHref = `/verify/done${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  return (
    <div className="ceremony">
      <h2>The values seed — seven questions, one per pillar</h2>
      <p>
        Your answers seed Circle matchmaking later. They are{" "}
        <strong>never public</strong> — matchmaking-only, by design. Answer
        any, skip any; you can return from the pillar dashboards anytime.
        ({done}/7 answered)
      </p>
      {m && <div className="notice">{m}</div>}
      {questions.map((q) => (
        <details key={q.id} open={!answeredIds.has(q.id) && done < 2}>
          <summary>
            {q.pillar.icon} <strong>{q.pillar.name}</strong>
            {answeredIds.has(q.id) ? " ✓" : ""}
          </summary>
          <p className="lore">{q.text}</p>
          <form action={submitSeedAnswer} className="composer">
            <input type="hidden" name="questionId" value={q.id} />
            <input type="hidden" name="returnTo" value={returnTo ?? ""} />
            <textarea
              name="body"
              defaultValue={answers.find((a) => a.questionId === q.id)?.body ?? ""}
              placeholder="In your own words — a sentence is plenty."
            />
            <button type="submit">Save answer</button>
          </form>
        </details>
      ))}
      <p>
        <Link href={finishHref}>
          {done > 0 ? "Finish onboarding →" : "Skip for now →"}
        </Link>
      </p>
    </div>
  );
}
