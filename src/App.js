import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
    const [session, setSession] = useState(null);
    const [guardData, setGuardData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                fetchGuardData(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                fetchGuardData(session.user.id);
            } else {
                setGuardData(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchGuardData = async (userId) => {
        const { data, error } = await supabase
            .from('guards')
            .select('*')
            .eq('id', userId)
            .single();

        if (!error && data) {
            setGuardData(data);
        }
        setLoading(false);
    };

    const handleLogin = (userData) => {
        setSession(userData.user);
        setGuardData(userData.guard);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setSession(null);
        setGuardData(null);
    };

    if (loading) {
        return <div className="loading-container"><div className="spinner"></div><p>Loading...</p></div>;
    }

    if (!session) {
        return <Login onLogin={handleLogin} />;
    }

    return <Dashboard user={{ user: session.user, guard: guardData }} onLogout={handleLogout} />;
}

export default App;