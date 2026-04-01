import React, { useState } from 'react';

function ApprovalCard({ approval, onApprove, onDeny }) {
    const [showDenyReason, setShowDenyReason] = useState(false);
    const [denyReason, setDenyReason] = useState('');

    const handleDeny = () => {
        if (denyReason.trim()) {
            onDeny(approval.id, denyReason);
            setShowDenyReason(false);
            setDenyReason('');
        } else {
            alert('Please enter a reason for denial');
        }
    };

    const timeAgo = (timestamp) => {
        const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
        if (seconds < 60) return `${seconds} seconds ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} minutes ago`;
        return `${Math.floor(minutes / 60)} hours ago`;
    };

    return (
        <div style={styles.card}>
            <div style={styles.header}>
                <span style={styles.time}>{timeAgo(approval.timestamp)}</span>
                <span style={styles.flat}>Flat {approval.visiting_flat}</span>
            </div>
            
            <div style={styles.content}>
                <div style={styles.visitorInfo}>
                    <div style={styles.name}>{approval.visitor_name}</div>
                    <div style={styles.phone}>📱 {approval.visitor_phone}</div>
                    {approval.vehicle_number && (
                        <div style={styles.vehicle}>🚗 {approval.vehicle_number}</div>
                    )}
                    <div style={styles.purpose}>
                        <span style={styles.purposeLabel}>Purpose:</span> {approval.purpose}
                    </div>
                </div>
                
                {approval.visitor_photo_url && (
                    <div style={styles.photoContainer}>
                        <img 
                            src={approval.visitor_photo_url} 
                            alt="Visitor" 
                            style={styles.photo}
                        />
                    </div>
                )}
            </div>
            
            {!showDenyReason ? (
                <div style={styles.buttonGroup}>
                    <button 
                        onClick={() => onApprove(approval.id)} 
                        style={styles.approveBtn}
                    >
                        ✓ Approve
                    </button>
                    <button 
                        onClick={() => setShowDenyReason(true)} 
                        style={styles.denyBtn}
                    >
                        ✗ Deny
                    </button>
                </div>
            ) : (
                <div style={styles.denySection}>
                    <textarea
                        placeholder="Reason for denial..."
                        value={denyReason}
                        onChange={(e) => setDenyReason(e.target.value)}
                        style={styles.textarea}
                        rows="2"
                    />
                    <div style={styles.denyButtonGroup}>
                        <button onClick={handleDeny} style={styles.confirmDenyBtn}>
                            Confirm Deny
                        </button>
                        <button onClick={() => setShowDenyReason(false)} style={styles.cancelBtn}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    card: {
        background: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e0e0e0'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: '1px solid #f0f0f0'
    },
    time: {
        fontSize: 12,
        color: '#666'
    },
    flat: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#2a5298'
    },
    content: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    visitorInfo: {
        flex: 1
    },
    name: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4
    },
    phone: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4
    },
    vehicle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4
    },
    purpose: {
        fontSize: 14,
        color: '#666'
    },
    purposeLabel: {
        fontWeight: 'bold'
    },
    photoContainer: {
        marginLeft: 12
    },
    photo: {
        width: 60,
        height: 60,
        borderRadius: 30,
        objectFit: 'cover',
        border: '2px solid #2a5298'
    },
    buttonGroup: {
        display: 'flex',
        gap: 10,
        marginTop: 8
    },
    approveBtn: {
        flex: 1,
        padding: '10px',
        background: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    denyBtn: {
        flex: 1,
        padding: '10px',
        background: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    denySection: {
        marginTop: 12
    },
    textarea: {
        width: '100%',
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: 8,
        fontSize: 14,
        boxSizing: 'border-box',
        fontFamily: 'inherit'
    },
    denyButtonGroup: {
        display: 'flex',
        gap: 10,
        marginTop: 8
    },
    confirmDenyBtn: {
        flex: 1,
        padding: '8px',
        background: '#dc3545',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer'
    },
    cancelBtn: {
        flex: 1,
        padding: '8px',
        background: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer'
    }
};

export default ApprovalCard;