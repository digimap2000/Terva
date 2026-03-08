import { DatabaseZap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InspectionBackend, ProjectDocument } from "@/lib/tauri";

interface BackendsProps {
  project: ProjectDocument;
}

function BackendCard({ backend }: { backend: InspectionBackend }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-secondary text-foreground">
          <DatabaseZap size={18} />
        </div>
        <div className="space-y-1">
          <CardTitle>{backend.id}</CardTitle>
          <CardDescription>
            {backend.backend_type} backend bound to {backend.base_url}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Type
          </div>
          <div className="mt-2">{backend.backend_type}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Base URL
          </div>
          <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
            {backend.base_url}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Backends({ project }: BackendsProps) {
  const backends = project.inspection?.backends ?? [];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">Backends</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Transport-facing backend definitions live here so the behaviour view can stay
          focused on user-facing capabilities.
        </p>
      </div>

      {backends.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {backends.map((backend) => (
            <BackendCard key={backend.id} backend={backend} />
          ))}
        </div>
      ) : (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>No backends declared</CardTitle>
            <CardDescription>
              The active project does not currently expose any parsed backend
              definitions.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
