import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/notifications")({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="text-sm text-muted-foreground">Notifications feed ships in Phase 5.</p>
    </div>
  ),
});
