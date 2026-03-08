import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeInfo, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authActivity } from "@/lib/activity";
import { cn } from "@/lib/utils";

type AuthTab = "summary" | "policy" | "origin";
type DiagnosticTab = "info" | "warnings" | "errors";

interface AuthFeature {
  id: string;
  label: string;
  summary: string;
  description: string;
}

const authFeatures: AuthFeature[] = [
  {
    id: "client-authentication",
    label: "Client Authentication",
    summary: "Define how clients authenticate with the MCP server.",
    description:
      "This surface will control how the linked MCP server authenticates clients and what trust model the active project adopts.",
  },
  {
    id: "local-access-policy",
    label: "Local Access Policy",
    summary: "Shape local trust and origin policy for the server surface.",
    description:
      "This surface will define local-only access expectations, origin policy, and trust boundaries for the server host.",
  },
];

function AuthField({
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

function AuthItem({
  feature,
  selected,
  onSelect,
}: {
  feature: AuthFeature;
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
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{feature.summary}</div>
    </button>
  );
}

export function Auth() {
  const [selectedId, setSelectedId] = useState(authFeatures[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<AuthTab>("summary");
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>("info");

  useEffect(() => {
    const firstFeature = authFeatures[0];
    if (!firstFeature) {
      setSelectedId("");
      return;
    }
    const stillExists = authFeatures.some((feature) => feature.id === selectedId);
    if (!selectedId || !stillExists) {
      setSelectedId(firstFeature.id);
    }
  }, [selectedId]);

  const selectedFeature = useMemo(() => {
    return authFeatures.find((feature) => feature.id === selectedId) ?? authFeatures[0] ?? null;
  }, [selectedId]);

  return (
    <WorkbenchShell
      sidebarStorageKey="terva-auth-sidebar-v1"
      sidebarTitle={authActivity.label}
      sidebarDescription="Authentication and local trust policy for the linked MCP server."
      sidebarIcon={authActivity.icon}
      sidebarFooter={
        <div className="text-xs text-muted-foreground">
          {authFeatures.length} auth surface{authFeatures.length === 1 ? "" : "s"} planned
        </div>
      }
      sidebarContent={
        <ScrollArea className="flex-1">
          <div className="space-y-1 px-2 py-2">
            {authFeatures.map((feature) => (
              <AuthItem
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
              <AuthField
                label="Selected Surface"
                description="Current authentication area in focus."
              >
                {selectedFeature ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{selectedFeature.label}</div>
                    <div className="text-muted-foreground">{selectedFeature.description}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Select an auth surface from the sidebar to inspect it here.
                  </div>
                )}
              </AuthField>
            </div>
          </TabsContent>

          <TabsContent value="warnings" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <AuthField
                label="Warnings"
                description="Advisory findings for authentication and trust policy."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Auth warnings are not surfaced yet. This panel is reserved for insecure policy,
                  incomplete configuration, and risky local exposure.
                </div>
              </AuthField>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <AuthField
                label="Errors"
                description="Blocking authentication and access policy issues."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Auth errors are not surfaced yet. This panel will carry invalid auth state,
                  conflicting policy, and broken server security configuration.
                </div>
              </AuthField>
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
            onValueChange={(value) => setActiveTab(value as AuthTab)}
            className="flex h-full min-h-0 flex-col"
          >
            <div className="flex items-center gap-3">
              {sidebarToggle}
              <TabsList variant="line" className="border-0 pb-0">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="policy">Policy</TabsTrigger>
                <TabsTrigger value="origin">Origin</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="summary" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  Define how the linked MCP server should authenticate clients and apply local
                  access rules for the active project.
                </p>

                <div className="space-y-0">
                  <AuthField
                    label="Authentication Surface"
                    description="Current auth area being configured."
                  >
                    <div className="inline-flex items-center gap-2 text-sm">
                      <LockKeyhole size={15} className="text-muted-foreground" />
                      <span className="font-medium">{selectedFeature.label}</span>
                    </div>
                  </AuthField>
                  <AuthField
                    label="Intent"
                    description="What this auth surface is for."
                  >
                    <div className="text-sm leading-6 text-muted-foreground">
                      {selectedFeature.description}
                    </div>
                  </AuthField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="policy" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  This tab will hold the active project’s authentication and trust configuration.
                </p>

                <div className="space-y-0">
                  <AuthField
                    label="Authentication Policy"
                    description="How clients prove identity to the linked server."
                  >
                    <div className="space-y-3 text-sm">
                      <div className="inline-flex items-center gap-2">
                        <UserRoundCheck size={15} className="text-muted-foreground" />
                        <span className="font-medium">No auth controls are wired yet</span>
                      </div>
                      <div className="text-muted-foreground">
                        This space is reserved for server-side auth options, trust modes, and
                        local-client policy.
                      </div>
                    </div>
                  </AuthField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="origin" className="min-h-0 flex-1 overflow-auto pt-6">
              <div className="space-y-6">
                <p className="text-sm leading-6 text-muted-foreground">
                  This tab will shape origin policy and local safety controls for the server host.
                </p>

                <div className="space-y-0">
                  <AuthField
                    label="Origin Policy"
                    description="Control which local clients and origins are allowed."
                  >
                    <div className="inline-flex items-start gap-2 text-sm">
                      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="text-muted-foreground">
                        Origin policy controls are not implemented yet. This tab is reserved for
                        local trust rules and safety boundaries.
                      </div>
                    </div>
                  </AuthField>
                  <AuthField
                    label="Notes"
                    description="Guidance for future auth configuration."
                  >
                    <div className="inline-flex items-start gap-2 text-sm">
                      <BadgeInfo size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="text-muted-foreground">
                        Authentication behavior belongs to the core-linked server runtime, not the
                        transport host shell.
                      </div>
                    </div>
                  </AuthField>
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
                <div className="text-sm font-medium">No auth surface selected</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose an auth item from the sidebar to inspect and configure it here.
                </p>
              </div>
            </div>
          </div>
        )
      }
    />
  );
}
