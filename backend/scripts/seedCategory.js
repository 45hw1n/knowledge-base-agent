// Change cwd to backend root so relative .env paths resolve correctly
process.chdir(require('path').resolve(__dirname, '..'));

// ⚠️  MUST load env BEFORE requiring any config/db modules — they read process.env at require-time
require('dotenv').config({ path: '.env.local' });

// Fail fast — nothing useful can happen without a DB connection string
if (!process.env.MONGO_URI) {
  console.error('[seedCategory] FATAL: MONGO_URI is not set in .env.production. Aborting.');
  process.exit(1);
}

const readline = require('readline');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Field = require('../src/models/Field');

const isDry = process.argv.includes('--dry');

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const categoryData = {
  id: '1',
  name: 'category',
  label: 'Category',
  isCustom: false,
  isActive: true,
  nestedTo: null,
  values: [
    { id: 'HOUSING',       value: 'HOUSING',       label: 'Housing',              isActive: true },
    { id: 'GROCERY',       value: 'GROCERY',       label: 'Grocery',              isActive: true },
    { id: 'BILLS',         value: 'BILLS',         label: 'Bills',                isActive: true },
    { id: 'DINING',        value: 'DINING',        label: 'Dining',               isActive: true },
    { id: 'TRANSPORT',     value: 'TRANSPORT',     label: 'Transport',            isActive: true },
    { id: 'TRAVEL',        value: 'TRAVEL',        label: 'Travel',               isActive: true },
    { id: 'SHOPPING',      value: 'SHOPPING',      label: 'Shopping',             isActive: true },
    { id: 'ENTERTAINMENT', value: 'ENTERTAINMENT', label: 'Entertainment',        isActive: true },
    { id: 'SUBSCRIPTION',  value: 'SUBSCRIPTION',  label: 'Subscription',         isActive: true },
    { id: 'HEALTH',        value: 'HEALTH',        label: 'Health',               isActive: true },
    { id: 'EDUCATION',     value: 'EDUCATION',     label: 'Education',            isActive: true },
    { id: 'PETS',          value: 'PETS',          label: 'Pets',                 isActive: true },
    { id: 'INSURANCE',     value: 'INSURANCE',     label: 'Insurance',            isActive: true },
    { id: 'PERSONAL',      value: 'PERSONAL',      label: 'Personal',             isActive: true },
    { id: 'LOAN',          value: 'LOAN',          label: 'Loan',                 isActive: true },
    { id: 'FUND_TRANSFER', value: 'FUND_TRANSFER', label: 'Fund Transfer',        isActive: true },
    { id: 'DEBTS',         value: 'DEBTS',         label: 'Debts and Repayments', isActive: true },
    { id: 'INCOME',        value: 'INCOME',        label: 'Income',               isActive: true },
    { id: 'INVESTMENT',    value: 'INVESTMENT',    label: 'Investment',           isActive: true },
    { id: 'SAVING',        value: 'SAVING',        label: 'Saving',               isActive: true },
    { id: 'REFUND',        value: 'REFUND',        label: 'Refund',               isActive: true },
  ],
};

const subCategoryData = {
  id: '2',
  name: 'subCategory',
  label: 'Sub category',
  isCustom: false,
  isActive: true,
  nestedTo: { field: 'category', id: '1' },
  values: [
    { id: 'RENT',                  value: 'RENT',                  label: 'Rent',                  isActive: true, nestedTo: { valueId: 'HOUSING' } },
    { id: 'MAINTENANCE',           value: 'MAINTENANCE',           label: 'Maintenance',           isActive: true, nestedTo: { valueId: 'HOUSING' } },
    { id: 'SOCIETY_CHARGE',        value: 'SOCIETY_CHARGE',        label: 'Society charge',        isActive: true, nestedTo: { valueId: 'HOUSING' } },

    { id: 'GROCERY',               value: 'GROCERY',               label: 'Grocery',               isActive: true, nestedTo: { valueId: 'GROCERY' } },
    { id: 'FRUIT_AND_VEGETABLE',   value: 'FRUIT_AND_VEGETABLE',   label: 'Fruit and vegetable',   isActive: true, nestedTo: { valueId: 'GROCERY' } },
    { id: 'SNACK',                 value: 'SNACK',                 label: 'Snack',                 isActive: true, nestedTo: { valueId: 'GROCERY' } },
    { id: 'QUICK_COMMERCE',        value: 'QUICK_COMMERCE',        label: 'Quick commerce',        isActive: true, nestedTo: { valueId: 'GROCERY' } },
    { id: 'HOUSEHOLD_SUPPLY',      value: 'HOUSEHOLD_SUPPLY',      label: 'Household supply',      isActive: true, nestedTo: { valueId: 'GROCERY' } },

    { id: 'ELECTRICITY',           value: 'ELECTRICITY',           label: 'Electricity',           isActive: true, nestedTo: { valueId: 'BILLS' } },
    { id: 'MOBILE',                value: 'MOBILE',                label: 'Mobile',                isActive: true, nestedTo: { valueId: 'BILLS' } },
    { id: 'INTERNET',              value: 'INTERNET',              label: 'Internet',              isActive: true, nestedTo: { valueId: 'BILLS' } },
    { id: 'GAS_AND_LPG',           value: 'GAS_AND_LPG',           label: 'Gas and LPG',           isActive: true, nestedTo: { valueId: 'BILLS' } },
    { id: 'WATER_BILL',            value: 'WATER_BILL',            label: 'Water bill',            isActive: true, nestedTo: { valueId: 'BILLS' } },

    { id: 'RESTAURANT',            value: 'RESTAURANT',            label: 'Restaurant',            isActive: true, nestedTo: { valueId: 'DINING' } },
    { id: 'FOOD_DELIVERY',         value: 'FOOD_DELIVERY',         label: 'Food delivery',         isActive: true, nestedTo: { valueId: 'DINING' } },
    { id: 'HOME_FOOD_DELIVERY',    value: 'HOME_FOOD_DELIVERY',    label: 'Home food delivery',    isActive: true, nestedTo: { valueId: 'DINING' } },
    { id: 'CAFE',                  value: 'CAFE',                  label: 'Cafe',                  isActive: true, nestedTo: { valueId: 'DINING' } },

    { id: 'FUEL',                  value: 'FUEL',                  label: 'Fuel',                  isActive: true, nestedTo: { valueId: 'TRANSPORT' } },
    { id: 'COMMUTE',               value: 'COMMUTE',               label: 'Commute',               isActive: true, nestedTo: { valueId: 'TRANSPORT' } },
    { id: 'VEHICLE_SERVICE',       value: 'VEHICLE_SERVICE',       label: 'Vehicle service',       isActive: true, nestedTo: { valueId: 'TRANSPORT' } },
    { id: 'TOLL',                  value: 'TOLL',                  label: 'Toll',                  isActive: true, nestedTo: { valueId: 'TRANSPORT' } },
    { id: 'PARKING',               value: 'PARKING',               label: 'Parking',               isActive: true, nestedTo: { valueId: 'TRANSPORT' } },

    { id: 'FLIGHT',                value: 'FLIGHT',                label: 'Flight',                isActive: true, nestedTo: { valueId: 'TRAVEL' } },
    { id: 'TICKET_BOOKING',        value: 'TICKET_BOOKING',        label: 'Ticket booking',        isActive: true, nestedTo: { valueId: 'TRAVEL' } },
    { id: 'HOTEL_STAY',            value: 'HOTEL_STAY',            label: 'Hotel stay',            isActive: true, nestedTo: { valueId: 'TRAVEL' } },
    { id: 'TRAVEL_ACTIVITIES',     value: 'TRAVEL_ACTIVITIES',     label: 'Travel activities',     isActive: true, nestedTo: { valueId: 'TRAVEL' } },

    { id: 'CLOTHING',              value: 'CLOTHING',              label: 'Clothing',              isActive: true, nestedTo: { valueId: 'SHOPPING' } },
    { id: 'ELECTRONICS',           value: 'ELECTRONICS',           label: 'Electronics',           isActive: true, nestedTo: { valueId: 'SHOPPING' } },
    { id: 'HOME_ITEM',             value: 'HOME_ITEM',             label: 'Home item',             isActive: true, nestedTo: { valueId: 'SHOPPING' } },
    { id: 'PERSONAL_CARE',         value: 'PERSONAL_CARE',         label: 'Personal care',         isActive: true, nestedTo: { valueId: 'SHOPPING' } },
    { id: 'GIFTS',                 value: 'GIFTS',                 label: 'Gifts',                 isActive: true, nestedTo: { valueId: 'SHOPPING' } },

    { id: 'MOVIE',                 value: 'MOVIE',                 label: 'Movie',                 isActive: true, nestedTo: { valueId: 'ENTERTAINMENT' } },
    { id: 'OUTING',                value: 'OUTING',                label: 'Outing',                isActive: true, nestedTo: { valueId: 'ENTERTAINMENT' } },
    { id: 'EVENTS',                value: 'EVENTS',                label: 'Events',                isActive: true, nestedTo: { valueId: 'ENTERTAINMENT' } },

    { id: 'VIDEO_STREAMING',       value: 'VIDEO_STREAMING',       label: 'Video streaming',       isActive: true, nestedTo: { valueId: 'SUBSCRIPTION' } },
    { id: 'MUSIC_STREAMING',       value: 'MUSIC_STREAMING',       label: 'Music streaming',       isActive: true, nestedTo: { valueId: 'SUBSCRIPTION' } },
    { id: 'SOFTWARE_AND_SAAS',     value: 'SOFTWARE_AND_SAAS',     label: 'Software and SaaS',     isActive: true, nestedTo: { valueId: 'SUBSCRIPTION' } },
    { id: 'READING',               value: 'READING',               label: 'Reading',               isActive: true, nestedTo: { valueId: 'SUBSCRIPTION' } },

    { id: 'MEDICINE',              value: 'MEDICINE',              label: 'Medicine',              isActive: true, nestedTo: { valueId: 'HEALTH' } },
    { id: 'DOCTOR',                value: 'DOCTOR',                label: 'Doctor',                isActive: true, nestedTo: { valueId: 'HEALTH' } },
    { id: 'LAB_AND_DIAGNOSTIC',    value: 'LAB_AND_DIAGNOSTIC',    label: 'Lab and diagnostic',    isActive: true, nestedTo: { valueId: 'HEALTH' } },
    { id: 'FITNESS',               value: 'FITNESS',               label: 'Fitness',               isActive: true, nestedTo: { valueId: 'HEALTH' } },
    { id: 'GYM',                   value: 'GYM',                   label: 'Gym',                   isActive: true, nestedTo: { valueId: 'HEALTH' } },

    { id: 'ONLINE_COURSE',         value: 'ONLINE_COURSE',         label: 'Online course',         isActive: true, nestedTo: { valueId: 'EDUCATION' } },
    { id: 'BOOKS',                 value: 'BOOKS',                 label: 'Books',                 isActive: true, nestedTo: { valueId: 'EDUCATION' } },
    { id: 'STATIONERY',            value: 'STATIONERY',            label: 'Stationery',            isActive: true, nestedTo: { valueId: 'EDUCATION' } },
    { id: 'FEE',                   value: 'FEE',                   label: 'Fee',                   isActive: true, nestedTo: { valueId: 'EDUCATION' } },

    { id: 'PET_FOOD',              value: 'PET_FOOD',              label: 'Pet food',              isActive: true, nestedTo: { valueId: 'PETS' } },
    { id: 'VET_VISIT',             value: 'VET_VISIT',             label: 'Vet visit',             isActive: true, nestedTo: { valueId: 'PETS' } },
    { id: 'PET_GROOMING',          value: 'PET_GROOMING',          label: 'Pet grooming',          isActive: true, nestedTo: { valueId: 'PETS' } },

    { id: 'TERM_INSURANCE',        value: 'TERM_INSURANCE',        label: 'Term insurance',        isActive: true, nestedTo: { valueId: 'INSURANCE' } },
    { id: 'LIFE_INSURANCE',        value: 'LIFE_INSURANCE',        label: 'Life insurance',        isActive: true, nestedTo: { valueId: 'INSURANCE' } },
    { id: 'HEALTH_INSURANCE',      value: 'HEALTH_INSURANCE',      label: 'Health insurance',      isActive: true, nestedTo: { valueId: 'INSURANCE' } },
    { id: 'VEHICLE_INSURANCE',     value: 'VEHICLE_INSURANCE',     label: 'Vehicle insurance',     isActive: true, nestedTo: { valueId: 'INSURANCE' } },

    { id: 'GROOMING',              value: 'GROOMING',              label: 'Grooming',              isActive: true, nestedTo: { valueId: 'PERSONAL' } },
    { id: 'MISC',                  value: 'MISC',                  label: 'Misc',                  isActive: true, nestedTo: { valueId: 'PERSONAL' } },
    { id: 'DONATIONS_AND_CHARITY', value: 'DONATIONS_AND_CHARITY', label: 'Donations and charity', isActive: true, nestedTo: { valueId: 'PERSONAL' } },

    { id: 'HOME_LOAN_EMI',         value: 'HOME_LOAN_EMI',         label: 'Home loan EMI',         isActive: true, nestedTo: { valueId: 'LOAN' } },
    { id: 'VEHICLE_LOAN_EMI',      value: 'VEHICLE_LOAN_EMI',      label: 'Vehicle loan EMI',      isActive: true, nestedTo: { valueId: 'LOAN' } },
    { id: 'PERSONAL_LOAN_EMI',     value: 'PERSONAL_LOAN_EMI',     label: 'Personal loan EMI',     isActive: true, nestedTo: { valueId: 'LOAN' } },
    { id: 'EDUCATION_LOAN_EMI',    value: 'EDUCATION_LOAN_EMI',    label: 'Education loan EMI',    isActive: true, nestedTo: { valueId: 'LOAN' } },
    { id: 'CREDIT_CARD_BILL',      value: 'CREDIT_CARD_BILL',      label: 'Credit card bill',      isActive: true, nestedTo: { valueId: 'LOAN' } },
    { id: 'EMI',                   value: 'EMI',                   label: 'EMI',                   isActive: true, nestedTo: { valueId: 'LOAN' } },

    { id: 'ATM_WITHDRAWAL',        value: 'ATM_WITHDRAWAL',        label: 'ATM withdrawal',        isActive: true, nestedTo: { valueId: 'FUND_TRANSFER' } },
    { id: 'PARTNER_TRANSFER',      value: 'PARTNER_TRANSFER',      label: 'Partner transfer',      isActive: true, nestedTo: { valueId: 'FUND_TRANSFER' } },
    { id: 'FAMILY_TRANSFER',       value: 'FAMILY_TRANSFER',       label: 'Family transfer',       isActive: true, nestedTo: { valueId: 'FUND_TRANSFER' } },
    { id: 'FRIEND_TRANSFER',       value: 'FRIEND_TRANSFER',       label: 'Friend transfer',       isActive: true, nestedTo: { valueId: 'FUND_TRANSFER' } },

    { id: 'MONEY_SENT',            value: 'MONEY_SENT',            label: 'Money sent',            isActive: true, nestedTo: { valueId: 'DEBTS' } },
    { id: 'REPAYMENT_RECEIVED',    value: 'REPAYMENT_RECEIVED',    label: 'Repayment received',    isActive: true, nestedTo: { valueId: 'DEBTS' } },

    { id: 'SALARY',                value: 'SALARY',                label: 'Salary',                isActive: true, nestedTo: { valueId: 'INCOME' } },
    { id: 'FREELANCE',             value: 'FREELANCE',             label: 'Freelance',             isActive: true, nestedTo: { valueId: 'INCOME' } },
    { id: 'INTEREST_INCOME',       value: 'INTEREST_INCOME',       label: 'Interest income',       isActive: true, nestedTo: { valueId: 'INCOME' } },
    { id: 'DIVIDEND',              value: 'DIVIDEND',              label: 'Dividend',              isActive: true, nestedTo: { valueId: 'INCOME' } },
    { id: 'RENTAL_INCOME',         value: 'RENTAL_INCOME',         label: 'Rental income',         isActive: true, nestedTo: { valueId: 'INCOME' } },

    { id: 'SIP',                   value: 'SIP',                   label: 'SIP',                   isActive: true, nestedTo: { valueId: 'INVESTMENT' } },
    { id: 'GOLD',                  value: 'GOLD',                  label: 'Gold',                  isActive: true, nestedTo: { valueId: 'INVESTMENT' } },
    { id: 'ETF',                   value: 'ETF',                   label: 'ETF',                   isActive: true, nestedTo: { valueId: 'INVESTMENT' } },
    { id: 'STOCKS',                value: 'STOCKS',                label: 'Stocks',                isActive: true, nestedTo: { valueId: 'INVESTMENT' } },
    { id: 'PPF_AND_NPS',           value: 'PPF_AND_NPS',           label: 'PPF and NPS',           isActive: true, nestedTo: { valueId: 'INVESTMENT' } },
    { id: 'CRYPTO',                value: 'CRYPTO',                label: 'Crypto',                isActive: true, nestedTo: { valueId: 'INVESTMENT' } },

    { id: 'FIXED_DEPOSIT',         value: 'FIXED_DEPOSIT',         label: 'Fixed deposit',         isActive: true, nestedTo: { valueId: 'SAVING' } },
    { id: 'RECURRING_DEPOSIT',     value: 'RECURRING_DEPOSIT',     label: 'Recurring deposit',     isActive: true, nestedTo: { valueId: 'SAVING' } },
    { id: 'SELF_TRANSFER',         value: 'SELF_TRANSFER',         label: 'Self transfer',         isActive: true, nestedTo: { valueId: 'SAVING' } },
    { id: 'EMERGENCY_FUND',        value: 'EMERGENCY_FUND',        label: 'Emergency fund',        isActive: true, nestedTo: { valueId: 'SAVING' } },

    { id: 'SHOPPING_REFUND',       value: 'SHOPPING_REFUND',       label: 'Shopping refund',       isActive: true, nestedTo: { valueId: 'REFUND' } },
    { id: 'TRAVEL_REFUND',         value: 'TRAVEL_REFUND',         label: 'Travel refund',         isActive: true, nestedTo: { valueId: 'REFUND' } },
    { id: 'BANK_REFUND',           value: 'BANK_REFUND',           label: 'Bank refund',           isActive: true, nestedTo: { valueId: 'REFUND' } },
    { id: 'CASHBACK',              value: 'CASHBACK',              label: 'Cashback',              isActive: true, nestedTo: { valueId: 'REFUND' } },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Prompts the user for input and resolves with the trimmed response
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
}

// Idempotent upsert: skips creation if a document with the given name already exists
async function upsertField(data, dry) {
  const existing = await Field.findOne({ name: data.name });
  if (existing) {
    console.log(`[seedCategory] "${data.name}" already exists — skipping.`);
    return;
  }
  if (dry) {
    console.log(`[seedCategory] [DRY RUN] Would create "${data.name}".`);
    return;
  }
  await Field.create(data);
  console.log(`[seedCategory] Created "${data.name}" successfully.`);
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function runSeedCategory() {
  // Safety gate — forces deliberate confirmation before touching production data
  console.log('\n⚠️  WARNING: You are about to run this on PRODUCTION');
  console.log(`    DB: ${process.env.MONGO_URI.replace(/:([^@]+)@/, ':****@')}`);
  if (isDry) console.log('    Mode: DRY RUN — no writes will occur\n');

  const answer = await prompt('Type YES to proceed (anything else aborts): ');
  if (answer !== 'YES') {
    console.log('[seedCategory] Aborted.');
    process.exit(0);
  }

  try {
    console.log('[seedCategory] Connecting to MongoDB...');
    await connectDB();

    await upsertField(categoryData, isDry);
    await upsertField(subCategoryData, isDry);

    console.log('[seedCategory] Seed completed successfully.');
  } catch (err) {
    console.error('[seedCategory] Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[seedCategory] Disconnected from MongoDB.');
  }
}

// ---------------------------------------------------------------------------

module.exports = { runSeedCategory };

if (require.main === module) {
  runSeedCategory();
}
