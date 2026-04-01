import React, { useState } from 'react';
import { supabase } from '../services/supabase';

function Login({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) throw signInError;

            const { data: guardData } = await supabase
                .from('guards')
                .select('*')
                .eq('id', data.user.id)
                .single();

            onLogin({
                user: data.user,
                guard: guardData
            });

        } catch (err) {
            setError(err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.logo}>👮</div>
                <h1 style={styles.title}>Security Guard Login</h1>
                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={styles.input}
                        required
                    />
                    {error && <p style={styles.error}>{error}</p>}
                    <button type="submit" style={styles.button} disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        margin: 0,
        padding: 20
    },
    card: {
        background: 'white',
        padding: 40,
        borderRadius: 20,
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: 400,
        textAlign: 'center'
    },
    logo: {
        fontSize: 48,
        marginBottom: 20
    },
    title: {
        marginBottom: 30,
        color: '#333',
        fontSize: 24
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        marginBottom: 15,
        border: '1px solid #ddd',
        borderRadius: 10,
        fontSize: 16,
        boxSizing: 'border-box'
    },
    button: {
        width: '100%',
        padding: '12px',
        background: '#2a5298',
        color: 'white',
        border: 'none',
        borderRadius: 10,
        fontSize: 16,
        cursor: 'pointer',
        fontWeight: 'bold'
    },
    error: {
        color: 'red',
        textAlign: 'center',
        marginBottom: 15,
        fontSize: 14
    }
};

export default Login;