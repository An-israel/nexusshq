import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/attendance")({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">My Attendance</h1>
      <p className="text-sm text-muted-foreground">Attendance ships in Phase 4.</p>
    </div>
  ),
});
