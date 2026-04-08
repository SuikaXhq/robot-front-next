'use client';

import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import styles from './SwarmCanvas.module.css';
import {
  AimOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  DownOutlined,
  UserOutlined,
  DesktopOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { Dropdown } from 'antd';

type CustomNodeData = {
  label: string;
  ip?: string;
  status?: string;
  statusType?: 'success' | 'danger' | 'running';
  icon?: 'user' | 'monitor';
};

function CustomNode({ id, data }: NodeProps<Node<CustomNodeData>>) {
  const { updateNodeData } = useReactFlow();
  const statusType = data.statusType || 'success';

  const colorMap: Record<string, string> = {
    success: '#67C23A',
    danger: '#F56C6C',
    running: '#409EFF',
  };

  const nodeColor = colorMap[statusType] || '#67C23A';

  return (
    <div className={styles.customNode}>
      <div className={styles.nodeRings}>
        <svg 
          className={styles.ringSvg} 
          viewBox="0 0 64 64" 
        >
          <circle className={styles.ringOuterBg} cx="32" cy="32" r="30" style={{ stroke: statusType === 'running' ? 'transparent' : nodeColor }} />
        </svg>
        {statusType === 'running' && (
          <>
            <div className={styles.rotatingLaser} style={{ '--glow-color': nodeColor } as React.CSSProperties}>
              <div className={styles.laserHead} />
            </div>
            <div className={styles.pulseRing} style={{ '--glow-color': nodeColor } as React.CSSProperties} />
          </>
        )}
        <div className={styles.nodeIconInner} style={{ borderColor: nodeColor, color: '#606266' }}>
          {data.icon === 'monitor' ? <DesktopOutlined style={{ fontSize: 24 }} /> : <UserOutlined style={{ fontSize: 24 }} />}
        </div>
      </div>
      <div
        className={styles.nodeContentBox}
        style={{
          borderStyle: statusType === 'running' ? 'solid' : 'dashed',
          borderColor: statusType === 'running' ? nodeColor : undefined,
        }}
      >
        <div className={styles.nodeTitle}>{data.label}</div>
        {data.ip && (
          <Dropdown
            menu={{
              items: [
                { key: 'IP-TEST-001', label: 'IP-TEST-001' },
                { key: 'IP-TEST-002', label: 'IP-TEST-002' },
                { key: 'IP-TEST-003', label: 'IP-TEST-003' },
                { key: 'IP-TEST-004', label: 'IP-TEST-004' },
                { key: 'IP-TEST-005', label: 'IP-TEST-005' },
                { key: 'IP-TEST-006', label: 'IP-TEST-006' },
              ],
              onClick: (e) => updateNodeData(id, { ip: e.key }),
              selectable: true,
              defaultSelectedKeys: [data.ip as string],
            }}
            trigger={['click']}
          >
            <div className={styles.nodeIp} style={{ cursor: 'pointer', color: nodeColor }}>
              {data.ip} <DownOutlined style={{ fontSize: 10, color: nodeColor }} />
            </div>
          </Dropdown>
        )}
        <div className={styles.textStatus} style={{ color: nodeColor }}>{data.status}</div>
      </div>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
      <Handle type="target" position={Position.Left} id="left" className={styles.handle} />
      <Handle type="source" position={Position.Right} id="right" className={styles.handle} />
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

const initialNodes: Node<CustomNodeData>[] = [
  { id: 'human', type: 'custom', data: { label: 'Human', ip: 'IP-TEST-001', status: 'IDLE', statusType: 'success', icon: 'user' }, position: { x: 50, y: 50 } },
  { id: 'architect', type: 'custom', data: { label: 'Architect', ip: 'IP-TEST-002', status: 'IDLE', statusType: 'danger', icon: 'user' }, position: { x: 300, y: 50 } },
  { id: 'cto', type: 'custom', data: { label: 'CTO', ip: 'IP-TEST-004', status: 'RUNNING', statusType: 'running', icon: 'user' }, position: { x: 300, y: 200 } },
  { id: 'cfo', type: 'custom', data: { label: 'CFO', ip: 'IP-TEST-005', status: 'RUNNING', statusType: 'running', icon: 'user' }, position: { x: 550, y: 200 } },
  { id: 'coder1', type: 'custom', data: { label: 'Coder-1', ip: 'IP-TEST-006', status: 'IDLE', statusType: 'success', icon: 'monitor' }, position: { x: 180, y: 350 } },
  { id: 'coder2', type: 'custom', data: { label: 'Coder-2', ip: 'IP-TEST-007', status: 'IDLE', statusType: 'success', icon: 'monitor' }, position: { x: 300, y: 350 } },
  { id: 'coder3', type: 'custom', data: { label: 'Coder-3', ip: 'IP-TEST-008', status: 'IDLE', statusType: 'success', icon: 'monitor' }, position: { x: 420, y: 350 } },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'human', target: 'architect', sourceHandle: 'right', targetHandle: 'left', style: { stroke: '#c0c4cc', strokeDasharray: '4 4' }, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e2', source: 'architect', target: 'cto', type: 'smoothstep', style: { stroke: '#c0c4cc', strokeDasharray: '4 4' }, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e3', source: 'cto', target: 'cfo', sourceHandle: 'right', targetHandle: 'left', style: { stroke: '#c0c4cc', strokeDasharray: '4 4' }, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e4', source: 'cto', target: 'coder1', type: 'smoothstep', style: { stroke: '#c0c4cc', strokeDasharray: '4 4' }, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e5', source: 'cto', target: 'coder2', type: 'smoothstep', style: { stroke: '#c0c4cc', strokeDasharray: '4 4' }, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e6', source: 'cto', target: 'coder3', type: 'smoothstep', style: { stroke: '#c0c4cc', strokeDasharray: '4 4' }, markerEnd: { type: MarkerType.ArrowClosed } },
];

const flowEvents = [
  { color: 'primary', text: 'LLM 开始: coder', time: '12:25:30 AM' },
  { color: 'purple', text: 'DB update: group_members', time: '12:25:30 AM' },
  { color: 'primary', text: 'LLM 结束: coder', time: '12:25:30 AM' },
  { color: 'warning', text: '工具结束: ceo · send group message', time: '12:25:30 AM' },
  { color: 'warning', text: '消息: CEO', time: '12:25:30 AM' },
  { color: 'purple', text: 'DB update: group_members', time: '12:25:30 AM' },
];

function FlowInner() {
  const { zoomIn, zoomOut, setViewport, getViewport } = useReactFlow();
  const [zoom, setZoom] = useState(0.9);
  const [isTaskFlowExpanded, setIsTaskFlowExpanded] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleZoomIn = useCallback(() => {
    zoomIn();
    setZoom(Math.min(zoom + 0.1, 4));
  }, [zoomIn, zoom]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
    setZoom(Math.max(zoom - 0.1, 0.2));
  }, [zoomOut, zoom]);

  const handleSetZoom = useCallback((z: number) => {
    const vp = getViewport();
    setViewport({ x: vp.x, y: vp.y, zoom: z });
    setZoom(z);
  }, [getViewport, setViewport]);

  return (
    <div className={styles.swarmCanvasContainer}>
      <div className={styles.canvasHeader}>
        <div className={styles.canvasTools}>
          <AimOutlined className={styles.toolIcon} />
          <span className={styles.divider}>|</span>
          <ZoomInOutlined className={styles.toolIcon} onClick={handleZoomIn} />
          <ZoomOutOutlined className={styles.toolIcon} onClick={handleZoomOut} />
          <Dropdown
            menu={{
              items: [
                { key: '100', label: '100%', onClick: () => handleSetZoom(1) },
                { key: '90', label: '90%', onClick: () => handleSetZoom(0.9) },
                { key: '75', label: '75%', onClick: () => handleSetZoom(0.75) },
                { key: '50', label: '50%', onClick: () => handleSetZoom(0.5) },
              ],
            }}
          >
            <span className={styles.zoomLabel}>
              {Math.round(zoom * 100)}% <DownOutlined />
            </span>
          </Dropdown>
        </div>
      </div>

      <div className={styles.canvasBody}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
          minZoom={0.2}
          maxZoom={4}
          fitView={false}
          onMoveEnd={(_, viewport) => setZoom(viewport.zoom)}
        >
          <Background gap={20} color="#e5e7eb" />
        </ReactFlow>

        {/* Task flow panel */}
        <div
          className={`${styles.taskFlowPanel} ${isTaskFlowExpanded ? styles.taskFlowExpanded : ''}`}
        >
          <div className={styles.taskFlowHeader}>
            <span>任务流程 <span className={styles.badge}>20</span></span>
            {isTaskFlowExpanded ? (
              <FullscreenExitOutlined
                className={styles.expandIcon}
                onClick={() => setIsTaskFlowExpanded(false)}
                title="退出全屏"
              />
            ) : (
              <FullscreenOutlined
                className={styles.expandIcon}
                onClick={() => setIsTaskFlowExpanded(true)}
                title="全屏"
              />
            )}
          </div>
          <div className={styles.taskFlowBody}>
            {flowEvents.map((evt, i) => (
              <div key={i} className={styles.flowItem}>
                <div className={`${styles.flowDot} ${styles[evt.color]}`} />
                <div className={styles.flowContent}>
                  <div className={styles.flowText}>{evt.text}</div>
                  <div className={styles.flowTime}>{evt.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SwarmCanvas() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  );
}
