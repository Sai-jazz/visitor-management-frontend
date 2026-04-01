import React from 'react';

function ActiveEntries({ entries, onExit }) {
    const timeInside = (timestamp) => {
        const minutes = Math.floor((new Date() - new Date(timestamp)) / 60000);
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        return `${hours} hr ${minutes % 60} min`;
    };

    const getTypeIcon = (type) => {
        switch(type) {
            case 'resident': return '🏠';
            case 'regular_visitor': return '⭐';
            default: return '👤';
        }
    };

    if (entries.length === 0) {
        return (
            <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>🏢</div>
                <p>No one currently inside</p>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {entries.map(entry => (
                <div key={entry.id} style={styles.entryCard}>
                    <div style={styles.entryHeader}>
                        <span style={styles.typeIcon}>{getTypeIcon(entry.entry_type)}</span>
                        <span style={styles.entryName}>
                            {entry.visitor_name || entry.resident_name || 'Unknown'}
                        </span>
                        <span style={styles.timeBadge}>
                            {timeInside(entry.timestamp)} inside
                        </span>
                    </div>
                    <div style={styles.entryDetails}>
                        <div>Flat: {entry.visiting_flat}</div>
                        {entry.purpose && <div>Purpose: {entry.purpose}</div>}
                        {entry.vehicle_number && <div>Vehicle: {entry.vehicle_number}</div>}
                    </div>
                    <button 
                        onClick={() => onExit(entry.id)}
                        style={styles.exitBtn}
                    >
                        🚪 Mark Exit
                    </button>
                </div>
            ))}
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    entryCard: {
        background: '#f8f9fa',
        borderRadius: '10px',
        padding: '12px',
        border: '1px solid #e0e0e0'
    },
    entryHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '8px',
        flexWrap: 'wrap'
    },
    typeIcon: {
        fontSize: '20px'
    },
    entryName: {
        fontWeight: 'bold',
        fontSize: '16px',
        color: '#333'
    },
    timeBadge: {
        background: '#e9ecef',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        color: '#666'
    },
    entryDetails: {
        fontSize: '13px',
        color: '#666',
        marginBottom: '10px',
        paddingLeft: '30px'
    },
    exitBtn: {
        width: '100%',
        padding: '8px',
        background: '#ffc107',
        color: '#333',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold'
    },
    emptyState: {
        textAlign: 'center',
        padding: '30px',
        color: '#666'
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: '10px'
    }
};

export default ActiveEntries;