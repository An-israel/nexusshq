import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/nexus";
import type { TopPerformer } from "@/lib/reports/use-report-data";

// ---- Props ----

interface Props {
  topFive: TopPerformer[];
  mostConsistent: (TopPerformer & { variance: number }) | null;
  mostImproved: (TopPerformer & { prevScore: number; improvement: number }) | null;
  loading: boolean;
}

// ---- Medal helpers ----

const MEDALS = ["🥇", "🥈", "🥉"];
const RANK_LABEL = ["#4", "#5"];

function medalLabel(rank: number): string {
  if (rank <= 3) return MEDALS[rank - 1];
  return RANK_LABEL[rank - 4] ?? `#${rank}`;
}

const RANK_BORDER: Record<number, string> = {
  1: "border-[#f59e0b]",
  2: "border-[#9ca3af]",
  3: "border-[#cd7f32]",
};

function rankBorder(rank: number): string {
  return RANK_BORDER[rank] ?? "border-border";
}

// ---- Score circle ----

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 90
      ? "text-green-400"
      : score >= 75
        ? "text-blue-400"
        : score >= 60
          ? "text-amber-400"
          : "text-red-400";
  return (
    <div
      className={cn(
        "w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm shrink-0",
        color,
        score >= 90
          ? "border-green-500/40"
          : score >= 75
            ? "border-blue-500/40"
            : score >= 60
              ? "border-amber-500/40"
              : "border-red-500/40",
      )}
    >
      {score}
    </div>
  );
}

// ---- Avatar ----

function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "w-14 h-14 text-lg"
      : size === "sm"
        ? "w-8 h-8 text-xs"
        : "w-10 h-10 text-sm";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn("rounded-full object-cover shrink-0", sizeClass)}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full bg-blue-600/20 text-blue-300 flex items-center justify-center font-semibold shrink-0",
        sizeClass,
      )}
    >
      {initialsOf(name)}
    </div>
  );
}

// ---- Stat pill ----

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-semibold text-foreground tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
    </div>
  );
}

// ---- Loading skeleton ----

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  );
}

// ---- Main component ----

export function Section7TopPerformers({
  topFive,
  mostConsistent,
  mostImproved,
  loading,
}: Props) {
  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-8">
      {/* Leaderboard */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Top 5 Performers
        </h3>
        {topFive.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No performance data available for this period.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {topFive.map((performer) => (
              <Card
                key={performer.employee.id}
                className={cn(
                  "p-4 border-2 flex flex-col items-center gap-3 text-center transition-shadow hover:shadow-lg",
                  rankBorder(performer.rank),
                )}
              >
                {/* Medal */}
                <span className="text-2xl leading-none">{medalLabel(performer.rank)}</span>

                {/* Avatar */}
                <Avatar
                  name={performer.employee.name}
                  avatarUrl={performer.employee.avatarUrl}
                />

                {/* Name + dept */}
                <div className="min-w-0 w-full">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {performer.employee.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {performer.employee.department
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </p>
                </div>

                {/* Score circle */}
                <ScoreCircle score={performer.score} />

                {/* Mini stats */}
                <div className="flex gap-3 justify-center pt-1 border-t border-border w-full">
                  <StatPill label="Tasks" value={performer.tasksCompleted} />
                  <StatPill label="KPI" value={`${performer.kpiPct}%`} />
                  <StatPill label="Att." value={`${performer.attendancePct}%`} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Special awards */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Most Consistent */}
        <Card className="p-5 bg-green-500/5 border-green-500/20">
          <p className="text-sm font-semibold text-green-400 mb-4">
            🏅 Most Consistent This Month
          </p>
          {mostConsistent ? (
            <div className="flex items-start gap-4">
              <Avatar
                name={mostConsistent.employee.name}
                avatarUrl={mostConsistent.employee.avatarUrl}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-base">
                  {mostConsistent.employee.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mostConsistent.employee.department
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </p>
                <div className="mt-3 flex gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg. Score</p>
                    <p className="text-lg font-bold text-green-400">
                      {mostConsistent.score}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Variation</p>
                    <p className="text-lg font-bold text-foreground">
                      ±{mostConsistent.variance.toFixed(1)} pts
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data available.</p>
          )}
        </Card>

        {/* Most Improved */}
        <Card className="p-5 bg-blue-500/5 border-blue-500/20">
          <p className="text-sm font-semibold text-blue-400 mb-4">
            📈 Most Improved
          </p>
          {mostImproved ? (
            <div className="flex items-start gap-4">
              <Avatar
                name={mostImproved.employee.name}
                avatarUrl={mostImproved.employee.avatarUrl}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-base">
                  {mostImproved.employee.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mostImproved.employee.department
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-sm">
                    {mostImproved.prevScore}
                  </span>
                  <span
                    className="text-blue-400 animate-bounce inline-block"
                    style={{ animationDuration: "1.5s" }}
                  >
                    →
                  </span>
                  <span className="text-foreground font-mono text-sm font-bold">
                    {mostImproved.score}
                  </span>
                  <span className="ml-2 text-green-400 font-semibold text-sm">
                    (+{mostImproved.improvement.toFixed(1)}%)
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last Month → This Month
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No data available.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
