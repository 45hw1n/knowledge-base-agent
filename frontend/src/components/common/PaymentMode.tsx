import {
  ArrowLeftRight,
  BanknoteArrowDown,
  CreditCard,
  Globe,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentModeType =
  | "UPI"
  | "CARD_PAYMENT"
  | "ATM_WITHDRAWAL"
  | "NET_BANKING"
  | "ONLINE_TRANSACTION";

type PaymentModeConfig = {
  icon: LucideIcon;
  label: string;
};

export const PAYMENT_MODE_CONFIG: Record<PaymentModeType, PaymentModeConfig> = {
  UPI: { icon: ScanLine, label: "UPI" },
  CARD_PAYMENT: { icon: CreditCard, label: "Card Payment" },
  ATM_WITHDRAWAL: { icon: BanknoteArrowDown, label: "ATM Withdrawal" },
  NET_BANKING: { icon: Globe, label: "Net Banking" },
  ONLINE_TRANSACTION: { icon: ArrowLeftRight, label: "Online Transaction" },
};

export interface PaymentModeProps {
  mode: PaymentModeType;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
}

export function isPaymentModeType(value: string): value is PaymentModeType {
  return value in PAYMENT_MODE_CONFIG;
}

export function getPaymentModeLabel(mode: PaymentModeType): string {
  return PAYMENT_MODE_CONFIG[mode].label;
}

export default function PaymentMode({
  mode,
  className,
  iconClassName,
  labelClassName,
  showLabel = true,
}: PaymentModeProps) {
  const { icon: Icon, label } = PAYMENT_MODE_CONFIG[mode];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={label}
    >
      <Icon
        className={cn("shrink-0 text-muted-foreground", iconClassName)}
        aria-hidden="true"
      />
      {showLabel && (
        <span
          className={cn("font-medium", labelClassName)}
        >
          {label}
        </span>
      )}
    </span>
  );
}
