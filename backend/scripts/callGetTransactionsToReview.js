#!/usr/bin/env node
/**
 * Calls GET_TRANSACTIONS_TO_REVIEW via POST /graphql and prints JSON to stdout.
 *
 * Prerequisites:
 * - Backend running (see server.js GraphQL mount path).
 * - Valid session: the resolver requires `req.user`. Pass your browser session cookie.
 *
 * Usage (from repo `backend/` or `backend/scripts/` — paths are relative to this file):
 *   node scripts/callGetTransactionsToReview.js
 *   cd scripts && node callGetTransactionsToReview.js
 *
 * With auth (copy Cookie from DevTools → Application → Cookies, or Network tab request headers):
 *   SESSION_COOKIE='connect.sid=YOUR_SIG_HERE' node scripts/callGetTransactionsToReview.js
 *
 * Default URL: https when effective NODE_ENV is `local` (matches server.js HTTPS).
 * Uses the same default as backend/src/config when NODE_ENV is unset (`local`), so
 * missing .env.local still picks https—matching `nodemon server.js` without env files.
 * For https://localhost self-signed certs the script sets NODE_TLS_REJECT_UNAUTHORIZED=0
 * unless you already set NODE_TLS_REJECT_UNAUTHORIZED=1 to enforce verification.
 *
 * Override URL:
 *   GRAPHQL_URL=http://localhost:5000/graphql node scripts/callGetTransactionsToReview.js
 *
 * Custom payload (must match GraphQL variables shape `{ input: { listInfo: ... } }`):
 *   PAYLOAD_FILE=./scripts/payload-get-transactions-to-review.json node scripts/callGetTransactionsToReview.js
 *
 * Or inline JSON string:
 *   SCRIPT_PAYLOAD_JSON='{"input":{"listInfo":{"page":1,"pageSize":10}}}' node scripts/callGetTransactionsToReview.js
 */

const fs = require('fs');
const path = require('path');

// Load PORT etc. from .env.local / .env.*
const config = require('../src/config');

const PORT = config.PORT || 5000;
/** Align with server.js + src/config: unset NODE_ENV defaults to `local`. */
const effectiveNodeEnv = process.env.NODE_ENV || config.NODE_ENV;

const GRAPHQL_URL =
    process.env.GRAPHQL_URL ||
    (effectiveNodeEnv === 'local'
        ? `https://localhost:${PORT}/graphql`
        : `http://localhost:${PORT}/graphql`);

/** Relax TLS for dev HTTPS on localhost only (self-signed certs). */
function applyLocalHttpsTlsIfNeeded() {
    try {
        const u = new URL(GRAPHQL_URL);
        const isLocal =
            u.hostname === 'localhost' || u.hostname === '127.0.0.1';
        if (u.protocol !== 'https:' || !isLocal) return;
        if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '1') return;
        if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
            console.warn(
                '[callGetTransactionsToReview] NODE_TLS_REJECT_UNAUTHORIZED=0 for local HTTPS (dev certs). Set NODE_TLS_REJECT_UNAUTHORIZED=1 to enforce.'
            );
        }
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    } catch {
        // ignore invalid GRAPHQL_URL
    }
}

const QUERY = `
  query GetTransactionsToReview($input: GetTransactionsToReviewInput!) {
    GET_TRANSACTIONS_TO_REVIEW(input: $input) {
      data {
        id
        amount
        merchant
        status
        createdAt
        updatedAt
        date
        type
        paymentMode
        category {
          id
          value
          label
        }
      }
      listInfo {
        page
        pageSize
        sort {
          attribute
          order
        }
        conditions
      }
      pagination {
        total
        totalPages
        hasNext
        hasPrevious
      }
      meta {
        executionTime
        cached
      }
    }
  }
`;

const DEFAULT_VARIABLES = {
    input: {
        listInfo: {
            page: 1,
            pageSize: 25,
            sort: [{ attribute: 'createdAt', order: 'DESC' }],
            conditions: {
                operator: 'AND',
                operands: [
                    { attribute: 'status', operator: 'is', value: 'READY_TO_REVIEW' }
                ]
            }
        }
    }
};

function loadVariables() {
    if (process.env.SCRIPT_PAYLOAD_JSON) {
        return JSON.parse(process.env.SCRIPT_PAYLOAD_JSON);
    }
    const filePath = process.env.PAYLOAD_FILE;
    if (filePath) {
        const resolved = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
        const raw = fs.readFileSync(resolved, 'utf8');
        return JSON.parse(raw);
    }
    return DEFAULT_VARIABLES;
}

async function main() {
    applyLocalHttpsTlsIfNeeded();

    const variables = loadVariables();
    const headers = {
        'Content-Type': 'application/json'
    };
    if (process.env.SESSION_COOKIE) {
        headers.Cookie = process.env.SESSION_COOKIE;
    }

    const body = JSON.stringify({
        query: QUERY,
        variables
    });

    const res = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers,
        body
    });

    const text = await res.text();
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        console.error('Non-JSON response:', text);
        process.exit(1);
    }

    const showStack =
        process.env.GRAPHQL_VERBOSE === '1' || process.env.GRAPHQL_VERBOSE === 'true';
    const forPrint =
        !showStack && parsed.errors?.length
            ? {
                  ...parsed,
                  errors: parsed.errors.map(({ extensions, ...rest }) => {
                      if (!extensions?.stacktrace) return { ...rest, extensions };
                      const { stacktrace: _s, ...extRest } = extensions;
                      return { ...rest, extensions: extRest };
                  })
              }
            : parsed;

    console.log(JSON.stringify(forPrint, null, 2));

    const unauthorized = parsed.errors?.some(
        (e) => e.extensions?.code === 'UNAUTHORIZED'
    );
    if (unauthorized) {
        console.error(
            '\n[callGetTransactionsToReview] Session required. After logging in in the browser, copy the Cookie header ' +
                '(e.g. connect.sid=...) and run:\n' +
                "  SESSION_COOKIE='connect.sid=...' node scripts/callGetTransactionsToReview.js\n" +
                '(Full docs in script header.)'
        );
    }

    if (parsed.errors?.length) {
        process.exitCode = 1;
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
