// ~0.75 words per token (GPT-style heuristic)
function estimateTokenCount(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 0.75);
}

// Signature patterns that mark the start of content we can drop
const SIGNATURE_PATTERNS = [
  /^(thanks\s*[&and]*\s*regards|best\s+regards|warm\s+regards|kind\s+regards|regards|sincerely|cheers|thank\s+you)[,.]?\s*$/i,
  /^best[,.]?\s*$/i,
  /^--\s*$/,
];

// Quoted reply header patterns (Outlook/Gmail style)
const REPLY_HEADER_PATTERNS = [
  /^on\s.+wrote:\s*$/i,
  /^-{3,}\s*original message\s*-{3,}/i,
  /^from:\s*.+sent:\s*.+to:\s*/i,
];

// Legal/footer line patterns
const FOOTER_PATTERNS = [
  /confidential(ity)?/i,
  /disclaimer/i,
  /unsubscribe/i,
  /this\s+email\s+was\s+sent/i,
  /privacy\s+policy/i,
  /all\s+rights\s+reserved/i,
];

function cleanEmailContent(raw) {
  // Strip HTML tags
  let text = raw.replace(/<[^>]*>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // Split into lines for per-line processing
  const lines = text.split(/\r?\n/);
  const kept = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Stop at signature
    if (SIGNATURE_PATTERNS.some((p) => p.test(line))) break;

    // Stop at quoted reply header
    if (REPLY_HEADER_PATTERNS.some((p) => p.test(line))) break;

    // Skip lines that are part of a quoted reply (lines starting with >)
    if (/^>/.test(line)) continue;

    // Skip legal footer lines
    if (FOOTER_PATTERNS.some((p) => p.test(line))) continue;

    kept.push(line);
  }

  // Join, collapse multiple blank lines into one, normalize whitespace within lines
  return kept
    .join("\n")
    .replace(/[^\S\n]+/g, " ") // collapse inline whitespace
    .replace(/\n{3,}/g, "\n\n") // max 2 consecutive newlines
    .trim();
}

const WORD_LIMIT = 600;

function buildOptimizedEmailPayload(emailMetadata, emailContent) {
  const cleaned = cleanEmailContent(emailContent) || emailContent;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const truncated =
    words.length > WORD_LIMIT
      ? words.slice(0, WORD_LIMIT).join(" ") + "\n[...trimmed]"
      : cleaned;


  return `
--------------------------------------------------
EMAIL METADATA
--------------------------------------------------

Subject: ${emailMetadata?.subject || ""}
From: ${emailMetadata?.from || ""}
Mail Date: ${emailMetadata?.date || ""}

--------------------------------------------------
EMAIL CONTENT (TRIMMED)
--------------------------------------------------

${truncated}`;

}

module.exports = {
  generate(context) {
    if (!context) {
      throw new Error("Context is required for prompt generation.");
    }

    const { categories = [], paymentSources = [], email = {} } = context;
    const emailMetadata = context.emailMetadata || email;
    const emailContent = context.emailContent || email.content || "";
    const optimizedEmailData = buildOptimizedEmailPayload(emailMetadata, emailContent)


    return `
You are a financial transaction extraction engine.

Your job is to extract EXACTLY ONE financial transaction from the email and return structured JSON.

You must:
- Use ONLY information present in the email.
- Use ONLY IDs provided in AVAILABLE DATABASE VALUES.
- Never invent values.
- Never guess IDs not present in provided lists.
- Return JSON only.
- Do NOT include markdown.
- Do NOT explain anything.

--------------------------------------------------
AVAILABLE DATABASE VALUES
--------------------------------------------------

CATEGORIES (with nested subCategories):
${JSON.stringify(categories, null, 2)}

PAYMENT SOURCES:
${JSON.stringify(paymentSources, null, 2)}

PAYMENT MODE:
UPI
CARD_PAYMENT
NET_BANKING
ATM_WITHDRAWAL
ONLINE_TRANSACTION

${optimizedEmailData}

--------------------------------------------------
EXTRACTION RULES
--------------------------------------------------

1. DATE (CRITICAL):
   - Return FULL ISO-8601 datetime with timezone.
   - Example: 2026-01-31T23:31:04+05:30
   - Prefer exact transaction datetime from email.
   - If only transaction date exists (no time), combine:
       transaction date + Mail Date time.
   - If no transaction date exists, use full Mail Date.
   - NEVER return date-only format.

2. AMOUNT:
   - Extract numeric amount.
   - Must be positive.
   - Do NOT include currency symbol.

3. CURRENCY:
   - Extract from email if present.
   - If not mentioned, default to "INR".

4. TYPE:
   - "DEBIT" if money deducted/sent/paid.
   - "CREDIT" if money received/refunded.

5. merchantRaw:
   - Exact merchant/recipient text from email.
   - Do NOT clean or modify.

6. merchantNormalized:
   - Clean canonical name.
   - Remove words like PRIVATE, LIMITED, PVT, LTD, INDIA.
   - Remove VPA prefixes.
   - Remove trailing alphanumeric terminal/merchant codes
     (e.g., "PR415550", "TID12345").
   - Keep only merchant/person name.

7. referenceId:
   - Extract UTR / reference number / transaction ID if present.
   - Else null.

8. isCreditCardRepayment:
   - Set isCreditCardRepayment = true if ANY of the following match:
   - VPA contains: "cred.club", "creditcard", "billpayment", "ccpay"
   - Merchant name (raw or normalized) contains:
     "CRED", "CREDIT CARD PAYMENT", "CREDIT CARD BILL",
     "BILLDESK", "CC PAYMENT", "CCPAY"
   - Merchant name matches bank credit card pattern:
     "[BANK NAME] CREDIT CARD" e.g. "HDFC CREDIT CARD",
     "ICICI CREDIT CARD"

   NOT a repayment — do NOT set true for:
   - Swiggy, Spotify, Netflix, Amazon, Zomato, BigBasket, Zepto,
     grocery stores, restaurants, dry fruit shops, petrol pumps,
     or ANY regular purchase merchant.
   - The email may say "Your [Bank] Credit Card XXnnnn has been used
     for a transaction..." — this means the credit card is the PAYMENT
     INSTRUMENT, not the recipient. This does NOT make it a repayment.
   - Decision heuristic: Money going TO a credit card to pay off a
     bill/balance = repayment (true). Money going TO a merchant FOR
     a product or service = regular purchase (false).

   Otherwise → false

9. name (Human readable title):
   Apply these rules in order. Use the first rule that matches.

   CRITICAL: A rule "matches" ONLY if the merchant name is CLEARLY and
   UNAMBIGUOUSLY identifiable as belonging to that category based on the
   merchant name alone. If there is ANY doubt, skip to rule 9.15
   (FALLBACK). Do NOT guess or assume.

   9.1. COFFEE AND BEVERAGES
     (Starbucks, Café Coffee Day, CCD, Barista, Third Wave, Blue Tokai,
      tea stalls, juice bars, beverage outlets)
     → "Coffee at {Merchant}"
     (use "Tea at {Merchant}" if clearly a chai/tea place)

   9.2. FOOD AND DINING
     ONLY match if the merchant is a KNOWN restaurant, food chain, food
     delivery app, or the name contains clear food/dining keywords
     (restaurant, cafe, kitchen, biryani, dhaba, bakery, mess, canteen,
     foods, dine, eatery, tiffin).
     Generic or ambiguous names (e.g., "Kohinoor", "Grand", "Royal",
     "Palace") are NOT sufficient.
     NOTE: If the merchant already matched 9.1 (Coffee), skip this rule.
     - 5AM–10:59AM   → "Breakfast at {Merchant}"
     - 11AM–3:59PM   → "Lunch at {Merchant}"
     - 4PM–5:59PM    → "Evening Snack at {Merchant}"
     - 6PM–11:59PM   → "Dinner at {Merchant}"
     - Midnight–4AM  → "Late Night Bite at {Merchant}"
     - No time info  → "Meal at {Merchant}"

   9.3. GROCERIES AND SUPERMARKETS
     (BigBasket, DMart, Zepto, Blinkit, Swiggy Instamart, Nature's
      Basket, supermarkets, hypermarkets, kirana stores)
     → "Groceries from {Merchant}"

   9.4. PERSONAL CARE
     (salons, spas, barbers, Green Trends, Naturals, Toni and Guy,
      beauty services)
     → "Personal Care at {Merchant}"

   9.5. FUEL AND PETROL
     (HP, Indian Oil, BPCL, Bharat Petroleum, Shell, petrol,
      fuel stations)
     → "Fuel at {Merchant}"

   9.6. AUTOMOTIVE
     (motors, garage, service center, auto works, wheels, tyres,
      car/bike dealers, spare parts shops)
     → "Auto Service - {Merchant}"

   9.7. TRANSPORT
     (Uber, Ola, Rapido, metro, toll, bus, cab, auto, parking,
      FastTag)
     → "Transport - {Merchant}"

   9.8. TRAVEL
     (IRCTC, airlines, IndiGo, Air India, SpiceJet, MakeMyTrip,
      hotel booking, Airbnb, OYO, train tickets, flight booking,
      RedBus outstation)
     → "Travel - {Merchant}"

   9.9. SUBSCRIPTION
     (Netflix, Spotify, Amazon Prime, YouTube Premium, Hotstar,
      Disney+, Apple Music, ZEE5, SonyLIV, Adobe, Notion, Slack,
      Dropbox, streaming/music/video subscriptions, SaaS tools)
     → "Subscription - {Merchant}"

   9.10. ENTERTAINMENT
     (PVR, INOX, BookMyShow, gaming, amusement parks, events,
      concerts)
     → "Entertainment - {Merchant}"

   9.11. SHOPPING AND E-COMMERCE
     (Amazon, Flipkart, Myntra, Nykaa, Meesho, retail clothing,
      electronics stores)
     → "Shopping at {Merchant}"

   9.12. MEDICAL AND PHARMACY
     (Apollo, MedPlus, hospitals, clinics, diagnostic labs,
      pharmacies, scans, pathology, X-ray, imaging, radiology,
      dental, eye care, ortho, physio, Aarthi Scans,
      Vijaya Diagnostics)
     → "Medical - {Merchant}"

   9.13. BILLS AND UTILITIES
     (electricity, water, broadband, mobile recharge, Jio, Airtel,
      BESCOM, piped gas, LPG cylinder booking)
     Do NOT include insurance here.
     → "Bill - {Merchant}"

   9.14. PERSON-TO-PERSON TRANSFER
     Match if ALL of these are true:
     a) Payment is via UPI (VPA present in email)
     b) Recipient name looks like a person's name (e.g.,
        "RAJASEKAR RAJENDRAN", "VAISHALI MOHANRAM") rather than
        a registered business
     c) VPA does NOT belong to a known business/merchant

     How to distinguish a person from a business:
     - Person: 2-3 word name with Indian first/last name pattern,
       VPA often contains a personal name (e.g., rajasekar@ybl)
     - Business: single brand word, contains PVT/LTD/LLC, or matches
       a well-known merchant name

     → "{Recipient Name}"
     (return just the person's name in title case, nothing else)

   9.15. FALLBACK (DEFAULT — use this when in doubt)
     If the merchant name does NOT clearly and obviously match any of
     the above categories, DO NOT force-fit it.
     → "{Merchant Normalized}"
     (return the cleaned merchant name as-is, title-cased)

---

ADDITIONAL NOTES FOR NAME

- If transaction time is unavailable, skip all time-based rules and
  rely solely on merchant category matching.
- Merchant names may contain alphanumeric terminal/reference codes
  (e.g., "KOHINOOR PR415550"). Strip them from the normalized name
  and do NOT use them to infer merchant type.
- When in doubt between two categories, prefer FALLBACK (rule 9.15).
- Do not over-label. "Sri Motors" should not become
  "Auto Service - Sri Motors" if it could be an unrelated business.
- Do not assume unknown merchants are restaurants. "Kohinoor",
  "Aarthi", "Grand" are ambiguous — use FALLBACK unless clear
  food/dining keywords are present.

10. categoryId and subCategoryId (CRITICAL — ALWAYS RETURN A PAIR):

  PAIRING RULE (NON-NEGOTIABLE):
  - categoryId and subCategoryId are ALWAYS returned as a pair.
  - NEVER return a subCategoryId without its parent categoryId.
  - NEVER return a categoryId from one category paired with a
    subCategoryId from a different category.
  - subCategoryId MUST always belong to the subcategories nested
    inside the chosen categoryId. Cross-category pairing is
    STRICTLY INVALID.
  - The ONLY valid case for null is when the email is completely
    uninterpretable — empty body, no amount, no merchant, no context
    whatsoever. In all other cases, always return a valid pair.
  - If categoryId is null, subCategoryId MUST also be null.

  CLASSIFICATION APPROACH:
  First try CONFIDENT MATCH using the inference hints below.
  If no confident match is found, GUESS using the signal hierarchy.
  Never leave both null if any signal exists in the email.

  CONFIDENT MATCH — Category inference hints (apply first match):

    HOUSING
      - Keywords: rent, maintenance, society, apartment, flat,
        pg, hostel
      - Merchants: NoBroker, MagicBricks

    GROCERY
      - Keywords: grocery, supermarket, hypermarket, vegetables,
        fruits, provisions, kirana, quick commerce, instant delivery
      - Merchants: BigBasket, DMart, Zepto, Blinkit, Swiggy Instamart,
        Nature's Basket, Reliance Fresh, Spencer's, More Supermarket

    BILLS
      - Keywords: electricity, recharge, broadband, wifi, mobile bill,
        postpaid, prepaid, piped gas, LPG, cylinder, water bill
      - Merchants: BESCOM, TNEB, MSEB, Airtel, Jio, BSNL, Vi, ACT,
        Hathway, Indane, HP Gas, Bharat Gas
      - Note: Credit card bill payments go to LOAN, not BILLS.

    DINING
      - Keywords: restaurant, biryani, food, dine, eat, kitchen,
        dhaba, mess, tiffin, home food, dabba
      - Merchants: Swiggy (food orders), Zomato, McDonald's, KFC,
        Domino's, Burger King, Subway, Pizza Hut
      - Note: Swiggy Instamart and Blinkit are GROCERY, not DINING.

    TRANSPORT
      - Keywords: fuel, petrol, diesel, cab, auto, metro, toll,
        parking, local commute, FastTag
      - Merchants: Uber, Ola, Rapido, HP, Indian Oil, BPCL, Shell,
        FastTag, DIMTS, BMTC
      - Note: Flight, train, hotel bookings go to TRAVEL, not TRANSPORT.

    TRAVEL
      - Keywords: flight, train ticket, hotel, resort, airbnb, trip,
        holiday, outstation, bus ticket (intercity)
      - Merchants: IRCTC, IndiGo, Air India, SpiceJet, GoAir,
        MakeMyTrip, Goibibo, Yatra, OYO, Airbnb, RedBus (outstation)

    SHOPPING
      - Keywords: clothing, electronics, furniture, appliance,
        fashion, retail, store, mart
      - Merchants: Amazon, Flipkart, Myntra, Nykaa, Meesho, Ajio,
        Reliance Digital, Croma, Vijay Sales

    ENTERTAINMENT
      - Keywords: movie, ticket, outing, amusement, park, game,
        event, concert
      - Merchants: PVR, INOX, BookMyShow, Wonderla

    SUBSCRIPTION
      - Keywords: subscription, membership, premium, plan, streaming,
        SaaS, software
      - Merchants: Netflix, Spotify, Amazon Prime, YouTube Premium,
        Hotstar, Disney+, Apple Music, ZEE5, SonyLIV, Adobe, Notion,
        Slack, Dropbox

    HEALTH
      - Keywords: hospital, clinic, pharmacy, medicine, doctor,
        diagnostic, lab, medical, scans, pathology, radiology,
        imaging, X-ray, dental, ortho, physio, gym, fitness
      - Merchants: Apollo, MedPlus, Netmeds, 1mg, Practo, Fortis,
        Columbia Asia, Aarthi Scans, Vijaya Diagnostics, Thyrocare,
        SRL Diagnostics, Dr Lal PathLabs, Cult.fit, Fitternity

    EDUCATION
      - Keywords: course, tuition, coaching, class, school, college,
        university, exam fee, books, stationery
      - Merchants: Udemy, Coursera, BYJU's, Unacademy, WhiteHat Jr

    INSURANCE
      - Keywords: insurance, premium, policy, term plan
      - Merchants: LIC, PolicyBazaar, HDFC Life, ICICI Prudential,
        Star Health, Bajaj Allianz

    PETS
      - Keywords: pet food, vet, veterinary, pet grooming, pet store,
        dog, cat, aquarium
      - Merchants: Heads Up For Tails, PetSutra, Supertails, Wiggles

    PERSONAL
      - Keywords: salon, spa, barber, grooming, parlour, beauty,
        donation, charity, temple, church, mosque
      - Merchants: Green Trends, Naturals, Toni and Guy, Lakme Salon,
        Milaap, GiveIndia, Ketto

    LOAN
      - Keywords: EMI, loan, home loan, vehicle loan, personal loan,
        education loan, repayment, instalment, credit card bill,
        credit card payment
      - Merchants: Any bank or NBFC with EMI/loan/credit card bill
        context
      - Note: All credit card bill payments go here to avoid
        double-counting spend.

    FUND_TRANSFER
      - Keywords: ATM, cash withdrawal, transfer to partner, transfer
        to family, transfer to friend
      - Context: ATM cash withdrawal, or UPI transfer to a known
        personal contact (partner, family, friend)

    DEBTS
      - Keywords: lent, borrowed, repayment, returning money
      - Context: money sent to someone as a loan, or repayment
        received — NOT a regular purchase or bill

    INVESTMENT
      - Keywords: SIP, mutual fund, gold, ETF, invest, folio,
        stocks, shares, crypto, PPF, NPS
      - Merchants: Zerodha, Groww, Kuvera, Coin, INDmoney,
        Paytm Money, ET Money, Wazirx, CoinDCX

    SAVING
      - Keywords: fixed deposit, FD, recurring deposit, RD,
        self transfer, own account transfer, emergency fund
      - Merchants: Any bank with FD/RD context, or self UPI transfer

    REFUND
      - Keywords: refund, cashback, reversal, money returned,
        reimbursement
      - Context: CREDIT type transaction from a merchant or bank
        indicating money returned

  GUESS HIERARCHY — when no confident match exists, apply in order:

    SIGNAL 1 — VPA is a phone number (e.g., 9840012345@paytm,
               9840012345@ybl, 9840012345@okicici)
      → FUND_TRANSFER + FRIEND_TRANSFER
        (isGuessed: true, confidence.overall below 0.5)

    SIGNAL 2 — VPA contains a person's name pattern
               (e.g., ravi.kumar@okicici, priya.sharma@ybl)
               and NOT a known business
      → FUND_TRANSFER + FRIEND_TRANSFER
        (isGuessed: true, confidence.overall below 0.5)

    SIGNAL 3 — Amount is large and round (≥ ₹5,000), sent to an
               individual via UPI, no merchant context
      → FUND_TRANSFER + FRIEND_TRANSFER
        (isGuessed: true, confidence.overall below 0.5)

    SIGNAL 4 — Email is from a bank, subject contains "EMI" or
               "loan" or "instalment", no specific loan type
               mentioned
      → LOAN + EMI
        (isGuessed: true, confidence.overall: 0.5–0.6)

    SIGNAL 5 — Amount is small and recurring pattern suggested
               (same amount, first of month), no merchant context
      → BILLS + ELECTRICITY as a placeholder
        (isGuessed: true, confidence.overall below 0.5)

    SIGNAL 6 — Transaction TYPE is CREDIT and no refund keyword,
               no salary keyword, amount is small
      → REFUND + BANK_REFUND
        (isGuessed: true, confidence.overall below 0.5)

    SIGNAL 7 — Transaction TYPE is CREDIT and keyword "salary"
               or "credited" with a large amount
      → INCOME + SALARY
        (isGuessed: true, confidence.overall: 0.6–0.7)

    SIGNAL 8 — No signals match at all. Use PERSONAL + MISC as
               the universal catch-all pair. This is always valid
               and always schema-safe.
      → PERSONAL + MISC
        (isGuessed: true, confidence.overall below 0.4)

  SUBCATEGORY INFERENCE HINTS (always validate against parent):

    HOUSING
      - RENT → payment to landlord, rent, NoBroker rent
      - MAINTENANCE → society maintenance, apartment maintenance fee
      - SOCIETY_CHARGE → society charge, apartment association fee

    GROCERY
      - GROCERY → general grocery, supermarket, kirana, provisions
      - FRUIT_AND_VEGETABLE → vegetables, fruits, sabzi, fresh produce
      - SNACK → chips, snacks, biscuits, packaged food
      - QUICK_COMMERCE → Zepto, Blinkit, Swiggy Instamart, instant
                          delivery apps
      - HOUSEHOLD_SUPPLY → detergent, cleaning supplies, toiletries,
                            household items from grocery apps

    BILLS
      - ELECTRICITY → TNEB, BESCOM, MSEB, electricity board payments
      - MOBILE → Airtel, Jio, Vi, BSNL, mobile recharge, postpaid bill
      - INTERNET → ACT, Hathway, broadband, wifi, fiber internet bill
      - GAS_AND_LPG → Indane, HP Gas, Bharat Gas, LPG cylinder
                       booking, piped gas bill
      - WATER_BILL → municipal water bill, water board payment

    DINING
      - RESTAURANT → physical restaurant, dine-in, hotel (food
                     context)
      - FOOD_DELIVERY → Swiggy (food orders), Zomato, online food
                        order
      - HOME_FOOD_DELIVERY → tiffin service, home cook, dabba
                              service, homemade food delivery
      - CAFE → Starbucks, CCD, Barista, Third Wave, Blue Tokai,
               standalone cafe payments

    TRANSPORT
      - FUEL → petrol, diesel, HP, Indian Oil, BPCL, Shell,
               fuel station
      - COMMUTE → Uber, Ola, Rapido, metro, local bus, auto,
                  local cab
      - VEHICLE_SERVICE → service center, garage, car wash, tyre
                           shop, spare parts, vehicle repair
      - TOLL → FastTag, toll plaza payments
      - PARKING → parking fee, parking lot payment

    TRAVEL
      - FLIGHT → IndiGo, Air India, SpiceJet, GoAir, flight ticket
      - TICKET_BOOKING → IRCTC train tickets, RedBus outstation,
                          intercity bus booking
      - HOTEL_STAY → OYO, Airbnb, MakeMyTrip hotel, Goibibo hotel,
                     resort booking, lodge
      - TRAVEL_ACTIVITIES → sightseeing, tour packages, travel
                             experiences, holiday activities

    SHOPPING
      - CLOTHING → Myntra, Ajio, Meesho, fashion, apparel, clothes
      - ELECTRONICS → Croma, Reliance Digital, Vijay Sales,
                      Amazon (electronics context)
      - HOME_ITEM → furniture, appliance, home decor, kitchen item
      - PERSONAL_CARE → Nykaa, Purplle, skincare, beauty products,
                        personal care products purchased online
      - GIFTS → gift purchases, gift cards, presents

    ENTERTAINMENT
      - MOVIE → PVR, INOX, BookMyShow (movie ticket context)
      - OUTING → general leisure outing, casual outings
      - EVENTS → concerts, live events, sports matches, BookMyShow
                 (non-movie context), Wonderla, amusement parks

    SUBSCRIPTION
      - VIDEO_STREAMING → Netflix, Amazon Prime, Hotstar, Disney+,
                          ZEE5, SonyLIV, YouTube Premium
      - MUSIC_STREAMING → Spotify, Apple Music, JioSaavn, Gaana,
                          Amazon Music
      - SOFTWARE_AND_SAAS → Adobe, Notion, Slack, Dropbox, Google
                             Workspace, Microsoft 365, any SaaS tool
      - READING → Kindle Unlimited, Pocket, news subscriptions,
                  magazine subscriptions

    HEALTH
      - MEDICINE → pharmacy, MedPlus, Netmeds, 1mg, medicine
                   purchase, Apollo pharmacy
      - DOCTOR → hospital, clinic, doctor consultation, Practo,
                 specialist visit
      - LAB_AND_DIAGNOSTIC → Aarthi Scans, Vijaya Diagnostics,
                              Thyrocare, SRL, Dr Lal PathLabs,
                              blood test, scan, X-ray, pathology
      - FITNESS → swimming, bouldering, yoga class, badminton court,
                  one-time sports activity, adhoc fitness payment
      - GYM → Cult.fit, Fitternity, gym membership, monthly gym
              fee, annual gym subscription

    EDUCATION
      - ONLINE_COURSE → Udemy, Coursera, BYJU's, Unacademy,
                        coaching fee, exam fee
      - BOOKS → book purchase, Kindle book, bookstore
      - STATIONERY → stationery shop, notebooks, pens,
                     office supplies
      - FEE → school fee, college fee, tuition fee,
              institution fee

    PETS
      - PET_FOOD → pet food purchase, dog food, cat food,
                   Heads Up For Tails, Supertails
      - VET_VISIT → veterinary clinic, vet consultation,
                    pet hospital
      - PET_GROOMING → pet grooming salon, pet spa

    INSURANCE
      - TERM_INSURANCE → term plan, HDFC Life, ICICI Prudential,
                          Max Life term insurance
      - LIFE_INSURANCE → LIC premium, endowment plan,
                          whole life policy
      - HEALTH_INSURANCE → Star Health, Niva Bupa, Bajaj Allianz
                            health, mediclaim premium
      - VEHICLE_INSURANCE → car insurance, bike insurance,
                             New India Assurance, ICICI Lombard
                             vehicle

    PERSONAL
      - GROOMING → salon, spa, barber, Green Trends, Naturals,
                   Lakme Salon, haircut, facial
      - MISC → anything that does not confidently fit any other
               category or subcategory — always valid as catch-all
      - DONATIONS_AND_CHARITY → Milaap, GiveIndia, Ketto, temple
                                 donation, charity payment,
                                 religious contribution

    LOAN
      - HOME_LOAN_EMI → home loan EMI, housing loan repayment
      - VEHICLE_LOAN_EMI → car loan EMI, bike loan EMI
      - PERSONAL_LOAN_EMI → personal loan EMI, consumer loan
      - EDUCATION_LOAN_EMI → education loan EMI, student loan
      - CREDIT_CARD_BILL → CRED, credit card bill payment,
                            CC payment, BillDesk (credit card
                            context), any bank credit card
                            repayment
      - EMI → generic EMI debit where loan type is not
               identifiable from the email

    FUND_TRANSFER
      - ATM_WITHDRAWAL → ATM cash withdrawal
      - PARTNER_TRANSFER → UPI transfer to partner/spouse
      - FAMILY_TRANSFER → UPI transfer to family member
                           (parent, sibling, relative)
      - FRIEND_TRANSFER → UPI transfer to a friend

    DEBTS
      - MONEY_SENT → money sent as a loan, marked as debt
      - REPAYMENT_RECEIVED → money received back as repayment

    INVESTMENT
      - SIP → SIP, mutual fund, Groww, Zerodha, Kuvera, INDmoney
      - GOLD → gold purchase, digital gold, Sovereign Gold Bond
      - ETF → ETF purchase, index fund
      - STOCKS → direct stock purchase, Zerodha equity,
                 Groww stocks
      - PPF_AND_NPS → PPF deposit, NPS contribution, pension fund
      - CRYPTO → Wazirx, CoinDCX, CoinSwitch, crypto purchase

    SAVING
      - FIXED_DEPOSIT → FD creation, fixed deposit booking
      - RECURRING_DEPOSIT → RD, recurring deposit setup
      - SELF_TRANSFER → transfer to own savings account, self
                        UPI transfer to own account
      - EMERGENCY_FUND → tagged transfer to emergency fund account

    REFUND
      - SHOPPING_REFUND → refund from Amazon, Flipkart, Myntra,
                          any shopping return
      - TRAVEL_REFUND → refund from IRCTC, airline, hotel
                        cancellation
      - BANK_REFUND → bank reversal, failed transaction refund,
                      bank initiated credit
      - CASHBACK → cashback credit, reward credit, promotional
                   credit from any merchant or payment app

11. paymentMode:
    - Determine how the payment was made.
    - Must be one of: UPI, CARD_PAYMENT, NET_BANKING,
      ATM_WITHDRAWAL, ONLINE_TRANSACTION
    - NEVER return null. If unsure, use best available signal.

    Detection order (apply the FIRST rule that matches):

    STEP 1 — ATM_WITHDRAWAL
      - Email contains "ATM", "ATM withdrawal", "cash withdrawal"
      → ATM_WITHDRAWAL

    STEP 2 — UPI
      - Email contains VPA (format: xxxxx@yyy) OR keywords "UPI",
        "VPA", "UPI transaction reference"
      → UPI

    STEP 3 — NET_BANKING
      - Email contains: "NEFT", "RTGS", "IMPS", "net banking",
        "netbanking", "internet banking"
      → NET_BANKING

    STEP 4a — ONLINE_TRANSACTION (keyword match)
      - Card is identified (credit or debit) AND merchant name
        contains any of these keywords (as part of the merchant
        name, NOT generic words from email body):
        RAZORPAY, PAYU, BILLDESK, CASHFREE, JUSPAY, PAYGATE,
        PAYMENTS, TECHNOLOGIES, INTERNET, DIGITAL, ONLINE, ECOM
      → ONLINE_TRANSACTION

    STEP 4b — ONLINE_TRANSACTION (known merchant match)
      - Card is identified (credit or debit) AND merchant matches:

        GROCERY: BigBasket, Zepto, Blinkit, Swiggy Instamart,
                 DMart, Nature's Basket, Reliance Fresh, Spencer's
        DINING: Swiggy, Zomato, McDonald's, KFC, Domino's,
                Burger King, Subway, Pizza Hut, Starbucks, CCD
        TRANSPORT: Uber, Ola, Rapido, FastTag
        TRAVEL: IRCTC, RedBus, IndiGo, Air India, MakeMyTrip,
                Goibibo, OYO, Airbnb
        SHOPPING: Amazon, Flipkart, Myntra, Nykaa, Meesho, Ajio,
                  Reliance Digital, Croma
        ENTERTAINMENT: PVR, INOX, BookMyShow, Wonderla
        SUBSCRIPTION: Netflix, Spotify, Amazon Prime, YouTube
                      Premium, Hotstar, Disney+, Apple Music,
                      ZEE5, SonyLIV, Adobe, Notion
        HEALTH: Apollo, MedPlus, Netmeds, 1mg, Practo, Cult.fit,
                Fitternity
        EDUCATION: Udemy, Coursera, BYJU's, Unacademy
        INSURANCE: PolicyBazaar, HDFC Life, ICICI Prudential
        INVESTMENT: Zerodha, Groww, Kuvera, INDmoney, Paytm Money,
                    ET Money, Wazirx, CoinDCX
        PAYMENTS: PhonePe, Google Pay, Paytm, CRED, Dunzo
      → ONLINE_TRANSACTION

      HARD STOP: If Step 4a or 4b matched → return
        ONLINE_TRANSACTION. Do NOT continue to Step 5.

    STEP 5 — CARD_PAYMENT (only if Step 4 did NOT match)
      - Email mentions "Credit Card", "credit card ending", "CC",
        "Debit Card", "debit card ending"
        OR last 4 digits match a CREDIT_CARD type in PAYMENT SOURCES
        OR last 4 digits match a BANK_ACCOUNT debitCardLast4 in
        PAYMENT SOURCES
      → CARD_PAYMENT

12. paymentSourceId:
    - Match using: card last 4, UPI ID, bank name, account last 4.
    - Must match an id from the provided PAYMENT SOURCES list.
    - If no confident match → null.

    STEP 1 — CARD_PAYMENT or ONLINE_TRANSACTION (credit card email):
      - Filter PAYMENT SOURCES where type = "CREDIT_CARD"
      - Match by last 4 digits, then by bank name
      → Return matching paymentSourceId

    STEP 2 — CARD_PAYMENT or ONLINE_TRANSACTION (debit card email):
      - Filter PAYMENT SOURCES where type = "BANK_ACCOUNT"
      - Match by debitCardLast4, then by bank name
      → Return matching paymentSourceId

    STEP 3 — UPI:
      - Filter PAYMENT SOURCES where type = "BANK_ACCOUNT"
      - Match by upiIds list, then by bank name
      → Return matching paymentSourceId

    STEP 4 — ATM_WITHDRAWAL:
      - Filter PAYMENT SOURCES where type = "BANK_ACCOUNT"
      - Match by debitCardLast4 or account last 4
      → Return matching paymentSourceId

    STEP 5 — NET_BANKING:
      - Filter PAYMENT SOURCES where type = "BANK_ACCOUNT"
      - Match by bank name mentioned in email
      → Return matching paymentSourceId

    - Prefer exact last 4 match over bank name match.
    - If no match → null.

13. cycle:
    - Must NEVER be null.
    - Format: MM-YYYY.

    RULE 1 — Credit Card Transaction:
      - Look up billingCycleDay from matched paymentSourceId.
      - If transaction date is ON OR AFTER billingCycleDay:
        → cycle = NEXT month and year
      - If transaction date is BEFORE billingCycleDay:
        → cycle = CURRENT month and year

    RULE 2 — Non Credit Card Transaction:
      - cycle = month and year of the transaction date

    RULE 3 — Format:
      - January 2026 → "01-2026"
      - February 2026 → "02-2026"

14. Confidence Scoring (numeric 0.0–1.0):
    overall:
      - 0.9–1.0 → clear banking email, all fields extracted directly
      - 0.7–0.89 → some fields inferred
      - 0.5–0.69 → category/subcategory guessed from weak signals
      - below 0.5 → category guessed from minimal or no signals
    paymentSource:
      - 0.9–1.0 → exact match by last 4 digits or UPI ID
      - 0.6–0.89 → inferred from bank name only
      - below 0.6 → no confident match found

15. isGuessed (boolean):
    - Set to true if categoryId and subCategoryId were determined
      by the GUESS HIERARCHY (rule 10 signals 1–8) rather than
      a CONFIDENT MATCH.
    - Set to false if the category was matched confidently via
      keywords or known merchants.
    - This field allows the UI to flag guessed transactions for
      user review without blocking the transaction from being saved.

--------------------------------------------------
STRICT OUTPUT FORMAT (MUST MATCH EXACTLY)
--------------------------------------------------

Return ONLY this JSON structure.
All keys MUST be present.
If unknown, use null.
Do NOT add extra keys.

{
  "date": "Full ISO-8601 datetime with timezone",
  "amount": number,
  "currency": "string",
  "type": "DEBIT | CREDIT",
  "merchantRaw": "string",
  "merchantNormalized": "string",
  "referenceId": "string or null",
  "isCreditCardRepayment": boolean,
  "name": "string",
  "categoryId": "string or null",
  "subCategoryId": "string or null",
  "paymentMode": "UPI | CARD_PAYMENT | ATM_WITHDRAWAL | NET_BANKING | ONLINE_TRANSACTION",
  "paymentSourceId": "string or null",
  "cycle": "MM-YYYY",
  "LLMMeta": {
    "confidence": {
      "overall": number,
      "paymentSource": number
    },
    "instrumentSignals": {
      "upiId": "string or null",
      "cardLast4": "string or null",
      "cardType": "CREDIT | DEBIT | null",
      "bank": "string or null",
      "bankAccountLast4": "string or null"
    },
    categorySubCategorySignals: {
      isGuessed: boolean,
      "categoryId": "string or null",
      "subCategoryId": "string or null",
    }
  }
}

Return ONLY valid JSON.
`;
  },
};

// SAMPLE OUTPUT

// {
//   "date": "2026-01-31T23:31:04+05:30",
//   "amount": 300.00,
//   "currency": "INR",
//   "type": "DEBIT",
//   "merchantRaw": "VPA vaishalimohanramtm@okhdfcbank VAISHALI THIYADA MOHANRAM",
//   "merchantNormalized": "VAISHALI THIYADA MOHANRAM",
//   "referenceId": "464203036188",
//   "isCreditCardRepayment": false,
//   "name": "VAISHALI THIYADA MOHANRAM",
//   "categoryId": "CASH",
//   "subCategoryId": "CASH_TRANSFER",
//   "paymentMode": "UPI",
//   "paymentSourceId": null,
//   "cycle": "01-2026",
//   "LLMMeta": {
//     "confidence": {
//       "overall": 0.95,
//       "paymentSource": 0.7
//     },
//     "instrumentSignals": {
//       "upiId": "vaishalimohanramtm@okhdfcbank",
//       "cardLast4": null,
//       "bank": "HDFC Bank",
//       "bankAccountLast4": "0796"
//     }
//   }
// }
