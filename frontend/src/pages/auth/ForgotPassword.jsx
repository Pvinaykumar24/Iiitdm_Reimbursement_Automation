import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api';

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await authApi.sendResetOtp({ email });
      setMessage(res.data?.message || 'OTP sent successfully.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please verify your email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await authApi.verifyResetOtp({ email, otp });
      setMessage(res.data?.message || 'OTP verified successfully. Set your new password.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await authApi.completeReset({ email, password });
      alert('Password reset successfully! Redirecting you to login...');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f4' }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#534AB7' }}>IIITDM Kancheepuram</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>Reimbursement Portal</div>
        </div>
        <div className="card">
          <div className="card-header" style={{ fontSize: 15 }}>Reset Password</div>
          <div className="card-body">
            {error && <div className="alert alert-error"><i className="ti ti-alert-circle" style={{ marginRight: 6 }} />{error}</div>}
            {message && <div className="alert alert-success" style={{ background: '#EAF3DE', borderColor: '#d7e8c3', color: '#27500A', marginBottom: 12, padding: '8px 12px', fontSize: 13, borderRadius: 6 }}><i className="ti ti-check" style={{ marginRight: 6 }} />{message}</div>}

            {step === 1 && (
              <form onSubmit={handleSendOtp}>
                <p style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
                  Enter your registered institute email address. We will send you a 6-digit OTP to reset your password.
                </p>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@iiitdm.ac.in"
                    required
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Send OTP →'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleVerifyOtp}>
                <p style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
                  A verification code has been sent to <strong>{email}</strong>. Enter the OTP code below.
                </p>
                <div className="form-group">
                  <label className="form-label">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    pattern="\d{6}"
                    maxLength="6"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    required
                    disabled={loading}
                    style={{ letterSpacing: '2px', textAlign: 'center', fontWeight: 'bold' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button type="button" className="btn btn-ghost" style={{ width: '40%' }} onClick={() => setStep(1)} disabled={loading}>
                    Back
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ width: '60%' }} disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify OTP →'}
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleResetPassword}>
                <p style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
                  Create a new password for your account.
                </p>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Resetting password...' : 'Update Password'}
                </button>
              </form>
            )}

            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
              <Link to="/login" style={{ color: '#534AB7', fontWeight: 500, textDecoration: 'none' }}>
                ← Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
