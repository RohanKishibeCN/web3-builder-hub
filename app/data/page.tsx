import { fetchSystemLogs, fetchStorageStats, fetchAnalysisQueue } from '@/app/actions';
import DataDashboardClient from './client';

export const dynamic = 'force-dynamic';

export default async function DataDashboardPage() {
  const [systemLogs, storageStats, analysisQueue] = await Promise.all([
    fetchSystemLogs(),
    fetchStorageStats(),
    fetchAnalysisQueue(),
  ]);

  return (
    <DataDashboardClient 
      systemLogs={systemLogs} 
      storageStats={storageStats} 
      analysisQueue={analysisQueue} 
    />
  );
}