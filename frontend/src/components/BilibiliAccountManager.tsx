import React, { useState, useEffect } from 'react'
import { Card, Button, Modal, Form, Input, Table, Tag, Space, message, Popconfirm, Tabs, Alert, Typography, Divider, Tooltip, Statistic } from 'antd'
import { PlusOutlined, DeleteOutlined, UserOutlined, CheckCircleOutlined, CloseCircleOutlined, QrcodeOutlined, ExclamationCircleOutlined, QuestionCircleOutlined, HeartOutlined, TrophyOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import { uploadApi, BilibiliAccount } from '../services/uploadApi'
import CookieHelper from './CookieHelper'
import AccountHealthMonitor from './AccountHealthMonitor'

const { TextArea } = Input
const { Text, Paragraph } = Typography
const { TabPane } = Tabs


interface AccountHealth {
  score: number
  status: 'excellent' | 'good' | 'warning' | 'poor'
  lastActive: string
  uploadCount: number
  successRate: number
}

const BilibiliAccountManager: React.FC = () => {
  const [accounts, setAccounts] = useState<BilibiliAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  const [activeTab, setActiveTab] = useState('cookie')
  const [cookieHelperVisible, setCookieHelperVisible] = useState(false)
  const [accountsHealth, setAccountsHealth] = useState<Record<string, AccountHealth>>({})
  const [refreshing, setRefreshing] = useState(false)
  
  // Form states
  const [passwordForm] = Form.useForm()
  const [cookieForm] = Form.useForm()
  const [qrSessionId, setQrSessionId] = useState<string>('')
  const [qrLoginStatus, setQrLoginStatus] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [statusCheckInterval, setStatusCheckInterval] = useState<number | null>(null)

  // Get account list
  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const data = await uploadApi.getAccounts()
      setAccounts(data)
      // Also get account health status
      await fetchAccountsHealth(data)
    } catch (error: any) {
      message.error('Failed to get account list: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Get account health status
  const fetchAccountsHealth = async (accountList?: BilibiliAccount[]) => {
    try {
      const targetAccounts = accountList || accounts
      const healthData: Record<string, AccountHealth> = {}
      
      for (const account of targetAccounts) {
        // Mock health status, should be fetched from API in real app
        const score = Math.floor(Math.random() * 40) + 60 // 60-100 score
        const uploadCount = Math.floor(Math.random() * 50) + 10
        const successRate = Math.floor(Math.random() * 30) + 70
        
        let status: AccountHealth['status'] = 'good'
        if (score >= 90) status = 'excellent'
        else if (score >= 75) status = 'good'
        else if (score >= 60) status = 'warning'
        else status = 'poor'
        
        healthData[account.id] = {
          score,
          status,
          lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          uploadCount,
          successRate
        }
      }
      
      setAccountsHealth(healthData)
    } catch (error: any) {
      console.error('Failed to get account health status:', error)
    }
  }

  // Refresh account health status
  const refreshAccountsHealth = async () => {
    try {
      setRefreshing(true)
      await fetchAccountsHealth()
      message.success('Health status refreshed')
    } catch (error: any) {
      message.error('Refresh failed: ' + (error.message || 'Unknown error'))
    } finally {
      setRefreshing(false)
    }
  }



  useEffect(() => {
    fetchAccounts()
    
    // Clear interval
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval)
      }
    }
  }, [])

  // Password login
  const handlePasswordLogin = async (values: any) => {
    try {
      setLoading(true)
      await uploadApi.passwordLogin(values.username, values.password, values.nickname)
      message.success('Password login successful!')
      setModalVisible(false)
      passwordForm.resetFields()
      fetchAccounts()
    } catch (error: any) {
      message.error('Password login failed: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Cookie import login
  const handleCookieLogin = async (values: any) => {
    try {
      setLoading(true)
      
      // Parse cookie string
      const cookieStr = values.cookies.trim()
      const cookies: Record<string, string> = {}
      
      cookieStr.split(';').forEach((cookie: string) => {
        const [key, value] = cookie.trim().split('=')
        if (key && value) {
          cookies[key] = value
        }
      })
      
      if (Object.keys(cookies).length === 0) {
        message.error('Invalid cookie format, please check your input')
        return
      }
      
      await uploadApi.cookieLogin(cookies, values.nickname)
      message.success('Cookie import successful!')
      setModalVisible(false)
      cookieForm.resetFields()
      fetchAccounts()
    } catch (error: any) {
      message.error('Cookie import failed: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Start QR login
  const startQRLogin = async (nickname?: string) => {
    try {
      setLoading(true)
      
      // Clear previous polling
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval)
        setStatusCheckInterval(null)
      }
      
      const response = await uploadApi.startQRLogin(nickname)
      setQrSessionId(response.session_id)
      setQrLoginStatus(response.status)
      
      // Start polling login status
      let pollCount = 0
      const maxPolls = 60
      
      const interval = setInterval(async () => {
        try {
          pollCount++
          if (pollCount > maxPolls) {
            message.error('QR login timeout, please try again')
            setQrSessionId('')
            setQrLoginStatus('')
            setQrCodeUrl('')
            clearInterval(interval)
            return
          }
          
          const statusResponse = await uploadApi.checkQRLoginStatus(response.session_id)
          setQrLoginStatus(statusResponse.status)
          
          if (statusResponse.qr_code) {
            setQrCodeUrl(statusResponse.qr_code)
          }
          
          if (statusResponse.status === 'success') {
            message.success('QR login successful!')
            clearInterval(interval)
            setModalVisible(false)
            fetchAccounts()
          } else if (statusResponse.status === 'failed') {
            message.error('QR login failed, please try again')
            clearInterval(interval)
          }
        } catch (error: any) {
          console.error('Failed to check login status:', error)
        }
      }, 1000)
      
      setStatusCheckInterval(interval)
      
    } catch (error: any) {
      message.error('Failed to start QR login: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Delete account
  const handleDeleteAccount = async (accountId: string) => {
    try {
      await uploadApi.deleteAccount(accountId)
      message.success('Account deleted successfully')
      fetchAccounts()
    } catch (error: any) {
      message.error('Failed to delete account: ' + (error.message || 'Unknown error'))
    }
  }



  // Get health status tag and color
  const getHealthStatusTag = (health?: AccountHealth) => {
    if (!health) return <Tag>Unknown</Tag>
    
    const statusConfig = {
      excellent: { color: 'green', text: 'Excellent', icon: <TrophyOutlined /> },
      good: { color: 'blue', text: 'Good', icon: <CheckCircleOutlined /> },
      warning: { color: 'orange', text: 'Warning', icon: <ExclamationCircleOutlined /> },
      poor: { color: 'red', text: 'Poor', icon: <CloseCircleOutlined /> }
    }
    
    const config = statusConfig[health.status]
    return (
      <Tooltip title={`Health score: ${health.score}/100`}>
        <Tag color={config.color} icon={config.icon}>
          {config.text} ({health.score})
        </Tag>
      </Tooltip>
    )
  }

  // Format last active time
  const formatLastActive = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (username: string) => (
        <Space>
          <UserOutlined />
          <span>{username}</span>
        </Space>
      ),
    },
    {
      title: 'Nickname',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: 'Account Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'} icon={status === 'active' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {status === 'active' ? 'Active' : 'Error'}
        </Tag>
      ),
    },
    {
      title: 'Health Status',
      key: 'health',
      render: (_: any, record: BilibiliAccount) => getHealthStatusTag(accountsHealth[record.id]),
    },
    {
      title: 'Activity',
      key: 'activity',
      render: (_: any, record: BilibiliAccount) => {
        const health = accountsHealth[record.id]
        if (!health) return '-'
        
        return (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <EyeOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontSize: '12px' }}>Uploads: {health.uploadCount}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartOutlined style={{ color: '#52c41a' }} />
              <span style={{ fontSize: '12px' }}>Success Rate: {health.successRate}%</span>
            </div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              Last Active: {formatLastActive(health.lastActive)}
            </div>
          </Space>
        )
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: BilibiliAccount) => (
        <Space size="middle">
          <Tooltip title="View Details">
            <Button type="text" icon={<EyeOutlined />} size="small">
              Details
            </Button>
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this account?"
            description="This cannot be undone. Please proceed with caution."
            onConfirm={() => handleDeleteAccount(record.id)}
            okText="Confirm"
            cancelText="Cancel"
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // Calculate overall statistics
  const getTotalStats = () => {
    const totalAccounts = accounts.length
    const activeAccounts = accounts.filter(acc => acc.status === 'active').length
    const healthScores = Object.values(accountsHealth).map(h => h.score)
    const avgHealth = healthScores.length > 0 ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) : 0
    const excellentCount = Object.values(accountsHealth).filter(h => h.status === 'excellent').length
    
    return { totalAccounts, activeAccounts, avgHealth, excellentCount }
  }

  const stats = getTotalStats()

  return (
    <div>
      <Tabs
        defaultActiveKey="accounts"
        items={[
          {
            key: 'accounts',
            label: (
              <span>
                <UserOutlined />
                Account Management
              </span>
            ),
            children: (
              <div>
                {/* Statistics cards */}
                <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <Card size="small">
                    <Statistic
                      title="Total Accounts"
                      value={stats.totalAccounts}
                      prefix={<UserOutlined />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                  <Card size="small">
                    <Statistic
                      title="Active Accounts"
                      value={stats.activeAccounts}
                      suffix={`/ ${stats.totalAccounts}`}
                      prefix={<CheckCircleOutlined />}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                  <Card size="small">
                    <Statistic
                      title="Avg Health Score"
                      value={stats.avgHealth}
                      suffix=" pts"
                      prefix={<HeartOutlined />}
                      valueStyle={{ color: stats.avgHealth >= 80 ? '#52c41a' : stats.avgHealth >= 60 ? '#faad14' : '#ff4d4f' }}
                    />
                  </Card>
                  <Card size="small">
                    <Statistic
                      title="Excellent Accounts"
                      value={stats.excellentCount}
                      prefix={<TrophyOutlined />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Card>
                </div>

                <Card 
                  title="Bilibili Account Management"  
                  extra={
                    <Space>
                      <Tooltip title="Refresh Health Status">
                        <Button 
                          icon={<ReloadOutlined />} 
                          onClick={refreshAccountsHealth}
                          loading={refreshing}
                          size="small"
                        >
                          Refresh
                        </Button>
                      </Tooltip>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                        Add Account
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    columns={columns}
                    dataSource={accounts}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`
                    }}
                    scroll={{ x: 800 }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'health',
            label: (
              <span>
                <HeartOutlined />
                Health Monitor
              </span>
            ),
            children: <AccountHealthMonitor onRefresh={fetchAccounts} />,
          },
        ]}
      />

      <Modal
        title="Add Bilibili Account"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          setQrSessionId('')
          setQrLoginStatus('')
          setQrCodeUrl('')
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval)
            setStatusCheckInterval(null)
          }
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="Login Methods Instruction"
          description="To avoid Bilibili risk control, it is recommended to use the Cookie import method. QR login may trigger risk control."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Cookie Import" key="cookie">
            <Form form={cookieForm} onFinish={handleCookieLogin} layout="vertical">
              <Form.Item
                name="nickname"
                label="昵称"
                rules={[{ required: true, message: '请输入昵称' }]}
              >
                <Input placeholder="请输入账号昵称" />
              </Form.Item>
              
                             <Form.Item
                 name="cookies"
                 label={
                   <Space>
                     <span>Cookie</span>
                     <Button 
                       type="link" 
                       size="small" 
                       icon={<QuestionCircleOutlined />}
                       onClick={() => setCookieHelperVisible(true)}
                     >
                       Get Help
                     </Button>
                   </Space>
                 }
                 rules={[{ required: true, message: 'Please enter cookies' }]}
               >
                 <TextArea
                   rows={6}
                   placeholder="Please copy Cookie from browser dev tools, e.g., SESSDATA=xxx; bili_jct=xxx; DedeUserID=xxx"
                 />
               </Form.Item>
              
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Import Cookie
                </Button>
              </Form.Item>
            </Form>
            
                         <Divider />
             <Paragraph type="secondary" style={{ fontSize: '12px' }}>
               <Text strong>Quick Guide for Cookie:</Text>
               <br />
               Click "Get Help" above to view detailed steps on getting cookies.
             </Paragraph>
          </TabPane>

          <TabPane tab="Password" key="password">
            <Form form={passwordForm} onFinish={handlePasswordLogin} layout="vertical">
              <Form.Item
                name="username"
                label="Username"
                rules={[{ required: true, message: 'Please enter username' }]}
              >
                <Input placeholder="Please enter Bilibili username or phone" />
              </Form.Item>
              
              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: 'Please enter password' }]}
              >
                <Input.Password placeholder="Please enter password" />
              </Form.Item>
              
              <Form.Item
                name="nickname"
                label="Nickname"
                rules={[{ required: true, message: 'Please enter nickname' }]}
              >
                <Input placeholder="Please enter account nickname" />
              </Form.Item>
              
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block>
                  Login
                </Button>
              </Form.Item>
            </Form>
            
            <Alert
              message="Note"
              description="Password login might require captcha. If it fails, please use Cookie import."
              type="warning"
              showIcon
            />
          </TabPane>

          <TabPane tab="QR Login" key="qr">
            <div style={{ textAlign: 'center' }}>
              {!qrSessionId ? (
                <div>
                  <Form.Item label="Nickname">
                    <Input placeholder="Please enter account nickname (optional)" />
                  </Form.Item>
                  <Button 
                    type="primary" 
                    icon={<QrcodeOutlined />}
                    onClick={() => startQRLogin()}
                    loading={loading}
                    block
                  >
                    Start QR Login
                  </Button>
                </div>
              ) : (
                <div>
                  {qrCodeUrl && (
                    <div style={{ marginBottom: '16px' }}>
                      <img src={qrCodeUrl} alt="二维码" style={{ maxWidth: '200px' }} />
                    </div>
                  )}
                  
                  {qrLoginStatus === 'pending' && (
                    <p>Generating QR code...</p>
                  )}
                  
                  {qrLoginStatus === 'processing' && (
                    <p>Please scan QR code with Bilibili App</p>
                  )}
                  
                  {qrLoginStatus === 'success' && (
                    <p style={{ color: '#52c41a' }}>✅ Login successful!</p>
                  )}
                  
                  {qrLoginStatus === 'failed' && (
                    <p style={{ color: '#ff4d4f' }}>❌ Login failed, please try again</p>
                  )}
                </div>
              )}
            </div>
            
            <Alert
              message="Risk Warning"
              description="QR login might trigger Bilibili risk control, Cookie import is highly recommended."
              type="error"
              showIcon
            />
          </TabPane>
        </Tabs>
      </Modal>

      <CookieHelper 
        visible={cookieHelperVisible}
        onClose={() => setCookieHelperVisible(false)}
      />
    </div>
  )
 }

export default BilibiliAccountManager
