const { NEGATIVE_REGEX } = require('./Constants');

const testCases = [
    { text: "Your credit card statement is ready", expected: true },
    { text: "Reminder: Your payment is due", expected: true },
    { text: "Exclusive offer for you", expected: true },
    { text: "How was your experience? Feedback requested", expected: true },
    { text: "Your subscription has been activated", expected: true },
    { text: "Transaction of INR 500 at Amazon", expected: false },
    { text: "Amount of ₹1,234 debited from card", expected: false },
    { text: "OTP for authentication: 123456", expected: true }
];

let allPassed = true;
testCases.forEach(({ text, expected }) => {
    const result = NEGATIVE_REGEX.test(text);
    if (result !== expected) {
        console.error(`FAIL: "${text}" | Expected: ${expected} | Got: ${result}`);
        allPassed = false;
    } else {
        console.log(`PASS: "${text}"`);
    }
});

if (allPassed) {
    console.log("\nAll regex tests passed!");
    process.exit(0);
} else {
    console.error("\nSome regex tests failed!");
    process.exit(1);
}
