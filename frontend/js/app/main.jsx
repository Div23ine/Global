/* Customer application bootstrap + shell (Design 02 preserved).
   Flow: configuration check -> Supabase Auth load -> auth gate -> hash router. */
(function () {
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  var h = React.createElement;

  /* -------------------------------------------------------- configuration */
  function ConfigScreen() {
    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('div', { className: 'brand brand-center' },
          h('span', { className: 'brand-mark', 'aria-hidden': 'true' }, '◎'),
          h('span', { className: 'brand-text' }, 'Meridian ', h('small', null, 'GLOBAL ACCOUNTS'))),
        h('h1', null, 'Service temporarily unavailable'),
        h('p', { className: 'muted' },
          'We could not establish a secure connection to Meridian services. Please try again in a moment.'),
        h('button', {
          className: 'btn btn-primary btn-block',
          type: 'button',
          onClick: function () { window.location.reload(); }
        }, 'Retry connection')));
  }

  /* --------------------------------------------------------- Supabase Auth */
  function AuthInput(props) {
    return h('label', { className: 'field' },
      h('span', null, props.label),
      h('input', {
        className: 'input', type: props.type || 'text', value: props.value,
        placeholder: props.placeholder || '', autoComplete: props.autoComplete,
        required: Boolean(props.required), minLength: props.minLength,
        maxLength: props.maxLength, onChange: props.onChange,
      }));
  }

  function SignInView() {
    var _e = useState(MG.auth.state.user ? MG.auth.state.user.email : ''); var email = _e[0]; var setEmail = _e[1];
    var _o = useState(''); var otp = _o[0]; var setOtp = _o[1];
    var _s = useState(MG.auth.state.mfaRequired ? 'mfa' : 'email'); var step = _s[0]; var setStep = _s[1]; // email | otp | mfa
    var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _x = useState(''); var error = _x[0]; var setError = _x[1];
    var _m = useState(''); var message = _m[0]; var setMessage = _m[1];
    var _factor = useState(MG.auth.state.mfaFactorId || null); var factor = _factor[0]; var setFactor = _factor[1];
    var _challenge = useState(null); var challenge = _challenge[0]; var setChallenge = _challenge[1];
    var _mfa = useState(''); var mfaCode = _mfa[0]; var setMfaCode = _mfa[1];

    useEffect(function () {
      if (!MG.auth.state.mfaRequired || !factor) return;
      setBusy(true);
      MG.auth.challengeTotp(factor).then(function (result) {
        if (result.error) throw result.error;
        setChallenge(result.data.id);
      }).catch(function (err) {
        setError(err.message || 'Could not start authenticator verification.');
      }).finally(function () { setBusy(false); });
    }, []);

    function sendOtp(event) {
      if (event) event.preventDefault();
      setBusy(true); setError(''); setMessage('');
      MG.auth.signIn(email).then(function (result) {
        if (result.error) throw result.error;
        setStep('otp');
        setMessage('We sent a one-time code to ' + email.trim() + '. Enter that code — not a link.');
      }).catch(function (err) { setError(err.message || 'Could not send the one-time code.'); })
        .finally(function () { setBusy(false); });
    }

    function verifyOtp(event) {
      event.preventDefault();
      setBusy(true); setError(''); setMessage('');
      MG.auth.verifyEmailOtp(email, otp).then(function (result) {
        if (result.error) throw result.error;
        return MG.auth.listMfaFactors().then(function (factorsResult) {
          if (factorsResult.error) throw factorsResult.error;
          var factors = (factorsResult.data && factorsResult.data.totp) || [];
          var verified = factors.filter(function (f) { return f.status === 'verified'; })[0];
          if (!verified) {
            location.hash = '#/overview';
            MG.auth.completeCustomerLogin();
            return;
          }
          setFactor(verified.id);
          return MG.auth.challengeTotp(verified.id).then(function (challengeResult) {
            if (challengeResult.error) throw challengeResult.error;
            setChallenge(challengeResult.data.id);
            setStep('mfa');
            setMessage('Enter the code from your authenticator app.');
          });
        });
      }).catch(function (err) { setError(err.message || 'Invalid or expired code.'); })
        .finally(function () { setBusy(false); });
    }

    function verifyMfa(event) {
      event.preventDefault();
      setBusy(true); setError('');
      MG.auth.verifyTotp(factor, challenge, mfaCode).then(function (result) {
        if (result.error) throw result.error;
        location.hash = '#/overview';
        MG.auth.completeCustomerLogin();
      }).catch(function (err) { setError(err.message || 'Authenticator code is invalid.'); })
        .finally(function () { setBusy(false); });
    }

    var title = step === 'mfa' ? 'Authenticator verification' : (step === 'otp' ? 'Enter one-time code' : 'Welcome back');
    var blurb = step === 'mfa'
      ? 'Multi-factor authentication is enabled. Enter the current authenticator code.'
      : (step === 'otp'
        ? (message || 'Enter the numeric code from your email.')
        : 'Enter your registered email. We will send a one-time code (OTP) — not a magic link.');

    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, title),
        h('p', { className: 'muted' }, blurb),
        step === 'email' ? h('form', { onSubmit: sendOtp },
          h(AuthInput, { label: 'Email address', type: 'email', autoComplete: 'email',
            value: email, required: true,
            onChange: function (event) { setEmail(event.target.value); } }),
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
            busy ? 'Sending…' : 'Send one-time code')) : null,
        step === 'otp' ? h(React.Fragment, null,
          h('form', { onSubmit: verifyOtp },
            h(AuthInput, { label: 'One-time code (OTP)', type: 'text', autoComplete: 'one-time-code',
              value: otp, required: true, maxLength: 6,
              onChange: function (event) { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); } }),
            error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
            message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
            h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
              busy ? 'Verifying…' : 'Verify and sign in')),
          h('button', { type: 'button', className: 'btn btn-ghost btn-block', disabled: busy, onClick: sendOtp },
            'Resend one-time code')) : null,
        step === 'mfa' ? h('form', { onSubmit: verifyMfa },
          h(AuthInput, { label: 'Authenticator code', type: 'text', autoComplete: 'one-time-code',
            value: mfaCode, required: true, maxLength: 6,
            onChange: function (event) { setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6)); } }),
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
            busy ? 'Verifying…' : 'Verify authenticator')) : null,
        h('p', { className: 'muted auth-links' }, h('a', { href: '#/register' }, 'Create an account'))));
  }


  var SIGNUP_COUNTRIES = [{"code":"AF","name":"Afghanistan","flag":"🇦🇫","dial":"+93"},{"code":"AX","name":"Åland Islands","flag":"🇦🇽","dial":"+35818"},{"code":"AL","name":"Albania","flag":"🇦🇱","dial":"+355"},{"code":"DZ","name":"Algeria","flag":"🇩🇿","dial":"+213"},{"code":"AS","name":"American Samoa","flag":"🇦🇸","dial":"+1684"},{"code":"AD","name":"Andorra","flag":"🇦🇩","dial":"+376"},{"code":"AO","name":"Angola","flag":"🇦🇴","dial":"+244"},{"code":"AI","name":"Anguilla","flag":"🇦🇮","dial":"+1264"},{"code":"AQ","name":"Antarctica","flag":"🇦🇶","dial":""},{"code":"AG","name":"Antigua and Barbuda","flag":"🇦🇬","dial":"+1268"},{"code":"AR","name":"Argentina","flag":"🇦🇷","dial":"+54"},{"code":"AM","name":"Armenia","flag":"🇦🇲","dial":"+374"},{"code":"AW","name":"Aruba","flag":"🇦🇼","dial":"+297"},{"code":"AU","name":"Australia","flag":"🇦🇺","dial":"+61"},{"code":"AT","name":"Austria","flag":"🇦🇹","dial":"+43"},{"code":"AZ","name":"Azerbaijan","flag":"🇦🇿","dial":"+994"},{"code":"BS","name":"Bahamas","flag":"🇧🇸","dial":"+1242"},{"code":"BH","name":"Bahrain","flag":"🇧🇭","dial":"+973"},{"code":"BD","name":"Bangladesh","flag":"🇧🇩","dial":"+880"},{"code":"BB","name":"Barbados","flag":"🇧🇧","dial":"+1246"},{"code":"BY","name":"Belarus","flag":"🇧🇾","dial":"+375"},{"code":"BE","name":"Belgium","flag":"🇧🇪","dial":"+32"},{"code":"BZ","name":"Belize","flag":"🇧🇿","dial":"+501"},{"code":"BJ","name":"Benin","flag":"🇧🇯","dial":"+229"},{"code":"BM","name":"Bermuda","flag":"🇧🇲","dial":"+1441"},{"code":"BT","name":"Bhutan","flag":"🇧🇹","dial":"+975"},{"code":"BO","name":"Bolivia","flag":"🇧🇴","dial":"+591"},{"code":"BA","name":"Bosnia and Herzegovina","flag":"🇧🇦","dial":"+387"},{"code":"BW","name":"Botswana","flag":"🇧🇼","dial":"+267"},{"code":"BV","name":"Bouvet Island","flag":"🇧🇻","dial":"+47"},{"code":"BR","name":"Brazil","flag":"🇧🇷","dial":"+55"},{"code":"IO","name":"British Indian Ocean Territory","flag":"🇮🇴","dial":"+246"},{"code":"VG","name":"British Virgin Islands","flag":"🇻🇬","dial":"+1284"},{"code":"BN","name":"Brunei","flag":"🇧🇳","dial":"+673"},{"code":"BG","name":"Bulgaria","flag":"🇧🇬","dial":"+359"},{"code":"BF","name":"Burkina Faso","flag":"🇧🇫","dial":"+226"},{"code":"BI","name":"Burundi","flag":"🇧🇮","dial":"+257"},{"code":"KH","name":"Cambodia","flag":"🇰🇭","dial":"+855"},{"code":"CM","name":"Cameroon","flag":"🇨🇲","dial":"+237"},{"code":"CA","name":"Canada","flag":"🇨🇦","dial":"+1204"},{"code":"CV","name":"Cape Verde","flag":"🇨🇻","dial":"+238"},{"code":"BQ","name":"Caribbean Netherlands","flag":"","dial":"+599"},{"code":"KY","name":"Cayman Islands","flag":"🇰🇾","dial":"+1345"},{"code":"CF","name":"Central African Republic","flag":"🇨🇫","dial":"+236"},{"code":"TD","name":"Chad","flag":"🇹🇩","dial":"+235"},{"code":"CL","name":"Chile","flag":"🇨🇱","dial":"+56"},{"code":"CN","name":"China","flag":"🇨🇳","dial":"+86"},{"code":"CX","name":"Christmas Island","flag":"🇨🇽","dial":"+61"},{"code":"CC","name":"Cocos (Keeling) Islands","flag":"🇨🇨","dial":"+61"},{"code":"CO","name":"Colombia","flag":"🇨🇴","dial":"+57"},{"code":"KM","name":"Comoros","flag":"🇰🇲","dial":"+269"},{"code":"CG","name":"Congo","flag":"🇨🇬","dial":"+242"},{"code":"CK","name":"Cook Islands","flag":"🇨🇰","dial":"+682"},{"code":"CR","name":"Costa Rica","flag":"🇨🇷","dial":"+506"},{"code":"HR","name":"Croatia","flag":"🇭🇷","dial":"+385"},{"code":"CU","name":"Cuba","flag":"🇨🇺","dial":"+53"},{"code":"CW","name":"Curaçao","flag":"🇨🇼","dial":"+599"},{"code":"CY","name":"Cyprus","flag":"🇨🇾","dial":"+357"},{"code":"CZ","name":"Czechia","flag":"🇨🇿","dial":"+420"},{"code":"DK","name":"Denmark","flag":"🇩🇰","dial":"+45"},{"code":"DJ","name":"Djibouti","flag":"🇩🇯","dial":"+253"},{"code":"DM","name":"Dominica","flag":"🇩🇲","dial":"+1767"},{"code":"DO","name":"Dominican Republic","flag":"🇩🇴","dial":"+1809"},{"code":"CD","name":"DR Congo","flag":"🇨🇩","dial":"+243"},{"code":"EC","name":"Ecuador","flag":"🇪🇨","dial":"+593"},{"code":"EG","name":"Egypt","flag":"🇪🇬","dial":"+20"},{"code":"SV","name":"El Salvador","flag":"🇸🇻","dial":"+503"},{"code":"GQ","name":"Equatorial Guinea","flag":"🇬🇶","dial":"+240"},{"code":"ER","name":"Eritrea","flag":"🇪🇷","dial":"+291"},{"code":"EE","name":"Estonia","flag":"🇪🇪","dial":"+372"},{"code":"SZ","name":"Eswatini","flag":"🇸🇿","dial":"+268"},{"code":"ET","name":"Ethiopia","flag":"🇪🇹","dial":"+251"},{"code":"FK","name":"Falkland Islands","flag":"🇫🇰","dial":"+500"},{"code":"FO","name":"Faroe Islands","flag":"🇫🇴","dial":"+298"},{"code":"FJ","name":"Fiji","flag":"🇫🇯","dial":"+679"},{"code":"FI","name":"Finland","flag":"🇫🇮","dial":"+358"},{"code":"FR","name":"France","flag":"🇫🇷","dial":"+33"},{"code":"GF","name":"French Guiana","flag":"🇬🇫","dial":"+594"},{"code":"PF","name":"French Polynesia","flag":"🇵🇫","dial":"+689"},{"code":"TF","name":"French Southern and Antarctic Lands","flag":"🇹🇫","dial":"+262"},{"code":"GA","name":"Gabon","flag":"🇬🇦","dial":"+241"},{"code":"GM","name":"Gambia","flag":"🇬🇲","dial":"+220"},{"code":"GE","name":"Georgia","flag":"🇬🇪","dial":"+995"},{"code":"DE","name":"Germany","flag":"🇩🇪","dial":"+49"},{"code":"GH","name":"Ghana","flag":"🇬🇭","dial":"+233"},{"code":"GI","name":"Gibraltar","flag":"🇬🇮","dial":"+350"},{"code":"GR","name":"Greece","flag":"🇬🇷","dial":"+30"},{"code":"GL","name":"Greenland","flag":"🇬🇱","dial":"+299"},{"code":"GD","name":"Grenada","flag":"🇬🇩","dial":"+1473"},{"code":"GP","name":"Guadeloupe","flag":"🇬🇵","dial":"+590"},{"code":"GU","name":"Guam","flag":"🇬🇺","dial":"+1671"},{"code":"GT","name":"Guatemala","flag":"🇬🇹","dial":"+502"},{"code":"GG","name":"Guernsey","flag":"🇬🇬","dial":"+44"},{"code":"GN","name":"Guinea","flag":"🇬🇳","dial":"+224"},{"code":"GW","name":"Guinea-Bissau","flag":"🇬🇼","dial":"+245"},{"code":"GY","name":"Guyana","flag":"🇬🇾","dial":"+592"},{"code":"HT","name":"Haiti","flag":"🇭🇹","dial":"+509"},{"code":"HM","name":"Heard Island and McDonald Islands","flag":"🇭🇲","dial":""},{"code":"HN","name":"Honduras","flag":"🇭🇳","dial":"+504"},{"code":"HK","name":"Hong Kong","flag":"🇭🇰","dial":"+852"},{"code":"HU","name":"Hungary","flag":"🇭🇺","dial":"+36"},{"code":"IS","name":"Iceland","flag":"🇮🇸","dial":"+354"},{"code":"IN","name":"India","flag":"🇮🇳","dial":"+91"},{"code":"ID","name":"Indonesia","flag":"🇮🇩","dial":"+62"},{"code":"IR","name":"Iran","flag":"🇮🇷","dial":"+98"},{"code":"IQ","name":"Iraq","flag":"🇮🇶","dial":"+964"},{"code":"IE","name":"Ireland","flag":"🇮🇪","dial":"+353"},{"code":"IM","name":"Isle of Man","flag":"🇮🇲","dial":"+44"},{"code":"IL","name":"Israel","flag":"🇮🇱","dial":"+972"},{"code":"IT","name":"Italy","flag":"🇮🇹","dial":"+39"},{"code":"CI","name":"Ivory Coast","flag":"🇨🇮","dial":"+225"},{"code":"JM","name":"Jamaica","flag":"🇯🇲","dial":"+1876"},{"code":"JP","name":"Japan","flag":"🇯🇵","dial":"+81"},{"code":"JE","name":"Jersey","flag":"🇯🇪","dial":"+44"},{"code":"JO","name":"Jordan","flag":"🇯🇴","dial":"+962"},{"code":"KZ","name":"Kazakhstan","flag":"🇰🇿","dial":"+76"},{"code":"KE","name":"Kenya","flag":"🇰🇪","dial":"+254"},{"code":"KI","name":"Kiribati","flag":"🇰🇮","dial":"+686"},{"code":"XK","name":"Kosovo","flag":"🇽🇰","dial":"+383"},{"code":"KW","name":"Kuwait","flag":"🇰🇼","dial":"+965"},{"code":"KG","name":"Kyrgyzstan","flag":"🇰🇬","dial":"+996"},{"code":"LA","name":"Laos","flag":"🇱🇦","dial":"+856"},{"code":"LV","name":"Latvia","flag":"🇱🇻","dial":"+371"},{"code":"LB","name":"Lebanon","flag":"🇱🇧","dial":"+961"},{"code":"LS","name":"Lesotho","flag":"🇱🇸","dial":"+266"},{"code":"LR","name":"Liberia","flag":"🇱🇷","dial":"+231"},{"code":"LY","name":"Libya","flag":"🇱🇾","dial":"+218"},{"code":"LI","name":"Liechtenstein","flag":"🇱🇮","dial":"+423"},{"code":"LT","name":"Lithuania","flag":"🇱🇹","dial":"+370"},{"code":"LU","name":"Luxembourg","flag":"🇱🇺","dial":"+352"},{"code":"MO","name":"Macau","flag":"🇲🇴","dial":"+853"},{"code":"MG","name":"Madagascar","flag":"🇲🇬","dial":"+261"},{"code":"MW","name":"Malawi","flag":"🇲🇼","dial":"+265"},{"code":"MY","name":"Malaysia","flag":"🇲🇾","dial":"+60"},{"code":"MV","name":"Maldives","flag":"🇲🇻","dial":"+960"},{"code":"ML","name":"Mali","flag":"🇲🇱","dial":"+223"},{"code":"MT","name":"Malta","flag":"🇲🇹","dial":"+356"},{"code":"MH","name":"Marshall Islands","flag":"🇲🇭","dial":"+692"},{"code":"MQ","name":"Martinique","flag":"🇲🇶","dial":"+596"},{"code":"MR","name":"Mauritania","flag":"🇲🇷","dial":"+222"},{"code":"MU","name":"Mauritius","flag":"🇲🇺","dial":"+230"},{"code":"YT","name":"Mayotte","flag":"🇾🇹","dial":"+262"},{"code":"MX","name":"Mexico","flag":"🇲🇽","dial":"+52"},{"code":"FM","name":"Micronesia","flag":"🇫🇲","dial":"+691"},{"code":"MD","name":"Moldova","flag":"🇲🇩","dial":"+373"},{"code":"MC","name":"Monaco","flag":"🇲🇨","dial":"+377"},{"code":"MN","name":"Mongolia","flag":"🇲🇳","dial":"+976"},{"code":"ME","name":"Montenegro","flag":"🇲🇪","dial":"+382"},{"code":"MS","name":"Montserrat","flag":"🇲🇸","dial":"+1664"},{"code":"MA","name":"Morocco","flag":"🇲🇦","dial":"+212"},{"code":"MZ","name":"Mozambique","flag":"🇲🇿","dial":"+258"},{"code":"MM","name":"Myanmar","flag":"🇲🇲","dial":"+95"},{"code":"NA","name":"Namibia","flag":"🇳🇦","dial":"+264"},{"code":"NR","name":"Nauru","flag":"🇳🇷","dial":"+674"},{"code":"NP","name":"Nepal","flag":"🇳🇵","dial":"+977"},{"code":"NL","name":"Netherlands","flag":"🇳🇱","dial":"+31"},{"code":"NC","name":"New Caledonia","flag":"🇳🇨","dial":"+687"},{"code":"NZ","name":"New Zealand","flag":"🇳🇿","dial":"+64"},{"code":"NI","name":"Nicaragua","flag":"🇳🇮","dial":"+505"},{"code":"NE","name":"Niger","flag":"🇳🇪","dial":"+227"},{"code":"NG","name":"Nigeria","flag":"🇳🇬","dial":"+234"},{"code":"NU","name":"Niue","flag":"🇳🇺","dial":"+683"},{"code":"NF","name":"Norfolk Island","flag":"🇳🇫","dial":"+672"},{"code":"KP","name":"North Korea","flag":"🇰🇵","dial":"+850"},{"code":"MK","name":"North Macedonia","flag":"🇲🇰","dial":"+389"},{"code":"MP","name":"Northern Mariana Islands","flag":"🇲🇵","dial":"+1670"},{"code":"NO","name":"Norway","flag":"🇳🇴","dial":"+47"},{"code":"OM","name":"Oman","flag":"🇴🇲","dial":"+968"},{"code":"PK","name":"Pakistan","flag":"🇵🇰","dial":"+92"},{"code":"PW","name":"Palau","flag":"🇵🇼","dial":"+680"},{"code":"PS","name":"Palestine","flag":"🇵🇸","dial":"+970"},{"code":"PA","name":"Panama","flag":"🇵🇦","dial":"+507"},{"code":"PG","name":"Papua New Guinea","flag":"🇵🇬","dial":"+675"},{"code":"PY","name":"Paraguay","flag":"🇵🇾","dial":"+595"},{"code":"PE","name":"Peru","flag":"🇵🇪","dial":"+51"},{"code":"PH","name":"Philippines","flag":"🇵🇭","dial":"+63"},{"code":"PN","name":"Pitcairn Islands","flag":"🇵🇳","dial":"+64"},{"code":"PL","name":"Poland","flag":"🇵🇱","dial":"+48"},{"code":"PT","name":"Portugal","flag":"🇵🇹","dial":"+351"},{"code":"PR","name":"Puerto Rico","flag":"🇵🇷","dial":"+1787"},{"code":"QA","name":"Qatar","flag":"🇶🇦","dial":"+974"},{"code":"RE","name":"Réunion","flag":"🇷🇪","dial":"+262"},{"code":"RO","name":"Romania","flag":"🇷🇴","dial":"+40"},{"code":"RU","name":"Russia","flag":"🇷🇺","dial":"+73"},{"code":"RW","name":"Rwanda","flag":"🇷🇼","dial":"+250"},{"code":"BL","name":"Saint Barthélemy","flag":"🇧🇱","dial":"+590"},{"code":"SH","name":"Saint Helena, Ascension and Tristan da Cunha","flag":"🇸🇭","dial":"+290"},{"code":"KN","name":"Saint Kitts and Nevis","flag":"🇰🇳","dial":"+1869"},{"code":"LC","name":"Saint Lucia","flag":"🇱🇨","dial":"+1758"},{"code":"MF","name":"Saint Martin","flag":"🇲🇫","dial":"+590"},{"code":"PM","name":"Saint Pierre and Miquelon","flag":"🇵🇲","dial":"+508"},{"code":"VC","name":"Saint Vincent and the Grenadines","flag":"🇻🇨","dial":"+1784"},{"code":"WS","name":"Samoa","flag":"🇼🇸","dial":"+685"},{"code":"SM","name":"San Marino","flag":"🇸🇲","dial":"+378"},{"code":"ST","name":"São Tomé and Príncipe","flag":"🇸🇹","dial":"+239"},{"code":"SA","name":"Saudi Arabia","flag":"🇸🇦","dial":"+966"},{"code":"SN","name":"Senegal","flag":"🇸🇳","dial":"+221"},{"code":"RS","name":"Serbia","flag":"🇷🇸","dial":"+381"},{"code":"SC","name":"Seychelles","flag":"🇸🇨","dial":"+248"},{"code":"SL","name":"Sierra Leone","flag":"🇸🇱","dial":"+232"},{"code":"SG","name":"Singapore","flag":"🇸🇬","dial":"+65"},{"code":"SX","name":"Sint Maarten","flag":"🇸🇽","dial":"+1721"},{"code":"SK","name":"Slovakia","flag":"🇸🇰","dial":"+421"},{"code":"SI","name":"Slovenia","flag":"🇸🇮","dial":"+386"},{"code":"SB","name":"Solomon Islands","flag":"🇸🇧","dial":"+677"},{"code":"SO","name":"Somalia","flag":"🇸🇴","dial":"+252"},{"code":"ZA","name":"South Africa","flag":"🇿🇦","dial":"+27"},{"code":"GS","name":"South Georgia","flag":"🇬🇸","dial":"+500"},{"code":"KR","name":"South Korea","flag":"🇰🇷","dial":"+82"},{"code":"SS","name":"South Sudan","flag":"🇸🇸","dial":"+211"},{"code":"ES","name":"Spain","flag":"🇪🇸","dial":"+34"},{"code":"LK","name":"Sri Lanka","flag":"🇱🇰","dial":"+94"},{"code":"SD","name":"Sudan","flag":"🇸🇩","dial":"+249"},{"code":"SR","name":"Suriname","flag":"🇸🇷","dial":"+597"},{"code":"SJ","name":"Svalbard and Jan Mayen","flag":"🇸🇯","dial":"+4779"},{"code":"SE","name":"Sweden","flag":"🇸🇪","dial":"+46"},{"code":"CH","name":"Switzerland","flag":"🇨🇭","dial":"+41"},{"code":"SY","name":"Syria","flag":"🇸🇾","dial":"+963"},{"code":"TW","name":"Taiwan","flag":"🇹🇼","dial":"+886"},{"code":"TJ","name":"Tajikistan","flag":"🇹🇯","dial":"+992"},{"code":"TZ","name":"Tanzania","flag":"🇹🇿","dial":"+255"},{"code":"TH","name":"Thailand","flag":"🇹🇭","dial":"+66"},{"code":"TL","name":"Timor-Leste","flag":"🇹🇱","dial":"+670"},{"code":"TG","name":"Togo","flag":"🇹🇬","dial":"+228"},{"code":"TK","name":"Tokelau","flag":"🇹🇰","dial":"+690"},{"code":"TO","name":"Tonga","flag":"🇹🇴","dial":"+676"},{"code":"TT","name":"Trinidad and Tobago","flag":"🇹🇹","dial":"+1868"},{"code":"TN","name":"Tunisia","flag":"🇹🇳","dial":"+216"},{"code":"TR","name":"Türkiye","flag":"🇹🇷","dial":"+90"},{"code":"TM","name":"Turkmenistan","flag":"🇹🇲","dial":"+993"},{"code":"TC","name":"Turks and Caicos Islands","flag":"🇹🇨","dial":"+1649"},{"code":"TV","name":"Tuvalu","flag":"🇹🇻","dial":"+688"},{"code":"UG","name":"Uganda","flag":"🇺🇬","dial":"+256"},{"code":"UA","name":"Ukraine","flag":"🇺🇦","dial":"+380"},{"code":"AE","name":"United Arab Emirates","flag":"🇦🇪","dial":"+971"},{"code":"GB","name":"United Kingdom","flag":"🇬🇧","dial":"+44"},{"code":"US","name":"United States","flag":"🇺🇸","dial":"+1201"},{"code":"UM","name":"United States Minor Outlying Islands","flag":"🇺🇲","dial":"+268"},{"code":"VI","name":"United States Virgin Islands","flag":"🇻🇮","dial":"+1340"},{"code":"UY","name":"Uruguay","flag":"🇺🇾","dial":"+598"},{"code":"UZ","name":"Uzbekistan","flag":"🇺🇿","dial":"+998"},{"code":"VU","name":"Vanuatu","flag":"🇻🇺","dial":"+678"},{"code":"VA","name":"Vatican City","flag":"🇻🇦","dial":"+3906698"},{"code":"VE","name":"Venezuela","flag":"🇻🇪","dial":"+58"},{"code":"VN","name":"Vietnam","flag":"🇻🇳","dial":"+84"},{"code":"WF","name":"Wallis and Futuna","flag":"🇼🇫","dial":"+681"},{"code":"EH","name":"Western Sahara","flag":"🇪🇭","dial":"+2125288"},{"code":"YE","name":"Yemen","flag":"🇾🇪","dial":"+967"},{"code":"ZM","name":"Zambia","flag":"🇿🇲","dial":"+260"},{"code":"ZW","name":"Zimbabwe","flag":"🇿🇼","dial":"+263"}];

  function SignUpView() {
    var _f = useState({ fullName: '', email: '', country: '', countryCode: '', phoneCountryCode: '', callingCode: '', phone: '', password: '', confirmPassword: '' });
    var form = _f[0]; var setForm = _f[1];
    var _step = useState('details'); var step = _step[0]; var setStep = _step[1];
    var _emailOtp = useState(''); var emailOtp = _emailOtp[0]; var setEmailOtp = _emailOtp[1];
    var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
    var _e = useState(''); var error = _e[0]; var setError = _e[1];
    var _m = useState(''); var message = _m[0]; var setMessage = _m[1];

    function update(key, value) { setForm(Object.assign({}, form, { [key]: value })); }

    function normalizePhone() {
      var calling = form.callingCode.replace(/[^+0-9]/g, '');
      var national = form.phone.replace(/[^0-9]/g, '').replace(/^0+/, '');
      if (!/^\+[1-9][0-9]{0,3}$/.test(calling) || national.length < 6 || national.length > 14) {
        throw new Error('Enter a valid country calling code and phone number.');
      }
      return calling + national;
    }

    function submit(event) {
      event.preventDefault(); setError(''); setMessage('');
      if (!form.countryCode || !form.callingCode) { setError('Select your country and phone country code.'); return; }
      if (form.password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
      if (form.password !== form.confirmPassword) { setError('Your passwords do not match.'); return; }
      var phone;
      try { phone = normalizePhone(); } catch (err) { setError(err.message); return; }
      setBusy(true);
      MG.auth.signUp({
        fullName: form.fullName, email: form.email, country: form.country,
        countryCode: form.countryCode, callingCode: form.callingCode,
        phone: phone, password: form.password,
      }).then(function (result) {
        if (result.error) throw result.error;
        setStep('email');
        setMessage('We sent a one-time code (OTP) to ' + form.email + '. Enter that code below — not a confirmation link.');
      }).catch(function (err) { setError(err.message || 'Could not start registration.'); })
        .finally(function () { setBusy(false); });
    }

    function verifyEmail(event) {
      event.preventDefault(); setBusy(true); setError(''); setMessage('');
      MG.auth.verifyEmailOtp(form.email, emailOtp).then(function (result) {
        if (result.error) throw result.error;
        setMessage('Email verified. Your account is ready.');
        MG.auth.completeCustomerLogin();
        location.hash = '#/overview';
      }).catch(function (err) { setError(err.message || 'Email verification failed.'); })
        .finally(function () { setBusy(false); });
    }

    var content;
    if (step === 'details') {
      content = h('form', { onSubmit: submit },
        h(AuthInput, { label: 'Full name', value: form.fullName, required: true, autoComplete: 'name',
          onChange: function (event) { update('fullName', event.target.value); } }),
        h(AuthInput, { label: 'Email address', type: 'email', value: form.email, required: true, autoComplete: 'email',
          onChange: function (event) { update('email', event.target.value); } }),
        h('div', { className: 'field' },
          h('label', null, 'Country'),
          h('select', { className: 'input', value: form.countryCode, required: true,
            onChange: function (event) {
              var c = SIGNUP_COUNTRIES.find(function (item) { return item.code === event.target.value; });
              setForm(Object.assign({}, form, { countryCode: c ? c.code : '', country: c ? c.name : '' }));
            } },
            h('option', { value: '' }, 'Select your country'),
            SIGNUP_COUNTRIES.map(function (country) {
              return h('option', { key: country.code, value: country.code }, country.name);
            }))),
        h('div', { className: 'grid-2' },
          h('div', { className: 'field' },
            h('label', null, 'Phone country code'),
            h('select', { className: 'input', value: form.phoneCountryCode, required: true,
              onChange: function (event) {
                var c = SIGNUP_COUNTRIES.find(function (item) { return item.code === event.target.value; });
                setForm(Object.assign({}, form, { phoneCountryCode: c ? c.code : '', callingCode: c ? c.dial : '' }));
              } },
              h('option', { value: '' }, 'Select calling code'),
              SIGNUP_COUNTRIES.map(function (country) {
                return h('option', { key: country.code, value: country.code },
                  country.flag + ' ' + country.name + ' ' + (country.dial || 'No calling code'));
              }))),
          h(AuthInput, { label: 'Phone number', type: 'tel', value: form.phone, required: true, placeholder: '8012345678',
            onChange: function (event) { update('phone', event.target.value); } })),
        h(AuthInput, { label: 'Password (minimum 8 characters)', type: 'password', value: form.password, required: true, minLength: 8, autoComplete: 'new-password',
          onChange: function (event) { update('password', event.target.value); } }),
        h(AuthInput, { label: 'Confirm password', type: 'password', value: form.confirmPassword, required: true, autoComplete: 'new-password',
          onChange: function (event) { update('confirmPassword', event.target.value); } }),
        error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
        h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
          busy ? 'Creating account…' : 'Sign Up'));
    } else {
      content = h(React.Fragment, null,
        h('form', { onSubmit: verifyEmail },
          h(AuthInput, { label: 'One-time code (OTP)', value: emailOtp, required: true, maxLength: 6, autoComplete: 'one-time-code',
            onChange: function (event) { setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); } }),
          h('p', { className: 'muted' },
            'Enter the numeric one-time code from your email. Do not use a “confirm email address” link — this step requires the OTP only.'),
          error ? h('p', { className: 'form-error', role: 'alert' }, error) : null,
          h('button', { className: 'btn btn-primary btn-block', type: 'submit', disabled: busy },
            busy ? 'Verifying…' : 'Verify OTP and activate account')),
        h('button', {
          type: 'button',
          className: 'btn btn-ghost btn-block',
          disabled: busy,
          onClick: function () {
            setBusy(true); setError(''); setMessage('');
            MG.auth.resendSignupOtp(form.email).then(function (result) {
              if (result.error) throw result.error;
              setMessage('A new one-time code was sent to ' + form.email + '.');
            }).catch(function (err) {
              setError(err.message || 'Could not resend the code.');
            }).finally(function () { setBusy(false); });
          },
        }, 'Resend one-time code'));
    }

    return h('div', { className: 'auth-wrap' },
      h('div', { className: 'auth-card' },
        h('p', { className: 'auth-brand' }, 'Meridian Global Accounts'),
        h('h1', null, step === 'details' ? 'Create your account' : 'Enter email OTP'),
        h('p', { className: 'muted' }, step === 'details' ? 'Create your Meridian account with your contact details and a password.' : (message || 'Enter the one-time code from your email.')),
        content,
        step !== 'details' && message ? h('p', { className: 'form-success', role: 'status' }, message) : null,
        h('p', { className: 'muted auth-links' }, 'Already registered? ', h('a', { href: '#/login' }, 'Sign in'))));
  }

  /* ------------------------------------------------------------------ shell */
  var NAV = [
    { group: 'Banking', items: [
      { id: 'overview', label: 'Overview', icon: 'dashboard' },
      { id: 'accounts', label: 'Accounts', icon: 'wallet' },
      { id: 'activate', label: 'Activate currency', icon: 'plus' },
      { id: 'deposits', label: 'Deposits', icon: 'arrow-up' },
      { id: 'transactions', label: 'Transactions', icon: 'receipt' },
      { id: 'statements', label: 'Statements', icon: 'doc' },
    ] },
    { group: 'Account', items: [
      { id: 'notifications', label: 'Notifications', icon: 'bell' },
      { id: 'profile', label: 'Profile', icon: 'user' },
      { id: 'security', label: 'Security', icon: 'shield' },
      { id: 'sessions', label: 'Sessions', icon: 'clock' },
      { id: 'support', label: 'Support', icon: 'life' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ] },
  ];

  var TITLES = {
    overview: 'Account Overview', accounts: 'My Accounts', activate: 'Activate Currency',
    deposits: 'Deposits', transactions: 'Transactions', statements: 'Statements',
    notifications: 'Notifications', profile: 'Profile', security: 'Security',
    sessions: 'Login Sessions', support: 'Support', settings: 'Settings',
    register: 'Create Account', login: 'Sign In',
  };

  MG.app = { NAV: NAV, TITLES: TITLES };

  function parseHash() {
    var raw = (location.hash || '#/overview').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    return { view: parts[0] || 'overview', param: parts[1] || null };
  }

  function Shell(props) {
    var route = props.route;
    var user = props.user;
    var _u = useState(0); var force = _u[1];
    var _d = useState(false); var drawer = _d[0]; var setDrawer = _d[1];

    useEffect(function () {
      var onHash = function () {
        force(function (x) { return x + 1; });
        setDrawer(false);
      };
      window.addEventListener('hashchange', onHash);
      return function () { window.removeEventListener('hashchange', onHash); };
    }, []);

    // Theme CSS keys off body.nav-open for the mobile drawer — keep body in sync.
    useEffect(function () {
      document.body.classList.toggle('nav-open', drawer);
      document.body.classList.add('app-shell');
      return function () {
        document.body.classList.remove('nav-open', 'app-shell');
      };
    }, [drawer]);

    var title = TITLES[route.view] || (route.view === 'account' ? 'Currency Account'
      : route.view === 'txn' ? 'Transaction Detail' : 'Meridian');
    var View = props.resolveView(route);
    var unread = MG.app.unreadCount || 0;
    var email = (user && user.email) ||
      (user && user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) ||
      (user && user.user_metadata && user.user_metadata.email) || '';
    var displayName =
      (user && (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name))) ||
      (user && user.fullName) ||
      (user && user.firstName) ||
      (email ? email.split('@')[0] : 'Customer');

    return h(React.Fragment, null,
      h('div', { className: 'shell' },
        h('aside', { className: 'sidenav', id: 'gl-sidenav', 'aria-label': 'Account navigation' },
          h('div', { className: 'sidenav-brand' },
            h('a', { href: 'index.html', className: 'brand brand-side' },
              h('span', { className: 'brand-mark brand-mark-light', 'aria-hidden': 'true' }, '◎'),
              h('span', { className: 'brand-text' }, 'Meridian', h('small', null, ' GLOBAL ACCOUNTS')))),
          h('nav', { className: 'sidenav-nav' },
            NAV.map(function (group) {
              return h(React.Fragment, { key: group.group },
                h('p', { className: 'nav-group' }, group.group),
                group.items.map(function (item) {
                  var isActive = route.view === item.id || (item.id === 'accounts' && route.view === 'account');
                  return h('a', {
                    key: item.id,
                    className: 'nav-item' + (isActive ? ' active' : ''),
                    href: '#/' + item.id,
                    onClick: function () { setDrawer(false); },
                  },
                    MG.icon ? MG.icon(item.icon, 17) : null,
                    h('span', null, item.label),
                    item.id === 'notifications' && unread > 0
                      ? h('span', { className: 'nav-badge' }, unread > 9 ? '9+' : String(unread))
                      : null);
                }));
            })),
          h('div', { className: 'sidenav-foot' },
            h('div', { className: 'sidenav-user' },
              h('span', { className: 'avatar', 'aria-hidden': 'true' }, MG.util.initials(displayName)),
              h('div', { className: 'sidenav-user-txt' },
                h('b', null, displayName),
                h('small', null, email || 'Signed in'))),
            h('button', {
              className: 'btn btn-outline btn-sm sidenav-out',
              type: 'button',
              onClick: function () { MG.auth.signOut({ scope: 'local' }); },
            }, MG.icon ? MG.icon('logout', 15) : null, ' Sign out'))),

        h('div', { className: 'shell-main' },
          h('header', { className: 'topbar' },
            h('button', {
              className: 'icon-btn menu-btn',
              type: 'button',
              'aria-expanded': drawer ? 'true' : 'false',
              'aria-controls': 'gl-sidenav',
              'aria-label': drawer ? 'Close navigation' : 'Open navigation',
              onClick: function () { setDrawer(!drawer); },
            }, MG.icon ? MG.icon('menu', 20) : '☰'),
            h('h1', { className: 'topbar-title', id: 'gl-viewtitle', tabIndex: -1 }, title),
            h('div', { className: 'topbar-actions' },
              h('a', {
                className: 'icon-btn topbar-bell',
                href: '#/notifications',
                'aria-label': unread ? ('Notifications, ' + unread + ' unread') : 'Notifications',
              },
                MG.icon ? MG.icon('bell', 19) : '🔔',
                unread > 0 ? h('span', { className: 'nav-badge' }, unread > 9 ? '9+' : String(unread)) : null),
              h('a', { className: 'topbar-chip', href: '#/profile', title: displayName },
                h('span', { className: 'avatar avatar-sm', 'aria-hidden': 'true' }, MG.util.initials(displayName)),
                h('span', { className: 'topbar-chip-name' }, displayName.split(' ')[0])))),

          h('main', { className: 'content', id: 'gl-main' },
            h('div', { className: 'page-frame' },
              h(View, { key: route.view + (route.param || ''), route: route, user: user })))),

        h('div', {
          className: 'scrim' + (drawer ? '' : ' is-hidden'),
          onClick: function () { setDrawer(false); },
          hidden: !drawer,
          'aria-hidden': 'true',
        })));
  }

  /* ------------------------------------------------------------- root/app */
  function App() {
    var _a = useState({ ready: false, error: null });
    var auth = _a[0]; var setAuth = _a[1];
    var _r = useState(parseHash()); var route = _r[0]; var setRoute = _r[1];
    var _u = useState(0); var force = _u[1];

    useEffect(function () {
      var active = true;
      var off = function () {};
      var onHash = function () { setRoute(parseHash()); };
      window.addEventListener('hashchange', onHash);
      MG.ready.then(function () {
        if (!active) return;
        if (!MG.isConfigured()) {
          throw (MG.configError || new Error('API public configuration is incomplete.'));
        }
        MG.api.init();
        off = MG.auth.onChange(function () { force(function (x) { return x + 1; }); });
        return MG.auth.load();
      }).then(function () {
        if (active) setAuth({ ready: true, error: null });
      }).catch(function (err) {
        if (active) setAuth({ ready: true, error: err });
      });
      return function () {
        active = false;
        off();
        window.removeEventListener('hashchange', onHash);
      };
    }, []);

    if (!MG.configLoaded) return h('div', { className: 'auth-wrap' }, h('div', { className: 'auth-card' }, h(MG.ui.Skeleton, { lines: 3 })));
    if (!MG.isConfigured()) return h(ConfigScreen);
    if (!auth.ready) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' }, h(MG.ui.Skeleton, { lines: 3 })));
    }
    if (auth.error) {
      return h('div', { className: 'auth-wrap' },
        h('div', { className: 'auth-card' },
          h('h1', null, 'Authentication unavailable'),
          h('p', { className: 'muted' }, 'The identity service could not be loaded. Check your connection and the Supabase configuration.'),
          h('button', {
            className: 'btn btn-primary', onClick: function () { location.reload(); },
          }, 'Retry')));
    }

    var st = MG.auth.state;
    if (!st.signedIn || !st.user) {
      document.body.classList.remove('app-shell', 'nav-open');
      document.body.classList.add('auth-page');
      var authView;
      if (route.view === 'register') authView = h(SignUpView);
      else authView = h(SignInView);
      return h('div', { className: 'auth-page-root' }, authView);
    }
    // Sign-in is pure email OTP (no magic-link second factor).


    document.body.classList.remove('auth-page');

    // Resolve view lazily so each view module registers itself.
    function resolveView(r) {
      var views = MG.views || {};
      var key = r.view === 'account' ? 'account' : r.view === 'txn' ? 'txn' : r.view;
      return views[key] || views.notFound || function () {
        return h('div', { className: 'panel' },
          h(MG.ui.Empty, { title: 'Page not found',
            hint: 'The view "' + r.view + '" does not exist.',
            action: h('a', { className: 'btn btn-primary', href: '#/overview' }, 'Back to overview') }));
      };
    }

    return h(Shell, { route: route, user: st.user, resolveView: resolveView });
  }

  var mount = document.getElementById('gl-app');
  if (!mount) {
    if (window.__meridianBootError) window.__meridianBootError(new Error('Missing #gl-app mount node.'));
  } else {
    try {
      window.__meridianBooted = true;
      ReactDOM.createRoot(mount).render(h(App));
    } catch (err) {
      if (window.__meridianBootError) window.__meridianBootError(err);
      else throw err;
    }
  }
})();
