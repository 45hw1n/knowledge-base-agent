import {
  Backpack,
  Banknote,
  BanknoteArrowUp,
  CalendarSync,
  Car,
  Clapperboard,
  GraduationCap,
  Heart,
  House,
  PawPrint,
  PiggyBank,
  Receipt,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Tag,
  TrendingUp,
  User,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  label: string;
  value: string;
};

type SubCategory = {
  id: string;
  label: string;
  value: string;
};

type Props = {
  category: Category;
  subCategory?: SubCategory | null;
};

// ─── Config ────────────────────────────────────────────────────────────────────

type CategoryConfig = {
  icon: LucideIcon;
  bg: string;
  text: string;
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  HOUSING: { icon: House, bg: "bg-blue-50", text: "text-blue-700" },
  GROCERY: { icon: ShoppingBasket, bg: "bg-green-50", text: "text-green-700" },
  BILLS: { icon: ReceiptText, bg: "bg-blue-50", text: "text-blue-700" },
  DINING: { icon: Utensils, bg: "bg-amber-50", text: "text-amber-700" },
  TRANSPORT: { icon: Car, bg: "bg-blue-50", text: "text-blue-700" },
  TRAVEL: { icon: Backpack, bg: "bg-amber-50", text: "text-amber-700" },
  SHOPPING: { icon: ShoppingBag, bg: "bg-amber-50", text: "text-amber-700" },
  ENTERTAINMENT: { icon: Clapperboard, bg: "bg-amber-50", text: "text-amber-700" },
  SUBSCRIPTION: { icon: CalendarSync, bg: "bg-amber-50", text: "text-amber-700" },
  HEALTH: { icon: Heart, bg: "bg-green-50", text: "text-green-700" },
  EDUCATION: { icon: GraduationCap, bg: "bg-blue-50", text: "text-blue-700" },
  PETS: { icon: PawPrint, bg: "bg-green-50", text: "text-green-700" },
  INSURANCE: { icon: ShieldCheck, bg: "bg-violet-50", text: "text-violet-700" },
  PERSONAL: { icon: User, bg: "bg-green-50", text: "text-green-700" },
  LOAN: { icon: BanknoteArrowUp, bg: "bg-rose-50", text: "text-rose-700" },
  FUND_TRANSFER: { icon: Banknote, bg: "bg-violet-50", text: "text-violet-700" },
  DEBTS: { icon: Receipt, bg: "bg-rose-50", text: "text-rose-700" },
  INCOME: { icon: WalletCards, bg: "bg-violet-50", text: "text-violet-700" },
  INVESTMENT: { icon: TrendingUp, bg: "bg-violet-50", text: "text-violet-700" },
  SAVING: { icon: PiggyBank, bg: "bg-violet-50", text: "text-violet-700" },
  REFUND: { icon: RotateCcw, bg: "bg-violet-50", text: "text-violet-700" },
};

const FALLBACK_CONFIG: CategoryConfig = {
  icon: Tag,
  bg: "bg-gray-100",
  text: "text-gray-600",
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CategorySubCategory({ category, subCategory }: Props) {
  const config = CATEGORY_CONFIG[category.value] ?? FALLBACK_CONFIG;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}
      aria-label={subCategory ? `${category.label}, ${subCategory.label}` : category.label}
    >
      <Icon size={14} aria-hidden="true" />
      {category.label}
      {subCategory && (
        <>
          <span className="opacity-40 select-none" aria-hidden="true">·</span>
          {subCategory.label}
        </>
      )}
    </span>
  );
}

// ─── Sample usages ─────────────────────────────────────────────────────────────

// <CategorySubCategory
//   category={{ id: "1", label: "Health", value: "HEALTH" }}
//   subCategory={{ id: "2", label: "Doctor", value: "DOCTOR" }}
// />
// → [Heart icon] Health · Doctor

// <CategorySubCategory
//   category={{ id: "3", label: "Dining", value: "DINING" }}
// />
// → [Utensils icon] Dining

// <CategorySubCategory
//   category={{ id: "4", label: "Investment", value: "INVESTMENT" }}
//   subCategory={{ id: "5", label: "Mutual Fund", value: "MUTUAL_FUND" }}
// />
// → [TrendingUp icon] Investment · Mutual Fund

// <CategorySubCategory
//   category={{ id: "6", label: "Unknown", value: "UNKNOWN_VALUE" }}
// />
// → [Tag icon] Unknown  (fallback for unmapped categories)
