import React from 'react'
import { Card, Tag, Space, Typography } from 'antd'
import { BILIBILI_PARTITIONS } from '../services/uploadApi'

const { Text } = Typography

interface UploadToBilibiliProps {
  partitionId?: number
}

const UploadToBilibili: React.FC<UploadToBilibiliProps> = ({ partitionId }) => {
  // Get partition name
  const getPartitionName = (id: number) => {
    const partition = BILIBILI_PARTITIONS.find(p => p.id === id)
    return partition ? partition.name : 'Unknown Partition'
  }

  return (
    <Card
      title={
        <Space>
          <span>Bilibili Partition Info</span>
          {partitionId && (
            <Tag color="blue">Current Partition: {getPartitionName(partitionId)}</Tag>
          )}
        </Space>
      }
      size="small"
      style={{ marginBottom: '16px' }}
    >
      <div>
        <Text type="secondary">
          Supported Partitions: Animation, Gaming, Music, Knowledge, Entertainment, Film & TV, Tech & Digital, etc.
        </Text>
        <div style={{ marginTop: '12px' }}>
          <Text strong>Partition ID: </Text>
          <Text code>{partitionId || 'Not set'}</Text>
        </div>
      </div>
    </Card>
  )
}

export default UploadToBilibili

