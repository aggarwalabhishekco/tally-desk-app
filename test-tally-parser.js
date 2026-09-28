// Standalone test: feeds a representative Tally Trial-Balance XML shape into
// parseTrialBalance and checks the bucket totals come out right. Modelled on
// publicly documented Tally XML export structure (LEDGER nodes with
// LEDGERNAME/PARENT/CLOSINGBALANCE under nested GROUP collections) since a
// live Tally instance isn't available in this environment.
const { parseTrialBalance, classifyLedger } = require('./src/tally-connector');
const assert = require('assert');

const sampleXML = `<ENVELOPE>
  <BODY>
    <DATA>
      <TRIALBALANCE>
        <DSPACCNAME>
          <LEDGER>
            <LEDGERNAME>Sales Accounts - Consulting</LEDGERNAME>
            <PARENT>Sales Accounts</PARENT>
            <CLOSINGBALANCE>-1250000.00</CLOSINGBALANCE>
          </LEDGER>
          <LEDGER>
            <LEDGERNAME>Purchase Accounts - Software</LEDGERNAME>
            <PARENT>Purchase Accounts</PARENT>
            <CLOSINGBALANCE>300000.00</CLOSINGBALANCE>
          </LEDGER>
          <LEDGER>
            <LEDGERNAME>Rent Paid</LEDGERNAME>
            <PARENT>Indirect Expenses</PARENT>
            <CLOSINGBALANCE>180000.00</CLOSINGBALANCE>
          </LEDGER>
          <LEDGER>
            <LEDGERNAME>HDFC Bank Current A/c</LEDGERNAME>
            <PARENT>Bank Accounts</PARENT>
            <CLOSINGBALANCE>540000.00</CLOSINGBALANCE>
          </LEDGER>
          <LEDGER>
            <LEDGERNAME>ABC Client Pvt Ltd</LEDGERNAME>
            <PARENT>Sundry Debtors</PARENT>
            <CLOSINGBALANCE>420000.00</CLOSINGBALANCE>
          </LEDGER>
          <LEDGER>
            <LEDGERNAME>XYZ Vendor</LEDGERNAME>
            <PARENT>Sundry Creditors</PARENT>
            <CLOSINGBALANCE>-95000.00</CLOSINGBALANCE>
          </LEDGER>
          <LEDGER>
            <LEDGERNAME>Interest Paid on Loan</LEDGERNAME>
            <PARENT>Indirect Expenses</PARENT>
            <CLOSINGBALANCE>22000.00</CLOSINGBALANCE>
          </LEDGER>
          <LEDGER>
            <LEDGERNAME>Advertisement Expenses</LEDGERNAME>
            <PARENT>Indirect Expenses</PARENT>
            <CLOSINGBALANCE>75000.00</CLOSINGBALANCE>
          </LEDGER>
        </DSPACCNAME>
      </TRIALBALANCE>
    </DATA>
  </BODY>
</ENVELOPE>`;

const { totals, ledgers } = parseTrialBalance(sampleXML);

assert.strictEqual(ledgers.length, 8, `expected 8 ledgers, got ${ledgers.length}`);
assert.strictEqual(Math.round(totals.revenue), 1250000, `revenue: ${totals.revenue}`);
assert.strictEqual(Math.round(totals.cogs), 300000, `cogs: ${totals.cogs}`);
assert.strictEqual(Math.round(totals.cashBank), 540000, `cashBank: ${totals.cashBank}`);
assert.strictEqual(Math.round(totals.debtors), 420000, `debtors: ${totals.debtors}`);
assert.strictEqual(Math.round(totals.creditors), 95000, `creditors: ${totals.creditors}`);
assert.strictEqual(Math.round(totals.interest), 22000, `interest: ${totals.interest}`);
assert.strictEqual(Math.round(totals.marketingExpense), 75000, `marketingExpense: ${totals.marketingExpense}`);
// Indirect expenses should include rent (180000) + interest (22000) + advt (75000) since
// classifyLedger buckets interest/marketing separately from the generic indirectExpense bucket
// only when their specific keyword patterns match -- rent falls through to indirectExpense.
assert.strictEqual(Math.round(totals.indirectExpense), 180000, `indirectExpense: ${totals.indirectExpense}`);

console.log('All parser assertions passed.');
console.log('Totals:', totals);

// classifyLedger direct checks
assert.strictEqual(classifyLedger('Sales Accounts - Consulting', 'Sales Accounts'), 'revenue');
assert.strictEqual(classifyLedger('Income Tax Provision', 'Provisions'), 'incomeTax');
assert.strictEqual(classifyLedger('Cash-in-Hand', 'Cash-in-Hand'), 'cashBank');
console.log('All classifier assertions passed.');
