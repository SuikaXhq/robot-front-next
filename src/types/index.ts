export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface TaskNode {
  id: number;
  label: string;
  children?: TaskNode[];
}

export interface HistoryRecord {
  task: string;
  runId: string;
  triggerType: string;
  triggerUser: string;
  startTime: string;
  duration: string;
  status: 'success' | 'danger';
  statusText: string;
  summary: string;
}

export interface Role {
  id: number;
  type: 'human' | 'ai' | 'monitor';
  name: string;
  tag?: string;
  time: string;
  description: string;
  count?: number | null;
}

export interface TreeItem {
  label: string;
  key: string;
  children?: TreeItem[];
  status?: 'pending' | 'running' | 'danger' | 'success';
  statusText?: string;
  isLeaf?: boolean;
}

export interface ClawteamTask {
  id: string;
  script: string;
  environment: string;
}

export interface NanobotConfig {
  endpoint: string;
  token?: string;
}
