import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../services/supabase';
import QRScanner from './QRScanner';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function Dashboard({ user, onLogout }) {
    const [pendingApprovals, setPendingApprovals] = useState([]);
    const [residentsInside, setResidentsInside] = useState([]);
    const [visitorsInside, setVisitorsInside] = useState([]);
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
    const [toastMessage, setToastMessage] = useState(null);

    const showMessage = (msg, type = 'success') => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const fetchData = async () => {
        try {
            // Fetch pending approvals
            const approvalsRes = await axios.get(`${API_URL}/api/pending-approvals`);
            if (approvalsRes.data.success) {
                setPendingApprovals(approvalsRes.data.approvals || []);
                console.log(`📋 Loaded ${approvalsRes.data.approvals?.length || 0} pending approvals`);
            }

            // Fetch entry logs
            const entriesRes = await axios.get(`${API_URL}/api/entry-logs?limit=100`);
            if (entriesRes.data.success) {
                const activeEntries = (entriesRes.data.logs || []).filter(log => !log.exit_time);
                
                // SEPARATE: Residents (entry_type = 'resident')
                const residents = activeEntries.filter(entry => entry.entry_type === 'resident');
                setResidentsInside(residents);
                
                // SEPARATE: Visitors (entry_type = 'visitor' or 'regular_visitor')
                const visitors = activeEntries.filter(entry => entry.entry_type === 'visitor' || entry.entry_type === 'regular_visitor');
                setVisitorsInside(visitors);
                
                console.log(`✅ Inside: ${residents.length} residents, ${visitors.length} visitors`);
            }

            // Fetch stats
            const statsRes = await axios.get(`${API_URL}/api/stats`);
            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
            }

            setError('');
        } catch (err) {
            console.error('Fetch error:', err);
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    // Real-time subscription
    useEffect(() => {
        fetchData();

        const subscription = supabase
            .channel('pending-approvals-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'pending_approvals'
                },
                (payload) => {
                    console.log('🆕 NEW VISITOR!', payload.new);
                    setPendingApprovals(prev => [payload.new, ...prev]);
                    showMessage(`🔔 ${payload.new.visitor_name} for Flat ${payload.new.visiting_flat}`, 'info');
                    
                    const audio = new Audio('/notification.mp3');
                    audio.play().catch(e => console.log('Audio not supported'));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'entry_logs'
                },
                (payload) => {
                    console.log('🚪 New entry logged:', payload.new);
                    if (payload.new.entry_type === 'resident') {
                        setResidentsInside(prev => [...prev, payload.new]);
                        showMessage(`🏠 Resident entered: ${payload.new.resident_name || 'Unknown'}`, 'info');
                    } else {
                        setVisitorsInside(prev => [...prev, payload.new]);
                        showMessage(`👤 Visitor entered: ${payload.new.visitor_name}`, 'info');
                    }
                    fetchData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'entry_logs',
                    filter: 'exit_time=not.is.null'
                },
                (payload) => {
                    console.log('🚪 Exit logged:', payload.new);
                    // Remove from appropriate list
                    if (payload.new.entry_type === 'resident') {
                        setResidentsInside(prev => prev.filter(e => e.id !== payload.new.id));
                    } else {
                        setVisitorsInside(prev => prev.filter(e => e.id !== payload.new.id));
                    }
                    fetchData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'pending_approvals'
                },
                (payload) => {
                    console.log('🔄 Approval updated:', payload.new);
                    if (payload.new.status !== 'pending') {
                        setPendingApprovals(prev => prev.filter(p => p.id !== payload.new.id));
                        if (payload.new.status === 'approved') {
                            showMessage(`✅ ${payload.new.visitor_name} approved!`, 'success');
                        } else if (payload.new.status === 'denied') {
                            showMessage(`❌ ${payload.new.visitor_name} denied`, 'error');
                        }
                        fetchData();
                    }
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleApprove = async (approvalId) => {
        setProcessingId(approvalId);
        try {
            const response = await axios.post(`${API_URL}/api/approvals/${approvalId}/process`, {
                action: 'approve',
                guardId: user?.user?.id || 'guard-001'
            });

            if (response.data.success) {
                setPendingApprovals(prev => prev.filter(p => p.id !== approvalId));
                showMessage('✅ Visitor approved!');
                fetchData();
            } else {
                showMessage('❌ Approval failed', 'error');
            }
        } catch (err) {
            console.error('Approval error:', err);
            showMessage(err.response?.data?.error || 'Failed to approve', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleDeny = async (approvalId, reason) => {
        setProcessingId(approvalId);
        try {
            const response = await axios.post(`${API_URL}/api/approvals/${approvalId}/process`, {
                action: 'deny',
                guardId: user?.user?.id || 'guard-001',
                notes: reason
            });

            if (response.data.success) {
                setPendingApprovals(prev => prev.filter(p => p.id !== approvalId));
                setShowDenyModal(null);
                showMessage('❌ Visitor denied');
                fetchData();
            } else {
                showMessage('Failed to deny', 'error');
            }
        } catch (err) {
            console.error('Deny error:', err);
            showMessage(err.response?.data?.error || 'Failed to deny', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleExit = async (entryId, entryType) => {
        if (window.confirm('Mark this person as exited?')) {
            try {
                const response = await axios.post(`${API_URL}/api/exit`, {
                    entryLogId: entryId,
                    guardId: user?.user?.id || 'guard-001'
                });

                if (response.data.success) {
                    if (entryType === 'resident') {
                        setResidentsInside(prev => prev.filter(e => e.id !== entryId));
                    } else {
                        setVisitorsInside(prev => prev.filter(e => e.id !== entryId));
                    }
                    showMessage('🚪 Exit logged');
                    fetchData();
                }
            } catch (err) {
                console.error('Exit error:', err);
                showMessage('Failed to log exit', 'error');
            }
        }
    };

    const handleQRScan = async (qrData) => {
        try {
            const response = await axios.post(`${API_URL}/api/residents/verify`, {
                qrData,
                guardId: user?.user?.id || 'guard-001'
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

    const DenyModal = ({ approval, onClose, onConfirm }) => {
        const [reason, setReason] = useState('');

        return (
            <div style={modalStyles.overlay} onClick={onClose}>
                <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
                    <h3 style={modalStyles.title}>Deny Visitor</h3>
                    <p><strong>{approval.visitor_name}</strong></p>
                    <p>Flat: <strong>{approval.visiting_flat}</strong></p>
                    <textarea
                        placeholder="Reason for denial..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        style={modalStyles.textarea}
                        rows="3"
                        autoFocus
                    />
                    <div style={modalStyles.buttonGroup}>
                        <button 
                            onClick={() => reason.trim() ? onConfirm(approval.id, reason) : alert('Please enter a reason')}
                            style={modalStyles.confirmBtn}
                        >
                            Confirm Deny
                        </button>
                        <button onClick={onClose} style={modalStyles.cancelBtn}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const modalStyles = {
        overlay: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        },
        modal: {
            background: 'white',
            padding: '24px',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '90%'
        },
        title: {
            marginBottom: '16px',
            fontSize: '20px'
        },
        textarea: {
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '16px',
            fontFamily: 'inherit'
        },
        buttonGroup: {
            display: 'flex',
            gap: '10px'
        },
        confirmBtn: {
            flex: 1,
            padding: '10px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
        },
        cancelBtn: {
            flex: 1,
            padding: '10px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
        }
    };

    const getUserName = () => {
        if (user?.guard?.name) return user.guard.name;
        if (user?.user?.email) return user.user.email.split('@')[0];
        return 'Guard';
    };

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    const totalInside = residentsInside.length + visitorsInside.length;

    return (
        <div style={styles.container}>
            {toastMessage && (
                <div style={{
                    ...styles.toast,
                    background: toastMessage.type === 'error' ? '#dc3545' : 
                               toastMessage.type === 'info' ? '#17a2b8' : '#28a745'
                }}>
                    {toastMessage.msg}
                </div>
            )}

            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <h1 style={styles.title}>👮 Security Dashboard</h1>
                    <p style={styles.subtitle}>Welcome, {getUserName()}</p>
                </div>
                <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
            </div>

            {error && <div style={styles.errorBanner}>⚠️ {error}</div>}

            <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>{pendingApprovals.length}</div>
                    <div style={styles.statLabel}>Pending Approvals</div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>{totalInside}</div>
                    <div style={styles.statLabel}>Total Inside</div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>{stats.todayEntries}</div>
                    <div style={styles.statLabel}>Today's Entries</div>
                </div>
            </div>

            <div style={styles.actionButtons}>
                <button onClick={() => setShowScanner(true)} style={styles.scanBtn}>
                    📷 Scan Resident QR
                </button>
            </div>

            {/* Pending Approvals Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    🕐 Pending Visitor Requests 
                    {pendingApprovals.length > 0 && <span style={styles.badge}>{pendingApprovals.length}</span>}
                </h2>
                
                {pendingApprovals.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>📭</div>
                        <p>No pending visitor requests</p>
                    </div>
                ) : (
                    pendingApprovals.map(approval => (
                        <div key={approval.id} style={styles.card}>
                            <div style={styles.visitorInfo}>
                                <div style={styles.name}>{approval.visitor_name}</div>
                                <div style={styles.phone}>📱 {approval.visitor_phone}</div>
                                <div style={styles.flat}>🏠 Flat {approval.visiting_flat}</div>
                                <div style={styles.purpose}>📦 Purpose: {approval.purpose}</div>
                                {approval.vehicle_number && <div style={styles.vehicle}>🚗 {approval.vehicle_number}</div>}
                                <div style={styles.time}>⏰ {new Date(approval.timestamp).toLocaleString()}</div>
                            </div>
                            <div style={styles.buttonGroup}>
                                <button 
                                    onClick={() => handleApprove(approval.id)}
                                    disabled={processingId === approval.id}
                                    style={styles.approveBtn}
                                >
                                    {processingId === approval.id ? '...' : '✓ Approve'}
                                </button>
                                <button 
                                    onClick={() => setShowDenyModal(approval)}
                                    disabled={processingId === approval.id}
                                    style={styles.denyBtn}
                                >
                                    ✗ Deny
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* RESIDENTS INSIDE SECTION - People who scanned QR */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    🏠 Residents Inside ({residentsInside.length})
                    <span style={styles.sectionBadge}>QR Entry</span>
                </h2>
                {residentsInside.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>🏠</div>
                        <p>No residents currently inside</p>
                    </div>
                ) : (
                    residentsInside.map(entry => (
                        <div key={entry.id} style={styles.residentCard}>
                            <div style={styles.visitorInfo}>
                                <div style={styles.name}>
                                    <span style={styles.residentIcon}>🏠</span> {entry.resident_name || 'Unknown'}
                                </div>
                                <div style={styles.flat}>Flat {entry.visiting_flat}</div>
                                <div style={styles.time}>Entered: {new Date(entry.timestamp).toLocaleTimeString()}</div>
                            </div>
                            <button 
                                onClick={() => handleExit(entry.id, 'resident')}
                                style={styles.exitBtn}
                            >
                                🚪 Mark Exit
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* VISITORS INSIDE SECTION - People who filled form */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>
                    👤 Visitors Inside ({visitorsInside.length})
                    <span style={styles.sectionBadgeVisitor}>Form Entry</span>
                </h2>
                {visitorsInside.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>👤</div>
                        <p>No visitors currently inside</p>
                    </div>
                ) : (
                    visitorsInside.map(entry => (
                        <div key={entry.id} style={styles.visitorCard}>
                            <div style={styles.visitorInfo}>
                                <div style={styles.name}>
                                    <span style={styles.visitorIcon}>👤</span> {entry.visitor_name || 'Unknown'}
                                </div>
                                <div style={styles.phone}>📱 {entry.visitor_phone || 'N/A'}</div>
                                <div style={styles.flat}>🏠 Flat {entry.visiting_flat}</div>
                                {entry.purpose && <div style={styles.purpose}>📦 Purpose: {entry.purpose}</div>}
                                <div style={styles.time}>Entered: {new Date(entry.timestamp).toLocaleTimeString()}</div>
                            </div>
                            <button 
                                onClick={() => handleExit(entry.id, 'visitor')}
                                style={styles.exitBtn}
                            >
                                🚪 Mark Exit
                            </button>
                        </div>
                    ))
                )}
            </div>

            {showDenyModal && (
                <DenyModal
                    approval={showDenyModal}
                    onClose={() => setShowDenyModal(null)}
                    onConfirm={handleDeny}
                />
            )}

            {showScanner && (
                <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
            )}
        </div>
    );
}

const styles = {
    container: {
        maxWidth: 700,
        margin: '0 auto',
        padding: '20px',
        paddingBottom: '40px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    },
    toast: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        color: 'white',
        zIndex: 2000,
        animation: 'slideIn 0.3s ease'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
    },
    headerLeft: { flex: 1 },
    title: { margin: 0, fontSize: '24px', color: '#333' },
    subtitle: { margin: '5px 0 0', fontSize: '14px', color: '#666' },
    logoutBtn: { padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
    errorBanner: { background: '#f8d7da', color: '#721c24', padding: '10px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '20px' },
    statCard: { background: 'linear-gradient(135deg, #2a5298 0%, #1e3c72 100%)', color: 'white', padding: '15px', borderRadius: '12px', textAlign: 'center' },
    statValue: { fontSize: '28px', fontWeight: 'bold' },
    statLabel: { fontSize: '12px', opacity: 0.9 },
    actionButtons: { marginBottom: '20px' },
    scanBtn: { width: '100%', padding: '15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
    section: { marginBottom: '25px' },
    sectionTitle: { fontSize: '18px', marginBottom: '15px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' },
    sectionBadge: { background: '#2a5298', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 'normal' },
    sectionBadgeVisitor: { background: '#17a2b8', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 'normal' },
    badge: { background: '#dc3545', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '12px' },
    card: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' },
    residentCard: { background: '#e8f0fe', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #c5d5f0' },
    visitorCard: { background: '#fff3e0', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #ffe0b3' },
    visitorInfo: { marginBottom: '12px' },
    name: { fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '4px' },
    residentIcon: { fontSize: '16px', marginRight: '6px' },
    visitorIcon: { fontSize: '16px', marginRight: '6px' },
    phone: { fontSize: '14px', color: '#666', marginBottom: '2px' },
    flat: { fontSize: '14px', color: '#666', marginBottom: '2px' },
    purpose: { fontSize: '14px', color: '#666', marginBottom: '2px' },
    vehicle: { fontSize: '14px', color: '#666', marginBottom: '2px' },
    time: { fontSize: '12px', color: '#999', marginTop: '4px' },
    buttonGroup: { display: 'flex', gap: '10px', marginTop: '8px' },
    approveBtn: { flex: 1, padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' },
    denyBtn: { flex: 1, padding: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' },
    exitBtn: { width: '100%', padding: '8px', background: '#ffc107', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
    emptyState: { textAlign: 'center', padding: '30px', background: '#f8f9fa', borderRadius: '12px', color: '#666' },
    emptyIcon: { fontSize: '40px', marginBottom: '10px' },
    loadingContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)', color: 'white' },
    spinner: { width: '50px', height: '50px', border: '4px solid rgba(255,255,255,0.3)', borderTop: '4px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '15px' }
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
`;
document.head.appendChild(styleSheet);

export default Dashboard;