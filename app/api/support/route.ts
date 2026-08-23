import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activeFace, ensureSessionId } from "@/lib/webSession";
import { enforceRateLimit, RateLimitError } from "@/lib/rateLimit";
import {
  answerSupportQuestion,
  createSupportCase,
  type SafeSupportContext,
} from "@/lib/support";

export const dynamic = "force-dynamic";

type SupportRequest = {
  action?: "ask" | "case";
  question?: string;
  contactEmail?: string;
  category?: string;
  severity?: string;
  subject?: string;
  description?: string;
  sourceArticle?: string;
  context?: SafeSupportContext;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SupportRequest;
    const face = await activeFace();
    const sessionId = await ensureSessionId();
    const limiterKey = face?.id ?? `session:${sessionId}`;

    if (body.action === "ask") {
      const question = String(body.question ?? "").trim();
      if (question.length < 3) {
        return NextResponse.json({ error: "Ask a complete question." }, { status: 400 });
      }
      await enforceRateLimit(db, "supportHelp", limiterKey);
      await enforceRateLimit(db, "global", limiterKey);
      const answer = await answerSupportQuestion({
        question,
        context: body.context,
        safetyKey: limiterKey,
      });
      return NextResponse.json(answer);
    }

    if (body.action === "case") {
      await enforceRateLimit(db, "supportCases", limiterKey);
      await enforceRateLimit(db, "global", limiterKey);
      const result = await createSupportCase(db, {
        profileId: face?.id,
        contactEmail: body.contactEmail,
        category: String(body.category ?? "other"),
        severity: String(body.severity ?? "normal"),
        subject: String(body.subject ?? ""),
        description: String(body.description ?? ""),
        context: body.context,
        sourceArticle: body.sourceArticle,
      });
      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown support action." }, { status: 400 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    const message = error instanceof Error ? error.message : "Support is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
