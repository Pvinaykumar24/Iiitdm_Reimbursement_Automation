import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Mechanical Engineering',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Humanities & Social Sciences',
  'Design',
];

const stepMeta = [
  { label: 'Your details',    icon: 'ti-user'         },
  { label: 'Verify email',    icon: 'ti-mail-check'   },
  { label: 'Set password',    icon: 'ti-lock'         },
];

export default function Register() {
  const navigate   = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);

  // Step 1 fields
  const [name,       setName]       = useState('');
  const [email,      setEmail]      = useState('');
  const [empId,      setEmpId]      = useState('');
  const [department, setDepartment] = useState('');

  // Step 2 – OTP (6 boxes)
  const [otp,    setOtp]    = useState(['', '', '', '', '', '']);
  const [timer,  setTimer]  = useState(0);
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Step 3 – password
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');

  // ── countdown for resend ────────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) return;
    const t = setInterval(() => setTimer(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [timer]);

  // ── Step 1 submit ───────────────────────────────────────────────────────────
  const handleStep1 = async (e) => {
    e.preventDefault();
    if (!email.toLowerCase().endsWith('@iiitdm.ac.in')) {
      setError('Email must end with @iiitdm.ac.in');
      return;
    }
    setError(''); setLoading(true);
    try {
      await authApi.sendOtp({ email, employee_id: empId, name, department });
      setSuccess(`OTP sent to ${email}`);
      setStep(2);
      setTimer(60);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  // ── OTP box change ──────────────────────────────────────────────────────────
  const handleOtpChange = (idx, val) => {
    const cleaned = val.replace(/\D/, '');
    const next = [...otp];
    next[idx] = cleaned;
    setOtp(next);
    if (cleaned && idx < 5) otpRefs[idx + 1].current?.focus();
  };
  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs[idx - 1].current?.focus();
  };
  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs[5].current?.focus();
    }
    e.preventDefault();
  };

  // ── Step 2 submit ───────────────────────────────────────────────────────────
  const handleStep2 = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the complete 6-digit OTP'); return; }
    setError(''); setLoading(true);
    try {
      await authApi.verifyOtp({ email, otp: code });
      setSuccess('Email verified! Now create your password.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally { setLoading(false); }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setError(''); setLoading(true);
    try {
      await authApi.sendOtp({ email, employee_id: empId, name, department });
      setSuccess('New OTP sent!');
      setTimer(60);
      setOtp(['', '', '', '', '', '']);
      otpRefs[0].current?.focus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally { setLoading(false); }
  };

  // ── Step 3 submit ───────────────────────────────────────────────────────────
  const handleStep3 = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password)) { setError('Password must contain at least one uppercase letter'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one number'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await authApi.completeRegistration({ email, password });
      setAuth(data.user, data.token, data.refreshToken);
      navigate('/faculty');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  // ── Password strength ───────────────────────────────────────────────────────
  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#c0392b', '#e67e22', '#27ae60', '#1a8a4a'][strength];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f0f0ff 0%, #f5f5f4 60%, #e8f5e9 100%)',
      padding: '24px 16px',
      overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 14, background: '#744FC6',
            marginBottom: 12, boxShadow: '0 4px 14px rgba(83,74,183,0.35)' }}>
            <i className="ti ti-building-community" style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#4C4C9D' }}>IIITDM Kancheepuram</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>Reimbursement Portal — Faculty Registration</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 0 }}>
          {stepMeta.map((s, i) => {
            const num = i + 1;
            const done    = step > num;
            const current = step === num;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, transition: 'all 0.3s',
                    background: done ? '#27ae60' : current ? '#744FC6' : '#e5e5e3',
                    color: done || current ? '#fff' : '#aaa',
                    boxShadow: current ? '0 0 0 4px rgba(83,74,183,0.18)' : 'none',
                  }}>
                    {done ? <i className="ti ti-check" style={{ fontSize: 14 }} /> : num}
                  </div>
                  <div style={{ fontSize: 10, color: done ? '#27ae60' : current ? '#744FC6' : '#aaa',
                    fontWeight: current ? 600 : 400, whiteSpace: 'nowrap' }}>{s.label}</div>
                </div>
                {i < stepMeta.length - 1 && (
                  <div style={{ width: 56, height: 2, margin: '0 4px', marginBottom: 18,
                    background: step > num ? '#27ae60' : '#e5e5e3', transition: 'all 0.3s' }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-body" style={{ padding: '24px 24px 20px' }}>

            {/* Alerts */}
            {error   && <div className="alert alert-error"   style={{ marginBottom: 16 }}><i className="ti ti-alert-circle" /> {error}</div>}
            {success && <div className="alert alert-success" style={{ marginBottom: 16 }}><i className="ti ti-circle-check" /> {success}</div>}

            {/* ── Step 1: Details ───────────────────────────────────────────── */}
            {step === 1 && (
              <form onSubmit={handleStep1}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Create your account</div>
                  <div style={{ fontSize: 13, color: '#888' }}>Enter your institute details to get started</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Full name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Dr. / Prof. Your Name" required />
                </div>

                <div className="form-group">
                  <label className="form-label">Faculty ID *</label>
                  <input type="text" value={empId} onChange={e => setEmpId(e.target.value.toUpperCase())}
                    placeholder="e.g. FAC001" required
                    style={{ fontFamily: 'monospace', letterSpacing: 1 }} />
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Your institute employee ID</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Institute email *</label>
                  <div style={{ position: 'relative' }}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="yourname@iiitdm.ac.in" required style={{ paddingRight: 140 }} />
                    <span style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 11, color: email.toLowerCase().endsWith('@iiitdm.ac.in') ? '#27ae60' : '#bbb',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {email.toLowerCase().endsWith('@iiitdm.ac.in')
                        ? <><i className="ti ti-circle-check" style={{ fontSize: 13 }} /> Verified domain</>
                        : '@iiitdm.ac.in only'}
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)} required>
                    <option value="">-- Select your department --</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary"
                  style={{ width: '100%', marginTop: 4, height: 42, fontSize: 14 }} disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8, display: 'inline-block' }} />Sending OTP...</>
                    : <><i className="ti ti-send" style={{ marginRight: 6 }} />Send OTP to my email</>}
                </button>

                <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' }}>
                  Already have an account? <Link to="/login" style={{ color: '#744FC6', fontWeight: 500 }}>Sign in</Link>
                </div>
              </form>
            )}

            {/* ── Step 2: OTP ──────────────────────────────────────────────── */}
            {step === 2 && (
              <form onSubmit={handleStep2}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Check your email</div>
                  <div style={{ fontSize: 13, color: '#888' }}>
                    We sent a 6-digit OTP to <strong style={{ color: '#744FC6' }}>{email}</strong>
                  </div>
                </div>

                {/* OTP boxes */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={otpRefs[idx]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(idx, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      style={{
                        width: 48, height: 56, textAlign: 'center', fontSize: 22,
                        fontWeight: 700, borderRadius: 10, border: digit ? '2px solid #744FC6' : '2px solid #e5e5e3',
                        background: digit ? '#f3f0fc' : '#fafaf9', color: '#4C4C9D',
                        outline: 'none', transition: 'all 0.15s',
                        fontFamily: 'monospace',
                      }}
                    />
                  ))}
                </div>

                <button type="submit" className="btn btn-primary"
                  style={{ width: '100%', height: 42, fontSize: 14 }} disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8, display: 'inline-block' }} />Verifying...</>
                    : <><i className="ti ti-shield-check" style={{ marginRight: 6 }} />Verify OTP</>}
                </button>

                <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#888' }}>
                  {timer > 0
                    ? <>Resend available in <strong style={{ color: '#744FC6' }}>{timer}s</strong></>
                    : <>Didn't receive it?{' '}
                        <button type="button" onClick={handleResend} disabled={loading}
                          style={{ background: 'none', border: 'none', color: '#744FC6', fontWeight: 500, cursor: 'pointer', fontSize: 13, padding: 0 }}>
                          Resend OTP
                        </button>
                      </>}
                </div>

                <div style={{ textAlign: 'center', marginTop: 10, fontSize: 13 }}>
                  <button type="button" onClick={() => { setStep(1); setError(''); setSuccess(''); }}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13 }}>
                    ← Change email
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 3: Password ──────────────────────────────────────────── */}
            {step === 3 && (
              <form onSubmit={handleStep3}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Create your password</div>
                  <div style={{ fontSize: 13, color: '#888' }}>Almost done! Set a strong password for your account.</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters" required style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowPass(p => !p)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0 }}>
                      <i className={`ti ${showPass ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: 16 }} />
                    </button>
                  </div>
                  {/* Strength bar */}
                  {password && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 4, borderRadius: 4,
                            background: strength >= i ? strengthColor : '#e5e5e3',
                            transition: 'all 0.3s',
                          }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: strengthColor, fontWeight: 500 }}>{strengthLabel}</div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#999', marginTop: 6, lineHeight: 1.6 }}>
                    Must be at least 8 chars · one uppercase · one number
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm password *</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showConf ? 'text' : 'password'} value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter your password" required style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowConf(p => !p)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0 }}>
                      <i className={`ti ${showConf ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: 16 }} />
                    </button>
                  </div>
                  {confirm && password && (
                    <div style={{ fontSize: 11, marginTop: 5, color: password === confirm ? '#27ae60' : '#c0392b', fontWeight: 500 }}>
                      <i className={`ti ${password === confirm ? 'ti-circle-check' : 'ti-circle-x'}`} style={{ marginRight: 4 }} />
                      {password === confirm ? 'Passwords match' : 'Passwords do not match'}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div style={{ background: '#f8f8ff', border: '1px solid #e0dff8', borderRadius: 8,
                  padding: '12px 14px', marginBottom: 16, fontSize: 12, color: '#555' }}>
                  <div style={{ fontWeight: 600, color: '#744FC6', marginBottom: 6, fontSize: 11 }}>ACCOUNT SUMMARY</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                    <div><span style={{ color: '#999' }}>Name: </span>{name}</div>
                    <div><span style={{ color: '#999' }}>Faculty ID: </span>{empId}</div>
                    <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#999' }}>Email: </span>{email}</div>
                    <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#999' }}>Dept: </span>{department}</div>
                  </div>
                </div>

                <button type="submit" className="btn btn-success"
                  style={{ width: '100%', height: 42, fontSize: 14 }} disabled={loading}>
                  {loading
                    ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8, display: 'inline-block' }} />Creating account...</>
                    : <><i className="ti ti-rocket" style={{ marginRight: 6 }} />Create account &amp; sign in</>}
                </button>
              </form>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
