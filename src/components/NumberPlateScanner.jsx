import React, { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';

function NumberPlateScanner({ onScan, onClose }) {
    const [image, setImage] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [detectedPlate, setDetectedPlate] = useState('');
    const [error, setError] = useState('');
    const [manualPlate, setManualPlate] = useState('');
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    // Start camera
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }
        } catch (err) {
            setError('Unable to access camera. Please check permissions.');
        }
    };

    // Capture photo from video
    const captureImage = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0);
            const imageData = canvasRef.current.toDataURL('image/jpeg');
            setImage(imageData);
            return imageData;
        }
        return null;
    };

    // Process image to extract number plate
    const processImage = async () => {
        const capturedImage = captureImage();
        if (!capturedImage) return;

        setProcessing(true);
        setError('');

        try {
            // Stop camera stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            // Extract text from image using Tesseract.js
            const result = await Tesseract.recognize(capturedImage, 'eng', {
                logger: (m) => console.log(m),
            });

            const text = result.data.text;
            console.log('Detected text:', text);

            // Look for number plate pattern (Indian format)
            const patterns = [
                /[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}/i,
                /[A-Z]{2}-[0-9]{1,2}-[A-Z]{1,2}-[0-9]{4}/i,
                /[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,2}[-\s]?[0-9]{4}/i
            ];

            let plateNumber = null;
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    plateNumber = match[0].toUpperCase().replace(/[-\s]/g, '');
                    break;
                }
            }

            if (plateNumber) {
                setDetectedPlate(plateNumber);
                setTimeout(() => {
                    onScan(plateNumber);
                }, 1000);
            } else {
                setError('Could not detect number plate. Please try again or enter manually.');
                setProcessing(false);
            }
        } catch (err) {
            console.error('OCR Error:', err);
            setError('Failed to process image. Please try again.');
            setProcessing(false);
        }
    };

    const handleManualVerify = () => {
        if (manualPlate.trim()) {
            onScan(manualPlate.trim().toUpperCase());
        } else {
            setError('Please enter a vehicle number');
        }
    };

    const retakePhoto = () => {
        setImage(null);
        setDetectedPlate('');
        setError('');
        setManualPlate('');
        startCamera();
    };

    useEffect(() => {
        startCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content scanner-modal" onClick={e => e.stopPropagation()}>
                <h3>🚗 Scan Number Plate</h3>
                
                {!image && !processing && (
                    <div className="camera-preview">
                        <video ref={videoRef} autoPlay playsInline className="camera-video" />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <button onClick={processImage} className="btn-capture">📸 Capture & Detect</button>
                    </div>
                )}

                {processing && (
                    <div className="processing-container">
                        <div className="spinner-small"></div>
                        <p>Processing image...</p>
                    </div>
                )}

                {image && !processing && !detectedPlate && (
                    <div className="result-container">
                        <img src={image} alt="Captured" className="captured-image" />
                        <div className="manual-entry">
                            <p>Could not detect automatically. Please enter manually:</p>
                            <input 
                                type="text" 
                                placeholder="Enter vehicle number" 
                                value={manualPlate} 
                                onChange={(e) => setManualPlate(e.target.value.toUpperCase())}
                                autoFocus
                            />
                            <div className="modal-buttons">
                                <button onClick={handleManualVerify} className="btn-primary">Verify</button>
                                <button onClick={retakePhoto} className="btn-secondary">Retake Photo</button>
                            </div>
                        </div>
                    </div>
                )}

                {detectedPlate && (
                    <div className="result-container">
                        <img src={image} alt="Captured" className="captured-image" />
                        <div className="detected-plate">
                            <p>✅ Detected: <strong>{detectedPlate}</strong></p>
                            <p>Verifying...</p>
                        </div>
                    </div>
                )}

                {error && <p className="error-text">{error}</p>}

                <div className="modal-buttons">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                </div>
            </div>
        </div>
    );
}

export default NumberPlateScanner;