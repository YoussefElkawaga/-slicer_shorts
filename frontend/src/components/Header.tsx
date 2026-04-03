import React from 'react'
import { Layout, Button } from 'antd'
import { SettingOutlined, HomeOutlined, ScissorOutlined, DashboardOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'

const { Header: AntHeader } = Layout

const Header: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  return (
    <AntHeader 
      className="glass-effect"
      style={{ 
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '72px',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backdropFilter: 'blur(20px)',
        background: 'rgba(26, 26, 26, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}
    >
      {/* Logo */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onClick={() => navigate('/')}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        <span
          style={{
            fontSize: '24px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            letterSpacing: '-0.5px',
            textShadow: '0 0 20px rgba(79, 172, 254, 0.3)',
            filter: 'drop-shadow(0 2px 4px rgba(79, 172, 254, 0.2))'
          }}
        >
          Video Slicer
        </span>
      </div>
      
      {/* Navigation Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {!isHomePage && (
          <Button 
            type="primary"
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              border: 'none',
              borderRadius: '8px',
              height: '40px',
              padding: '0 20px',
              fontWeight: 500,
              boxShadow: '0 2px 8px rgba(79, 172, 254, 0.3)'
            }}
          >
            Home
          </Button>
        )}
        
        <Button 
          type="primary"
          icon={<ScissorOutlined />}
          onClick={() => navigate('/shorts')}
          style={{
            background: location.pathname === '/shorts'
              ? 'linear-gradient(135deg, #667eea, #764ba2)'
              : 'rgba(102, 126, 234, 0.15)',
            border: location.pathname === '/shorts'
              ? 'none'
              : '1px solid rgba(102, 126, 234, 0.3)',
            borderRadius: '8px',
            height: '40px',
            padding: '0 20px',
            fontWeight: 600,
            color: '#fff',
            boxShadow: location.pathname === '/shorts'
              ? '0 2px 12px rgba(102, 126, 234, 0.4)'
              : 'none'
          }}
        >
          AI Shorts
        </Button>
        
        <Button 
          type="primary"
          icon={<DashboardOutlined />}
          onClick={() => navigate('/status')}
          style={{
            background: location.pathname === '/status'
              ? 'linear-gradient(135deg, #52c41a, #73d13d)'
              : 'rgba(82, 196, 26, 0.15)',
            border: location.pathname === '/status'
              ? 'none'
              : '1px solid rgba(82, 196, 26, 0.3)',
            borderRadius: '8px',
            height: '40px',
            padding: '0 20px',
            fontWeight: 600,
            color: '#fff',
            boxShadow: location.pathname === '/status'
              ? '0 2px 12px rgba(82, 196, 26, 0.4)'
              : 'none'
          }}
        >
          Status
        </Button>
        
        {/* Settings button removed to hide it in deploy */}
        
        {/* Logout Button */}
        <Button 
          type="text" 
          onClick={() => {
            localStorage.removeItem('teamToken')
            window.location.href = '/login'
          }}
          style={{
            color: '#ff4d4f',
            border: '1px solid transparent',
            borderRadius: '8px',
            height: '40px',
            padding: '0 16px',
            fontWeight: 500
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 77, 79, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          Logout
        </Button>
      </div>
    </AntHeader>
  )
}

export default Header