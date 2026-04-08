'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './HistoryView.module.css';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import { Table, Select, Input, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { HistoryRecord } from '@/types';

const { RangePicker } = DatePicker;

const tableData: HistoryRecord[] = [
  { task: '项目执行与监控', runId: 'f6d5f561234', triggerType: '定时触发', triggerUser: 'XXX 323465463', startTime: '2021/11/01 01:00:00', duration: '42时11分19秒', status: 'success', statusText: '成功', summary: 'XXXXXXXXX' },
  { task: '研发计划变更', runId: 'f6d5f561234', triggerType: '定时触发', triggerUser: 'XXX 323465463', startTime: '2021/11/01 01:00:00', duration: '42时11分19秒', status: 'danger', statusText: '失败', summary: 'XXXXXXXXX' },
  { task: '系统设计_行解', runId: 'f6d5f561234', triggerType: '定时触发', triggerUser: 'XXX 323465463', startTime: '2021/11/01 01:00:00', duration: '42时11分19秒', status: 'success', statusText: '成功', summary: 'XXXXXXXXX' },
  { task: '系统设计_行解', runId: 'f6d5f561234', triggerType: '定时触发', triggerUser: 'XXX 323465463', startTime: '2021/11/01 01:00:00', duration: '42时11分19秒', status: 'success', statusText: '成功', summary: 'XXXXXXXXX' },
  { task: '系统设计_行解', runId: 'f6d5f561234', triggerType: '定时触发', triggerUser: 'XXX 323465463', startTime: '2021/11/01 01:00:00', duration: '42时11分19秒', status: 'success', statusText: '成功', summary: 'XXXXXXXXX' },
];

const columns: ColumnsType<HistoryRecord> = [
  { title: '任务', dataIndex: 'task', key: 'task' },
  { title: '运行ID', dataIndex: 'runId', key: 'runId' },
  {
    title: '触发类型', dataIndex: 'triggerType', key: 'triggerType',
    render: (text: string) => <span className={styles.triggerTag}>{text}</span>,
  },
  { title: '触发人', dataIndex: 'triggerUser', key: 'triggerUser' },
  { title: '开始时间', dataIndex: 'startTime', key: 'startTime' },
  { title: '耗时', dataIndex: 'duration', key: 'duration' },
  {
    title: '运行状态', dataIndex: 'status', key: 'status',
    render: (_: string, record: HistoryRecord) => (
      <span>
        <span className={`${styles.statusDot} ${styles[record.status]}`} />
        {record.statusText}
      </span>
    ),
  },
  { title: '运行总结', dataIndex: 'summary', key: 'summary' },
  {
    title: '操作', key: 'action', fixed: 'right' as const, width: 160,
    render: () => (
      <span className={styles.actionLinks}>
        <a>查看快照</a>
        <a>查看日志</a>
      </span>
    ),
  },
];

export default function HistoryView() {
  const router = useRouter();
  const [filterType, setFilterType] = useState<string>();
  const [filterStatus, setFilterStatus] = useState<string>();

  return (
    <div className={styles.historyView}>
      <div className={styles.historyContainer}>
        <div className={styles.historyHeader}>
          <div className={styles.headerLeft}>
            <button className={styles.backBtn} onClick={() => router.back()}>
              <ArrowLeftOutlined />
            </button>
            <span className={styles.title}>运行记录</span>
          </div>
          <div className={styles.headerFilters}>
            <Select placeholder="触发类型" style={{ width: 120 }} value={filterType} onChange={setFilterType} options={[{ value: 'timer', label: '定时触发' }, { value: 'manual', label: '手动触发' }]} allowClear />
            <Select placeholder="状态" style={{ width: 120, marginLeft: 12 }} value={filterStatus} onChange={setFilterStatus} options={[{ value: 'success', label: '成功' }, { value: 'danger', label: '失败' }]} allowClear />
            <Select placeholder="触发人" style={{ width: 120, marginLeft: 12 }} options={[{ value: '', label: '全部' }]} allowClear />
            <Input placeholder="请输入工作流名称" style={{ width: 200, marginLeft: 12 }} suffix={<SearchOutlined />} />
            <RangePicker style={{ marginLeft: 12 }} />
          </div>
        </div>
        <div className={styles.historyBody}>
          <Table
            columns={columns}
            dataSource={tableData.map((d, i) => ({ ...d, key: i }))}
            pagination={false}
            scroll={{ x: 1200 }}
          />
        </div>
      </div>
    </div>
  );
}
