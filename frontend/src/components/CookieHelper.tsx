import React, { useState } from 'react'
import { Modal, Steps, Card, Typography, Alert, Button, Space, Divider } from 'antd'
import { QuestionCircleOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons'

const { Paragraph, Text } = Typography
const { Step } = Steps

interface CookieHelperProps {
  visible: boolean
  onClose: () => void
}

const CookieHelper: React.FC<CookieHelperProps> = ({ visible, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [copied, setCopied] = useState(false)

  const steps = [
    {
      title: 'Login to Bilibili',
      description: 'Login to your Bilibili account in the browser',
      content: (
        <div>
          <Alert
            message="Step 1: Login to Bilibili"
            description="Please ensure you have successfully logged into your Bilibili account in the browser."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Open your browser and visit <Text code>https://www.bilibili.com</Text>
            </Paragraph>
            <Paragraph>
              2. Click the "Login" button in the top right corner
            </Paragraph>
            <Paragraph>
              3. Login with your Bilibili account
            </Paragraph>
            <Paragraph>
              4. Confirm successful login when you see your username in the top right corner
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Open Developer Tools',
      description: 'Press F12 to open browser Developer Tools',
      content: (
        <div>
          <Alert
            message="Step 2: Open Developer Tools"
            description="Use a shortcut to open the browser Developer Tools"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              <Text strong>Windows/Linux:</Text> Press <Text code>F12</Text> key
            </Paragraph>
            <Paragraph>
              <Text strong>Mac:</Text> Press <Text code>Command + Option + I</Text>
            </Paragraph>
            <Paragraph>
              Or right-click anywhere on the page and select "Inspect"
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              Developer Tools will open at the bottom or right side, containing multiple tabs
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Switch to Network Tab',
      description: 'Find the Network tab',
      content: (
        <div>
          <Alert
            message="Step 3: Switch to Network Tab"
            description="Find the Network tab in Developer Tools"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Find tabs at the top of Developer Tools
            </Paragraph>
            <Paragraph>
              2. Click the <Text code>Network</Text> tab
            </Paragraph>
            <Paragraph>
              3. Ensure the Network panel is clear (if not, click the clear button)
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              The Network tab monitors web requests, including Cookie information
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Refresh Page',
      description: 'Refresh Bilibili page to capture requests',
      content: (
        <div>
          <Alert
            message="Step 4: Refresh Page"
            description="Refresh Bilibili page to capture network requests"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Ensure Network tab is open
            </Paragraph>
            <Paragraph>
              2. Press <Text code>F5</Text> or click browser refresh button
            </Paragraph>
            <Paragraph>
              3. Observe request list in the Network panel
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              After refreshing, the Network panel will show all network requests during page load
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Find Cookie',
      description: 'Find Cookie information in Request Headers',
      content: (
        <div>
          <Alert
            message="Step 5: Find Cookie Information"
            description="Find the Cookie field in any request"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Select any request in the Network panel (usually the first one)
            </Paragraph>
            <Paragraph>
              2. Click the request and find <Text code>Headers</Text> on the right
            </Paragraph>
            <Paragraph>
              3. Find <Text code>Cookie</Text> under <Text code>Request Headers</Text>
            </Paragraph>
            <Paragraph>
              4. The Cookie value is the complete Cookie string you need
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              The Cookie string is usually long, containing multiple key-value pairs separated by semicolons
            </Paragraph>
          </Card>
        </div>
      )
    },
    {
      title: 'Copy Cookie',
      description: 'Copy the complete Cookie string',
      content: (
        <div>
          <Alert
            message="Step 6: Copy Cookie"
            description="Copy the complete Cookie string to the clipboard"
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Card size="small">
            <Paragraph>
              1. Right-click the Cookie value
            </Paragraph>
            <Paragraph>
              2. Select "Copy value"
            </Paragraph>
            <Paragraph>
              3. Or double-click the entire Cookie value and press <Text code>Ctrl+C</Text>
            </Paragraph>
            <Divider />
            <Paragraph type="secondary">
              The copied Cookie can be directly pasted into AutoClip's Cookie input
            </Paragraph>
            <Alert
              message="Important Notice"
              description="Cookie contains your login info. Keep it safe and don't share it."
              type="warning"
              showIcon
            />
          </Card>
        </div>
      )
    }
  ]

  const handleCopy = () => {
    const cookieExample = "SESSDATA=your_sessdata_here; bili_jct=your_bili_jct_here; DedeUserID=your_dedeuserid_here"
    navigator.clipboard.writeText(cookieExample).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Modal
      title={
        <Space>
          <QuestionCircleOutlined />
          <span>Cookie Retrieval Guide</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="copy"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
        >
          {copied ? 'Copied' : 'Copy Example'}
        </Button>
      ]}
      width={700}
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="Cookie import is the safest login method"
          description="Compared to QR login, Cookie import won't trigger Bilibili risk control and is highly recommended."
          type="success"
          showIcon
        />
      </div>

      <Steps current={currentStep} onChange={setCurrentStep} direction="vertical" size="small">
        {steps.map((step, index) => (
          <Step key={index} title={step.title} description={step.description} />
        ))}
      </Steps>

      <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
        {steps[currentStep].content}
      </div>

      <Divider />

      <Card size="small" title="Cookie Format Example">
        <Paragraph code style={{ fontSize: '12px', wordBreak: 'break-all' }}>
          SESSDATA=your_sessdata_here; bili_jct=your_bili_jct_here; DedeUserID=your_dedeuserid_here; buvid3=your_buvid3_here
        </Paragraph>
        <Paragraph type="secondary" style={{ fontSize: '12px' }}>
          Note: The actual Cookie is much longer and contains more fields.
        </Paragraph>
      </Card>
    </Modal>
  )
}

export default CookieHelper

