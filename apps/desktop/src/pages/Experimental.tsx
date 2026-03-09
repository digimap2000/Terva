import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeInfo, Network, RadioTower, Sparkles } from "lucide-react";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { experimentalActivity } from "@/lib/activity";
import type { ProjectDocument } from "@/lib/tauri";
import { cn } from "@/lib/utils";

type ExperimentalTab = "summary" | "configuration" | "notes";
type DiagnosticTab = "info" | "warnings" | "errors";

interface ExperimentalFeature {
  id: string;
  label: string;
  summary: string;
  description: string;
  status: string;
}

interface ExperimentalProps {
  project: ProjectDocument;
}

const features: ExperimentalFeature[] = [
  {
    id: "mdns-advertisement",
    label: "mDNS Advertisement",
    summary: "Advertise the running MCP server on the local network for discovery.",
    description:
      "This feature will configure local network advertisement of the active MCP server so compatible clients can discover it without manual endpoint entry.",
    status: "Planned",
  },
];

function ExperimentalField({
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

function FeatureMenuItem({
  feature,
  selected,
  onSelect,
}: {
  feature: ExperimentalFeature;
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
      <div className="text-sm font-medium">{feature.label}</div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {feature.summary}
      </div>
    </button>
  );
}

export function Experimental({ project }: ExperimentalProps) {
  const [selectedId, setSelectedId] = useState(features[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<ExperimentalTab>("summary");
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>("info");

  useEffect(() => {
    const firstFeature = features[0];
    if (!firstFeature) {
      setSelectedId("");
      return;
    }

    const stillExists = features.some((feature) => feature.id === selectedId);
    if (!selectedId || !stillExists) {
      setSelectedId(firstFeature.id);
    }
  }, [selectedId]);

  const selectedFeature = useMemo(() => {
    return features.find((feature) => feature.id === selectedId) ?? features[0] ?? null;
  }, [selectedId]);

  return (
    <WorkbenchShell
      sidebarStorageKey="terva-labs-sidebar-v1"
      sidebarTitle={experimentalActivity.label}
      sidebarDescription="Emerging MCP features we may enable behind the active project."
      sidebarIcon={experimentalActivity.icon}
      sidebarFooter={
        <div className="text-xs text-muted-foreground">
          {features.length} lab feature{features.length === 1 ? "" : "s"} listed
        </div>
      }
      sidebarContent={
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-2 py-2">
            {features.map((feature) => (
              <FeatureMenuItem
                key={feature.id}
                feature={feature}
                selected={selectedFeature?.id === feature.id}
                onSelect={() => {
                  setSelectedId(feature.id);
                  setActiveTab("summary");
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
              <ExperimentalField
                label="Feature Focus"
                description="Experimental feature currently selected in the sidebar."
              >
                {selectedFeature ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{selectedFeature.label}</div>
                    <div className="text-muted-foreground">{selectedFeature.description}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Select a lab feature to inspect it here.
                  </div>
                )}
              </ExperimentalField>

              <ExperimentalField
                label="Project Context"
                description="Active project that will ultimately own this capability."
              >
                <div className="text-sm text-muted-foreground">
                  {project.display_name} can opt into selected lab-stage MCP server features here.
                </div>
              </ExperimentalField>
            </div>
          </TabsContent>

          <TabsContent value="warnings" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <ExperimentalField
                label="Warnings"
                description="Advisory findings or cautions for the selected feature."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Lab-feature warnings are not surfaced yet. This panel is reserved for
                  rollout cautions, partial support notes, and interoperability concerns.
                </div>
              </ExperimentalField>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <ExperimentalField
                label="Errors"
                description="Blocking issues related to the selected feature."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Lab-feature errors are not surfaced yet. This panel will carry
                  invalid configuration, unavailable platform support, or runtime conflicts.
                </div>
              </ExperimentalField>
            </div>
          </TabsContent>
        </Tabs>
      }
      sidebarDefaultSize="22%"
      sidebarMinSize="14%"
      sidebarMaxSize="32%"
      contentClassName="p-6"
      mainContent={(sidebarToggle) =>
        selectedFeature ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ExperimentalTab)}
            className="flex h-full min-h-0 flex-col"
          >
            <div className="flex items-center gap-3">
              {sidebarToggle}
              <TabsList variant="line" className="border-0 pb-0">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="summary" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  Labs lets the project opt into emerging MCP server capabilities
                  without blurring the core product model.
                </p>

                <div className="space-y-0">
                  <ExperimentalField
                    label="Feature"
                    description="Lab-stage MCP server feature currently in focus."
                  >
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Sparkles size={15} className="text-muted-foreground" />
                      <span className="font-medium">{selectedFeature.label}</span>
                    </div>
                  </ExperimentalField>

                  <ExperimentalField
                    label="Intent"
                    description="What this feature is intended to add to the MCP server."
                  >
                    <div className="text-sm leading-6 text-muted-foreground">
                      {selectedFeature.description}
                    </div>
                  </ExperimentalField>

                  <ExperimentalField
                    label="Status"
                    description="Current level of product support for this feature."
                  >
                    <div className="text-sm font-medium">{selectedFeature.status}</div>
                  </ExperimentalField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="configuration" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  This will become the configuration surface for the selected lab feature.
                  For now it establishes the exact shape of the first feature we intend to support.
                </p>

                <div className="space-y-0">
                  <ExperimentalField
                    label="mDNS Advertisement"
                    description="Local network discovery for the running MCP server."
                  >
                    <div className="space-y-3 text-sm">
                      <div className="inline-flex items-center gap-2">
                        <RadioTower size={15} className="text-muted-foreground" />
                        <span className="font-medium">Advertise the active Streamable HTTP endpoint</span>
                      </div>
                      <div className="text-muted-foreground">
                        Configuration controls are not implemented yet. This tab is reserved for
                        enabling advertisement, controlling the published service name, and shaping
                        any local discovery metadata we decide to expose.
                      </div>
                    </div>
                  </ExperimentalField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  This space is reserved for implementation notes, protocol caveats, and rollout
                  guidance for each lab-stage server feature.
                </p>

                <div className="space-y-0">
                  <ExperimentalField
                    label="Current Direction"
                    description="What we know about the selected feature so far."
                  >
                    <div className="inline-flex items-start gap-2 text-sm">
                      <BadgeInfo size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="text-muted-foreground">
                        The first lab feature is mDNS advertisement of the MCP server so
                        local clients can discover the running endpoint on the network.
                      </div>
                    </div>
                  </ExperimentalField>

                  <ExperimentalField
                    label="Transport Scope"
                    description="Where this experimental feature sits in the product architecture."
                  >
                    <div className="inline-flex items-center gap-2 text-sm">
                      <Network size={15} className="text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Applies to the linked core’s Streamable HTTP server surface.
                      </span>
                    </div>
                  </ExperimentalField>
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
                <div className="text-sm font-medium">No lab feature selected</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose a feature from the sidebar to inspect and configure it here.
                </p>
              </div>
            </div>
          </div>
        )
      }
    />
  );
}
