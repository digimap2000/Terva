import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Auth() {
  return (
    <div className="h-full p-6">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Auth</CardTitle>
          <CardDescription>
            Define how the linked MCP server should authenticate clients and apply
            local access rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-secondary/20 p-5">
            <p className="text-sm font-medium">Authentication Policy</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This view will own MCP authentication behavior for the active Terva
              project. Server-side auth options, origin policy, and local trust
              controls will be configured here rather than in the transport host.
            </p>
          </div>
          <div className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No auth controls are wired yet.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
