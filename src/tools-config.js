// Shared between shell.js (renderer) — kept as a plain script (no require)
// so it can be loaded directly via <script src="tools-config.js"> in shell.html.

const TOOL_CATEGORIES = [
  {
    key: 'income-tax',
    label: 'Income Tax & TDS',
    tools: [
      { id: 'tax-regime-calculator', title: 'Tax Regime Calculator (Old vs New)', file: 'tax-regime-calculator.html' },
      { id: 'tds-calculator', title: 'TDS Calculator', file: 'tds-calculator.html' },
      { id: 'capital-gains-calculator', title: 'Capital Gains Calculator', file: 'capital-gains-calculator.html' },
      { id: 'hra-calculator', title: 'HRA Exemption Calculator', file: 'hra-calculator.html' },
    ],
  },
  {
    key: 'gst',
    label: 'GST Compliance',
    tools: [
      { id: 'gst-2b-reconciliation', title: 'GST 2B Reconciliation', file: 'gst-2b-reconciliation.html', tally: 'file-2', note: 'Upload the same 2B/Books exports you already use — direct field auto-fill doesn’t apply here.' },
      { id: 'gst-due-date-tracker', title: 'GST Due Date Tracker', file: 'gst-due-date-tracker.html' },
      { id: 'gst-tax-cashflow-forecaster', title: 'GST & Tax Cash Flow Forecaster', file: 'gst-tax-cashflow-forecaster.html', tally: 'direct', fields: { 'inp-revenue': { bucket: 'revenue', mode: 'sum' } } },
    ],
  },
  {
    key: 'startup',
    label: 'Startup & Business Health',
    tools: [
      { id: 'unit-economics-calculator', title: 'Unit Economics Calculator', file: 'unit-economics-calculator.html', tally: 'direct', fields: { 'inp-sm-spend': { bucket: 'marketingExpense', mode: 'sum' } } },
      { id: 'breakeven-runway-calculator', title: 'Breakeven & Runway Calculator', file: 'breakeven-runway-calculator.html', tally: 'direct', fields: {
          'inp-fixed-costs': { bucket: 'indirectExpense', mode: 'monthly' },
          'inp-cash': { bucket: 'cashBank', mode: 'sum' },
          'inp-monthly-expenses': { bucket: ['cogs', 'directExpense', 'indirectExpense'], mode: 'monthly' },
          'inp-monthly-revenue': { bucket: 'revenue', mode: 'monthly' },
        } },
      { id: 'valuation-dilution-simulator', title: 'Valuation & Dilution Simulator', file: 'valuation-dilution-simulator.html' },
      { id: 'first-hire-cost-calculator', title: 'First Hire — True Cost Calculator', file: 'first-hire-cost-calculator.html' },
    ],
  },
  {
    key: 'financial-audit',
    label: 'Financial Planning & Audit',
    tools: [
      { id: 'financial-health-screener', title: 'Financial Health Screener', file: 'financial-health-screener.html', tally: 'direct', fields: {
          'inp-revenue': { bucket: 'revenue', mode: 'sum' },
          'inp-cogs': { bucket: 'cogs', mode: 'sum' },
          'inp-sga': { bucket: 'indirectExpense', mode: 'sum' },
          'inp-interest': { bucket: 'interest', mode: 'sum' },
          'inp-tax': { bucket: 'incomeTax', mode: 'sum' },
          'inp-cash': { bucket: 'cashBank', mode: 'sum' },
          'inp-ar': { bucket: 'debtors', mode: 'sum' },
          'inp-inv': { bucket: 'inventory', mode: 'sum' },
          'inp-nppe': { bucket: 'fixedAssets', mode: 'sum' },
          'inp-ap': { bucket: 'creditors', mode: 'sum' },
        } },
      { id: 'monthly-mis-report-generator', title: 'Monthly MIS Report Generator', file: 'monthly-mis-report-generator.html' },
      { id: 'audit-document-checklist', title: 'Audit Document Checklist', file: 'audit-document-checklist.html', tally: 'file-2', note: 'Import the Trial Balance / Day Book Excel exports the tool already expects — see the Tally panel for the matching live totals to cross-check against.' },
    ],
  },
  {
    key: 'roc',
    label: 'ROC Compliance',
    tools: [
      { id: 'roc-compliance-checklist', title: 'ROC Compliance Checklist', file: 'roc-compliance-checklist.html' },
    ],
  },
  {
    key: 'fun',
    label: 'Just for Fun',
    tools: [
      { id: 'tax-trivia-quiz', title: 'Tax Trivia Quiz', file: 'tax-trivia-quiz.html' },
      { id: 'tax-myths-vs-facts', title: 'Tax Myths vs Facts', file: 'tax-myths-vs-facts.html' },
      { id: 'emi-calculator', title: 'EMI Calculator', file: 'emi-calculator.html' },
    ],
  },
];

if (typeof module !== 'undefined') module.exports = { TOOL_CATEGORIES };
