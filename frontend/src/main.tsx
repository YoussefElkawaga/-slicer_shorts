import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import enUS from 'antd/locale/en_US'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import App from './App.tsx'
import './index.css'

// Configure dayjs plugins
dayjs.extend(relativeTime)
dayjs.extend(timezone)
dayjs.extend(utc)

// Set dayjs locale to English
dayjs.locale('en')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider locale={enUS}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ConfigProvider>,
)