import { FolderOpen, FolderPlus, Server, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { NewProjectPreview } from "@/lib/tauri";

interface NewProjectDialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  friendlyName: string;
  preview: NewProjectPreview | null;
  onFriendlyNameChange: (value: string) => void;
  onBrowseDirectory: () => void;
  onClose: () => void;
  onCreate: () => void;
}

function PreviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </div>
      <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground">
        {value}
      </div>
    </div>
  );
}

export function NewProjectDialog({
  open,
  busy,
  error,
  friendlyName,
  preview,
  onFriendlyNameChange,
  onBrowseDirectory,
  onClose,
  onCreate,
}: NewProjectDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
      <Card className="w-full max-w-3xl border-border/70 bg-card/95 shadow-2xl">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                New Project
              </div>
              <div className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Name the project once and Terva will derive a safe filesystem name and
                MCP server name from it.
              </div>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0"
              onClick={onClose}
              disabled={busy}
            >
              <X />
            </Button>
          </div>

          <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-2">
                <label
                  htmlFor="new-project-name"
                  className="text-sm font-medium text-foreground"
                >
                  Project name
                </label>
                <Input
                  id="new-project-name"
                  value={friendlyName}
                  onChange={(event) => onFriendlyNameChange(event.target.value)}
                  placeholder="Audio Streamer Control"
                  autoFocus
                  disabled={busy}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={onBrowseDirectory}
                disabled={busy}
              >
                <FolderOpen />
                Choose Folder
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Location</div>
              <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                {preview?.directory ?? "Loading default location…"}
              </div>
            </div>

            {preview ? (
              <div className="grid gap-4 md:grid-cols-2">
                <PreviewValue
                  label="Filesystem Name"
                  value={preview.file_name}
                />
                <PreviewValue
                  label="MCP Server Name"
                  value={preview.mcp_server_name}
                />
              </div>
            ) : null}

            {preview ? (
              <div className="rounded-xl border border-border/70 bg-secondary/35 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Server className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      Project will be created at
                    </div>
                    <div className="break-all text-sm leading-6 text-muted-foreground">
                      {preview.target_path}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/25 bg-destructive/6 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={onCreate}
              disabled={busy || !preview || !friendlyName.trim()}
            >
              <FolderPlus />
              {busy ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
