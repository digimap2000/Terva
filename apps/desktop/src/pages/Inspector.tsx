import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BadgeInfo,
  Globe,
  Radar,
  SearchCode,
  Server,
  Wrench,
} from "lucide-react";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inspectorActivity } from "@/lib/activity";
import type { ProjectDocument } from "@/lib/tauri";
import { cn } from "@/lib/utils";

type InspectorTab = "overview" | "discovery" | "debug";
type DiagnosticTab = "info" | "warnings" | "errors";

interface InspectorTarget {
  id: string;
  label: string;
  summary: string;
  description: string;
}

interface InspectorProps {
  project: ProjectDocument | null;
}

const targets: InspectorTarget[] = [
  {
    id: "local-network-scan",
    label: "Local Network Discovery",
    summary: "Browse for running MCP servers on the local network.",
    description:
      "This workspace will discover MCP servers visible on the local network, inspect the transport they expose, and let the user poke into their surfaces as a debugging aid.",
  },
];

function InspectorField({
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

function TargetItem({
  target,
  selected,
  onSelect,
}: {
  target: InspectorTarget;
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
      <div className="text-sm font-medium">{target.label}</div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{target.summary}</div>
    </button>
  );
}

export function Inspector({ project }: InspectorProps) {
  const [selectedId, setSelectedId] = useState(targets[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<InspectorTab>("overview");
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>("info");

  useEffect(() => {
    const firstTarget = targets[0];
    if (!firstTarget) {
      setSelectedId("");
      return;
    }

    const stillExists = targets.some((target) => target.id === selectedId);
    if (!selectedId || !stillExists) {
      setSelectedId(firstTarget.id);
    }
  }, [selectedId]);

  const selectedTarget = useMemo(() => {
    return targets.find((target) => target.id === selectedId) ?? targets[0] ?? null;
  }, [selectedId]);

  return (
    <WorkbenchShell
      sidebarStorageKey="terva-inspector-sidebar-v1"
      sidebarTitle={inspectorActivity.label}
      sidebarDescription="Discovery and debugging surfaces for MCP servers visible on the local network."
      sidebarIcon={inspectorActivity.icon}
      sidebarFooter={
        <div className="text-xs text-muted-foreground">
          {targets.length} inspection target{targets.length === 1 ? "" : "s"} defined
        </div>
      }
      sidebarContent={
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-2 py-2">
            {targets.map((target) => (
              <TargetItem
                key={target.id}
                target={target}
                selected={selectedTarget?.id === target.id}
                onSelect={() => {
                  setSelectedId(target.id);
                  setActiveTab("overview");
                }}
              />
            ))}
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
              <InspectorField
                label="Inspector Scope"
                description="What this inspector surface is intended to help the user do."
              >
                <div className="space-y-2 text-sm">
                  <div className="font-medium">Discover and interrogate MCP servers</div>
                  <div className="text-muted-foreground">
                    The inspector is a local-network discovery and debugging surface for finding
                    MCP servers, checking what they expose, and poking around inside them.
                  </div>
                </div>
              </InspectorField>

              <InspectorField
                label="Selected Target"
                description="Current focus within the inspector workspace."
              >
                {selectedTarget ? (
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{selectedTarget.label}</div>
                    <div className="text-muted-foreground">{selectedTarget.description}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Select an inspection target from the sidebar.
                  </div>
                )}
              </InspectorField>

              <InspectorField
                label="Active Project"
                description="Current Terva document alongside which the inspector is running."
              >
                <div className="text-sm text-muted-foreground">
                  {project ? project.display_name : "No project open"}
                </div>
              </InspectorField>
            </div>
          </TabsContent>

          <TabsContent value="warnings" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <InspectorField
                label="Warnings"
                description="Advisory findings for discovery and inspection operations."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Inspector warnings are not surfaced yet. This panel is reserved for partial
                  discovery results, protocol mismatches, and local-network limitations.
                </div>
              </InspectorField>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <InspectorField
                label="Errors"
                description="Blocking issues encountered during discovery or inspection."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Inspector errors are not surfaced yet. This panel will carry failed discovery,
                  endpoint connection errors, and protocol parsing failures.
                </div>
              </InspectorField>
            </div>
          </TabsContent>
        </Tabs>
      }
      sidebarDefaultSize="22%"
      sidebarMinSize="14%"
      sidebarMaxSize="32%"
      contentClassName="p-6"
      mainContent={(sidebarToggle) =>
        selectedTarget ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as InspectorTab)}
            className="flex h-full min-h-0 flex-col"
          >
            <div className="flex items-center gap-3">
              {sidebarToggle}
              <TabsList variant="line" className="border-0 pb-0">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="discovery">Discovery</TabsTrigger>
                <TabsTrigger value="debug">Debug</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  The inspector is the place for browsing MCP servers visible on the local
                  network and understanding what they expose before or alongside Terva project
                  authoring.
                </p>

                <div className="space-y-0">
                  <InspectorField
                    label="Discovery Target"
                    description="Current discovery/debugging mode exposed by this view."
                  >
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Radar size={15} className="text-muted-foreground" />
                      <span className="font-medium">{selectedTarget.label}</span>
                    </div>
                  </InspectorField>

                  <InspectorField
                    label="Intent"
                    description="What this inspector mode is meant to reveal."
                  >
                    <div className="text-sm leading-6 text-muted-foreground">
                      {selectedTarget.description}
                    </div>
                  </InspectorField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="discovery" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  This tab will browse for reachable MCP servers on the local network and list the
                  endpoints they expose.
                </p>

                <div className="space-y-0">
                  <InspectorField
                    label="Server Discovery"
                    description="Browse for running MCP servers."
                  >
                    <div className="space-y-3 text-sm">
                      <div className="inline-flex items-center gap-2">
                        <Globe size={15} className="text-muted-foreground" />
                        <span className="font-medium">
                          Local-network MCP server enumeration
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Discovery is not implemented yet. This tab is reserved for scanning,
                        listing discovered servers, and selecting one for deeper inspection.
                      </div>
                    </div>
                  </InspectorField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="debug" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  This tab is for protocol-level poking and service introspection once a target
                  server has been selected.
                </p>

                <div className="space-y-0">
                  <InspectorField
                    label="Protocol Tools"
                    description="Inspect tools, resources, prompts, and raw server behavior."
                  >
                    <div className="space-y-3 text-sm">
                      <div className="inline-flex items-center gap-2">
                        <SearchCode size={15} className="text-muted-foreground" />
                        <span className="font-medium">
                          Discovery, introspection, and low-level debugging
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        This space will grow into the MCP equivalent of a discovery and debugger
                        surface rather than a production authoring view.
                      </div>
                    </div>
                  </InspectorField>

                  <InspectorField
                    label="Planned Surfaces"
                    description="Initial capabilities we expect this inspector to expose."
                  >
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <Server size={15} className="text-muted-foreground" />
                        <span>Browse discovered MCP server identities</span>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <BadgeInfo size={15} className="text-muted-foreground" />
                        <span>Inspect tool/resource/prompt surfaces</span>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <Wrench size={15} className="text-muted-foreground" />
                        <span>Exercise requests and inspect responses</span>
                      </div>
                    </div>
                  </InspectorField>
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
                <div className="text-sm font-medium">No inspection target selected</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose an item from the sidebar to inspect local-network MCP servers here.
                </p>
              </div>
            </div>
          </div>
        )
      }
    />
  );
}
