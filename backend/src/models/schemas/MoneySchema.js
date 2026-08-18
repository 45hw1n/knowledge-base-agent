const mongoose = require('mongoose');

/**
 * Reusable {value, currency?} sub-schema for a monetary amount. `currency`
 * is optional — a source may state an amount using only a symbol (e.g.
 * "₹5,000") without a resolvable ISO currency code, and we don't invent
 * one. Shared across Invoice.amount and Payment.amount.
 */
const MoneySchema = new mongoose.Schema(
  {
    value: { type: Number, required: true },
    currency: { type: String, default: null, trim: true },
  },
  { _id: false }
);

module.exports = MoneySchema;
