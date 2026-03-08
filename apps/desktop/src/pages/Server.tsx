import { useMemo, useState, type ReactNode } from "react";
import { Play, Square } from "lucide-react";
import { WorkbenchShell } from "@/components/layout/WorkbenchShell";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RuntimeLogEntry, RuntimeState } from "@/hooks/useActiveProject";
import { serverActivity } from "@/lib/activity";

interface ServerProps {
  logs: RuntimeLogEntry[];
  runtimeError: string | null;
  runtimeState: RuntimeState;
  serverUrl: string | null;
  onStartServer: () => Promise<boolean>;
  onStopServer: () => Promise<boolean>;
}

type ServerTab = "overview" | "options" | "activity";
type DiagnosticTab = "info" | "warnings" | "errors";

function runtimeCopy(runtimeState: RuntimeState) {
  switch (runtimeState) {
    case "running":
      return {
        label: "Running",
        detail: "The linked MCP server is available for local clients.",
      };
    case "starting":
      return {
        label: "Starting",
        detail: "Launching the linked MCP server.",
      };
    case "stopping":
      return {
        label: "Stopping",
        detail: "Stopping the linked MCP server.",
      };
    case "error":
      return {
        label: "Error",
        detail: "The last server action failed.",
      };
    case "stopped":
      return {
        label: "Stopped",
        detail: "The linked MCP server is not running.",
      };
  }
}

function ServerField({
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

export function Server({
  logs,
  runtimeError,
  runtimeState,
  serverUrl,
  onStartServer,
  onStopServer,
}: ServerProps) {
  const runtime = runtimeCopy(runtimeState);
  const busy = runtimeState === "starting" || runtimeState === "stopping";
  const running = runtimeState === "running";
  const [activeTab, setActiveTab] = useState<ServerTab>("overview");
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>("info");

  const latestEvent = useMemo(() => logs[0] ?? null, [logs]);

  return (
    <WorkbenchShell
      sidebarStorageKey="terva-server-sidebar-v1"
      sidebarTitle={serverActivity.label}
      sidebarDescription="Runtime controls, endpoint state, and the live MCP event stream."
      sidebarIcon={serverActivity.icon}
      sidebarFooter={
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>{runtime.label}</div>
          <div>{serverUrl ?? "No endpoint active"}</div>
        </div>
      }
      sidebarContent={
        <div className="flex h-full flex-col justify-between px-4 py-4">
          <div className="space-y-4">
            <div className="rounded-xl border bg-secondary/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Status
                  </p>
                  <p className="mt-2 text-lg font-semibold">{runtime.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{runtime.detail}</p>
                </div>
                <span
                  className={[
                    "size-3 shrink-0 rounded-full",
                    running
                      ? "bg-emerald-500"
                      : runtimeState === "error"
                        ? "bg-destructive"
                        : "bg-muted-foreground/40",
                  ].join(" ")}
                />
              </div>
              <div className="mt-4 rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Endpoint:</span>{" "}
                <span className="font-mono">{serverUrl ?? "Not running"}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={onStartServer}
                disabled={running || busy}
                className="flex-1"
              >
                <Play />
                Start
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onStopServer}
                disabled={!running || busy}
                className="flex-1"
              >
                <Square />
                Stop
              </Button>
            </div>

            {runtimeError ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
                {runtimeError}
              </div>
            ) : null}
          </div>
        </div>
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
              <ServerField
                label="Runtime State"
                description="Current state of the linked MCP server."
              >
                <div className="space-y-2 text-sm">
                  <div className="font-medium">{runtime.label}</div>
                  <div className="text-muted-foreground">{runtime.detail}</div>
                </div>
              </ServerField>
              <ServerField
                label="Latest Event"
                description="Most recent structured event surfaced from the runtime."
              >
                {latestEvent ? (
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">{latestEvent.event}</div>
                    <div className="text-muted-foreground">{latestEvent.timestamp}</div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No server events have been emitted yet.
                  </div>
                )}
              </ServerField>
            </div>
          </TabsContent>

          <TabsContent value="warnings" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <ServerField
                label="Warnings"
                description="Non-blocking runtime issues and advisory notices."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Runtime warnings are not surfaced separately yet. This panel is reserved for
                  degraded service state, recoverable runtime issues, and protocol advisories.
                </div>
              </ServerField>
            </div>
          </TabsContent>

          <TabsContent value="errors" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-0">
              <ServerField
                label="Errors"
                description="Blocking runtime failures for the linked server."
              >
                <div className="text-sm leading-6 text-muted-foreground">
                  Runtime errors are not categorized yet. This panel will carry server start
                  failures, listener problems, and fatal transport/runtime issues.
                </div>
              </ServerField>
            </div>
          </TabsContent>
        </Tabs>
      }
      sidebarDefaultSize="24%"
      sidebarMinSize="16%"
      sidebarMaxSize="34%"
      contentClassName="p-6"
      mainContent={(sidebarToggle) =>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ServerTab)}
          className="flex h-full min-h-0 flex-col"
        >
          <div className="flex items-center gap-3">
            {sidebarToggle}
            <TabsList variant="line" className="border-0 pb-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-6">
              <p className="text-sm leading-6 text-muted-foreground">
                Start or stop the linked MCP server for the active Terva project and inspect the
                endpoint the runtime is currently exposing.
              </p>

              <div className="space-y-0">
                <ServerField
                  label="Server Endpoint"
                  description="Current Streamable HTTP endpoint exposed by the runtime."
                >
                  <div className="font-mono text-xs text-muted-foreground">
                    {serverUrl ?? "Not running"}
                  </div>
                </ServerField>

                <ServerField
                  label="Event Volume"
                  description="Structured log entries currently retained by the desktop host."
                >
                  <div className="text-sm font-medium">{logs.length} event{logs.length === 1 ? "" : "s"}</div>
                </ServerField>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="options" className="min-h-0 flex-1 overflow-auto pt-6">
            <div className="space-y-6">
              <p className="text-sm leading-6 text-muted-foreground">
                This tab will become the home for runtime options that control how the linked MCP
                server is started and exposed.
              </p>

              <div className="space-y-0">
                <ServerField
                  label="Runtime Options"
                  description="Future controls for server behavior."
                >
                  <div className="text-sm leading-6 text-muted-foreground">
                    Server configuration controls are not wired yet. This space is reserved for
                    runtime options as the server surface grows.
                  </div>
                </ServerField>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="min-h-0 flex-1 overflow-auto pt-6">
            {logs.length > 0 ? (
              <ScrollArea className="h-full rounded-xl border bg-secondary/20">
                <div className="space-y-3 p-4">
                  {logs.map((entry) => (
                    <div key={entry.id} className="rounded-lg border bg-background/90 p-3">
                      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{entry.event}</span>
                        <span>{entry.timestamp}</span>
                      </div>
                      <pre className="mt-3 overflow-auto text-xs leading-6 text-muted-foreground">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Start the server and interact with the active project to see structured logs here.
              </div>
            )}
          </TabsContent>
        </Tabs>
      }
    />
  );
}
