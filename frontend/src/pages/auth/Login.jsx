import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login({ email, password });
      setAuth(data.user, data.token, data.refreshToken);
      if (data.user.role === 'FACULTY')  navigate('/faculty');
      else if (data.user.role === 'DEAN') navigate('/dean');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
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
          <div className="card-header" style={{ fontSize: 15 }}>Sign in to your account</div>
          <div className="card-body">
            {error && <div className="alert alert-error"><i className="ti ti-alert-circle" />{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@iiitdm.ac.in" required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <div style={{ marginTop: 14, padding: '10px 12px', background: '#f5f5f4', borderRadius: 6, fontSize: 12, color: '#666' }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Demo accounts (password: Password@123)</div>
              <div>Faculty: karthick@iiitdm.ac.in</div>
              <div>Dean SR: dean@iiitdm.ac.in</div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: '#888' }}>
              New faculty?{' '}
              <Link to="/register" style={{ color: '#534AB7', fontWeight: 500, textDecoration: 'none' }}>
                Create an account →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}