import { createFileRoute, redirect } from "@tanstack/react-router";

// KPIs now live as a tab on the merged Goals & KPIs page — redirect old
// bookmarks/links there instead of maintaining a separate page.
export const Route = createFileRoute("/_app/$workspaceSlug/kpis")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: `/${params.workspaceSlug}/okrs` as never });
  },
});
