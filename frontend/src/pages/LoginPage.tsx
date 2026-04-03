import React, { useState } from 'react';
import { Layout, Typography, Input, Button, Card, message } from 'antd';
import { LockOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleLogin = async () => {
    if (!password) {
      message.error('Please enter the team password');
      return;
    }

    setLoading(true);
    try {
      // In a production setup, this should hit an API.
      // For now, we are hitting the /api/v1/auth/login endpoint
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('teamToken', data.access_token);
        message.success('Welcome back to AutoClip!');
        navigate(from, { replace: true });
      } else {
        const errorData = await response.json();
        message.error(errorData.detail || 'Incorrect password');
      }
    } catch (error) {
      console.error('Login failed:', error);
      message.error('Failed to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Content 
      style={{ 
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background decorations */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '10%',
        width: '300px',
        height: '300px',
        background: 'rgba(79, 172, 254, 0.1)',
        filter: 'blur(100px)',
        borderRadius: '50%'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '10%',
        width: '400px',
        height: '400px',
        background: 'rgba(0, 242, 254, 0.05)',
        filter: 'blur(120px)',
        borderRadius: '50%'
      }} />

      <Card 
        bordered={false}
        style={{
          width: 400,
          background: 'rgba(26, 26, 26, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          padding: '24px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 32px rgba(79, 172, 254, 0.4)',
          transform: 'rotate(-5deg)'
        }}>
          <TeamOutlined style={{ fontSize: '32px', color: '#fff' }} />
        </div>

        <Title level={2} style={{ color: '#fff', marginBottom: '8px', fontSize: '28px', fontWeight: 700 }}>
          Team Access
        </Title>
        <Text style={{ color: '#aaa', display: 'block', marginBottom: '32px', fontSize: '15px' }}>
          Enter the secure team password to continue
        </Text>

        <Input.Password
          size="large"
          placeholder="Enter Team Password"
          prefix={<LockOutlined style={{ color: '#4facfe', marginRight: '8px' }} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={handleLogin}
          style={{
            height: '50px',
            borderRadius: '12px',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff',
            marginBottom: '24px',
            fontSize: '16px'
          }}
        />

        <Button
          type="primary"
          size="large"
          block
          loading={loading}
          onClick={handleLogin}
          style={{
            height: '50px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            border: 'none',
            fontSize: '16px',
            fontWeight: 600,
            boxShadow: '0 4px 15px rgba(79, 172, 254, 0.4)'
          }}
        >
          Secure Auth Login
        </Button>
      </Card>
    </Content>
  );
};

export default LoginPage;
