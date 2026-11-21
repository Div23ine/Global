/* ============================================================================
   MERIDIAN GLOBAL ACCOUNTS — INTERNATIONAL MULTI-CURRENCY ACCOUNT PLATFORM
   (frontend design prototype — three design concepts for client selection)

   shared/data.js — shared dataset, product copy and DEMO SEED used by all
   three design concepts and by the React admin apps.

   !! IMPORTANT !!
   EVERY value below is DEMONSTRATION DATA. No figure, balance, transaction,
   customer, rate or statistic on any page of this frontend is real financial
   information. This file (plus shared/api.js) is the single seam to swap for
   real API responses when the backend is implemented.
   ========================================================================== */
window.GL = window.GL || {};

GL.BRAND = {
  name: 'Meridian',
  full: 'Meridian Global Accounts',
  tagline: 'One account. Five currencies. Global access.',
  sub: 'GLOBAL ACCOUNTS',
  wordmarkNote: 'Placeholder brand for the design prototype'
};

GL.PREVIEW = true; /* enables demo banners, simulated OTP codes and flow simulators */

/* ---------------------------------------------------------------------------
   Supported currencies + indicative demo rates (per 1 USD). JPY is seeded as
   "temporarily unavailable" to demonstrate that state. Rates are static demo
   values — production would consume a live rates feed.
--------------------------------------------------------------------------- */
GL.CURRENCIES = [
  { code: 'NGN', name: 'Nigerian Naira',  symbol: '₦',   status: 'active',       note: '' },
  { code: 'USD', name: 'US Dollar',       symbol: '$',   status: 'active',       note: '' },
  { code: 'GBP', name: 'British Pound',   symbol: '£',   status: 'active',       note: '' },
  { code: 'EUR', name: 'Euro',            symbol: '€',   status: 'active',       note: '' },
  { code: 'CHF', name: 'Swiss Franc',     symbol: 'CHF', status: 'active',       note: '' },
  { code: 'JPY', name: 'Japanese Yen',    symbol: '¥',   status: 'unavailable',  note: 'Temporarily unavailable for activation while we extend the demo.' }
];

GL.RATES = { USD: 1, GBP: 1.27, EUR: 1.08, CHF: 1.12, NGN: 1 / 1550, JPY: 0.0066 };
GL.RATES_NOTE = 'Indicative demo rates — no real exchange is performed in this prototype.';

/* ---------------------------------------------------------------------------
   Countries selectable at registration. "currency" is the country-based
   DEFAULT currency activated after simulated verification. The mapping is
   deliberately configurable — production reads it from backend config.
--------------------------------------------------------------------------- */
GL.COUNTRIES = [
  { code: 'NG', name: 'Nigeria',           currency: 'NGN', dial: '+234' },
  { code: 'US', name: 'United States',     currency: 'USD', dial: '+1'   },
  { code: 'GB', name: 'United Kingdom',    currency: 'GBP', dial: '+44'  },
  { code: 'CH', name: 'Switzerland',       currency: 'CHF', dial: '+41'  },
  { code: 'DE', name: 'Germany',           currency: 'EUR', dial: '+49'  },
  { code: 'FR', name: 'France',            currency: 'EUR', dial: '+33'  },
  { code: 'IT', name: 'Italy',             currency: 'EUR', dial: '+39'  },
  { code: 'ES', name: 'Spain',             currency: 'EUR', dial: '+34'  },
  { code: 'NL', name: 'Netherlands',       currency: 'EUR', dial: '+31'  },
  { code: 'BE', name: 'Belgium',           currency: 'EUR', dial: '+32'  },
  { code: 'IE', name: 'Ireland',           currency: 'EUR', dial: '+353' },
  { code: 'AT', name: 'Austria',           currency: 'EUR', dial: '+43'  },
  { code: 'PT', name: 'Portugal',          currency: 'EUR', dial: '+351' },
  { code: 'FI', name: 'Finland',           currency: 'EUR', dial: '+358' },
  { code: 'CA', name: 'Canada',            currency: 'USD', dial: '+1'   },
  { code: 'AU', name: 'Australia',         currency: 'USD', dial: '+61'  },
  { code: 'ZA', name: 'South Africa',      currency: 'USD', dial: '+27'  },
  { code: 'AE', name: 'United Arab Emirates', currency: 'USD', dial: '+971' },
  { code: 'SG', name: 'Singapore',         currency: 'USD', dial: '+65'  },
  { code: 'HK', name: 'Hong Kong SAR',     currency: 'USD', dial: '+852' },
  { code: 'JP', name: 'Japan',             currency: 'USD', dial: '+81'  },
  { code: 'KE', name: 'Kenya',             currency: 'USD', dial: '+254' },
  { code: 'GH', name: 'Ghana',             currency: 'USD', dial: '+233' },
  { code: 'BR', name: 'Brazil',            currency: 'USD', dial: '+55'  }
];
GL.COUNTRY_NOTE = 'Countries without a national currency in our supported set default to USD. The mapping is configurable.';

/* ---------------------------------------------------------------------------
   Simulated deposit methods. "currencies: null" = all supported currencies.
   Credit card is deliberately unsupported for NGN ("where supported").
--------------------------------------------------------------------------- */
GL.DEPOSIT_METHODS = [
  { id: 'debit_card',     label: 'Debit card',      icon: 'card',     feePct: 1.4, feeNote: '1.4% (min 0.50 currency units)', currencies: null,  desc: 'Instant simulated debit-card charge.' },
  { id: 'credit_card',    label: 'Credit card',     icon: 'card',     feePct: 2.2, feeNote: '2.2% (min 1.00 currency units)', currencies: ['USD', 'GBP', 'EUR', 'CHF'], desc: 'Where supported — not available for NGN.' },
  { id: 'payment_gateway',label: 'Payment gateway', icon: 'globe',    feePct: 1.0, feeNote: '1.0% gateway fee', currencies: null, desc: 'Simulated third-party checkout.' },
  { id: 'bank_transfer',  label: 'Bank transfer',   icon: 'bank',     feePct: 0,   feeNote: 'No fee', currencies: null, desc: 'Simulated transfer — settles as PENDING until confirmed.' }
];

GL.DEPOSIT_LIMITS = { NGN: [1000, 5000000], USD: [10, 50000], GBP: [10, 40000], EUR: [10, 45000], CHF: [10, 45000] };

/* ---------------------------------------------------------------------------
   Public-site copy (shared substance — each design renders it in its own
   visual language).
--------------------------------------------------------------------------- */
GL.WHAT_IS_OFFSHORE = {
  intro: 'An international (often called “offshore”) account is simply an account held outside your country of residence, usually in a different currency. People use them to receive salaries abroad, hold savings in stable currencies, pay international tuition or suppliers, and keep money in the currency they actually spend.',
  sections: [
    { icon: 'globe',    title: 'What it is', text: 'A multi-currency account that sits alongside your local bank accounts. You keep balances in several currencies and transact in each of them separately.' },
    { icon: 'landmark', title: 'What it is not', text: 'It is not a replacement for your bank, and it is not a way to hide money. International accounts are ordinary, transparent financial tools used by millions of people.' },
    { icon: 'coins',    title: 'Who uses them', text: 'Freelancers paid in USD or EUR, families funding education abroad, cross-border commuters, small importers and exporters, and savers who want currency diversification.' },
    { icon: 'shield-check', title: 'How they are regulated', text: 'In production, customer funds in platforms like this are held with regulated partner institutions and are subject to know-your-customer and anti-money-laundering checks in every market served.' }
  ],
  misconceptions: [
    { q: '“Offshore means hidden.”', a: 'No. Modern international accounts are fully documented and reported. Transparency is a legal requirement, not an option.' },
    { q: '“They are only for the very wealthy.”', a: 'No. Digital multi-currency accounts serve ordinary cross-border earners and savers, often with no minimum balance.' },
    { q: '“It replaces my bank.”', a: 'No. It complements your bank — a second, currency-flexible account alongside your existing relationships.' }
  ]
};

GL.HOW_STEPS = [
  { n: 1, icon: 'user',    title: 'Create your account', text: 'Register with your name, email, country and international phone number, and choose a password.' },
  { n: 2, icon: 'mail',    title: 'Verify email and phone', text: 'Enter the one-time codes sent to your email and phone. In this prototype the codes are simulated and shown on screen — nothing real is sent.' },
  { n: 3, icon: 'coins',   title: 'Your default currency activates', text: 'Based on your country — Nigeria gets NGN, the United States USD, the United Kingdom GBP, Switzerland CHF, eurozone countries EUR. It starts at a zero balance.' },
  { n: 4, icon: 'plus',    title: 'Add currencies and simulate deposits', text: 'Activate any of the five supported currencies. Each keeps its own balance, transaction history, deposit records and status — nothing is converted automatically.' },
  { n: 5, icon: 'chart',   title: 'Manage everything in one place', text: 'Track transactions, preview and download statements, manage security, sessions and notifications, and reach support.' }
];

GL.FEATURES = [
  { icon: 'coins',  title: 'Multi-currency accounts', text: 'Hold NGN, USD, GBP, EUR and CHF side by side. Every currency account has its own balance, history and status.' },
  { icon: 'globe',  title: 'Country-based activation', text: 'The currency for your country is activated automatically after verification. The mapping is configurable.' },
  { icon: 'plus',   title: 'Flexible currency activation', text: 'Activate additional currencies yourself in seconds. New accounts always start at zero — balances are never auto-converted.' },
  { icon: 'card',   title: 'Simulated deposits', text: 'Debit card, credit card where supported, payment gateway and bank transfer — with success, pending, failed, cancelled and duplicate states.' },
  { icon: 'search', title: 'Transparent history', text: 'Search and filter every transaction by text, currency, status and date, and open a full detail view for any record.' },
  { icon: 'doc',    title: 'Monthly statements', text: 'Per-currency statements with opening and closing balances, line previews and a simulated download.' },
  { icon: 'bell',   title: 'Notifications and support', text: 'In-app notifications for account events and a support desk with tracked conversations.' },
  { icon: 'shield', title: 'Security controls', text: 'MFA settings, login history, active sessions with device details, suspicious-activity alerts and a temporary account freeze.' }
];

GL.FAQ = [
  { q: 'Is this a bank account?', a: 'No. Meridian provides a platform account — a company-issued multi-currency account you manage through our interface. It is not a bank account and this prototype does not provide actual offshore bank accounts or regulated banking services. In production, funds are held with regulated partner institutions.' },
  { q: 'Which currencies are supported?', a: 'The platform initially supports five currencies: Nigerian Naira (NGN), US Dollar (USD), British Pound (GBP), Euro (EUR) and Swiss Franc (CHF). Additional currencies appear as they become available — unavailable ones are shown with a note.' },
  { q: 'How does my default currency get chosen?', a: 'From the country you select at registration: Nigeria → NGN, United States → USD, United Kingdom → GBP, Switzerland → CHF, eurozone countries → EUR, others default to USD. The mapping is configurable.' },
  { q: 'Can I convert money between currencies?', a: 'No. Each activated currency keeps its own separate balance, history and deposit records. Activating a new currency never converts or moves funds from another currency — new accounts always start at zero.' },
  { q: 'How do deposits work in this prototype?', a: 'Deposits are fully simulated. You choose a currency, amount and method, review the details, then submit through a mock payment gateway. The simulator can return successful, pending, failed, cancelled or duplicate outcomes. No real money moves and no real payment provider is contacted.' },
  { q: 'What happens if a deposit is pending or fails?', a: 'Pending deposits are awaiting confirmation and do not credit your balance. Failed and cancelled deposits never credit your balance. Only successful simulated payments update the balance of the specific currency you deposited into.' },
  { q: 'Who can see or change my account?', a: 'Administrators can view accounts through a fully audited takeover mode with a permanent on-screen indicator, and can edit permitted profile information and manage currency activation. They cannot withdraw, transfer, edit balances, alter deposit confirmations or modify historical ledger entries — the restriction is enforced in the service layer, not just hidden buttons.' },
  { q: 'Will I be notified when an administrator views my account?', a: 'Takeover sessions are not notified automatically. Administrators can send a manual notification from the account viewer when appropriate.' },
  { q: 'What security features are demonstrated?', a: 'Email and phone verification, MFA settings, login history, active sessions with device details, suspicious-login alerts, a temporary account freeze with reason, account recovery, and a security event history.' },
  { q: 'Is any of this real?', a: 'No. This is a frontend design prototype for client review. Every user, balance, transaction, statement and notification is demonstration data stored in your browser. Use “Reset demo data” in the demo controls to restore the original state.' }
];

GL.TERMS_SECTIONS = [
  { title: 'Demonstration notice', text: 'This document is part of a frontend design prototype. It outlines the intended production terms for review purposes and is not a legally binding agreement.' },
  { title: 'Platform account, not a bank account', text: 'Meridian provides company-issued platform accounts for holding and managing supported currencies. These are not bank accounts. The platform does not provide actual offshore bank accounts or regulated banking services.' },
  { title: 'Eligibility', text: 'You must be at least 18 years old, provide accurate identity and contact information, and complete email and phone verification. Additional identity verification applies in production under local know-your-customer rules.' },
  { title: 'Currency activation and balances', text: 'Your country determines the default currency activated after verification. You may activate additional supported currencies. Each currency account is separate: balances, history and deposits are held per currency and are never converted automatically.' },
  { title: 'Deposits', text: 'In this prototype all deposits are simulated. In production, deposits are accepted through licensed payment partners, are credited only after confirmation, and may be pending, failed, cancelled or rejected as duplicates depending on the payment provider response.' },
  { title: 'Administrative access', text: 'Administrators may access customer accounts through an audited takeover mode limited to viewing and permitted edits. Administrators cannot withdraw funds, transfer funds, edit balances, change deposit confirmations or modify historical ledger entries. Users are not automatically notified of takeover sessions but may receive manual notifications.' },
  { title: 'Liability', text: 'The prototype is provided “as is” for design evaluation, without warranty of any kind. Production terms on liability, indemnity and dispute resolution will be defined in the final agreement.' },
  { title: 'Changes', text: 'These terms may be updated as the product and its regulatory posture evolve. Material changes will be communicated through the platform in production.' }
];

GL.PRIVACY_SECTIONS = [
  { title: 'Demonstration notice', text: 'This policy is part of a frontend design prototype. In this demo, all data you enter is stored only in your own browser and never transmitted anywhere.' },
  { title: 'Data we would collect', text: 'In production: identity and contact details you provide at registration, account and transaction records generated as you use the platform, device and security events used to protect your account, and support communications.' },
  { title: 'How data would be used', text: 'To operate your multi-currency accounts, verify your identity, prevent fraud and money laundering, respond to support requests, and meet legal obligations in the markets served.' },
  { title: 'Storage in this prototype', text: 'The demo stores its data in your browser’s local storage only. Clearing your browser data or using “Reset demo data” removes it completely. Nothing is sent to a server.' },
  { title: 'Security', text: 'The production platform would protect data with encryption in transit and at rest, multi-factor authentication, session controls and a full audit trail of administrative access.' },
  { title: 'Your rights', text: 'In production you would be able to access, correct, export and delete your personal data, subject to legal retention requirements, by contacting our privacy team.' },
  { title: 'Contact', text: 'Questions about privacy can be directed to privacy@meridian.example (demo address for the prototype).' }
];

GL.PLATFORM_STATS = [
  { num: '5', lbl: 'Supported currencies' },
  { num: '24', lbl: 'Countries served (demo)' },
  { num: '48,213', lbl: 'Account holders (demo figure)' },
  { num: '99.95%', lbl: 'Platform uptime (demo figure)' }
];

/* ---------------------------------------------------------------------------
   Admin roles + permission matrix (demonstration data).
--------------------------------------------------------------------------- */
GL.ADMIN_ROLES = [
  { id: 'super-admin', name: 'Super Administrator', members: ['Nadia Farouk'], desc: 'Full platform administration. Financial mutations remain blocked for every role by policy.' },
  { id: 'compliance',  name: 'Compliance Officer',  members: ['Marcus Lee'],   desc: 'Security monitoring, account freezes and audit review.' },
  { id: 'support',     name: 'Support Agent',       members: ['Priya Sharma'], desc: 'Support tickets and read-only account access.' },
  { id: 'readonly',    name: 'Read-only Analyst',   members: ['Tomas Weber'],  desc: 'Reporting and dashboards only.' }
];

GL.PERMISSION_MATRIX = {
  columns: ['Super Administrator', 'Compliance Officer', 'Support Agent', 'Read-only Analyst'],
  rows: [
    { area: 'Customer accounts',            v: ['Full', 'View', 'View', 'View'] },
    { area: 'Account takeover (view mode)', v: ['Full', 'View', 'View', 'None'] },
    { area: 'Permitted profile edits',      v: ['Edit', 'None', 'Edit', 'None'] },
    { area: 'Currency activation (per user)', v: ['Full', 'None', 'None', 'None'] },
    { area: 'Balances & historical ledger', v: ['View only', 'View only', 'View only', 'View only'] },
    { area: 'Edit balances / withdraw / transfer', v: ['Blocked', 'Blocked', 'Blocked', 'Blocked'] },
    { area: 'Change deposit confirmations', v: ['Blocked', 'Blocked', 'Blocked', 'Blocked'] },
    { area: 'Freeze / unfreeze accounts',   v: ['Full', 'Full', 'None', 'None'] },
    { area: 'Currency availability config', v: ['Full', 'None', 'None', 'None'] },
    { area: 'Support tickets',              v: ['Full', 'View', 'Full', 'None'] },
    { area: 'Audit logs',                   v: ['Full', 'View', 'None', 'View'] },
    { area: 'Platform settings',            v: ['Full', 'None', 'None', 'None'] },
    { area: 'Administrator roles',          v: ['Full', 'None', 'None', 'None'] }
  ]
};

GL.DEMO_CREDENTIALS = {
  customers: [
    { email: 'amara.okafor@example.com',   country: 'Nigeria',       note: 'NGN + USD, active history' },
    { email: 'james.whitfield@example.com',country: 'United Kingdom',note: 'GBP + EUR + USD' },
    { email: 'elsa.baumann@example.com',   country: 'Switzerland',   note: 'CHF + USD — account frozen' },
    { email: 'remy.laurent@example.com',   country: 'France',        note: 'EUR only' },
    { email: 'adaeze.nwosu@example.com',   country: 'Nigeria',       note: 'Phone verification pending' }
  ],
  customerPassword: 'Demo1234!',
  admin: { email: 'nadia.farouk@meridian.example', password: 'Admin1234!', name: 'Nadia Farouk' }
};

/* ---------------------------------------------------------------------------
   DEMO SEED — builds the demo database. Balances are ALWAYS computed as the
   sum of successful ledger entries, so every balance is provably consistent
   with the transaction history behind it.
--------------------------------------------------------------------------- */
GL.seedDb = function () {
  var now = Date.now();
  function d(days, h, m) { return now - days * 864e5 - (h || 0) * 36e5 - (m || 0) * 6e4; }

  var users = [
    {
      id: 'u-1001', name: 'Amara Okafor', firstName: 'Amara', lastName: 'Okafor',
      email: 'amara.okafor@example.com', phone: '+234 801 234 5678', countryCode: 'NG', country: 'Nigeria',
      password: 'Demo1234!', role: 'customer', status: 'active',
      verification: { email: true, phone: true }, defaultCurrency: 'NGN',
      accounts: [{ code: 'NGN', status: 'active', openedAt: d(96) }, { code: 'USD', status: 'active', openedAt: d(84) }],
      mfaEnabled: true, prefs: { emailNotifs: true, pushNotifs: true, weeklySummary: false },
      createdAt: d(96), address: 'Victoria Island, Lagos', accountId: 'MGA-4821-9075'
    },
    {
      id: 'u-1002', name: 'James Whitfield', firstName: 'James', lastName: 'Whitfield',
      email: 'james.whitfield@example.com', phone: '+44 7700 900123', countryCode: 'GB', country: 'United Kingdom',
      password: 'Demo1234!', role: 'customer', status: 'active',
      verification: { email: true, phone: true }, defaultCurrency: 'GBP',
      accounts: [{ code: 'GBP', status: 'active', openedAt: d(120) }, { code: 'EUR', status: 'active', openedAt: d(64) }, { code: 'USD', status: 'active', openedAt: d(40) }],
      mfaEnabled: false, prefs: { emailNotifs: true, pushNotifs: false, weeklySummary: true },
      createdAt: d(120), address: 'Manchester, United Kingdom', accountId: 'MGA-5107-2264'
    },
    {
      id: 'u-1003', name: 'Elsa Baumann', firstName: 'Elsa', lastName: 'Baumann',
      email: 'elsa.baumann@example.com', phone: '+41 79 123 45 67', countryCode: 'CH', country: 'Switzerland',
      password: 'Demo1234!', role: 'customer', status: 'frozen',
      freezeReason: 'Suspicious login activity detected — account pending security review (demo).',
      frozenAt: d(3), frozenBy: 'Nadia Farouk (admin)',
      verification: { email: true, phone: true }, defaultCurrency: 'CHF',
      accounts: [{ code: 'CHF', status: 'active', openedAt: d(210) }, { code: 'USD', status: 'active', openedAt: d(150) }],
      mfaEnabled: true, prefs: { emailNotifs: true, pushNotifs: true, weeklySummary: true },
      createdAt: d(210), address: 'Zürich, Switzerland', accountId: 'MGA-7734-8812'
    },
    {
      id: 'u-1004', name: 'Rémy Laurent', firstName: 'Rémy', lastName: 'Laurent',
      email: 'remy.laurent@example.com', phone: '+33 6 12 34 56 78', countryCode: 'FR', country: 'France',
      password: 'Demo1234!', role: 'customer', status: 'active',
      verification: { email: true, phone: true }, defaultCurrency: 'EUR',
      accounts: [{ code: 'EUR', status: 'active', openedAt: d(58) }],
      mfaEnabled: false, prefs: { emailNotifs: true, pushNotifs: false, weeklySummary: false },
      createdAt: d(58), address: 'Lyon, France', accountId: 'MGA-2298-4417'
    },
    {
      id: 'u-1005', name: 'Adaeze Nwosu', firstName: 'Adaeze', lastName: 'Nwosu',
      email: 'adaeze.nwosu@example.com', phone: '+234 802 555 0192', countryCode: 'NG', country: 'Nigeria',
      password: 'Demo1234!', role: 'customer', status: 'active',
      verification: { email: true, phone: false }, defaultCurrency: 'NGN',
      accounts: [{ code: 'NGN', status: 'active', openedAt: d(12) }],
      mfaEnabled: false, prefs: { emailNotifs: true, pushNotifs: true, weeklySummary: false },
      createdAt: d(12), address: 'Abuja, Nigeria', accountId: 'MGA-9650-3381'
    },
    {
      id: 'admin-1', name: 'Nadia Farouk', firstName: 'Nadia', lastName: 'Farouk',
      email: 'nadia.farouk@meridian.example', phone: '+41 79 555 01 23', countryCode: 'CH', country: 'Switzerland',
      password: 'Admin1234!', role: 'super-admin', status: 'active',
      verification: { email: true, phone: true }, title: 'Head of Operations',
      accounts: [], createdAt: d(365), accountId: 'MGA-ADMIN-001'
    }
  ];

  var T = [], DEP = [], PAY = [], N = [], SEC = [], SES = [], A = [];
  var txnSeq = 7000, depSeq = 3200, paySeq = 900, notSeq = 500, secSeq = 300, sesSeq = 800, audSeq = 100;

  function txn(userId, currency, type, amount, status, method, days, h, desc, ref) {
    T.push({ ref: ref || ('DEMO-TXN-' + (++txnSeq)), userId: userId, currency: currency, type: type,
      amount: amount, status: status, method: method, ts: d(days, h || 9, (txnSeq * 7) % 60),
      description: desc });
  }
  function dep(userId, currency, amount, method, status, days, h, outcomeSource) {
    var ref = 'DEMO-DEP-' + (++depSeq);
    var feePct = { debit_card: 0.014, credit_card: 0.022, payment_gateway: 0.01, bank_transfer: 0 }[method];
    var fee = Math.round(amount * feePct * 100) / 100;
    DEP.push({ reference: ref, userId: userId, currency: currency, amount: amount, method: method, fee: fee,
      status: status, createdAt: d(days, h || 10, 15), processedAt: status === 'pending' ? null : d(days, h || 10, 26),
      outcomeSource: outcomeSource || 'gateway' });
    PAY.push({ id: 'DEMO-PAY-' + (++paySeq), reference: ref, userId: userId, method: method,
      outcome: status, durationMs: 800 + (paySeq * 37) % 2200, ts: d(days, h || 10, 26), forced: false });
    /* ledger entries: only successful deposits credit the balance */
    var label = { debit_card: 'Debit card deposit', credit_card: 'Credit card deposit', payment_gateway: 'Payment gateway deposit', bank_transfer: 'Bank transfer deposit' }[method];
    if (status === 'successful' || status === 'failed' || status === 'cancelled') {
      txn(userId, currency, 'deposit', amount, status, method, days, h, label + ' — ' + ref, ref);
    }
    return ref;
  }
  function notif(userId, title, body, days, read, kind) {
    N.push({ id: 'n-' + (++notSeq), userId: userId, title: title, body: body, ts: d(days, 11, 20), read: !!read, kind: kind || 'info' });
  }
  function sec(userId, type, device, ip, location, days, h, suspicious, detail) {
    SEC.push({ id: 'se-' + (++secSeq), userId: userId, type: type, device: device, ip: ip, location: location,
      ts: d(days, h || 8, 45), suspicious: !!suspicious, detail: detail || '' });
  }
  function ses(userId, device, browser, os, ip, location, days, current, status) {
    SES.push({ id: 's-' + (++sesSeq), userId: userId, device: device, browser: browser, os: os, ip: ip,
      location: location, lastActive: d(days, 12, 10), current: !!current, status: status || 'active' });
  }
  function audit(action, target, detail, days, result) {
    A.push({ id: 'a-' + (++audSeq), ts: d(days, 14, 5), actor: 'nadia.farouk@meridian.example', actorName: 'Nadia Farouk',
      action: action, target: target, detail: detail, result: result || 'allowed', ip: '102.89.44.7' });
  }

  /* ---- u-1001 Amara — NGN + USD ---- */
  txn('u-1001', 'NGN', 'system_credit', 2400000, 'successful', '—', 96, 8, 'Demo opening balance');
  dep('u-1001', 'NGN', 350000, 'debit_card', 'successful', 34, 9);
  dep('u-1001', 'NGN', 120000, 'bank_transfer', 'successful', 19, 10);
  txn('u-1001', 'NGN', 'fee', -2100, 'successful', '—', 19, 11, 'Platform fee — statement issuance (demo)');
  txn('u-1001', 'USD', 'system_credit', 1200, 'successful', '—', 84, 8, 'Demo opening balance');
  dep('u-1001', 'USD', 500, 'payment_gateway', 'successful', 26, 15);
  dep('u-1001', 'USD', 250, 'debit_card', 'pending', 2, 10, 'default');       /* pending — not credited */
  dep('u-1001', 'USD', 90, 'credit_card', 'failed', 8, 16);                   /* failed — not credited */
  dep('u-1001', 'NGN', 75000, 'payment_gateway', 'cancelled', 5, 12);         /* cancelled — not credited */

  /* ---- u-1002 James — GBP + EUR + USD ---- */
  txn('u-1002', 'GBP', 'system_credit', 3500, 'successful', '—', 120, 8, 'Demo opening balance');
  dep('u-1002', 'GBP', 800, 'debit_card', 'successful', 42, 9);
  dep('u-1002', 'GBP', 150, 'payment_gateway', 'cancelled', 21, 11);
  txn('u-1002', 'GBP', 'fee', -4.2, 'successful', '—', 21, 12, 'Platform fee — statement issuance (demo)');
  txn('u-1002', 'EUR', 'system_credit', 600, 'successful', '—', 64, 8, 'Demo opening balance');
  dep('u-1002', 'EUR', 400, 'bank_transfer', 'successful', 28, 10);
  txn('u-1002', 'USD', 'system_credit', 250, 'successful', '—', 40, 8, 'Demo opening balance');

  /* ---- u-1003 Elsa — CHF + USD (frozen) ---- */
  txn('u-1003', 'CHF', 'system_credit', 8500, 'successful', '—', 210, 8, 'Demo opening balance');
  dep('u-1003', 'CHF', 1200, 'debit_card', 'successful', 55, 9);
  txn('u-1003', 'USD', 'system_credit', 900, 'successful', '—', 150, 8, 'Demo opening balance');
  dep('u-1003', 'USD', 300, 'payment_gateway', 'successful', 12, 14);

  /* ---- u-1004 Rémy — EUR ---- */
  txn('u-1004', 'EUR', 'system_credit', 1800, 'successful', '—', 58, 8, 'Demo opening balance');
  dep('u-1004', 'EUR', 250, 'debit_card', 'successful', 16, 9);
  txn('u-1004', 'EUR', 'fee', -3.5, 'successful', '—', 16, 10, 'Platform fee — statement issuance (demo)');

  /* ---- u-1005 Adaeze — NGN ---- */
  txn('u-1005', 'NGN', 'system_credit', 150000, 'successful', '—', 12, 8, 'Demo opening balance');

  /* ---- notifications ---- */
  notif('u-1001', 'Welcome to Meridian', 'Your multi-currency platform account is ready. This is a demonstration environment — no real money is involved.', 96, true, 'success');
  notif('u-1001', 'Deposit confirmed', 'Your USD deposit of $500.00 via payment gateway has been confirmed and credited.', 26, true, 'success');
  notif('u-1001', 'New sign-in detected', 'Chrome on macOS · Lagos, Nigeria. If this was you, no action is needed.', 9, false, 'info');
  notif('u-1001', 'Deposit pending', 'Your USD deposit of $250.00 is awaiting confirmation. The balance will update once it settles.', 2, false, 'warning');
  notif('u-1002', 'Welcome to Meridian', 'Your multi-currency platform account is ready. This is a demonstration environment.', 120, true, 'success');
  notif('u-1002', 'Weekly summary ready', 'Your account summary for last week is available in Statements.', 7, false, 'info');
  notif('u-1003', 'Account temporarily frozen', 'We detected suspicious login activity. Your account is frozen pending security review. Contact support for assistance.', 3, false, 'warning');
  notif('u-1004', 'Welcome to Meridian', 'Your multi-currency platform account is ready. This is a demonstration environment.', 58, true, 'success');
  notif('u-1005', 'Verify your phone', 'Enter the code sent to your phone to finish setting up your account.', 12, false, 'warning');

  /* ---- security events + sessions ---- */
  sec('u-1001', 'login', 'Chrome 121 · macOS 14', '102.89.44.7', 'Lagos, Nigeria', 9, 8, false, 'Successful password + MFA sign-in');
  sec('u-1001', 'login', 'Safari · iPhone 15', '197.210.8.19', 'Lagos, Nigeria', 22, 20, false, 'Successful sign-in');
  sec('u-1001', 'password_change', 'Chrome 121 · macOS 14', '102.89.44.7', 'Lagos, Nigeria', 48, 10, false, 'Password changed from account settings');
  sec('u-1002', 'login', 'Edge 120 · Windows 11', '81.132.55.4', 'Manchester, United Kingdom', 5, 7, false, 'Successful sign-in');
  sec('u-1002', 'mfa_disabled', 'Edge 120 · Windows 11', '81.132.55.4', 'Manchester, United Kingdom', 30, 19, false, 'Multi-factor authentication turned off');
  sec('u-1003', 'login_failed', 'Unknown browser', '185.220.101.5', 'Frankfurt, Germany', 3, 3, true, '5 consecutive failed password attempts');
  sec('u-1003', 'login_failed', 'Unknown browser', '185.220.101.5', 'Frankfurt, Germany', 3, 4, true, 'Failed attempt — MFA code invalid');
  sec('u-1003', 'account_frozen', 'Administrator action', '102.89.44.7', '—', 3, 5, true, 'Account frozen by administrator: suspicious login pattern');
  sec('u-1004', 'login', 'Firefox 122 · Windows 10', '90.117.3.88', 'Lyon, France', 2, 8, false, 'Successful sign-in');
  sec('u-1005', 'login', 'Chrome 120 · Android 14', '105.112.55.9', 'Abuja, Nigeria', 1, 9, false, 'Sign-in blocked — phone verification pending');

  ses('u-1001', 'Desktop', 'Chrome 121', 'macOS 14', '102.89.44.7', 'Lagos, Nigeria', 0, true, 'active');
  ses('u-1001', 'iPhone 15', 'Safari', 'iOS 17', '197.210.8.19', 'Lagos, Nigeria', 2, false, 'active');
  ses('u-1001', 'Laptop', 'Firefox', 'Windows 11', '102.89.22.31', 'Lagos, Nigeria', 30, false, 'revoked');
  ses('u-1002', 'Desktop', 'Edge 120', 'Windows 11', '81.132.55.4', 'Manchester, United Kingdom', 0, true, 'active');
  ses('u-1003', 'Desktop', 'Chrome 119', 'macOS 13', '185.22.10.44', 'Zürich, Switzerland', 6, false, 'revoked');
  ses('u-1004', 'Desktop', 'Firefox 122', 'Windows 10', '90.117.3.88', 'Lyon, France', 0, true, 'active');

  /* ---- support tickets ---- */
  var tickets = [
    {
      id: 't-2001', userId: 'u-1001', subject: 'Pending deposit not credited yet', category: 'Deposits',
      status: 'resolved', createdAt: d(24, 9, 40),
      messages: [
        { from: 'customer', text: 'Hi — my gateway deposit from yesterday still shows pending. Is that normal?', ts: d(24, 9, 40) },
        { from: 'support', text: 'Hello Amara, thank you for reaching out. Pending deposits settle once the payment provider confirms them. Yours settled this morning and is now marked successful. This is a demo conversation, by the way!', ts: d(24, 13, 5) },
        { from: 'customer', text: 'Perfect, I can see it now. Thank you!', ts: d(24, 14, 12) }
      ]
    },
    {
      id: 't-2002', userId: 'u-1002', subject: 'Can I activate CHF alongside GBP?', category: 'Currencies',
      status: 'open', createdAt: d(4, 10, 22),
      messages: [
        { from: 'customer', text: 'I travel to Switzerland often — can I add a CHF account to my existing one?', ts: d(4, 10, 22) }
      ]
    }
  ];

  /* ---- audit log (seeded history) ---- */
  audit('admin_login', '—', 'Administrator signed in (demo).', 2, 'allowed');
  audit('takeover_start', 'u-1001 · Amara Okafor', 'Administrative takeover session started — read + permitted edits.', 2, 'allowed');
  audit('profile_edit', 'u-1001 · Amara Okafor', 'Phone updated during takeover (+234 801 234 5678). User not auto-notified.', 2, 'allowed');
  audit('takeover_end', 'u-1001 · Amara Okafor', 'Administrative takeover session ended.', 2, 'allowed');
  audit('denied_attempt', 'u-1002 · James Whitfield', 'Blocked by policy: edit_balance — administrators cannot edit customer balances.', 4, 'denied');
  audit('currency_config', 'JPY', 'Availability set to unavailable (demo demonstration).', 6, 'allowed');
  audit('account_frozen', 'u-1003 · Elsa Baumann', 'Reason: suspicious login activity detected — pending security review.', 3, 'allowed');
  audit('manual_notification', 'u-1003 · Elsa Baumann', 'Manual notification sent: account frozen pending review.', 3, 'allowed');

  /* ---- assemble + compute balances from the ledger ---- */
  var db = {
    version: 1, seededAt: now,
    users: users, transactions: T, deposits: DEP, payments: PAY, notifications: N,
    securityEvents: SEC, sessions: SES, tickets: tickets, audit: A,
    settings: {
      platformName: 'Meridian Global Accounts', maintenanceMode: false,
      currencyStatus: { NGN: 'active', USD: 'active', GBP: 'active', EUR: 'active', CHF: 'active', JPY: 'unavailable' },
      supportEmail: 'support@meridian.example', lastRatesUpdate: d(0, 6)
    },
    forcedOutcome: 'auto'
  };
  users.forEach(function (u) {
    u.accounts = u.accounts || [];
    u.accounts.forEach(function (a) {
      a.balance = T.filter(function (t) {
        return t.userId === u.id && t.currency === a.code && t.status === 'successful';
      }).reduce(function (s, t) { return s + t.amount; }, 0);
    });
  });
  return db;
};
