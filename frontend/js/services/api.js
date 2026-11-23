/* API client — one method per REST resource from API_SPECIFICATION.md.
   Views never call fetch or http directly; they call MG.api.*. */
(function () {
  var http;

  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  MG.api = {
    init: function () { http = MG.http; },

    /* ---- profile ---- */
    profile: function () { return http.get('/profile'); },
    updateProfile: function (patch) { return http.patch('/profile', patch); },

    /* ---- accounts & currencies ---- */
    currencies: function () { return http.get('/currencies'); },
    accounts: function () { return http.get('/accounts'); },
    account: function (code) { return http.get('/accounts/' + encodeURIComponent(code)); },
    activateCurrency: function (code) {
      return http.post('/accounts/activate', { currencyCode: code });
    },
    closeAccount: function (code) { return http.post('/accounts/' + encodeURIComponent(code) + '/close'); },

    /* ---- deposits ---- */
    createDeposit: function (currencyCode, amount, notes, idempotencyKey) {
      return http.post('/deposits', { currencyCode: currencyCode, amount: amount, notes: notes },
        { idempotencyKey: idempotencyKey });
    },
    deposits: function (page, status) { return http.get('/deposits' + qs({ page: page, status: status })); },
    deposit: function (reference) { return http.get('/deposits/' + encodeURIComponent(reference)); },
    cancelDeposit: function (reference) {
      return http.post('/deposits/' + encodeURIComponent(reference) + '/cancel');
    },
    reportPayment: function (reference, notes, bankTransactionRef, receiptUrl) {
      return http.post('/deposits/' + encodeURIComponent(reference) + '/report-payment', {
        notes: notes, bankTransactionRef: bankTransactionRef, receiptUrl: receiptUrl
      });
    },

    /* ---- transactions & statements ---- */
    transactions: function (filters) { return http.get('/transactions' + qs(filters)); },
    transaction: function (reference) { return http.get('/transactions/' + encodeURIComponent(reference)); },
    statements: function () { return http.get('/statements'); },
    generateStatement: function (accountId, periodStart, periodEnd) {
      return http.post('/statements/generate', {
        accountId: accountId, periodStart: periodStart, periodEnd: periodEnd,
      });
    },
    downloadStatement: function (id) { return http.download('/statements/' + encodeURIComponent(id) + '/download'); },

    /* ---- notifications & support ---- */
    notifications: function (page) { return http.get('/notifications' + qs({ page: page })); },
    markNotificationRead: function (id) { return http.post('/notifications/' + encodeURIComponent(id) + '/read'); },
    tickets: function () { return http.get('/support/tickets'); },
    createTicket: function (subject, category, message) {
      return http.post('/support/tickets', { subject: subject, category: category, message: message });
    },
  };

  /* ---- admin client (separate namespace used by admin.html views) ---- */
  MGA = window.MGA || {};
  MGA.api = {
    overview: function () { return http.get('/admin/overview'); },
    users: function (filters) { return http.get('/admin/users' + qs(filters)); },
    user: function (id) { return http.get('/admin/users/' + encodeURIComponent(id)); },
    updateUser: function (id, patch) { return http.patch('/admin/users/' + encodeURIComponent(id), patch); },
    suspendUser: function (id, reason) { return http.post('/admin/users/' + encodeURIComponent(id) + '/suspend', { reason: reason }); },
    banUser: function (id, reason) { return http.post('/admin/users/' + encodeURIComponent(id) + '/ban', { reason: reason }); },
    unbanUser: function (id) { return http.post('/admin/users/' + encodeURIComponent(id) + '/unban'); },
    deleteUser: function (id) { return http.del('/admin/users/' + encodeURIComponent(id)); },
    notifyUser: function (id, title, body) {
      return http.post('/admin/users/' + encodeURIComponent(id) + '/notify', { title: title, body: body });
    },
    currencies: function () { return http.get('/admin/currencies'); },
    setCurrencyStatus: function (code, status) {
      return http.patch('/admin/currencies/' + encodeURIComponent(code), { status: status });
    },
    deposits: function (page, status) { return http.get('/admin/deposits' + qs({ page: page, status: status })); },
    depositQueue: function (page, status) { return http.get('/admin/deposits/queue' + qs({ page: page, status: status })); },
    assignBank: function (depositId, bankAccountId) {
      return http.post('/admin/deposits/' + encodeURIComponent(depositId) + '/assign-bank', { bankAccountId: bankAccountId });
    },
    verifyCredit: function (depositId, payload) {
      return http.post('/admin/deposits/' + encodeURIComponent(depositId) + '/verify-credit', payload);
    },
    rejectDeposit: function (depositId, reason) {
      return http.post('/admin/deposits/' + encodeURIComponent(depositId) + '/reject', { reason: reason });
    },
    receivingBanks: function () { return http.get('/admin/receiving-banks'); },
    saveReceivingBank: function (payload) { return http.post('/admin/receiving-banks', payload); },
    approveReceivingBank: function (id) { return http.post('/admin/receiving-banks/' + encodeURIComponent(id) + '/approve'); },
    rejectReceivingBank: function (id, reason) { return http.post('/admin/receiving-banks/' + encodeURIComponent(id) + '/reject', { reason: reason }); },
    refunds: function (page, status) { return http.get('/admin/refunds' + qs({ page: page, status: status })); },
    createRefund: function (payload, idempotencyKey) {
      return http.post('/admin/refunds', payload, { idempotencyKey: idempotencyKey });
    },
    approveRefund: function (id, approvedAmount, notes) {
      return http.post('/admin/refunds/' + encodeURIComponent(id) + '/approve', { approvedAmount: approvedAmount, notes: notes });
    },
    rejectRefund: function (id, reason) {
      return http.post('/admin/refunds/' + encodeURIComponent(id) + '/reject', { reason: reason });
    },
    transactions: function (filters) { return http.get('/admin/transactions' + qs(filters)); },
    payments: function (page) { return http.get('/admin/payments' + qs({ page: page })); },
    securityEvents: function (page) { return http.get('/admin/security/events' + qs({ page: page })); },
    freeze: function (userId, reason) { return http.post('/admin/security/freeze', { userId: userId, reason: reason }); },
    reports: function () { return http.get('/admin/reports'); },
    tickets: function (status, page) { return http.get('/admin/support/tickets' + qs({ status: status, page: page })); },
    replyTicket: function (id, message) { return http.post('/admin/support/tickets/' + encodeURIComponent(id) + '/reply', { message: message }); },
    resolveTicket: function (id) { return http.post('/admin/support/tickets/' + encodeURIComponent(id) + '/resolve'); },
    roles: function () { return http.get('/admin/roles'); },
    assignRole: function (email, roleId, displayName) {
      return http.post('/admin/roles/assign', { email: email, roleId: roleId, displayName: displayName });
    },
    revokeRole: function (profileId) { return http.post('/admin/roles/revoke', { profileId: profileId }); },
    audit: function (filters) { return http.get('/admin/audit' + qs(filters)); },
    settings: function () { return http.get('/admin/settings'); },
    updateSettings: function (patch) { return http.patch('/admin/settings', patch); },
  };
})();
