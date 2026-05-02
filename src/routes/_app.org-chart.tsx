import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deptLabel, initialsOf } from "@/lib/nexus";

export const Route = createFileRoute("/_app/org-chart")({
  component: OrgChartPage,
});

interface OrgProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  reports_to: string | null;
  role: string | null;
}

type OrgProfileBase = Omit<OrgProfile, "role">;

function OrgChartPage() {
  const { isManager } = useAuth();
  const [people, setPeople] = React.useState<OrgProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deptFilter, setDeptFilter] = React.useState<string>("all");

  React.useEffect(() => {
    setLoading(true);
    void Promise.all([
      supabase.from("profiles").select("id, full_name, email, department, job_title, reports_to").eq("is_active", true),
      supabase.from("user_roles").select("user_id, role"),
    ]).then(([profileRes, roleRes]) => {
      const roleMap: Record<string, string> = {};
      (roleRes.data ?? []).forEach((r: { user_id: string; role: string }) => {
        // Pick highest if multiple roles
        const rank: Record<string, number> = { admin: 0, manager: 1, employee: 2 };
        if (!(r.user_id in roleMap) || rank[r.role] < rank[roleMap[r.user_id]]) {
          roleMap[r.user_id] = r.role;
        }
      });
      const merged: OrgProfile[] = ((profileRes.data ?? []) as OrgProfileBase[]).map((p) => ({
        ...p,
        role: roleMap[p.id] ?? "employee",
      }));
      setPeople(merged);
      setLoading(false);
    });
  }, []);

  const filtered = React.useMemo(
    () => deptFilter === "all" ? people : people.filter((p) => p.department === deptFilter),
    [people, deptFilter],
  );

  // Build tree from filtered list
  const tree = React.useMemo(() => buildTree(filtered, people), [filtered, people]);

  const depts = React.useMemo(
    () => Array.from(new Set(people.map((p) => p.department).filter(Boolean))) as string[],
    [people],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Org Chart</h1>
          <p className="text-sm text-muted-foreground">Team hierarchy and reporting structure.</p>
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {depts.map((d) => <SelectItem key={d} value={d}>{deptLabel(d)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto pb-4">
          {tree.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No team members found.{" "}
              {isManager && "Set reporting lines in team member profiles to build the hierarchy."}
            </Card>
          ) : (
            <TreeLevel nodes={tree} allPeople={people} />
          )}
          {isManager && (
            <p className="mt-4 text-xs text-muted-foreground">
              Tip: set each team member's "Reports to" in their profile to build the hierarchy.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface TreeNode {
  person: OrgProfile;
  children: TreeNode[];
}

function buildTree(filtered: OrgProfile[], all: OrgProfile[]): TreeNode[] {
  const filteredIds = new Set(filtered.map((p) => p.id));
  // Roots = people whose manager is not in the filtered set (or has no manager)
  const roots = filtered.filter(
    (p) => !p.reports_to || !filteredIds.has(p.reports_to),
  );

  function buildChildren(parentId: string): TreeNode[] {
    return filtered
      .filter((p) => p.reports_to === parentId)
      .map((p) => ({ person: p, children: buildChildren(p.id) }));
  }

  return roots.map((r) => ({ person: r, children: buildChildren(r.id) }));
}

function TreeLevel({ nodes, allPeople }: { nodes: TreeNode[]; allPeople: OrgProfile[] }) {
  return (
    <div className="flex gap-6 justify-center">
      {nodes.map((node) => (
        <div key={node.person.id} className="flex flex-col items-center">
          <PersonCard person={node.person} />
          {node.children.length > 0 && (
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-border" />
              <div className="relative flex gap-6 before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-border">
                {node.children.map((child, i) => (
                  <div key={child.person.id} className="flex flex-col items-center">
                    <div className="w-px h-6 bg-border" />
                    <TreeLevel nodes={[child]} allPeople={allPeople} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-destructive/15 text-destructive border-destructive/30",
  manager: "bg-warning/15 text-warning border-warning/30",
  employee: "bg-primary/15 text-primary border-primary/30",
};

function PersonCard({ person }: { person: OrgProfile }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 w-40 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
        {initialsOf(person.full_name ?? person.email)}
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold leading-snug">{person.full_name ?? person.email}</p>
        {person.job_title && (
          <p className="text-[10px] text-muted-foreground mt-0.5">{person.job_title}</p>
        )}
        {person.department && (
          <p className="text-[10px] text-muted-foreground">{deptLabel(person.department)}</p>
        )}
      </div>
      {person.role && (
        <span className={`text-[9px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${ROLE_COLOR[person.role] ?? ""}`}>
          {person.role}
        </span>
      )}
    </div>
  );
}
