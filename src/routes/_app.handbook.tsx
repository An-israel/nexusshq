import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BookOpen, Plus, Pin, Trash2, Edit2, ChevronDown, ChevronRight } from "lucide-react";
import { timeAgo } from "@/lib/nexus";

export const Route = createFileRoute("/_app/handbook")({
  component: HandbookPage,
});

interface WikiSection {
  id: string;
  title: string;
  order_index: number;
  created_at: string;
}

interface WikiPage {
  id: string;
  section_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  author_id: string | null;
  updated_at: string;
  created_at: string;
}

function HandbookPage() {
  const { user, isManager } = useAuth();
  const [sections, setSections] = React.useState<WikiSection[]>([]);
  const [pages, setPages] = React.useState<WikiPage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedPage, setSelectedPage] = React.useState<WikiPage | null>(null);
  const [editPage, setEditPage] = React.useState<WikiPage | null>(null);
  const [newSectionOpen, setNewSectionOpen] = React.useState(false);
  const [newPageOpen, setNewPageOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async () => {
    setLoading(true);
    const [secRes, pageRes] = await Promise.all([
      supabase.from("wiki_sections").select("*").order("order_index").order("created_at"),
      supabase.from("wiki_pages").select("*").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }),
    ]);
    const secs = (secRes.data ?? []) as WikiSection[];
    setSections(secs);
    setPages((pageRes.data ?? []) as WikiPage[]);
    setExpanded(new Set(secs.map((s) => s.id)));
    setLoading(false);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  async function deletePage(id: string) {
    if (!confirm("Delete this page?")) return;
    await supabase.from("wiki_pages").delete().eq("id", id);
    if (selectedPage?.id === id) setSelectedPage(null);
    void load();
  }

  async function deleteSection(id: string) {
    if (!confirm("Delete this section and all its pages?")) return;
    await supabase.from("wiki_sections").delete().eq("id", id);
    void load();
  }

  async function togglePin(page: WikiPage) {
    await supabase.from("wiki_pages").update({ is_pinned: !page.is_pinned }).eq("id", page.id);
    void load();
  }

  const pinnedPages = pages.filter((p) => p.is_pinned && !p.section_id);
  const unsectionedPages = pages.filter((p) => !p.section_id && !p.is_pinned);

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-0 overflow-hidden rounded-xl border border-border">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Handbook</span>
          </div>
          {isManager && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setNewSectionOpen(true)} title="New section">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {loading && <p className="px-4 text-xs text-muted-foreground">Loading…</p>}

          {/* Pinned pages */}
          {pinnedPages.length > 0 && (
            <div className="mb-2">
              <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Pinned</p>
              {pinnedPages.map((p) => (
                <PageNavItem key={p.id} page={p} selected={selectedPage?.id === p.id} onSelect={setSelectedPage} />
              ))}
            </div>
          )}

          {/* Sections */}
          {sections.map((sec) => {
            const secPages = pages.filter((p) => p.section_id === sec.id);
            const open = expanded.has(sec.id);
            return (
              <div key={sec.id} className="mb-1">
                <div className="flex items-center group">
                  <button
                    className="flex flex-1 items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded((prev) => {
                      const next = new Set(prev);
                      open ? next.delete(sec.id) : next.add(sec.id);
                      return next;
                    })}
                  >
                    {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {sec.title}
                  </button>
                  {isManager && (
                    <div className="flex gap-0.5 pr-2 opacity-0 group-hover:opacity-100">
                      <button onClick={() => setNewPageOpen(true)} title="Add page">
                        <Plus className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button onClick={() => deleteSection(sec.id)} title="Delete section">
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  )}
                </div>
                {open && secPages.map((p) => (
                  <PageNavItem key={p.id} page={p} selected={selectedPage?.id === p.id} onSelect={setSelectedPage} indent />
                ))}
              </div>
            );
          })}

          {/* Unsectioned pages */}
          {unsectionedPages.map((p) => (
            <PageNavItem key={p.id} page={p} selected={selectedPage?.id === p.id} onSelect={setSelectedPage} />
          ))}

          {isManager && (
            <div className="px-4 pt-3">
              <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setNewPageOpen(true)}>
                <Plus className="mr-1.5 h-3 w-3" /> New page
              </Button>
            </div>
          )}
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        {selectedPage ? (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start justify-between gap-3 mb-6">
              <h1 className="text-xl font-bold">{selectedPage.title}</h1>
              {isManager && (
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => togglePin(selectedPage)}>
                    <Pin className={`h-3.5 w-3.5 mr-1 ${selectedPage.is_pinned ? "text-primary" : ""}`} />
                    {selectedPage.is_pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditPage(selectedPage)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deletePage(selectedPage.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Updated {timeAgo(selectedPage.updated_at)}
            </p>
            <div className="prose prose-sm prose-invert max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                {selectedPage.content || "No content yet."}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Select a page from the sidebar.</p>
              {isManager && (
                <Button className="mt-4" size="sm" onClick={() => setNewPageOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create first page
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
        <NewSectionDialog
          onSaved={() => { setNewSectionOpen(false); void load(); }}
          nextIndex={sections.length}
        />
      </Dialog>
      <Dialog open={newPageOpen} onOpenChange={setNewPageOpen}>
        <NewPageDialog
          sections={sections}
          authorId={user?.id ?? ""}
          onSaved={(page) => { setNewPageOpen(false); void load().then(() => setSelectedPage(page)); }}
        />
      </Dialog>
      <Dialog open={!!editPage} onOpenChange={(o) => !o && setEditPage(null)}>
        {editPage && (
          <EditPageDialog
            page={editPage}
            onSaved={(updated) => {
              setEditPage(null);
              setSelectedPage(updated);
              void load();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function PageNavItem({
  page,
  selected,
  onSelect,
  indent = false,
}: {
  page: WikiPage;
  selected: boolean;
  onSelect: (p: WikiPage) => void;
  indent?: boolean;
}) {
  return (
    <button
      onClick={() => onSelect(page)}
      className={`w-full text-left flex items-center gap-1.5 px-4 py-1.5 text-xs transition-colors
        ${indent ? "pl-8" : ""}
        ${selected ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
    >
      {page.is_pinned && <Pin className="h-2.5 w-2.5 shrink-0" />}
      <span className="truncate">{page.title}</span>
    </button>
  );
}

function NewSectionDialog({ onSaved, nextIndex }: { onSaved: () => void; nextIndex: number }) {
  const [title, setTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("wiki_sections").insert({ title: title.trim(), order_index: nextIndex });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Section created");
    onSaved();
  }
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Section</DialogTitle></DialogHeader>
      <Label>Section name</Label>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brand Guidelines" autoFocus />
      <DialogFooter>
        <Button onClick={save} disabled={saving || !title.trim()}>{saving ? "Saving…" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewPageDialog({
  sections,
  authorId,
  onSaved,
}: {
  sections: WikiSection[];
  authorId: string;
  onSaved: (p: WikiPage) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [sectionId, setSectionId] = React.useState<string>("");
  const [saving, setSaving] = React.useState(false);
  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("wiki_pages")
      .insert({ title: title.trim(), content: content.trim(), section_id: sectionId || null, author_id: authorId })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Page created");
    onSaved(data as WikiPage);
  }
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New Page</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Onboarding Checklist" autoFocus />
        </div>
        <div>
          <Label>Section (optional)</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">No section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <div>
          <Label>Content</Label>
          <Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your content here…" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving || !title.trim()}>{saving ? "Saving…" : "Create"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditPageDialog({ page, onSaved }: { page: WikiPage; onSaved: (p: WikiPage) => void }) {
  const [title, setTitle] = React.useState(page.title);
  const [content, setContent] = React.useState(page.content);
  const [saving, setSaving] = React.useState(false);
  async function save() {
    setSaving(true);
    const { data, error } = await supabase
      .from("wiki_pages")
      .update({ title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() })
      .eq("id", page.id)
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Page updated");
    onSaved(data as WikiPage);
  }
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Edit Page</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Content</Label>
          <Textarea rows={10} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
