import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
    const [session, setSession] = useState(null);
    const [guardData, setGuardData] = useState(null);
    const [apartment, setApartment] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('1️⃣ useEffect STARTED');
        
        const initializeAuth = async () => {
            console.log('2️⃣ initializeAuth STARTED');
            
            try {
                console.log('3️⃣ Calling supabase.auth.getSession()...');
                
                // Add a timeout to detect hanging
                const timeoutId = setTimeout(() => {
                    console.error('🔴 WARNING: getSession() is taking more than 5 seconds!');
                }, 5000);
                
                const { data, error } = await supabase.auth.getSession();
                
                clearTimeout(timeoutId);
                
                console.log('4️⃣ getSession() COMPLETED');
                console.log('   - Has session?', !!data.session);
                console.log('   - Error?', error);
                
                if (error) {
                    console.error('Session error:', error);
                    setLoading(false);
                    return;
                }

                if (data.session) {
                    console.log('5️⃣ Session found for:', data.session.user.email);
                    setSession(data.session);
                    console.log('6️⃣ Calling fetchGuardData...');
                    await fetchGuardData(data.session.user.id);
                } else {
                    console.log('5️⃣ No session found');
                    setLoading(false);
                }
                
            } catch (err) {
                console.error('❌ initializeAuth caught error:', err);
                setLoading(false);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            console.log('🔄 Auth state changed:', event);
        });

        return () => {
            console.log('🧹 Cleaning up subscription');
            subscription.unsubscribe();
        };
    }, []);

    const fetchGuardData = async (userId) => {
        console.log('7️⃣ fetchGuardData STARTED for:', userId);
        
        try {
            console.log('8️⃣ Querying apartment_guards table...');
            
            const { data, error } = await supabase
                .from('apartment_guards')
                .select(`
                    *,
                    apartments:apartment_id (
                        id,
                        name,
                        address
                    )
                `)
                .eq('auth_user_id', userId)
                .maybeSingle();

            console.log('9️⃣ Query COMPLETED');
            console.log('   - Data found?', !!data);
            console.log('   - Error?', error);

            if (error) {
                console.error('Guard fetch error:', error);
                setGuardData(null);
                setApartment(null);
            } else if (data) {
                console.log('✅ Guard found:', data.name);
                console.log('🏢 Apartment:', data.apartments?.name);
                setGuardData(data);
                setApartment(data.apartments);
            } else {
                console.log('⚠️ No guard record found for this user');
                setGuardData(null);
                setApartment(null);
            }
        } catch (err) {
            console.error('❌ fetchGuardData error:', err);
            setGuardData(null);
            setApartment(null);
        } finally {
            console.log('🔟 Setting loading to FALSE');
            setLoading(false);
        }
    };

    const handleLogin = (userData) => {
        console.log('🔑 Login handler called');
        setSession(userData.user);
        setGuardData(userData.guard);
        setApartment(userData.apartment);
    };

    const handleLogout = async () => {
        console.log('🚪 Logout called');
        await supabase.auth.signOut();
        setSession(null);
        setGuardData(null);
        setApartment(null);
    };

    console.log('🔄 App rendering, loading =', loading);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading...</p>
                <p style={{ fontSize: '12px', marginTop: '10px' }}>Check console (F12) for logs</p>
            </div>
        );
    }

    if (!session) {
        return <Login onLogin={handleLogin} />;
    }

    if (session && !guardData && !loading) {
        return (
            <div style={styles.errorContainer}>
                <h2>⚠️ Access Denied</h2>
                <p>You are logged in but not registered as a security guard.</p>
                <p>Email: {session.user?.email}</p>
                <button onClick={handleLogout} style={styles.button}>Go Back</button>
            </div>
        );
    }

    return <Dashboard user={{ user: session.user, guard: guardData, apartment: apartment }} onLogout={handleLogout} />;
}

const styles = {
    errorContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        color: 'white',
        textAlign: 'center',
        padding: '20px'
    },
    button: {
        marginTop: '20px',
        padding: '12px 24px',
        background: '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer'
    }
};

export default App;