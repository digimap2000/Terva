import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RuntimeLogEntry, RuntimeState } from "@/hooks/useActiveProject";

interface ServerProps {
  logs: RuntimeLogEntry[];
  runtimeError: string | null;
  runtimeState: RuntimeState;
  serverUrl: string | null;
  onStartServer: () => Promise<boolean>;
  onStopServer: () => Promise<boolean>;
}

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

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)] gap-6 p-6 max-lg:grid-cols-1">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Server</CardTitle>
          <CardDescription>
            Start or stop the linked MCP server for the active Terva project. Future
            runtime options will live here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                  running ? "bg-emerald-500" : runtimeState === "error" ? "bg-destructive" : "bg-muted-foreground/40",
                ].join(" ")}
              />
            </div>
            <div className="mt-4 rounded-lg bg-background/80 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Endpoint:</span>{" "}
              <span className="font-mono">
                {serverUrl ?? "Not running"}
              </span>
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
              Start Server
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onStopServer}
              disabled={!running || busy}
              className="flex-1"
            >
              <Square />
              Stop Server
            </Button>
          </div>

          <div className="rounded-xl border border-dashed p-4">
            <p className="text-sm font-medium">Runtime Options</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Server configuration controls will be added here as the runtime surface
              grows.
            </p>
          </div>

          {runtimeError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {runtimeError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-col border-border/70">
        <CardHeader>
          <CardTitle>Server Log</CardTitle>
          <CardDescription>
            Structured events emitted by the linked MCP server. Most recent entries are
            shown first.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
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
              Start the server and interact with the active project to see structured
              logs here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
