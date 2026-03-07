import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RuntimeLogEntry } from "@/hooks/useActiveProject";

interface LogsProps {
  logs: RuntimeLogEntry[];
}

export function Logs({ logs }: LogsProps) {
  return (
    <div className="h-full p-6">
      <Card className="flex h-full min-h-0 flex-col border-border/70">
        <CardHeader>
          <CardTitle>Runtime Log</CardTitle>
          <CardDescription>
            Structured events emitted by the linked Terva runtime. Most recent entries are shown first.
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
              Start the runtime and interact with the active project to see structured logs here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
