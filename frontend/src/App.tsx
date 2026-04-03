import { } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from 'antd'
import HomePage from './pages/HomePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
// SettingsPage removed from import
import ShortsPage from './pages/ShortsPage'
import ProcessingPage from './pages/ProcessingPage'
import Header from './components/Header'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'

const { Content } = Layout

function App() {
  console.log('🎬 App component loaded');
  
  return (
    <Layout>
      <Header />
      <Content>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          
          <Route path="/project/:id" element={
            <ProtectedRoute>
              <ProjectDetailPage />
            </ProtectedRoute>
          } />
          
          <Route path="/shorts" element={
            <ProtectedRoute>
              <ShortsPage />
            </ProtectedRoute>
          } />

          <Route path="/processing/:id" element={
            <ProtectedRoute>
              <ProcessingPage />
            </ProtectedRoute>
          } />
          
          {/* Settings Route Removed from production completely securely */}
        </Routes>
      </Content>
    </Layout>
  )
}

export default App