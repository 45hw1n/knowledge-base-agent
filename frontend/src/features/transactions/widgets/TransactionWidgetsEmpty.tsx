import { Card, CardContent } from "@/lib/ui";

export function TransactionWidgetsEmpty() {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        No transactions found for the selected period.
      </CardContent>
    </Card>
  );
}
