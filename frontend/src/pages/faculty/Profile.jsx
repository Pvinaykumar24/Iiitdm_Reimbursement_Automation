import { useEffect, useState } from 'react';
import { authApi } from '../../api';

export default function FacultyProfile() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    employee_id: '',
    department: '',
    designation: '',
    phone: '',
    bank_account: '',
    ifsc_code: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    authApi.getProfile()
      .then(res => {
        const d = res.data;
        setForm({
          name: d.name || '',
          email: d.email || '',
          employee_id: d.employee_id || '',
          department: d.department || '',
          designation: d.designation || '',
          phone: d.phone || '',
          bank_account: d.bank_account || '',
          ifsc_code: d.ifsc_code || ''
        });
      })
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage(''); setSaving(true);
    try {
      const res = await authApi.updateProfile({
        name: form.name,
        phone: form.phone,
        designation: form.designation,
        bank_account: form.bank_account,
        ifsc_code: form.ifsc_code
      });
      setMessage('Profile updated successfully!');
      const d = res.data;
      setForm(prev => ({
        ...prev,
        name: d.name || '',
        phone: d.phone || '',
        designation: d.designation || '',
        bank_account: d.bank_account || '',
        ifsc_code: d.ifsc_code || ''
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <>
      <h1 className="page-title">My Profile</h1>

      {message && <div className="alert alert-success"><i className="ti ti-check" />{message}</div>}
      {error && <div className="alert alert-error"><i className="ti ti-alert-circle" />{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">Edit Profile Information</div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={e => setForm({ ...form, designation: e.target.value })}
                    placeholder="e.g. Assistant Professor"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="10-digit mobile"
                  />
                </div>
              </div>

              <div className="form-row form-row-2" style={{ marginTop: 8 }}>
                <div className="form-group">
                  <label className="form-label">Bank Account Number</label>
                  <input
                    type="text"
                    value={form.bank_account}
                    onChange={e => setForm({ ...form, bank_account: e.target.value })}
                    placeholder="Enter savings or current account no."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank IFSC Code</label>
                  <input
                    type="text"
                    value={form.ifsc_code}
                    onChange={e => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0001234"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile Details'}
              </button>
            </form>
          </div>
        </div>

        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header">Employment Details</div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>Employee ID</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{form.employee_id || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>Department</div>
              <div style={{ fontWeight: 600, marginTop: 2 }}>{form.department || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888' }}>Institute Email</div>
              <div style={{ fontWeight: 600, marginTop: 2, color: '#534AB7' }}>{form.email}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
