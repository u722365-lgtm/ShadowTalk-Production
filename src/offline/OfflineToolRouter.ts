export const LOCAL_TOOLS = [
  'calculator',
  'local_text_processing',
  'local_file_access',
  'local_code_generation',
  'local_data_analysis'
];

export const CLOUD_TOOLS = [
  'web_search',
  'external_apis',
  'cloud_databases',
  'remote_browsing'
];

export class OfflineToolRouter {
  static canRunOffline(toolName: string): boolean {
    return LOCAL_TOOLS.includes(toolName);
  }

  static isCloudOnly(toolName: string): boolean {
    return CLOUD_TOOLS.includes(toolName) || (!LOCAL_TOOLS.includes(toolName));
  }
}
