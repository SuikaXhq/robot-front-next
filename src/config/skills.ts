/**
 * Skills 平台集成配置
 * =============================================================================
 * 预留 Vue Skills 平台对接配置。
 * 后续部署 Vue 项目后，修改 SKILLS_PLATFORM_URL 为实际地址即可。
 */

/** iframe 加载的 Vue Skills 平台地址 */
export const SKILLS_PLATFORM_URL = process.env.NEXT_PUBLIC_SKILLS_PLATFORM_URL || '';

/** Skill 数据载荷结构 */
export interface SkillPayload {
  id: string;
  name: string;
  /** 发送至 Claude 的初始提示词 */
  prompt?: string;
  /** 预留扩展字段 */
  meta?: Record<string, unknown>;
}
