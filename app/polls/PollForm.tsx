import { submitPoll } from "@/app/actions";

// The creation form (POLLS §4). Governance polls: always sealed, candle
// close — the form says so instead of offering a live-tally choice.
export function PollForm({
  pillarId,
  isGovernance,
  backTo,
}: {
  pillarId: string;
  isGovernance: boolean;
  backTo: string;
}) {
  return (
    <form action={submitPoll} className="composer">
      <input type="hidden" name="pillarId" value={pillarId} />
      <input type="hidden" name="isGovernance" value={isGovernance ? "1" : "0"} />
      <input type="hidden" name="backTo" value={backTo} />
      <label>
        The question
        <input type="text" name="title" required maxLength={200} />
      </label>
      <label>
        Context (optional)
        <input type="text" name="description" maxLength={500} />
      </label>
      <label>
        Options — one per line
        <textarea name="options" required placeholder={"Yes\nNo"} />
      </label>
      <label>
        Type{" "}
        <select name="type" defaultValue="single">
          <option value="single">Single choice</option>
          <option value="multi">Multiple choice</option>
          <option value="consensus">Consensus (threshold to pass)</option>
        </select>
      </label>{" "}
      <label>
        Consensus threshold %{" "}
        <input type="number" name="thresholdPercent" min={50} max={100} defaultValue={60} style={{ width: "4rem" }} />
      </label>
      <br />
      <label>
        Vote visibility{" "}
        <select name="mode" defaultValue="pseudonymous">
          <option value="pseudonymous">Pseudonymous — aggregate only, ever</option>
          <option value="public">Public — who voted how, on this poll's record</option>
        </select>
      </label>{" "}
      <label>
        Duration (hours){" "}
        <input type="number" name="durationHours" min={1} defaultValue={72} style={{ width: "5rem" }} />
      </label>
      <br />
      {isGovernance ? (
        <p className="interim-note">
          Governance poll: sealed tally (no option) and the candle close —
          the true end is drawn at random inside the final stretch,
          committed as a hash now, revealed with the results.
        </p>
      ) : (
        <label>
          <input type="checkbox" name="liveTally" /> Show a live tally while
          open (ordinary polls only; sealed is the default)
        </label>
      )}
      <p />
      <button type="submit">
        {isGovernance ? "Open governance poll" : "Open poll"}
      </button>
    </form>
  );
}
