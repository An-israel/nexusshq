import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/tasks")({
  component: () => (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">My Tasks</h1>
      <p className="text-sm text-muted-foreground">Task management ships in Phase 3.</p>
    </div>
  ),
});
