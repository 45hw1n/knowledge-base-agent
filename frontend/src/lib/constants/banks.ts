/** Shape of a bank option returned by getBanks() */
export interface BankOption {
  id: string;
  name: string;
  value: string;
}

/**
 * Returns a list of banks.
 * Shared across the app for bank-account and credit-card forms.
 */
export const getBanks = (): BankOption[] => [
  { id: "sbi", name: "State Bank of India", value: "State Bank of India" },
  { id: "hdfc", name: "HDFC Bank", value: "HDFC Bank" },
  { id: "icici", name: "ICICI Bank", value: "ICICI Bank" },
  { id: "axis", name: "Axis Bank", value: "Axis Bank" },
  { id: "kotak", name: "Kotak Mahindra Bank", value: "Kotak Mahindra Bank" },

  { id: "pnb", name: "Punjab National Bank", value: "Punjab National Bank" },
  { id: "bob", name: "Bank of Baroda", value: "Bank of Baroda" },
  { id: "canara", name: "Canara Bank", value: "Canara Bank" },
  { id: "union", name: "Union Bank of India", value: "Union Bank of India" },
  { id: "indian", name: "Indian Bank", value: "Indian Bank" },

  { id: "idfc", name: "IDFC FIRST Bank", value: "IDFC FIRST Bank" },
  { id: "idbi", name: "IDBI Bank", value: "IDBI Bank" },
  { id: "yes", name: "Yes Bank", value: "Yes Bank" },
  { id: "indusind", name: "IndusInd Bank", value: "IndusInd Bank" },
  { id: "federal", name: "Federal Bank", value: "Federal Bank" },

  { id: "bandhan", name: "Bandhan Bank", value: "Bandhan Bank" },
  { id: "rbl", name: "RBL Bank", value: "RBL Bank" },
  { id: "south_indian", name: "South Indian Bank", value: "South Indian Bank" },
  { id: "karnataka", name: "Karnataka Bank", value: "Karnataka Bank" },
  { id: "karur", name: "Karur Vysya Bank", value: "Karur Vysya Bank" },

  { id: "city_union", name: "City Union Bank", value: "City Union Bank" },

  {
    id: "au_sfb",
    name: "AU Small Finance Bank",
    value: "AU Small Finance Bank",
  },
  {
    id: "ujjivan",
    name: "Ujjivan Small Finance Bank",
    value: "Ujjivan Small Finance Bank",
  },
  {
    id: "equitas",
    name: "Equitas Small Finance Bank",
    value: "Equitas Small Finance Bank",
  },

  { id: "paytm_pb", name: "Paytm Payments Bank", value: "Paytm Payments Bank" },
];
