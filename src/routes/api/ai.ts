import { createFileRoute } from "@tanstack/react-router";

// Calls Anthropic Claude API server-side so the API key is never exposed to the browser.
// ANTHROPIC_API_KEY must be set in Cloudflare Workers environment variables.
export const Route = createFileRoute("/api/ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
        if (!apiKey) {
          return Response.json(
            {
              error:
                "AI features require ANTHROPIC_API_KEY to be set in your environment variables.",
            },
            { status: 500 },
          );
        }

        let body: { action: string; context?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { action, context = {} } = body;
        const { systemPrompt, userPrompt, maxTokens } = buildPrompt(action, context);

        if (!userPrompt) {
          return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }

        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: maxTokens ?? 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          let errMsg = errText;
          try {
            const parsed = JSON.parse(errText) as {
              error?: { message?: string };
              message?: string;
            };
            errMsg = parsed.error?.message ?? parsed.message ?? errText;
          } catch {
            /* leave as raw text */
          }
          if (resp.status === 401)
            errMsg =
              "Invalid Anthropic API key. Please update ANTHROPIC_API_KEY in your server environment variables.";
          return Response.json({ error: errMsg }, { status: 502 });
        }

        const data = (await resp.json()) as {
          content: Array<{ type: string; text: string }>;
        };
        const text = data.content.find((c) => c.type === "text")?.text ?? "";
        return Response.json({ result: text });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});

// ─── Prompt builders ──────────────────────────────────────────────────────────

type PromptSpec = { systemPrompt: string; userPrompt: string; maxTokens?: number };

function buildPrompt(
  action: string,
  ctx: Record<string, unknown>,
): PromptSpec & { userPrompt: string | null } {
  const base =
    "You are an AI assistant for Nexxos HQ, an internal team management platform. Be concise, practical, and action-oriented.";

  switch (action) {
    // ── Feature 1: performance insights ─────────────────────────────────────
    case "performance-insights": {
      const name = ctx.name as string;
      const scores = ctx.scores as Record<string, number>;
      const strengths = ctx.strengths as string;
      const improvements = ctx.improvements as string;
      return {
        systemPrompt: base,
        userPrompt: `Analyse the following performance review for ${name} and provide 3-5 bullet-point insights with one recommended action.

Scores (out of 5):
- Productivity: ${scores.productivity}
- Quality: ${scores.quality}
- Attendance: ${scores.attendance}
- Collaboration: ${scores.collaboration}

Strengths: ${strengths || "N/A"}
Areas to improve: ${improvements || "N/A"}

Respond in plain text, no markdown headings.`,
        maxTokens: 512,
      };
    }

    // ── Feature 2: burnout risk for a single employee ────────────────────────
    case "burnout-risk": {
      const name = ctx.name as string;
      const overtimeMinutes = ctx.overtimeMinutes as number;
      const missedClockOuts = ctx.missedClockOuts as number;
      const overdueTasks = ctx.overdueTasks as number;
      const lateDays = ctx.lateDays as number;
      return {
        systemPrompt: base,
        userPrompt: `Assess burnout risk for employee "${name}" based on the past 4 weeks:
- Overtime minutes logged: ${overtimeMinutes}
- Missed clock-outs: ${missedClockOuts}
- Overdue tasks: ${overdueTasks}
- Late clock-in days: ${lateDays}

Return ONLY a JSON object (no markdown):
{"risk_level":"low|medium|high","reason":"one sentence explanation"}`,
        maxTokens: 128,
      };
    }

    // ── Feature 3: task description helper ──────────────────────────────────
    case "task-description": {
      const title = ctx.title as string;
      const dept = ctx.department as string;
      return {
        systemPrompt: base,
        userPrompt: `Write a clear, concise task description (2-3 sentences) for the following task in the ${dept ?? "general"} department:

Task title: "${title}"

Write the description only. No bullet points, no headers.`,
        maxTokens: 150,
      };
    }

    // ── Feature 4: weekly summary (for email body) ───────────────────────────
    case "weekly-summary": {
      const stats = ctx.stats as {
        totalTasks: number;
        completedTasks: number;
        overdueTasks: number;
        presentDays: number;
        absentDays: number;
        topDept: string;
      };
      return {
        systemPrompt: base,
        userPrompt: `Write a friendly, motivating 3-paragraph weekly summary email body for the Nexxos HQ team.

Last week's stats:
- Tasks completed: ${stats.completedTasks} / ${stats.totalTasks}
- Overdue tasks: ${stats.overdueTasks}
- Most active department: ${stats.topDept}
- Attendance: ${stats.presentDays} present days, ${stats.absentDays} absent days

Start with "Hi team,". End with "Have a great week ahead!"`,
        maxTokens: 400,
      };
    }

    // ── Feature 5: burnout / flight-risk team analysis ───────────────────────
    case "burnout-analysis": {
      const employees = ctx.employees as unknown[];
      return {
        systemPrompt: base,
        userPrompt: `You are an HR analytics AI. Analyze the following 30-day employee data and identify burnout/flight risk signals.

For each employee, return a JSON array (no other text) in this format:
[{"userId":"...","name":"...","risk":"high|medium|low","summary":"one sentence","signals":["signal 1","signal 2"]}]

Risk levels: "high" = multiple concerning signals, "medium" = 1-2 signals, "low" = healthy patterns.
Signals to watch: >4 absences, >6 late arrivals, declining task completion, >2 overdue tasks, >2 leave requests.

Employee data (30 days):
${JSON.stringify(employees, null, 2)}`,
        maxTokens: 2048,
      };
    }

    default:
      return { systemPrompt: base, userPrompt: null as unknown as string, maxTokens: 256 };
  }
}
