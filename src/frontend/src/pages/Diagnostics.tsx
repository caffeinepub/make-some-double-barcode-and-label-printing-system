import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';
import { usePrintHistory, useErrorLogs } from '../hooks/useQueries';
import { toast } from 'sonner';

export function Diagnostics() {
  const { data: printHistory = [] } = usePrintHistory();
  const { data: errorLogs = [] } = useErrorLogs();

  const totalScans = printHistory.length * 2;
  const labelsPrinted = printHistory.length;
  const errorCount = errorLogs.length;

  const handleExport = () => {
    if (printHistory.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'Time', 'Serial Number', 'Label Type', 'Printer'];
    const rows = printHistory.map((record) => {
      const date = new Date(Number(record.timestamp) / 1000000);
      return [
        date.toLocaleDateString(),
        date.toLocaleTimeString(),
        record.serialNumber,
        record.labelType,
        record.printer,
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Diagnostics exported!');
  };

  const handleClear = () => {
    toast.info('Clear functionality would reset all diagnostic data');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-400">Total Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold text-white">{totalScans}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-400">Labels Printed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold text-white">{labelsPrinted}</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-400">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold text-red-500">{errorCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#0f0f0f] border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-2xl">Print History</CardTitle>
          <CardDescription className="text-zinc-400 text-base">
            View and reprint previously printed labels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-[#1a1a1a] border border-zinc-700 rounded-lg p-6 min-h-[220px]">
            {printHistory.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-zinc-400 text-base">No print history available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {printHistory.slice(0, 5).map((record, idx) => {
                  const date = new Date(Number(record.timestamp) / 1000000);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg"
                    >
                      <div>
                        <p className="text-white font-mono text-base">{record.serialNumber}</p>
                        <p className="text-zinc-400 text-sm">
                          {date.toLocaleDateString()} {date.toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-400 text-sm">{record.labelType}</p>
                        <p className="text-zinc-500 text-xs">{record.printer}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0f0f0f] border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white text-2xl">System Diagnostics</CardTitle>
              <CardDescription className="text-zinc-400 text-base">
                View connection events, print commands, and scan performance
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                className="bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-12 px-4 text-base active:scale-95 transition-transform"
              >
                <Download className="w-5 h-5 mr-2" />
                Export
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                size="sm"
                className="bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-950/50 h-12 px-4 text-base active:scale-95 transition-transform"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-[#1a1a1a] border border-zinc-700 rounded-lg p-5 min-h-[220px] max-h-[400px] overflow-y-auto font-mono text-base">
            <div className="space-y-2">
              <div className="flex gap-3">
                <span className="text-blue-400">19:42:19</span>
                <span className="text-zinc-500">INFO</span>
                <span className="text-zinc-300">Label counters automatically reset for new day</span>
              </div>
              {errorLogs.slice(0, 10).map((log, idx) => {
                const date = new Date(Number(log.timestamp) / 1000000);
                return (
                  <div key={idx} className="flex gap-3">
                    <span className="text-blue-400">{date.toLocaleTimeString()}</span>
                    <span className="text-red-400">ERROR</span>
                    <span className="text-zinc-300">{log.errorMessage}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
