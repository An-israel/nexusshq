import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { initialsOf } from "@/lib/nexus";
import { cn } from "@/lib/utils";

interface Props {
  /** Folder under the 'avatars' bucket. Use the user id for profiles or "groups/{groupId}" for groups. */
  pathPrefix: string;
  currentUrl: string | null | undefined;
  fallbackName?: string | null;
  onUploaded: (publicUrl: string) => void | Promise<void>;
  size?: number;
  editable?: boolean;
  rounded?: "full" | "lg";
}

export function AvatarUploader({
  pathPrefix,
  currentUrl,
  fallbackName,
  onUploaded,
  size = 80,
  editable = true,
  rounded = "full",
}: Props) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${pathPrefix}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await onUploaded(data.publicUrl);
      toast.success("Updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const radiusClass = rounded === "full" ? "rounded-full" : "rounded-lg";

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "relative overflow-hidden bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0",
          radiusClass,
        )}
        style={{ width: size, height: size, fontSize: size / 3 }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{initialsOf(fallbackName ?? "")}</span>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 hover:opacity-100 transition-opacity"
            disabled={uploading}
          >
            <Camera className="h-5 w-5" />
          </button>
        )}
      </div>
      {editable && (
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : currentUrl ? "Change" : "Upload"}
          </Button>
          <p className="text-xs text-muted-foreground">PNG / JPG, max 5MB</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
