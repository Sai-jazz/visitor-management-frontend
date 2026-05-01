import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase } from '../services/supabase';
import QRScanner from './QRScanner';
import NumberPlateScanner from './NumberPlateScanner';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function Dashboard({ user, onLogout }) {
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [residentsInside, setResidentsInside] = useState([]);
    const [visitorsInside, setVisitorsInside] = useState([]);
    const [regularVisitors, setRegularVisitors] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [stats, setStats] = useState({
        activeInside: 0,
        todayEntries: 0,
        pendingApprovals: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [showDenyModal, setShowDenyModal] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const [showPlateScanner, setShowPlateScanner] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [selectedVisitor, setSelectedVisitor] = useState(null);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [isInitialized, setIsInitialized] = useState(false);

    const apartment = user?.apartment;
    const apartmentId = apartment?.id;

    const showMessage = (msg, type = 'success') => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const fetchData = useCallback(async () => {
        if (!apartmentId) {
            setLoading(false);
            setIsInitialized(true);
            return;
        }
        
        try {
            console.log(`🔄 Fetching data for apartment: ${apartment?.name}`);
            
            // Fetch pending approvals
            const approvalsRes = await axios.get(`${API_URL}/api/apartments/${apartmentId}/pending-approvals`);
            if (approvalsRes.data.success) {
                setPendingApprovals(approvalsRes.data.approvals || []);
            }

            // Fetch entry logs
            const entriesRes = await axios.get(`${API_URL}/api/apartments/${apartmentId}/entry-logs?limit=200`);
            if (entriesRes.data.success) {
                const allLogs = entriesRes.data.logs || [];
                const activeEntries = allLogs.filter(log => !log.exit_time);
                
                const residents = activeEntries.filter(entry => entry.entry_type === 'resident');
                const visitors = activeEntries.filter(entry => entry.entry_type === 'visitor');
                
                setResidentsInside(residents);
                setVisitorsInside(visitors);
            }

            // Fetch regular visitors
            const regularRes = await axios.get(`${API_URL}/api/apartments/${apartmentId}/regular-visitors`);
            if (regularRes.data.success) {
                setRegularVisitors(regularRes.data.visitors || []);
            }

            // Fetch stats
            const statsRes = await axios.get(`${API_URL}/api/apartments/${apartmentId}/stats`);
            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
            }

            setError('');
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    }, [apartmentId, apartment?.name]);

    const searchRegularVisitor = async () => {
        if (!searchTerm.trim()) {
            setSearchResults([]);
            return;
        }
        
        try {
            const response = await axios.get(`${API_URL}/api/apartments/${apartmentId}/regular-visitors/search?q=${encodeURIComponent(searchTerm)}`);
            if (response.data.success) {
                setSearchResults(response.data.visitors);
            }
        } catch (err) {
            console.error('Search error:', err);
            showMessage('Search failed', 'error');
        }
    };

    const verifyRegularVisitor = async (visitor) => {
        try {
            const response = await axios.post(`${API_URL}/api/apartments/${apartmentId}/regular-visitors/verify`, {
                visitorId: visitor.id,
                guardId: user?.guard?.id || 'guard-001'
            });
            if (response.data.success) {
                showMessage(`✅ ${visitor.name} verified! Entry granted.`);
                setSearchTerm('');
                setSearchResults([]);
                fetchData();
            }
        } catch (err) {
            showMessage(err.response?.data?.error || 'Verification failed', 'error');
        }
    };

    const handlePlateScan = async (plateNumber) => {
        try {
            const response = await axios.post(`${API_URL}/api/apartments/${apartmentId}/residents/verify-vehicle`, {
                vehicleNumber: plateNumber,
                guardId: user?.guard?.id || 'guard-001'
            });
            if (response.data.success) {
                showMessage(`✅ Welcome ${response.data.resident.name}! (${plateNumber})`);
                setShowPlateScanner(false);
                fetchData();
            }
        } catch (err) {
            showMessage(err.response?.data?.error || 'Vehicle not recognized', 'error');
        }
    };

    const handleCheckout = async (entryId) => {
        try {
            const response = await axios.post(`${API_URL}/api/apartments/${apartmentId}/exit`, {
                entryLogId: entryId,
                guardId: user?.guard?.id || 'guard-001'
            });
            if (response.data.success) {
                showMessage('🚪 Exit logged successfully');
                setShowCheckoutModal(false);
                setSelectedVisitor(null);
                fetchData();
            }
        } catch (err) {
            showMessage('Failed to log exit', 'error');
        }
    };

    const handleApprove = async (approvalId) => {
        setProcessingId(approvalId);
        try {
            const response = await axios.post(`${API_URL}/api/apartments/${apartmentId}/approvals/${approvalId}/process`, {
                action: 'approve',
                guardId: user?.guard?.id || 'guard-001'
            });
            if (response.data.success) {
                setPendingApprovals(prev => prev.filter(p => p.id !== approvalId));
                showMessage('✅ Visitor approved!');
                fetchData();
            }
        } catch (err) {
            showMessage('Failed to approve', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeny = async (approvalId, reason) => {
        setProcessingId(approvalId);
        try {
            const response = await axios.post(`${API_URL}/api/apartments/${apartmentId}/approvals/${approvalId}/process`, {
                action: 'deny',
                guardId: user?.guard?.id || 'guard-001',
                notes: reason
            });
            if (response.data.success) {
                setPendingApprovals(prev => prev.filter(p => p.id !== approvalId));
                setShowDenyModal(null);
                showMessage('❌ Visitor denied');
                fetchData();
            }
        } catch (err) {
            showMessage('Failed to deny', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleQRScan = async (qrData) => {
        try {
            const response = await axios.post(`${API_URL}/api/apartments/${apartmentId}/residents/verify-qr`, {
                qrData,
                guardId: user?.guard?.id || 'guard-001'
            });
            if (response.data.success) {
                showMessage(`✅ Welcome ${response.data.resident.name}!`);
                fetchData();
            }
        } catch (err) {
            showMessage(err.response?.data?.error || 'Invalid QR code', 'error');
        } finally {
            setShowScanner(false);
        }
    };

    useEffect(() => {
        if (apartmentId) {
            fetchData();
        } else if (user?.user?.id) {
            const timer = setTimeout(() => {
                if (!apartmentId && !isInitialized) {
                    setError('No apartment assigned. Please contact administrator.');
                    setLoading(false);
                    setIsInitialized(true);
                }
            }, 3000);
            return () => clearTimeout(timer);
        } else {
            setLoading(false);
            setIsInitialized(true);
        }
    }, [apartmentId, fetchData, user?.user?.id, isInitialized]);

    useEffect(() => {
        if (!apartmentId) return;
        
        const subscription = supabase
            .channel(`apartment-${apartmentId}`)
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'apartment_pending_approvals', filter: `apartment_id=eq.${apartmentId}` },
                (payload) => {
                    setPendingApprovals(prev => [payload.new, ...prev]);
                    showMessage(`🔔 ${payload.new.visitor_name} for Flat ${payload.new.visiting_flat}`, 'info');
                }
            )
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'apartment_entry_logs', filter: `apartment_id=eq.${apartmentId}` },
                () => fetchData()
            )
            .subscribe();

        return () => subscription.unsubscribe();
    }, [apartmentId]);

    const DenyModal = ({ approval, onClose, onConfirm }) => {
        const [reason, setReason] = useState('');
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <h3>Deny Visitor</h3>
                    <p><strong>{approval.visitor_name}</strong> - Flat {approval.visiting_flat}</p>
                    <textarea placeholder="Reason for denial..." value={reason} onChange={e => setReason(e.target.value)} rows="3" />
                    <div className="modal-buttons">
                        <button className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn-danger" onClick={() => reason.trim() && onConfirm(approval.id, reason)}>Confirm Deny</button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading || !isInitialized) {
        return <div className="loading-container"><div className="spinner"></div><p>Loading...</p></div>;
    }

    if (!apartment) {
        return (
            <div className="error-container">
                <h2>Access Denied</h2>
                <p>You have not been assigned to any apartment.</p>
                <button onClick={onLogout} className="btn-logout">Logout</button>
            </div>
        );
    }

    const totalInside = residentsInside.length + visitorsInside.length;

    return (
        <div className="guard-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div className="apartment-badge">
                    <span className="apartment-icon">🏘️</span>
                    <div>
                        <h2>{apartment.name}</h2>
                        <p>{apartment.address}</p>
                    </div>
                </div>
                <button onClick={onLogout} className="btn-logout">Logout</button>
            </div>

            {/* Toast */}
            {toastMessage && <div className={`toast ${toastMessage.type}`}>{toastMessage.msg}</div>}

            {/* Stats Cards */}
            <div className="stats-row">
                <div className="stat-card"><span className="stat-value">{pendingApprovals.length}</span><span className="stat-label">Pending</span></div>
                <div className="stat-card"><span className="stat-value">{totalInside}</span><span className="stat-label">Total Inside</span></div>
                <div className="stat-card"><span className="stat-value">{stats.todayEntries}</span><span className="stat-label">Today's Entries</span></div>
            </div>

            {/* Action Buttons */}
            <div className="action-row">
                <button onClick={() => setShowScanner(true)} className="btn-scan">📷 Scan QR Code</button>
                <button onClick={() => setShowPlateScanner(true)} className="btn-vehicle">🚗 Scan Number Plate</button>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>Pending Approvals</button>
                <button className={`tab ${activeTab === 'inside' ? 'active' : ''}`} onClick={() => setActiveTab('inside')}>Currently Inside</button>
                <button className={`tab ${activeTab === 'regular' ? 'active' : ''}`} onClick={() => setActiveTab('regular')}>Regular Visitors</button>
            </div>

            {/* Pending Approvals Tab */}
            {activeTab === 'pending' && (
                <div className="tab-content">
                    {pendingApprovals.length === 0 ? (
                        <div className="empty-state">No pending approvals</div>
                    ) : (
                        pendingApprovals.map(approval => (
                            <div key={approval.id} className="approval-card">
                                <div className="approval-info">
                                    <h4>{approval.visitor_name}</h4>
                                    <p>📱 {approval.visitor_phone}</p>
                                    <p>🏠 Flat {approval.visiting_flat}</p>
                                    <p>📦 {approval.purpose}</p>
                                    {approval.vehicle_number && <p>🚗 {approval.vehicle_number}</p>}
                                </div>
                                <div className="approval-actions">
                                    <button onClick={() => handleApprove(approval.id)} disabled={processingId === approval.id} className="btn-approve">Approve</button>
                                    <button onClick={() => setShowDenyModal(approval)} disabled={processingId === approval.id} className="btn-deny">Deny</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Currently Inside Tab */}
            {activeTab === 'inside' && (
                <div className="tab-content">
                    {totalInside === 0 ? (
                        <div className="empty-state">No one inside</div>
                    ) : (
                        <>
                            {/* Residents Inside */}
                            {residentsInside.length > 0 && (
                                <div className="sub-section">
                                    <h3 className="sub-title">🏠 Residents ({residentsInside.length})</h3>
                                    {residentsInside.map(entry => (
                                        <div key={entry.id} className="visitor-card">
                                            <div className="visitor-info">
                                                <h4>{entry.person_name}</h4>
                                                <p>🏠 Flat {entry.flat_number}</p>
                                                {entry.vehicle_number && <p>🚗 {entry.vehicle_number}</p>}
                                                <p>⏰ Entered: {new Date(entry.entry_time).toLocaleTimeString()}</p>
                                            </div>
                                            <button onClick={() => { setSelectedVisitor(entry); setShowCheckoutModal(true); }} className="btn-exit">Exit</button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Visitors Inside */}
                            {visitorsInside.length > 0 && (
                                <div className="sub-section">
                                    <h3 className="sub-title">👤 Visitors ({visitorsInside.length})</h3>
                                    {visitorsInside.map(visitor => (
                                        <div key={visitor.id} className="visitor-card">
                                            <div className="visitor-info">
                                                <h4>{visitor.person_name}</h4>
                                                <p>📱 {visitor.person_phone || 'N/A'}</p>
                                                <p>🏠 Flat {visitor.flat_number}</p>
                                                {visitor.purpose && <p>📦 Purpose: {visitor.purpose}</p>}
                                                <p>⏰ Entered: {new Date(visitor.entry_time).toLocaleTimeString()}</p>
                                            </div>
                                            <button onClick={() => { setSelectedVisitor(visitor); setShowCheckoutModal(true); }} className="btn-exit">Exit</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Regular Visitors Tab */}
            {activeTab === 'regular' && (
                <div className="tab-content">
                    <div className="search-section">
                        <input type="text" placeholder="Search by name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <button onClick={searchRegularVisitor} className="btn-search">Search</button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="search-results">
                            <h3 className="sub-title">Search Results</h3>
                            {searchResults.map(visitor => (
                                <div key={visitor.id} className="visitor-card">
                                    <div className="visitor-info">
                                        <h4>{visitor.name}</h4>
                                        <p>📱 {visitor.phone}</p>
                                        {visitor.purpose && <p>📦 Purpose: {visitor.purpose}</p>}
                                        {visitor.days?.length > 0 && <p>📅 Days: {visitor.days.join(', ')}</p>}
                                        {visitor.visit_time && <p>⏰ Time: {visitor.visit_time}</p>}
                                        <p>🔄 Total visits: {visitor.total_visits || 0}</p>
                                    </div>
                                    <button onClick={() => verifyRegularVisitor(visitor)} className="btn-verify">Verify & Let In</button>
                                </div>
                            ))}
                        </div>
                    )}
                    {searchTerm && searchResults.length === 0 && <div className="empty-state">No regular visitors found</div>}
                    {!searchTerm && (
                        <div className="regular-list">
                            <h3 className="sub-title">All Regular Visitors</h3>
                            {regularVisitors.length === 0 ? (
                                <div className="empty-state">No regular visitors added yet</div>
                            ) : (
                                regularVisitors.map(visitor => (
                                    <div key={visitor.id} className="visitor-card">
                                        <div className="visitor-info">
                                            <h4>{visitor.name}</h4>
                                            <p>📱 {visitor.phone}</p>
                                            {visitor.purpose && <p>📦 Purpose: {visitor.purpose}</p>}
                                            {visitor.days?.length > 0 && <p>📅 Days: {visitor.days.join(', ')}</p>}
                                            {visitor.visit_time && <p>⏰ Time: {visitor.visit_time}</p>}
                                        </div>
                                        <button onClick={() => verifyRegularVisitor(visitor)} className="btn-verify">Verify & Let In</button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* QR Scanner Modal */}
            {showScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />}

            {/* Number Plate Scanner Modal */}
            {showPlateScanner && <NumberPlateScanner onScan={handlePlateScan} onClose={() => setShowPlateScanner(false)} />}

            {/* Checkout Modal */}
            {showCheckoutModal && selectedVisitor && (
                <div className="modal-overlay" onClick={() => setShowCheckoutModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>Confirm Exit</h3>
                        <p>Mark <strong>{selectedVisitor.person_name}</strong> as exited?</p>
                        <div className="modal-buttons">
                            <button className="btn-secondary" onClick={() => setShowCheckoutModal(false)}>Cancel</button>
                            <button className="btn-primary" onClick={() => handleCheckout(selectedVisitor.id)}>Confirm Exit</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deny Modal */}
            {showDenyModal && <DenyModal approval={showDenyModal} onClose={() => setShowDenyModal(null)} onConfirm={handleDeny} />}
        </div>
    );
}

export default Dashboard;