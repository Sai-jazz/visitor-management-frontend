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
        // Check for existing session on page load
        const initializeAuth = async () => {
            try {
                // Get current session
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
                
                if (sessionError) {
                    console.error('Session error:', sessionError);
                    setLoading(false);
                    return;
                }
                
                if (currentSession) {
                    console.log('✅ Found existing session for user:', currentSession.user.email);
                    setSession(currentSession);
                    await fetchGuardData(currentSession.user.id);
                } else {
                    console.log('No existing session found');
                    setLoading(false);
                }
            } catch (err) {
                console.error('Auth initialization error:', err);
                setLoading(false);
            }
        };

        initializeAuth();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            console.log('Auth state changed:', _event, newSession?.user?.email);
            setSession(newSession);
            
            if (newSession) {
                await fetchGuardData(newSession.user.id);
            } else {
                setGuardData(null);
                setApartment(null);
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchGuardData = async (userId) => {
        try {
            console.log('Fetching guard data for user:', userId);
            
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
                .single();

            if (error) {
                console.error('Error fetching guard data:', error);
                setGuardData(null);
                setApartment(null);
            } else if (data) {
                console.log('✅ Guard data loaded:', {
                    name: data.name,
                    apartment: data.apartments?.name
                });
                setGuardData(data);
                setApartment(data.apartments);
            } else {
                console.log('No guard data found for user');
                setGuardData(null);
                setApartment(null);
            }
        } catch (err) {
            console.error('Fetch guard data error:', err);
            setGuardData(null);
            setApartment(null);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (userData) => {
        setSession(userData.user);
        setGuardData(userData.guard);
        setApartment(userData.apartment);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setGuardData(null);
        setApartment(null);
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!session) {
        return <Login onLogin={handleLogin} />;
    }

    return <Dashboard user={{ user: session.user, guard: guardData, apartment: apartment }} onLogout={handleLogout} />;
}

export default App;