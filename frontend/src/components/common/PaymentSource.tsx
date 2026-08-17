type PaymentSourceData = {
  kind: string;
  displayName?: string | null;
  last4?: string | null;
} | null;

type Props = {
  paymentSource: PaymentSourceData;
};

function resolveDisplayName(ps: NonNullable<PaymentSourceData>): string {
  return (
    ps.displayName ??
    (ps.kind === "CREDIT_CARD" ? "Credit Card" : "Bank Account")
  );
}

export default function PaymentSource({ paymentSource }: Props) {
  if (!paymentSource) return <>—</>;

  const name = resolveDisplayName(paymentSource);

  if (!paymentSource.last4) {
    return <>{name}</>;
  }

  return (
    <>
      {name}
      <span className="font-mono text-muted-foreground">
        {" "}
        ****{paymentSource.last4}
      </span>
    </>
  );
}
