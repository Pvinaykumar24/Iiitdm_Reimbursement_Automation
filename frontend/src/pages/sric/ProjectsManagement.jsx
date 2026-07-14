import { useEffect, useState } from 'react';
import { projectsApi } from '../../api';

const DEFAULT_NEW_PROJECT = {
  project_no: '',
  title: '',
  funding_agency: '',
  pi_employee_id: '',
  total_budget: ''
};

export default function ProjectsManagement() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  // Assign PI Modal
  const [editingProject, setEditingProject] = useState(null);
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Create Project Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjForm, setNewProjForm] = useState({ ...DEFAULT_NEW_PROJECT });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [faculties, setFaculties] = useState([]);

  const fetchProjects = () => {
    setLoading(true);
    projectsApi.getAll()
      .then(res => {
        setProjects(res.data);
        setError('');
      })
      .catch(err => {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to fetch projects');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
    projectsApi.getFaculties()
      .then(res => setFaculties(res.data))
      .catch(err => console.error('Failed to load faculties list:', err));
  }, []);

  const openAssignModal = (proj) => {
    setEditingProject(proj);
    setEmployeeIdInput(proj.pi_employee_id || '');
    setSaveError('');
    setSaveLoading(false);
  };

  const closeAssignModal = () => {
    setEditingProject(null);
    setEmployeeIdInput('');
    setSaveError('');
  };

  const handleSaveAssignment = (e) => {
    e.preventDefault();
    if (!editingProject) return;
    setSaveLoading(true);
    setSaveError('');

    projectsApi.assignPI(editingProject.id, employeeIdInput)
      .then(() => {
        fetchProjects();
        closeAssignModal();
      })
      .catch(err => {
        console.error(err);
        setSaveError(err.response?.data?.message || 'Failed to update assignment');
      })
      .finally(() => setSaveLoading(false));
  };

  // Create Project Actions
  const openCreateModal = () => {
    setNewProjForm({
      project_no: '',
      title: '',
      funding_agency: '',
      pi_employee_id: '',
      total_budget: ''
    });
    setCreateError('');
    setCreateLoading(false);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateError('');
  };

  const handleCreateProject = (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    const payload = {
      project_no: newProjForm.project_no.trim(),
      title: newProjForm.title.trim(),
      funding_agency: newProjForm.funding_agency.trim(),
      pi_employee_id: newProjForm.pi_employee_id.trim() || null,
      total_budget: parseFloat(newProjForm.total_budget || 0)
    };

    projectsApi.create(payload)
      .then(() => {
        fetchProjects();
        closeCreateModal();
      })
      .catch(err => {
        console.error(err);
        setCreateError(err.response?.data?.message || 'Failed to create project');
      })
      .finally(() => setCreateLoading(false));
  };

  const filteredProjects = projects.filter(p => {
    const q = search.toLowerCase();
    return (
      p.project_no.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q) ||
      (p.pi_name && p.pi_name.toLowerCase().includes(q)) ||
      (p.pi_employee_id && p.pi_employee_id.toLowerCase().includes(q))
    );
  });

  const assignedCount = projects.filter(p => p.pi_id).length;
  const unassignedCount = projects.filter(p => !p.pi_id).length;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Projects Database</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={openCreateModal}
            style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 6, height: 38, padding: '0 16px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="ti ti-plus" style={{ fontSize: 14 }} />
            Add New Project
          </button>
          <div style={{ position: 'relative', width: 280 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input
              type="text"
              placeholder="Search projects, PI, Employee ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34, background: '#fff', border: '1px solid #d4d4d0', borderRadius: 6, height: 38, outline: 'none', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <i className="ti ti-alert-circle" /> {error}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat-card" style={{ background: '#fafaf9' }}>
          <div className="stat-label">Total Projects</div>
          <div className="stat-value" style={{ color: '#3C3489' }}>{projects.length}</div>
        </div>
        <div className="stat-card" style={{ background: '#fafaf9' }}>
          <div className="stat-label">Assigned Projects</div>
          <div className="stat-value" style={{ color: '#27500A' }}>{assignedCount}</div>
        </div>
        <div className="stat-card" style={{ background: '#fafaf9' }}>
          <div className="stat-label">Unassigned Projects</div>
          <div className="stat-value" style={{ color: '#791F1F' }}>{unassignedCount}</div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="empty-state">
            <i className="ti ti-folder-off" />
            No projects found matching the criteria.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Project code</th>
                <th style={{ width: '35%' }}>Project title</th>
                <th style={{ width: '20%' }}>Assigned PI</th>
                <th style={{ width: '15%' }}>Funding Agency</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Total Budget</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500, color: '#534AB7' }}>{p.project_no}</td>
                  <td style={{ fontSize: 12, lineHeight: 1.4 }}>{p.title}</td>
                  <td>
                    {p.pi_id ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{p.pi_name}</span>
                        <span style={{ fontSize: 11, color: '#888', marginTop: 2 }}>ID: {p.pi_employee_id}</span>
                      </div>
                    ) : (
                      <span style={{ fontStyle: 'italic', color: '#c53030', fontWeight: 500, fontSize: 11 }}>
                        Unassigned / No PI
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{p.funding_agency}</td>
                  <td style={{ fontWeight: 500, textAlign: 'right' }}>
                    ₹{parseFloat(p.total_budget || 0).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openAssignModal(p)}
                      style={{ fontSize: 11 }}
                    >
                      Assign / Edit PI
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modern PI Assignment Modal */}
      {editingProject && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, fontFamily: 'system-ui'
        }}>
          <div className="card" style={{ width: 440, padding: 24, borderRadius: 10, background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>Assign PI Faculty</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#666', lineHeight: 1.4 }}>
              Assign a Principal Investigator (PI) to the project <strong>{editingProject.project_no}</strong>.
            </p>

            <form onSubmit={handleSaveAssignment}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 6, fontSize: '12px', fontWeight: 500 }}>
                  PI Employee ID (Faculty ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. FAC001"
                  list="employee-ids"
                  value={employeeIdInput}
                  onChange={e => setEmployeeIdInput(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d4d4d0', borderRadius: 6, fontSize: '13px' }}
                  disabled={saveLoading}
                />
                <span style={{ fontSize: '11px', color: '#888', display: 'block', marginTop: 4 }}>
                  Enter the employee ID of the faculty member. Leave blank to unassign.
                </span>
              </div>

              {saveError && (
                <div className="alert alert-error" style={{ padding: '8px 12px', fontSize: 12, marginBottom: 16 }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} /> {saveError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f0f0ee', paddingTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={closeAssignModal}
                  disabled={saveLoading}
                >
                  Cancel
                </button>
                {editingProject.pi_id && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#791F1F', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                    onClick={() => {
                      setEmployeeIdInput('');
                      setSaveError('');
                      setSaveLoading(true);
                      projectsApi.assignPI(editingProject.id, '')
                        .then(() => {
                          fetchProjects();
                          closeAssignModal();
                        })
                        .catch(err => {
                          console.error(err);
                          setSaveError(err.response?.data?.message || 'Failed to unassign');
                        })
                        .finally(() => setSaveLoading(false));
                    }}
                    disabled={saveLoading}
                  >
                    Unassign PI
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                  disabled={saveLoading}
                >
                  {saveLoading ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Project Modal */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, fontFamily: 'system-ui',
          overflowY: 'auto', padding: '40px 0'
        }}>
          <div className="card" style={{ width: 560, padding: 24, borderRadius: 10, background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', margin: 'auto' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>Create New Research Project</h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#666', lineHeight: 1.4 }}>
              Fill in the project parameters and assign the Principal Investigator.
            </p>

            <form onSubmit={handleCreateProject}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '12px', fontWeight: 500 }}>
                    Project Code / Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DST/2024/001"
                    value={newProjForm.project_no}
                    onChange={e => setNewProjForm({ ...newProjForm, project_no: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d4d4d0', borderRadius: 6, fontSize: '13px' }}
                    disabled={createLoading}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '12px', fontWeight: 500 }}>
                    Funding Agency *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DST, SERB, DRDO"
                    value={newProjForm.funding_agency}
                    onChange={e => setNewProjForm({ ...newProjForm, funding_agency: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d4d4d0', borderRadius: 6, fontSize: '13px' }}
                    disabled={createLoading}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '12px', fontWeight: 500 }}>
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Development of High-Performance Robotics Actuators"
                  value={newProjForm.title}
                  onChange={e => setNewProjForm({ ...newProjForm, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d4d4d0', borderRadius: 6, fontSize: '13px' }}
                  disabled={createLoading}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '12px', fontWeight: 500 }}>
                    PI Employee ID (Faculty ID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FAC001"
                    list="employee-ids"
                    value={newProjForm.pi_employee_id}
                    onChange={e => setNewProjForm({ ...newProjForm, pi_employee_id: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d4d4d0', borderRadius: 6, fontSize: '13px' }}
                    disabled={createLoading}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: 4, fontSize: '12px', fontWeight: 500 }}>
                    Total Budget Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="e.g. 500000"
                    value={newProjForm.total_budget}
                    onChange={e => setNewProjForm({ ...newProjForm, total_budget: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d4d4d0', borderRadius: 6, fontSize: '13px' }}
                    disabled={createLoading}
                  />
                </div>
              </div>

              {createError && (
                <div className="alert alert-error" style={{ padding: '8px 12px', fontSize: 12, marginBottom: 16 }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} /> {createError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #f0f0ee', paddingTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={closeCreateModal}
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#534AB7', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
                  disabled={createLoading}
                >
                  {createLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <datalist id="employee-ids">
        {faculties.map(f => (
          <option key={f.id} value={f.employee_id}>
            {f.employee_id} — {f.name} ({f.department})
          </option>
        ))}
      </datalist>
    </>
  );
}
