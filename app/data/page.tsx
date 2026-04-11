import { fetchSystemLogs, fetchStorageStats, fetchAnalysisQueue, fetchProjects } from '@/app/actions';
import DataDashboardClient from './client';

export const dynamic = 'force-dynamic';

export default async function DataDashboardPage() {
  const [systemLogs, storageStats, analysisQueue, presentationData] = await Promise.all([
    fetchSystemLogs(),
    fetchStorageStats(),
    fetchAnalysisQueue(),
    fetchProjects(),
  ]);

  return (
    <DataDashboardClient 
      systemLogs={systemLogs} 
      storageStats={storageStats} 
      analysisQueue={analysisQueue} 
      presentationData={presentationData}
    />
  );
}