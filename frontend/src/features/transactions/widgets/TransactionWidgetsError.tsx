interface TransactionWidgetsErrorProps {
  message: string;
}

export function TransactionWidgetsError({ message }: TransactionWidgetsErrorProps) {
  return (
    <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-sm font-medium text-destructive">
      Oops, something went wrong: {message}
    </div>
  );
}
