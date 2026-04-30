import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, role } = useAuth();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {profile?.full_name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's a snapshot of your {role === "admin" ? "organization" : "work"} today.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Dashboard widgets coming online as we build out each module.
      </div>
    </div>
  );
}
