import React, { useRef, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function QRScanner({ onScan, onClose }) {
    const scannerRef = useRef(null);

    useEffect(() => {
        if (scannerRef.current === null) {
            const scanner = new Html5QrcodeScanner(
                "qr-reader",
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true,
                },
                false
            );

            scanner.render(
                (decodedText) => {
                    scanner.clear();
                    onScan(decodedText);
                },
                (err) => {
                    // Silently ignore scanning errors (no QR found yet)
                    console.log("Scanning...");
                }
            );

            scannerRef.current = scanner;
        }

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear();
                scannerRef.current = null;
            }
        };
    }, [onScan]);

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3 style={styles.headerTitle}>Scan QR Code</h3>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>
                <div style={styles.scannerContainer}>
                    <div id="qr-reader" style={{ width: '100%' }}></div>
                </div>
                <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.9)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modal: {
        background: 'white',
        borderRadius: 20,
        width: '90%',
        maxWidth: 500,
        overflow: 'hidden'
    },
    header: {
        padding: '15px 20px',
        background: '#2a5298',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    headerTitle: {
        margin: 0,
        color: 'white'
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        fontSize: 24,
        cursor: 'pointer',
        color: 'white'
    },
    scannerContainer: {
        padding: 20,
        background: '#000'
    },
    cancelBtn: {
        width: '100%',
        padding: 12,
        background: '#f0f0f0',
        border: 'none',
        fontSize: 16,
        cursor: 'pointer',
        fontWeight: 'bold'
    }
};

export default QRScanner;