"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Answer = {
  answer: string;
  articles: { slug: string; title: string; summary: string }[];
  escalate: boolean;
  severity: "informational" | "normal" | "high" | "critical";
  generated: boolean;
  secretRejected?: boolean;
};

export function Helpdesk({
  signedIn,
  stage,
  from,
}: {
  signedIn: boolean;
  stage?: string;
  from?: string;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showCase, setShowCase] = useState(false);
  const [caseReference, setCaseReference] = useState("");

  const context = {
    stage: stage || undefined,
    route: from || undefined,
    clientVersion: "web",
  };

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCaseReference("");
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ask", question, context }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The helpdesk could not answer.");
      setAnswer(payload);
      if (payload.escalate || payload.secretRejected) setShowCase(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The helpdesk could not answer.");
    } finally {
      setBusy(false);
    }
  }

  async function openCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "case",
          contactEmail: form.get("contactEmail"),
          category: form.get("category"),
          severity: answer?.severity ?? form.get("severity"),
          subject: form.get("subject"),
          description: form.get("description"),
          sourceArticle: answer?.articles[0]?.slug,
          context,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The support request could not be opened.");
      setCaseReference(payload.reference);
      setShowCase(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The support request could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="helpdesk" aria-labelledby="helpdesk-heading">
      <div className="helpdesk-heading">
        <div>
          <p className="eyebrow">Internal AI helpdesk</p>
          <h2 id="helpdesk-heading">What are you trying to do?</h2>
        </div>
        <span className="helpdesk-boundary">Approved AgoraNet sources only</span>
      </div>
      <p className="lore">
        Describe the problem in your own words. Never paste a Humanity
        Credential, access key, wallet seed phrase, private key, or password.
      </p>
      {(stage || from) && (
        <p className="support-context">
          Context attached: {stage ? `onboarding stage “${stage}”` : "current feature"}
          {from ? ` · ${from}` : ""}. No other identity is visible to Support.
        </p>
      )}
      <form onSubmit={ask} className="helpdesk-ask">
        <label htmlFor="support-question">Your question</label>
        <div className="search-hero">
          <input
            id="support-question"
            type="search"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="I’m stuck at verification…"
            maxLength={2000}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? "Checking…" : "Ask Support"}
          </button>
        </div>
      </form>

      {error && <p className="notice support-error">{error}</p>}

      {answer && (
        <div className="helpdesk-answer" aria-live="polite">
          <p className="eyebrow">
            {answer.generated ? "AI answer · grounded in approved help" : "Approved help match"}
          </p>
          <p>{answer.answer}</p>
          {answer.articles.length > 0 && (
            <div className="helpdesk-sources">
              <strong>Read next</strong>
              {answer.articles.map((article) => (
                <Link key={article.slug} href={`/support/${article.slug}`}>
                  {article.title} →
                </Link>
              ))}
            </div>
          )}
          <div className="helpdesk-actions">
            <button type="button" onClick={() => setShowCase(true)}>
              Still need help? Open a request
            </button>
            <button type="button" className="quiet-button" onClick={() => setAnswer(null)}>
              Ask another question
            </button>
          </div>
        </div>
      )}

      {!answer && (
        <button type="button" className="linklike support-open-case" onClick={() => setShowCase(true)}>
          Skip self-service and open a support request
        </button>
      )}

      {showCase && (
        <form onSubmit={openCase} className="support-case-form">
          <div className="support-case-heading">
            <div>
              <p className="eyebrow">Human escalation</p>
              <h3>Open a support request</h3>
            </div>
            <button type="button" className="linklike" onClick={() => setShowCase(false)}>
              Close
            </button>
          </div>
          <label>
            Reply email {signedIn ? "(optional)" : ""}
            <input type="email" name="contactEmail" required={!signedIn} maxLength={254} />
          </label>
          <div className="support-form-row">
            <label>
              Category
              <select name="category" defaultValue={stage ? "onboarding" : "technical"}>
                <option value="onboarding">Onboarding</option>
                <option value="verification">Verification</option>
                <option value="identity-and-keys">Identity and keys</option>
                <option value="wallet-and-transactions">Wallet and transactions</option>
                <option value="technical">Technical problem</option>
                <option value="privacy-and-safety">Privacy or safety</option>
                <option value="moderation">Moderation</option>
                <option value="other">Other</option>
              </select>
            </label>
            {!answer && (
              <label>
                Urgency
                <select name="severity" defaultValue="normal">
                  <option value="informational">Question</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            )}
          </div>
          <label>
            Subject
            <input
              type="text"
              name="subject"
              defaultValue={question.slice(0, 140)}
              maxLength={140}
              required
            />
          </label>
          <label>
            What happened?
            <textarea
              name="description"
              defaultValue={question}
              minLength={20}
              maxLength={5000}
              rows={6}
              required
            />
          </label>
          <p className="field-help">
            We attach only the current stage or feature. Review your message;
            secrets and unrelated personal information do not belong here.
          </p>
          <button type="submit" disabled={busy}>
            {busy ? "Opening…" : "Confirm and open request"}
          </button>
        </form>
      )}

      {caseReference && (
        <div className="notice support-case-success" aria-live="polite">
          <strong>Request opened: {caseReference}</strong>
          <br />Keep this reference. The request is recorded for human review
          {signedIn ? "; a reply email helps the team reach you" : " using the reply email you provided"}.
        </div>
      )}
    </section>
  );
}
