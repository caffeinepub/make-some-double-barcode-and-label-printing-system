import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanPrint } from './pages/ScanPrint';
import { LabelSettings } from './pages/LabelSettings';
import { Devices } from './pages/Devices';
import { Diagnostics } from './pages/Diagnostics';
import { LoginScreen } from './components/LoginScreen';
import { Box, Eye, EyeOff } from 'lucide-react';
import { ThemeProvider } from 'next-themes';
import { useWakeLock } from './hooks/useWakeLock';
import { UsbPrinterProvider } from './contexts/UsbPrinterContext';
import { PrintProtocolProvider } from './contexts/PrintProtocolContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState('scan');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const wakeLock = useWakeLock();

  useEffect(() => {
    // Check if user is already authenticated in this session
    const authState = sessionStorage.getItem('isAuthenticated');
    if (authState === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    sessionStorage.setItem('isAuthenticated', 'true');
  };

  if (!isAuthenticated) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <UsbPrinterProvider>
      <PrintProtocolProvider>
        <div className="min-h-screen bg-[#0a0a0a]">
          <header className="border-b border-zinc-800 bg-[#0f0f0f]">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center">
                    <Box className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Make Some Double!!</h1>
                    <p className="text-sm text-zinc-400">Barcode & Label System</p>
                  </div>
                </div>
                
                {/* Wake Lock Status Indicator */}
                <div className="flex items-center gap-2">
                  {wakeLock.isSupported ? (
                    wakeLock.isActive ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/20">
                        <Eye className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-green-400">Screen Awake</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                        <EyeOff className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs text-yellow-400">Screen Lock Inactive</span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800/50 border border-zinc-700">
                      <EyeOff className="w-4 h-4 text-zinc-500" />
                      <span className="text-xs text-zinc-400">Wake Lock Unavailable</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Error notification */}
              {wakeLock.error && !wakeLock.isActive && (
                <div className="mt-3 px-4 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400">
                    <strong>Note:</strong> Screen wake lock is not available. Please adjust your device's screen timeout settings manually to prevent the screen from sleeping during use.
                  </p>
                </div>
              )}
            </div>
          </header>

          <main className="container mx-auto px-6 py-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-[#0f0f0f] border border-zinc-800 p-1 tablet-tabs-list">
                <TabsTrigger
                  value="scan"
                  className="tablet-tab-trigger data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-zinc-400"
                >
                  Scan & Print
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="tablet-tab-trigger data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-zinc-400"
                >
                  Label Settings
                </TabsTrigger>
                <TabsTrigger
                  value="devices"
                  className="tablet-tab-trigger data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-zinc-400"
                >
                  Devices
                </TabsTrigger>
                <TabsTrigger
                  value="diagnostics"
                  className="tablet-tab-trigger data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-white text-zinc-400"
                >
                  Diagnostics
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scan" className="mt-0">
                <ScanPrint />
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <LabelSettings />
              </TabsContent>

              <TabsContent value="devices" className="mt-0">
                <Devices />
              </TabsContent>

              <TabsContent value="diagnostics" className="mt-0">
                <Diagnostics />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </PrintProtocolProvider>
    </UsbPrinterProvider>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
