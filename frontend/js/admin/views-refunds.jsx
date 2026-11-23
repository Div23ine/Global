/* ==========================================================================
   MERIDIAN ADMIN — Hong Kong International Fintech (Design 2)
   admin views-refunds.jsx — Refund Management (list · review · create)

   Split out of views-ops.jsx by concept (file-size ratchet). Adds the
   refund-creation form that was missing from the console (audit F-3):
   creation posts to POST /admin/refunds (refunds.manage, audited,
   idempotency-key honored); approval still credits only via the atomic
   service-layer RPC.
   ========================================================================== */
(function () {
  var React = window.React;
  var h = React.createElement;
  MGA.views = MGA.views || {};

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function uuid4() {
    if (window.crypto && window.crypto.randomUUID) {
      try { return window.crypto.randomUUID(); } catch (e) { /* fall through */ }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /* --------------------------------------------------------------- refunds */
  MGA.views.refunds = function () {
    var _s = React.useState(''); var status = _s[0]; var setStatus = _s[1];
    var _r = React.useState(0); var reload = _r[1];
    var _sel = React.useState(null); var selected = _sel[0]; var setSelected = _sel[1];
    var _amt = React.useState(''); var approvedAmount = _amt[0]; var setApprovedAmount = _amt[1];
    var _notes = React.useState(''); var notes = _notes[0]; var setNotes = _notes[1];
    var _busy = React.useState(false); var busy = _busy[0]; var setBusy = _busy[1];

    /* ---- new-refund form state (audit F-3) ---- */
    var _show = React.useState(false); var showNew = _show[0]; var setShowNew = _show[1];
    var _rf = React.useState({ txnId: '', amount: '', reason: '', notes: '' }); var draft = _rf[0]; var setDraft = _rf[1];
    var _key = React.useState(uuid4()); var idemKey = _key[0]; var setIdemKey = _key[1];

    var state = MG.ui.useAsync(function () { return MGA.api.refunds(1, status); }, [status, _r[0]]);

    function setDraftField(k, v) {
      setDraft(Object.assign({}, draft, (function () { var o = {}; o[k] = v; return o; })()));
    }

    function resetDraft() {
      setDraft({ txnId: '', amount: '', reason: '', notes: '' });
      setIdemKey(uuid4());
    }

    function createNewRefund(e) {
      e.preventDefault();
      var txnId = String(draft.txnId || '').trim();
      var amount = String(draft.amount || '').trim();
      var reason = String(draft.reason || '').trim();
      var notes = String(draft.notes || '').trim();

      if (!UUID_RE.test(txnId)) {
        MG.ui.toast('Original transaction ID must be the transaction UUID \u2014 copy it from the Transactions view.', 'err');
        return;
      }
      var amountNum = Number(amount);
      if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
        MG.ui.toast('Requested amount must be a positive number.', 'err');
        return;
      }
      if (reason.length < 3) {
        MG.ui.toast('A reason of at least 3 characters is required.', 'err');
        return;
      }

      setBusy(true);
      MGA.api.createRefund({
        originalTransactionId: txnId,
        requestedAmount: amount,
        reason: reason,
        notes: notes || undefined,
      }, idemKey).then(function () {
        MG.ui.toast('Refund request created \u2014 it now awaits review. Nothing has been credited yet.', 'ok');
        setShowNew(false);
        resetDraft();
        reload(function (x) { return x + 1; });
      }).catch(function (err) {
        MG.ui.toast(MG.util.errMessage(err), 'err');
      }).finally(function () { setBusy(false); });
    }

    return h(React.Fragment, null,
      h(MG.ui.PageHead, {
        icon: 'receipt', title: 'Refund management',
        sub: 'All refunds are internal. Approving credits the customer\u2019s Meridian balance.',
        actions: h('button', { className: 'btn btn-primary btn-sm', onClick: function () {
          if (showNew) { setShowNew(false); return; }
          resetDraft(); setShowNew(true);
        } }, h(MG.ui.Icon, { name: 'plus', size: 14 }), ' New refund request') }),

      h(MG.ui.Notice, { tone: 'info', icon: 'info' },
        h('p', null, 'No external bank payout is performed. All refunds credit the internal Meridian balance.')),

      showNew ? h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, h(MG.ui.Icon, { name: 'plus', size: 15 }), ' New refund request') },
        h('form', { onSubmit: createNewRefund, noValidate: true },
          h('div', { className: 'field' },
            h('label', { htmlFor: 'rf-txn' }, 'Original transaction ID'),
            h('input', { id: 'rf-txn', placeholder: 'UUID \u2014 copied from Transactions', value: draft.txnId,
              onChange: function (e) { setDraftField('txnId', e.target.value); } }),
            h('p', { className: 'hint' }, 'Open Transactions and use \u201cCopy ID\u201d on the original transaction row.')),
          h('div', { className: 'field' },
            h('label', { htmlFor: 'rf-amount' }, 'Requested amount'),
            h('input', { id: 'rf-amount', inputMode: 'decimal', placeholder: 'e.g. 250.00', value: draft.amount,
              onChange: function (e) { setDraftField('amount', e.target.value); } })),
          h('div', { className: 'field' },
            h('label', { htmlFor: 'rf-reason' }, 'Reason'),
            h('textarea', { id: 'rf-reason', rows: 3, placeholder: 'Why this refund is being raised (3\u20131000 characters)',
              value: draft.reason,
              onChange: function (e) { setDraftField('reason', e.target.value); } })),
          h('div', { className: 'field' },
            h('label', { htmlFor: 'rf-notes' }, 'Notes (optional)'),
            h('input', { id: 'rf-notes', placeholder: 'Internal handling notes', value: draft.notes,
              onChange: function (e) { setDraftField('notes', e.target.value); } })),
          h('div', { className: 'btn-row', style: { marginTop: 12 } },
            h('button', { type: 'submit', className: 'btn btn-primary' + (busy ? ' is-busy' : ''), disabled: busy },
              h(MG.ui.Icon, { name: 'check', size: 14 }), ' Create refund request'),
            h('button', { type: 'button', className: 'btn btn-ghost', disabled: busy, onClick: function () { setShowNew(false); } },
              'Cancel'))),
        h('p', { className: 'panel-note' },
          'Creating a request credits nothing \u2014 it enters the review queue. Approval is a separate audited action restricted to refunds.manage. Submission carries an idempotency key, so a double click or network retry cannot create duplicates.')) : null,

      h('div', { className: 'filter-bar' },
        h('div', { className: 'field' },
          h('label', null, 'Status'),
          h('select', { value: status, onChange: function (e) { setStatus(e.target.value); } },
            h('option', { value: '' }, 'All statuses'),
            h('option', { value: 'requested' }, 'Requested'),
            h('option', { value: 'under_review' }, 'Under review'),
            h('option', { value: 'approved' }, 'Approved'),
            h('option', { value: 'completed' }, 'Completed'),
            h('option', { value: 'rejected' }, 'Rejected')))),

      state.loading ? h(MG.ui.PageSkeleton, { variant: 'list' })
        : state.error ? h(MG.ui.ErrorPanel, { error: state.error, onRetry: function () { location.reload(); } })
        : h(MG.ui.DataTable, {
            rows: state.data || [],
            rowKey: function (r) { return r.id; },
            empty: h(MG.ui.Empty, { icon: 'receipt', title: 'No refunds', note: 'No refund requests match the current filter.' }),
            columns: [
              { th: 'Reference', td: function (r) { return h('code', null, r.reference); } },
              { th: 'Original', td: function (r) { return r.original_reference; } },
              { th: 'Requested', align: 'right', td: function (r) { return h('span', { className: 'td-amount' }, MG.util.money(r.requested_amount, r.currency_code)); } },
              { th: 'Status', td: function (r) { return h(MG.ui.Badge, { status: r.status }); } },
              { th: 'Created', td: function (r) { return h('span', { className: 'td-date' }, MG.util.date(r.created_at)); } },
              { th: '', align: 'right', td: function (r) {
                return h('button', { className: 'btn btn-ghost btn-sm', onClick: function () {
                  setSelected(r); setApprovedAmount(String(r.requested_amount));
                } }, h(MG.ui.Icon, { name: 'eye', size: 13 }), ' Review'); } },
            ] }),

      selected ? h(MG.ui.Card, { title: h('h3', { className: 'panel-title' }, 'Review refund \u2014 ', selected.reference) },
        h('p', null, h('b', null, 'Original transaction: '), selected.original_reference,
          ' (', MG.util.money(selected.original_amount, selected.currency_code), ')'),
        h('p', null, h('b', null, 'Customer: '), selected.profile_id),
        h('p', null, h('b', null, 'Reason: '), selected.reason),
        h('p', null, h('b', null, 'Status: '), h(MG.ui.Badge, { status: selected.status })),
        (['requested','under_review','approved'].indexOf(selected.status) >= 0) ? h(React.Fragment, null,
          h('div', { className: 'field', style: { marginTop: 14 } },
            h('label', null, 'Approved amount'),
            h('input', { value: approvedAmount, onChange: function (e) { setApprovedAmount(e.target.value); } })),
          h('div', { className: 'field' },
            h('label', null, 'Notes'),
            h('input', { value: notes, onChange: function (e) { setNotes(e.target.value); } })),
          h('div', { className: 'btn-row' },
            h('button', { className: 'btn btn-primary', disabled: busy, onClick: function () {
              setBusy(true);
              MGA.api.approveRefund(selected.id, approvedAmount || undefined, notes || undefined).then(function () {
                MG.ui.toast('Refund approved \u2014 Meridian balance credited.', 'ok');
                setSelected(null); setApprovedAmount(''); setNotes('');
                reload(function (x) { return x + 1; });
              }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); })
                .finally(function () { setBusy(false); });
            } }, 'Approve and credit'),
            h('button', { className: 'btn btn-ghost', disabled: busy, onClick: function () {
              setBusy(true);
              MGA.api.rejectRefund(selected.id, notes || 'Rejected').then(function () {
                MG.ui.toast('Refund rejected.', 'ok');
                setSelected(null); setNotes('');
                reload(function (x) { return x + 1; });
              }).catch(function (e) { MG.ui.toast(MG.util.errMessage(e), 'err'); })
                .finally(function () { setBusy(false); });
            } }, 'Reject'))) : null,
        h('button', { className: 'btn btn-ghost btn-sm', style: { marginTop: 12 }, onClick: function () { setSelected(null); } }, 'Close')) : null);
  };
})();
