import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Globe, Link2, ServerCog } from "lucide-react";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backendsActivity } from "@/lib/activity";
import type { InspectionBackend, ProjectDocument } from "@/lib/tauri";
import { cn } from "@/lib/utils";

type BackendTab = "summary" | "connection";
type DiagnosticTab = "info" | "warnings" | "errors";

interface BackendsProps {
  project: ProjectDocument;
}

function BackendField({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/60 py-5 first:pt-0 last:border-b-0 last:pb-0 md:flex-row md:gap-6">
      <div className="space-y-1 md:w-1/3 md:shrink-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="md:w-2/3">{children}</div>
    </div>
  );
}

function BackendMenuItem({
  backend,
  selected,
  onSelect,
}: {
  backend: InspectionBackend;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col items-start rounded-md px-3 py-3 text-left transition-colors hover:bg-secondary/50",
        selected
          ? "bg-accent/15 text-accent"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <div className="text-sm font-medium">{backend.id}</div>
      <div className="mt-1 text-xs text-muted-foreground">{backend.backend_type}</div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{backend.base_url}</div>
    </button>
  );
}

export function Backends({ project }: BackendsProps) {
  const backends = project.inspection?.backends ?? [];
  const [selectedId, setSelectedId] = useState(backends[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<BackendTab>("summary");
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>("info");

  useEffect(() => {
    const firstBackend = backends[0];
    if (!firstBackend) {
      setSelectedId("");
      return;
    }

    const stillExists = backends.some((backend) => backend.id === selectedId);
    if (!selectedId || !stillExists) {
      setSelectedId(firstBackend.id);
    }
  }, [backends, selectedId]);

  const selectedBackend = useMemo(() => {
    return backends.find((backend) => backend.id === selectedId) ?? backends[0] ?? null;
  }, [backends, selectedId]);

  return (
    <WorkbenchShell
      sidebarStorageKey="terva-backends-sidebar-v1"
      sidebarTitle={backendsActivity.label}
      sidebarDescription="Transport-facing definitions that behaviours resolve through."
      sidebarIcon={backendsActivity.icon}
      sidebarFooter={
        <div className="text-xs text-muted-foreground">
          {backends.length} backend{backends.length === 1 ? "" : "s"} declared
        </div>
      }
      sidebarContent={
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-2 py-2">
            {backends.length > 0 ? (
              backends.map((backend) => (
                <BackendMenuItem
                  key={backend.id}
                  backend={backend}
                  selected={selectedBackend?.id === backend.id}
                  onSelect={() => {
                    setSelectedId(backend.id);
                    setActiveTab("summary");
                  }}
                />
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                No backends are declared in the active project.
              </div>
            )}
          </div>
        </ScrollArea>
      }
      bottomContent={
        <Tabs
          value={diagnosticTab}
          onValueChange={(value) => setDiagnosticTab(value as DiagnosticTab)}
          className="flex h-full min-h-0 flex-col"
        >
          <TabsList variant="line" className="border-b pb-0">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="warnings">Warnings</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <BackendField
                label="Selected Backend"
                description="Backend definition currently being inspected."
              >
                {selectedBackend ? (
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{selectedBackend.id}</div>
                    <div className="text-muted-foreground">
                      {selectedBackend.backend_type} bound to {selectedBackend.base_url}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Select a backend from the sidebar to inspect it here.
                  </div>
                )}
              </BackendField>

              <BackendField
                label="Context"
                description="Project-level summary for transport definitions."
              >
                <div className="text-sm text-muted-foreground">
                  {project.capability_count} behaviours currently reference {project.backend_count} backends.
                </div>
              </BackendField>
            </div>
          </TabsContent>

          <TabsContent value="warnings" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <BackendField
                label="Warnings"
                description="Non-blocking findings derived from backend validation."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Backend-scoped warnings are not surfaced yet. This panel is reserved for
                  suspicious URLs, missing metadata, and other advisory findings.
                </div>
              </BackendField>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <BackendField
                label="Errors"
                description="Blocking issues derived from backend validation."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Backend-scoped errors are not surfaced yet. This panel will carry broken
                  backend definitions and invalid connection details once validation is wired
                  through.
                </div>
              </BackendField>
            </div>
          </TabsContent>
        </Tabs>
      }
      sidebarDefaultSize="22%"
      sidebarMinSize="14%"
      sidebarMaxSize="32%"
      contentClassName="p-6"
      mainContent={(sidebarToggle) =>
        selectedBackend ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as BackendTab)}
            className="flex h-full min-h-0 flex-col"
          >
            <div className="flex items-center gap-3">
              {sidebarToggle}
              <TabsList variant="line" className="border-0 pb-0">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="connection">Connection</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="summary" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  Define the transport identity of the selected backend and the role it plays in
                  the project runtime.
                </p>

                <div className="space-y-0">
                  <BackendField
                    label="Backend Id"
                    description="Stable internal identifier used by capabilities."
                  >
                    <div className="text-sm font-medium">{selectedBackend.id}</div>
                  </BackendField>

                  <BackendField
                    label="Backend Type"
                    description="Current adapter class surfaced from the core."
                  >
                    <div className="inline-flex items-center gap-2 text-sm">
                      <ServerCog size={15} className="text-muted-foreground" />
                      <span className="font-medium">{selectedBackend.backend_type}</span>
                    </div>
                  </BackendField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="connection" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  Connection details for the selected backend. This is where transport settings
                  and future connection policy controls will live.
                </p>

                <div className="space-y-0">
                  <BackendField
                    label="Base URL"
                    description="Resolved root endpoint used by backend actions."
                  >
                    <div className="inline-flex items-start gap-2 text-sm">
                      <Globe size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="break-all font-mono text-xs text-muted-foreground">
                        {selectedBackend.base_url}
                      </div>
                    </div>
                  </BackendField>

                  <BackendField
                    label="Transport"
                    description="Current connection shape inferred from the backend definition."
                  >
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Link2 size={15} className="text-muted-foreground" />
                      <span className="font-medium">HTTP JSON API</span>
                    </div>
                  </BackendField>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="flex items-center gap-3">
              {sidebarToggle}
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="max-w-xl text-center">
                <div className="text-sm font-medium">No backend selected</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Add or load a backend definition in the active project to inspect it here.
                </p>
              </div>
            </div>
          </div>
        )
      }
    />
  );
}
