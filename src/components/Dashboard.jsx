import React, { useState, useEffect, useCallback } from 'react';
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
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    const apartment = user?.apartment;
    const apartmentId = apartment?.id;

    const showMessage = (msg, type = 'success') => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Fetch data function with better error handling
    const fetchData = useCallback(async () => {
        if (!apartmentId) {
            console.log('No apartmentId, skipping fetch');
            setLoading(false);
            setIsInitialized(true);
            return;
        }
        
        try {
            console.log(`🔄 Fetching data for apartment: ${apartment?.name} (${apartmentId})`);
            
            // Fetch entry logs
            const entriesRes = await axios.get(`${API_URL}/api/apartments/${apartmentId}/entry-logs?limit=200`);
            if (entriesRes.data.success) {
                const allLogs = entriesRes.data.logs || [];
                const activeEntries = allLogs.filter(log => !log.exit_time);
                
                const residents = activeEntries.filter(entry => entry.entry_type === 'resident');
                const visitors = activeEntries.filter(entry => entry.entry_type === 'visitor');
                
                setResidentsInside(residents);
                setVisitorsInside(visitors);
                console.log(`✅ Inside: ${residents.length} residents, ${visitors.length} visitors`);
            }

            // Fetch pending approvals
            const approvalsRes = await axios.get(`${API_URL}/api/apartments/${apartmentId}/pending-approvals`);
            if (approvalsRes.data.success) {
                setPendingApprovals(approvalsRes.data.approvals || []);
                console.log(`✅ Pending approvals: ${approvalsRes.data.approvals?.length || 0}`);
            }

            // Fetch stats
            const statsRes = await axios.get(`${API_URL}/api/apartments/${apartmentId}/stats`);
            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
                console.log(`✅ Stats:`, statsRes.data.stats);
            }

            setError('');
        } catch (err) {
            console.error('❌ Fetch error:', err);
            setError(err.message || 'Failed to connect to server');
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    }, [apartmentId, apartment?.name]);

    // Initial fetch on mount - only when apartmentId is available
    useEffect(() => {
        if (apartmentId) {
            fetchData();
        } else if (user?.user?.id) {
            // Wait for apartment data to load from parent
            console.log('Waiting for apartment data...');
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

    // Real-time subscription (only when apartmentId is available)
    useEffect(() => {
        if (!apartmentId) return;
        
        const channelName = `apartment-${apartmentId}-${Date.now()}`;
        
        const subscription = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'apartment_pending_approvals',
                    filter: `apartment_id=eq.${apartmentId}`
                },
                (payload) => {
                    console.log('🆕 NEW VISITOR!', payload.new);
                    setPendingApprovals(prev => [payload.new, ...prev]);
                    showMessage(`🔔 ${payload.new.visitor_name} for Flat ${payload.new.visiting_flat}`, 'info');
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'apartment_pending_approvals',
                    filter: `apartment_id=eq.${apartmentId}`
                },
                (payload) => {
                    console.log('🔄 Approval updated:', payload.new);
                    if (payload.new.status !== 'pending') {
                        setPendingApprovals(prev => prev.filter(p => p.id !== payload.new.id));
                        fetchData();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'apartment_entry_logs',
                    filter: `apartment_id=eq.${apartmentId}`
                },
                (payload) => {
                    console.log('🚪 ENTRY LOG DETECTED!', payload.new);
                    
                    if (payload.new.entry_type === 'resident') {
                        setResidentsInside(prev => {
                            const exists = prev.some(r => r.id === payload.new.id);
                            if (!exists) return [payload.new, ...prev];
                            return prev;
                        });
                        showMessage(`🏠 ${payload.new.person_name} entered`, 'info');
                    } else if (payload.new.entry_type === 'visitor') {
                        setVisitorsInside(prev => [payload.new, ...prev]);
                        showMessage(`👤 ${payload.new.person_name} entered`, 'info');
                    }
                    fetchData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'apartment_entry_logs',
                    filter: `apartment_id=eq.${apartmentId}`
                },
                (payload) => {
                    if (payload.new.exit_time) {
                        console.log('🚪 EXIT LOG DETECTED!', payload.new);
                        if (payload.new.entry_type === 'resident') {
                            setResidentsInside(prev => prev.filter(e => e.id !== payload.new.id));
                        } else {
                            setVisitorsInside(prev => prev.filter(e => e.id !== payload.new.id));
                        }
                        showMessage(`🚪 ${payload.new.person_name} exited`, 'info');
                        fetchData();
                    }
                }
            )
            .subscribe();

        return () => {
            console.log('Cleaning up subscription...');
            subscription.unsubscribe();
        };
    }, [apartmentId, fetchData]);

    // Handlers
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
                const response = await axios.post(`${API_URL}/api/apartments/${apartmentId}/exit`, {
                    entryLogId: entryId,
                    guardId: user?.guard?.id || 'guard-001'
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

    const handleVehicleVerify = async (vehicleNumber) => {
        try {
            const response = await axios.post(`${API_URL}/api/apartments/${apartmentId}/residents/verify-vehicle`, {
                vehicleNumber,
                guardId: user?.guard?.id || 'guard-001'
            });

            if (response.data.success) {
                showMessage(`✅ Welcome ${response.data.resident.name}!`, 'success');
                setShowVehicleModal(false);
                fetchData();
            }
        } catch (err) {
            showMessage(err.response?.data?.error || 'Vehicle not recognized', 'error');
        }
    };

    // Deny Modal Component
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
        title: { marginBottom: '16px', fontSize: '20px' },
        textarea: {
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '16px',
            fontFamily: 'inherit'
        },
        buttonGroup: { display: 'flex', gap: '10px' },
        confirmBtn: { flex: 1, padding: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
        cancelBtn: { flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }
    };

    // Vehicle Entry Modal Component
    const VehicleEntryModal = ({ onClose, onVerify }) => {
        const [vehicleNumber, setVehicleNumber] = useState('');
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState('');

        const handleVerify = async () => {
            if (!vehicleNumber.trim()) {
                setError('Please enter vehicle number');
                return;
            }
            setLoading(true);
            setError('');
            await onVerify(vehicleNumber);
            setLoading(false);
        };

        return (
            <div style={vehicleModalStyles.overlay} onClick={onClose}>
                <div style={vehicleModalStyles.modal} onClick={(e) => e.stopPropagation()}>
                    <h3 style={vehicleModalStyles.title}>🚗 Vehicle Entry</h3>
                    <p style={{ marginBottom: '15px', color: '#666' }}>Enter the vehicle number plate</p>
                    <input
                        type="text"
                        placeholder="e.g., KA-01-AB-1234"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                        style={vehicleModalStyles.input}
                        autoFocus
                    />
                    {error && <p style={vehicleModalStyles.errorText}>{error}</p>}
                    <div style={vehicleModalStyles.buttonGroup}>
                        <button onClick={handleVerify} disabled={loading} style={vehicleModalStyles.confirmBtn}>
                            {loading ? 'Verifying...' : '✓ Verify & Let In'}
                        </button>
                        <button onClick={onClose} style={vehicleModalStyles.cancelBtn}>Cancel</button>
                    </div>
                    <p style={vehicleModalStyles.hint}>💡 Format: KA01AB1234 or KA-01-AB-1234</p>
                </div>
            </div>
        );
    };

    const vehicleModalStyles = {
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
        title: { marginBottom: '16px', fontSize: '20px', color: '#333' },
        input: {
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: '16px',
            marginBottom: '10px',
            fontFamily: 'monospace'
        },
        errorText: { color: '#dc3545', fontSize: '12px', marginBottom: '10px' },
        hint: { fontSize: '11px', color: '#999', marginTop: '10px', textAlign: 'center' },
        buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
        confirmBtn: { flex: 1, padding: '10px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
        cancelBtn: { flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }
    };

    // Loading state
    if (loading || !isInitialized) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Loading dashboard...</p>
                <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.7 }}>Verifying access...</p>
            </div>
        );
    }

    // No apartment assigned
    if (!apartment && !loading && isInitialized) {
        return (
            <div style={styles.errorContainer}>
                <div style={styles.errorIcon}>🚫</div>
                <h2>Access Denied</h2>
                <p>You have not been assigned to any apartment.</p>
                <p>Please contact your administrator.</p>
                <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
            </div>
        );
    }

    const totalInside = residentsInside.length + visitorsInside.length;

    return (
        <div style={styles.container}>
            {/* Apartment Header */}
            <div style={styles.apartmentHeader}>
                <div style={styles.apartmentIcon}>🏘️</div>
                <div style={styles.apartmentInfo}>
                    <h2 style={styles.apartmentName}>{apartment.name}</h2>
                    <p style={styles.apartmentAddress}>{apartment.address || 'No address provided'}</p>
                    <p style={styles.apartmentGuard}>👮 Guard: {user?.guard?.name || 'Security Guard'}</p>
                </div>
            </div>

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
                    <p style={styles.subtitle}>Welcome, {user?.guard?.name || user?.user?.email?.split('@')[0] || 'Guard'}</p>
                </div>
                <button onClick={onLogout} style={styles.logoutBtn}>Logout</button>
            </div>

            {error && (
                <div style={styles.errorBanner}>
                    ⚠️ {error}
                    <button onClick={() => fetchData()} style={{ marginLeft: '10px', padding: '4px 8px', background: 'white', color: '#721c24', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Retry
                    </button>
                </div>
            )}

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

            <div style={styles.buttonRow}>
                <button onClick={() => setShowScanner(true)} style={styles.scanBtn}>
                    📷 Scan QR Code
                </button>
                <button onClick={() => setShowVehicleModal(true)} style={styles.vehicleBtn}>
                    🚗 Vehicle Number Plate
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
                                <div style={styles.time}>⏰ {new Date(approval.created_at).toLocaleString()}</div>
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

            {/* Residents Inside Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>🏠 Residents Inside ({residentsInside.length})</h2>
                {residentsInside.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>🏠</div>
                        <p>No residents currently inside</p>
                    </div>
                ) : (
                    residentsInside.map(entry => (
                        <div key={entry.id} style={styles.residentCard}>
                            <div style={styles.visitorInfo}>
                                <div style={styles.name}>🏠 {entry.person_name || 'Unknown'}</div>
                                <div style={styles.flat}>Flat {entry.flat_number}</div>
                                {entry.vehicle_number && <div style={styles.vehicle}>🚗 {entry.vehicle_number}</div>}
                                <div style={styles.time}>Entered: {new Date(entry.entry_time).toLocaleTimeString()}</div>
                            </div>
                            <button onClick={() => handleExit(entry.id, 'resident')} style={styles.exitBtn}>🚪 Mark Exit</button>
                        </div>
                    ))
                )}
            </div>

            {/* Visitors Inside Section */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>👤 Visitors Inside ({visitorsInside.length})</h2>
                {visitorsInside.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>👤</div>
                        <p>No visitors currently inside</p>
                    </div>
                ) : (
                    visitorsInside.map(entry => (
                        <div key={entry.id} style={styles.visitorCard}>
                            <div style={styles.visitorInfo}>
                                <div style={styles.name}>👤 {entry.person_name || 'Unknown'}</div>
                                <div style={styles.phone}>📱 {entry.person_phone || 'N/A'}</div>
                                <div style={styles.flat}>🏠 Flat {entry.flat_number}</div>
                                {entry.purpose && <div style={styles.purpose}>📦 Purpose: {entry.purpose}</div>}
                                <div style={styles.time}>Entered: {new Date(entry.entry_time).toLocaleTimeString()}</div>
                            </div>
                            <button onClick={() => handleExit(entry.id, 'visitor')} style={styles.exitBtn}>🚪 Mark Exit</button>
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

            {showVehicleModal && (
                <VehicleEntryModal 
                    onClose={() => setShowVehicleModal(false)}
                    onVerify={handleVehicleVerify}
                />
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
    apartmentHeader: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px',
        borderRadius: '16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    },
    apartmentIcon: { fontSize: '48px' },
    apartmentInfo: { flex: 1 },
    apartmentName: { margin: 0, fontSize: '20px', fontWeight: 'bold' },
    apartmentAddress: { margin: '5px 0 0', fontSize: '12px', opacity: 0.9 },
    apartmentGuard: { margin: '8px 0 0', fontSize: '12px', opacity: 0.8 },
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
    errorBanner: { 
        background: '#f8d7da', 
        color: '#721c24', 
        padding: '10px', 
        borderRadius: '8px', 
        marginBottom: '15px', 
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
    },
    errorContainer: { textAlign: 'center', padding: '50px', background: 'white', borderRadius: '16px', margin: '50px auto', maxWidth: '400px' },
    errorIcon: { fontSize: '64px', marginBottom: '20px' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '20px' },
    statCard: { background: 'linear-gradient(135deg, #2a5298 0%, #1e3c72 100%)', color: 'white', padding: '15px', borderRadius: '12px', textAlign: 'center' },
    statValue: { fontSize: '28px', fontWeight: 'bold' },
    statLabel: { fontSize: '12px', opacity: 0.9 },
    buttonRow: { display: 'flex', gap: '12px', marginBottom: '20px' },
    scanBtn: { flex: 1, padding: '15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
    vehicleBtn: { flex: 1, padding: '15px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
    section: { marginBottom: '25px' },
    sectionTitle: { fontSize: '18px', marginBottom: '15px', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' },
    badge: { background: '#dc3545', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '12px' },
    card: { background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e0e0e0' },
    residentCard: { background: '#e8f0fe', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #c5d5f0' },
    visitorCard: { background: '#fff3e0', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #ffe0b3' },
    visitorInfo: { marginBottom: '12px' },
    name: { fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '4px' },
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