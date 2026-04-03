import React, { useState, useEffect } from 'react'
import { Layout, Card, Form, Input, Button, Typography, Space, Alert, Divider, Row, Col, Tabs, message, Select, Tag } from 'antd'
import { KeyOutlined, SaveOutlined, ApiOutlined, SettingOutlined, InfoCircleOutlined, RobotOutlined } from '@ant-design/icons'
import { settingsApi } from '../services/api'
import './SettingsPage.css'

const { Content } = Layout
const { Title, Text, Paragraph } = Typography

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<any>({})
  const [currentProvider, setCurrentProvider] = useState<any>({})
  const [selectedProvider, setSelectedProvider] = useState('dashscope')

  // Provider configuration
  const providerConfig: Record<string, { name: string; icon: React.ReactNode; color: string; description: string; apiKeyField: string; placeholder: string }> = {
    dashscope: {
      name: 'Alibaba Qwen',
      icon: <RobotOutlined />,
      color: '#1890ff',
      description: 'Alibaba Cloud Qwen LLM Service',
      apiKeyField: 'dashscope_api_key',
      placeholder: 'Enter your Qwen API key'
    },
    openai: {
      name: 'OpenAI',
      icon: <RobotOutlined />,
      color: '#52c41a',
      description: 'OpenAI GPT Series Models',
      apiKeyField: 'openai_api_key',
      placeholder: 'Enter your OpenAI API key'
    },
    gemini: {
      name: 'Google Gemini',
      icon: <RobotOutlined />,
      color: '#faad14',
      description: 'Google Gemini Models',
      apiKeyField: 'gemini_api_key',
      placeholder: 'Enter your Gemini API key'
    },
    siliconflow: {
      name: 'SiliconFlow',
      icon: <RobotOutlined />,
      color: '#722ed1',
      description: 'SiliconFlow Model Service',
      apiKeyField: 'siliconflow_api_key',
      placeholder: 'Enter your SiliconFlow API key'
    }
  }

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [settings, models, provider] = await Promise.all([
        settingsApi.getSettings(),
        settingsApi.getAvailableModels(),
        settingsApi.getCurrentProvider()
      ])
      
      setAvailableModels(models)
      setCurrentProvider(provider)
      setSelectedProvider(settings.llm_provider || 'dashscope')
      
      // Set form initial values
      form.setFieldsValue(settings)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  // Save configuration
  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      await settingsApi.updateSettings(values)
      message.success('Settings saved successfully!')
      await loadData() // Reload data
    } catch (error: any) {
      message.error('Save failed: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Test API key
  const handleTestApiKey = async () => {
    const provider = providerConfig[selectedProvider]
    if (!provider) return

    const apiKey = form.getFieldValue(provider.apiKeyField)
    const modelName = form.getFieldValue('model_name')
    
    if (!apiKey) {
      message.error('Please enter an API key first')
      return
    }

    if (!modelName) {
      message.error('Please select a model first')
      return
    }

    try {
      setLoading(true)
      const result = await settingsApi.testApiKey(selectedProvider, apiKey, modelName)
      if (result.success) {
        message.success('API key test successful!')
      } else {
        message.error('API key test failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error: any) {
      message.error('Test failed: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  // Provider switch
  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider)
    form.setFieldsValue({ llm_provider: newProvider })
  }

  const currentProviderConfig = providerConfig[selectedProvider] || providerConfig.dashscope

  // Build Tabs items using the antd v5 API
  const tabItems = [
    {
      key: 'api',
      label: 'AI Model Configuration',
      children: (
        <>
          <Card title="AI Model Configuration" className="settings-card">
            <Alert
              message="Multi-Provider Support"
              description="The system supports multiple AI model providers. You can choose different services and models based on your needs."
              type="info"
              showIcon
              className="settings-alert"
            />
            
            <Form
              form={form}
              layout="vertical"
              className="settings-form"
              onFinish={handleSave}
              initialValues={{
                llm_provider: 'dashscope',
                model_name: 'qwen-plus',
                chunk_size: 5000,
                min_score_threshold: 0.7,
                max_clips_per_collection: 5
              }}
            >
              {/* Current provider status */}
              {currentProvider.available && (
                <Alert
                  message={`Currently using: ${currentProvider.display_name} - ${currentProvider.model}`}
                  type="success"
                  showIcon
                  style={{ marginBottom: 24 }}
                />
              )}

              {/* Provider selection */}
              <Form.Item
                label="Select AI Model Provider"
                name="llm_provider"
                className="form-item"
                rules={[{ required: true, message: 'Please select an AI model provider' }]}
              >
                <Select
                  value={selectedProvider}
                  onChange={handleProviderChange}
                  className="settings-input"
                  placeholder="Select an AI model provider"
                >
                  {Object.entries(providerConfig).map(([key, config]) => (
                    <Select.Option key={key} value={key}>
                      <Space>
                        <span style={{ color: config.color }}>{config.icon}</span>
                        <span>{config.name}</span>
                        <Tag color={config.color}>{config.description}</Tag>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Dynamic API key input */}
              <Form.Item
                label={`${currentProviderConfig.name} API Key`}
                name={currentProviderConfig.apiKeyField}
                className="form-item"
                rules={[
                  { required: true, message: 'Please enter your API key' },
                  { min: 10, message: 'API key must be at least 10 characters' }
                ]}
              >
                <Input.Password
                  placeholder={currentProviderConfig.placeholder}
                  prefix={<KeyOutlined />}
                  className="settings-input"
                />
              </Form.Item>

              {/* Model selection */}
              <Form.Item
                label="Select Model"
                name="model_name"
                className="form-item"
                rules={[{ required: true, message: 'Please select a model' }]}
              >
                <Select
                  className="settings-input"
                  placeholder="Select a model"
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label as unknown as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                  }
                >
                  {availableModels[selectedProvider]?.map((model: any) => (
                    <Select.Option key={model.name} value={model.name}>
                      <Space>
                        <span>{model.display_name}</span>
                        <Tag>Max {model.max_tokens} tokens</Tag>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item className="form-item">
                <Space>
                  <Button
                    type="default"
                    icon={<ApiOutlined />}
                    className="test-button"
                    onClick={handleTestApiKey}
                    loading={loading}
                  >
                    Test Connection
                  </Button>
                </Space>
              </Form.Item>

              <Divider className="settings-divider" />

              <Title level={4} className="section-title">Model Configuration</Title>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Model Name"
                    name="model_name"
                    className="form-item"
                  >
                    <Input placeholder="qwen-plus" className="settings-input" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Text Chunk Size"
                    name="chunk_size"
                    className="form-item"
                  >
                    <Input 
                      type="number" 
                      placeholder="5000" 
                      addonAfter="chars" 
                      className="settings-input"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Minimum Score Threshold"
                    name="min_score_threshold"
                    className="form-item"
                  >
                    <Input 
                      type="number" 
                      step="0.1" 
                      min="0" 
                      max="1" 
                      placeholder="0.7" 
                      className="settings-input"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Max Clips Per Collection"
                    name="max_clips_per_collection"
                    className="form-item"
                  >
                    <Input 
                      type="number" 
                      placeholder="5" 
                      addonAfter="clips" 
                      className="settings-input"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item className="form-item">
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  size="large"
                  className="save-button"
                  loading={loading}
                >
                  Save Settings
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="Instructions" className="settings-card">
            <Space direction="vertical" size="large" className="instructions-space">
              <div className="instruction-item">
                <Title level={5} className="instruction-title">
                  <InfoCircleOutlined /> 1. Select AI Model Provider
                </Title>
                <Paragraph className="instruction-text">
                  The system supports multiple AI model providers:
                  <br />• <Text strong>Alibaba Qwen</Text>: Get your API key from Alibaba Cloud Console
                  <br />• <Text strong>OpenAI</Text>: Get your API key from platform.openai.com
                  <br />• <Text strong>Google Gemini</Text>: Get your API key from ai.google.dev
                  <br />• <Text strong>SiliconFlow</Text>: Get your API key from docs.siliconflow.cn
                </Paragraph>
              </div>
              
              <div className="instruction-item">
                <Title level={5} className="instruction-title">
                  <InfoCircleOutlined /> 2. Configuration Parameters
                </Title>
                <Paragraph className="instruction-text">
                  • <Text strong>Text Chunk Size</Text>: Affects processing speed and accuracy, recommended 5000 characters<br />
                  • <Text strong>Score Threshold</Text>: Only segments scoring above this threshold will be retained<br />
                  • <Text strong>Clips Per Collection</Text>: Controls the number of clips included in each themed collection
                </Paragraph>
              </div>
              
              <div className="instruction-item">
                <Title level={5} className="instruction-title">
                  <InfoCircleOutlined /> 3. Test Connection
                </Title>
                <Paragraph className="instruction-text">
                  Before saving, we recommend testing your API key to ensure the service is working properly
                </Paragraph>
              </div>
            </Space>
          </Card>
        </>
      )
    }
  ]

  return (
    <Content className="settings-page">
      <div className="settings-container">
        <Title level={2} className="settings-title">
          <SettingOutlined /> System Settings
        </Title>
        
        <Tabs defaultActiveKey="api" className="settings-tabs" items={tabItems} />
      </div>
    </Content>
  )
}

export default SettingsPage