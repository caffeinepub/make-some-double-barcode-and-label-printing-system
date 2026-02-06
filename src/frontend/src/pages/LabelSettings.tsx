import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ZoomIn, ZoomOut, RotateCcw, Upload, Save, Download, RefreshCw } from 'lucide-react';
import { useSaveLabelConfig, useGetValidPrefixes, useAddMultiplePrefixes, useGetTitleMappings, useInitializeDefaultTitles } from '../hooks/useQueries';
import { toast } from 'sonner';
import { LABEL_LAYOUT, estimateCode128Width, calculateCenteredTextX } from '../utils/cpclTemplates';

// CODE128 encoding patterns - each pattern is 11 modules wide
// Format: [bar, space, bar, space, bar, space] widths in modules
const CODE128_PATTERNS: number[][] = [
  [2,1,2,2,2,2], [2,2,2,1,2,2], [2,2,2,2,2,1], [1,2,1,2,2,3], [1,2,1,3,2,2],
  [1,3,1,2,2,2], [1,2,2,2,1,3], [1,2,2,3,1,2], [1,3,2,2,1,2], [2,2,1,2,1,3],
  [2,2,1,3,1,2], [2,3,1,2,1,2], [1,1,2,2,3,2], [1,2,2,1,3,2], [1,2,2,2,3,1],
  [1,1,3,2,2,2], [1,2,3,1,2,2], [1,2,3,2,2,1], [2,2,3,2,1,1], [2,2,1,1,3,2],
  [2,2,1,2,3,1], [2,1,3,2,1,2], [2,2,3,1,1,2], [3,1,2,1,3,1], [3,1,1,2,2,2],
  [3,2,1,1,2,2], [3,2,1,2,2,1], [3,1,2,2,1,2], [3,2,2,1,1,2], [3,2,2,2,1,1],
  [2,1,2,1,2,3], [2,1,2,3,2,1], [2,3,2,1,2,1], [1,1,1,3,2,3], [1,3,1,1,2,3],
  [1,3,1,3,2,1], [1,1,2,3,1,3], [1,3,2,1,1,3], [1,3,2,3,1,1], [2,1,1,3,1,3],
  [2,3,1,1,1,3], [2,3,1,3,1,1], [1,1,2,1,3,3], [1,1,2,3,3,1], [1,3,2,1,3,1],
  [1,1,3,1,2,3], [1,1,3,3,2,1], [1,3,3,1,2,1], [3,1,3,1,2,1], [2,1,1,3,3,1],
  [2,3,1,1,3,1], [2,1,3,1,1,3], [2,1,3,3,1,1], [2,1,3,1,3,1], [3,1,1,1,2,3],
  [3,1,1,3,2,1], [3,3,1,1,2,1], [3,1,2,1,1,3], [3,1,2,3,1,1], [3,3,2,1,1,1],
  [3,1,4,1,1,1], [2,2,1,4,1,1], [4,3,1,1,1,1], [1,1,1,2,2,4], [1,1,1,4,2,2],
  [1,2,1,1,2,4], [1,2,1,4,2,1], [1,4,1,1,2,2], [1,4,1,2,2,1], [1,1,2,2,1,4],
  [1,1,2,4,1,2], [1,2,2,1,1,4], [1,2,2,4,1,1], [1,4,2,1,1,2], [1,4,2,2,1,1],
  [2,4,1,2,1,1], [2,2,1,1,1,4], [4,1,3,1,1,1], [2,4,1,1,1,2], [1,3,4,1,1,1],
  [1,1,1,2,4,2], [1,2,1,1,4,2], [1,2,1,2,4,1], [1,1,4,2,1,2], [1,2,4,1,1,2],
  [1,2,4,2,1,1], [4,1,1,2,1,2], [4,2,1,1,1,2], [4,2,1,2,1,1], [2,1,2,1,4,1],
  [2,1,4,1,2,1], [4,1,2,1,2,1], [1,1,1,1,4,3], [1,1,1,3,4,1], [1,3,1,1,4,1],
  [1,1,4,1,1,3], [1,1,4,3,1,1], [4,1,1,1,1,3], [4,1,1,3,1,1], [1,1,3,1,4,1],
  [1,1,4,1,3,1], [3,1,1,1,4,1], [4,1,1,1,3,1], [2,1,1,4,1,2], [2,1,1,2,1,4],
  [2,1,1,2,3,2], [2,3,3,1,1,1,2]
];

// Start codes for Code 128
const START_CODE_B = 104;
const STOP_CODE = 106;

// Simple Code 128B encoder for display purposes
function encodeCode128B(text: string): number[] {
  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    let value = charCode - 32;
    if (value < 0 || value > 95) value = 0;
    codes.push(value);
    checksum += value * (i + 1);
  }
  
  codes.push(checksum % 103);
  codes.push(STOP_CODE);
  
  return codes;
}

interface PreviewSettings {
  width: number;
  height: number;
  showBarcodes: boolean;
  barcodeHeight: number;
  barcodeWidthScale: number;
  firstBarcodeX: number;
  firstBarcodeY: number;
  secondBarcodeX: number;
  secondBarcodeY: number;
  showTextLabels: boolean;
  fontFamily: string;
  fontSize: number;
  firstTextX: number;
  firstTextY: number;
  secondTextX: number;
  secondTextY: number;
}

export function LabelSettings() {
  // Convert CPCL dots to mm for UI (203dpi = 8 dots per mm)
  const DOTS_TO_MM = 203 / 25.4; // ~8 dots per mm
  const dotsToMm = (dots: number) => Math.round(dots / DOTS_TO_MM * 10) / 10;
  const mmToDots = (mm: number) => Math.round(mm * DOTS_TO_MM);

  // Calculate centered barcode X positions for default sample text
  const sampleText1 = '55V10M29F04381';
  const sampleText2 = '55V10M29F04362';
  const labelWidthDots = LABEL_LAYOUT.WIDTH;
  
  // Calculate centered X for barcodes
  const calculateCenteredX = (text: string, moduleWidth: number) => {
    const barcodeWidth = estimateCode128Width(text, moduleWidth);
    return Math.max(LABEL_LAYOUT.LEFT_MARGIN, Math.floor((labelWidthDots - barcodeWidth) / 2));
  };

  const defaultBarcode1X = calculateCenteredX(sampleText1, LABEL_LAYOUT.NARROW_BAR);
  const defaultBarcode2X = calculateCenteredX(sampleText2, LABEL_LAYOUT.NARROW_BAR);

  // Draft settings (editable form inputs) - initialized from LABEL_LAYOUT with centered defaults
  const [width, setWidth] = useState(48);
  const [height, setHeight] = useState(30);
  const [orientation, setOrientation] = useState('Portrait');
  const [showBarcodes, setShowBarcodes] = useState(true);
  const [barcodeType, setBarcodeType] = useState('CODE128');
  const [barcodeHeight, setBarcodeHeight] = useState(dotsToMm(LABEL_LAYOUT.BARCODE_HEIGHT));
  const [barcodeWidthScale, setBarcodeWidthScale] = useState(LABEL_LAYOUT.NARROW_BAR);
  const [firstBarcodeX, setFirstBarcodeX] = useState(dotsToMm(defaultBarcode1X));
  const [firstBarcodeY, setFirstBarcodeY] = useState(dotsToMm(LABEL_LAYOUT.TOP_MARGIN));
  const [secondBarcodeX, setSecondBarcodeX] = useState(dotsToMm(defaultBarcode2X));
  const [secondBarcodeY, setSecondBarcodeY] = useState(dotsToMm(LABEL_LAYOUT.TOP_MARGIN + LABEL_LAYOUT.BARCODE_SPACING));
  const [showTextLabels, setShowTextLabels] = useState(true);
  const [fontFamily, setFontFamily] = useState('Monospace');
  const [fontSize, setFontSize] = useState(10);
  const [firstTextX, setFirstTextX] = useState(dotsToMm(LABEL_LAYOUT.LEFT_MARGIN));
  const [firstTextY, setFirstTextY] = useState(dotsToMm(LABEL_LAYOUT.TOP_MARGIN + LABEL_LAYOUT.BARCODE_HEIGHT + LABEL_LAYOUT.TEXT_GAP));
  const [secondTextX, setSecondTextX] = useState(dotsToMm(LABEL_LAYOUT.LEFT_MARGIN));
  const [secondTextY, setSecondTextY] = useState(dotsToMm(LABEL_LAYOUT.TOP_MARGIN + LABEL_LAYOUT.BARCODE_SPACING + LABEL_LAYOUT.BARCODE_HEIGHT + LABEL_LAYOUT.TEXT_GAP));
  const [zoom, setZoom] = useState(100);
  const [requiredPrefixes, setRequiredPrefixes] = useState('55V, 72V, 55Y');
  const [successVolume, setSuccessVolume] = useState(50);
  const [errorVolume, setErrorVolume] = useState(50);
  const [printVolume, setPrintVolume] = useState(50);

  // Live preview toggle
  const [livePreview, setLivePreview] = useState(true);

  // Preview settings snapshot (drives canvas rendering)
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>({
    width,
    height,
    showBarcodes,
    barcodeHeight,
    barcodeWidthScale,
    firstBarcodeX,
    firstBarcodeY,
    secondBarcodeX,
    secondBarcodeY,
    showTextLabels,
    fontFamily,
    fontSize,
    firstTextX,
    firstTextY,
    secondTextX,
    secondTextY,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveMutation = useSaveLabelConfig();
  const addPrefixesMutation = useAddMultiplePrefixes();
  const initTitlesMutation = useInitializeDefaultTitles();
  const { data: validPrefixes = [] } = useGetValidPrefixes();
  const { data: titleMappings = [] } = useGetTitleMappings();

  // Initialize default title mappings on mount if empty
  useEffect(() => {
    if (titleMappings.length === 0) {
      initTitlesMutation.mutate();
    }
  }, [titleMappings.length]);

  // Load existing prefixes on mount
  useEffect(() => {
    if (validPrefixes.length > 0) {
      setRequiredPrefixes(validPrefixes.join(', '));
    }
  }, [validPrefixes]);

  // Auto-update preview when live preview is enabled
  useEffect(() => {
    if (livePreview) {
      setPreviewSettings({
        width,
        height,
        showBarcodes,
        barcodeHeight,
        barcodeWidthScale,
        firstBarcodeX,
        firstBarcodeY,
        secondBarcodeX,
        secondBarcodeY,
        showTextLabels,
        fontFamily,
        fontSize,
        firstTextX,
        firstTextY,
        secondTextX,
        secondTextY,
      });
    }
  }, [
    livePreview,
    width,
    height,
    showBarcodes,
    barcodeHeight,
    barcodeWidthScale,
    firstBarcodeX,
    firstBarcodeY,
    secondBarcodeX,
    secondBarcodeY,
    showTextLabels,
    fontFamily,
    fontSize,
    firstTextX,
    firstTextY,
    secondTextX,
    secondTextY,
  ]);

  // Manual update preview function
  const handleUpdatePreview = () => {
    setPreviewSettings({
      width,
      height,
      showBarcodes,
      barcodeHeight,
      barcodeWidthScale,
      firstBarcodeX,
      firstBarcodeY,
      secondBarcodeX,
      secondBarcodeY,
      showTextLabels,
      fontFamily,
      fontSize,
      firstTextX,
      firstTextY,
      secondTextX,
      secondTextY,
    });
  };

  // Render accurate CODE128 barcode on canvas with proper dual-barcode layout
  // Using device-independent scaling for consistent proportions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use high DPI for print quality (300 DPI standard)
    // 1mm = 11.811 pixels at 300 DPI
    const DPI = 300;
    const MM_TO_PX = DPI / 25.4; // 25.4mm per inch
    
    // Get device pixel ratio for sharp rendering on high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate canvas size in pixels at 300 DPI
    const canvasWidthPx = previewSettings.width * MM_TO_PX;
    const canvasHeightPx = previewSettings.height * MM_TO_PX;
    
    // Set canvas bitmap size (accounting for device pixel ratio)
    canvas.width = canvasWidthPx * dpr;
    canvas.height = canvasHeightPx * dpr;
    
    // Scale context to account for device pixel ratio
    ctx.scale(dpr, dpr);
    
    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);

    const moduleWidth = previewSettings.barcodeWidthScale;
    
    if (previewSettings.showBarcodes) {
      // Render first barcode
      const barcode1Width = renderBarcode(
        ctx, 
        sampleText1, 
        previewSettings.firstBarcodeX * MM_TO_PX, 
        previewSettings.firstBarcodeY * MM_TO_PX, 
        moduleWidth, 
        previewSettings.barcodeHeight
      );
      
      // Render second barcode
      const barcode2Width = renderBarcode(
        ctx, 
        sampleText2, 
        previewSettings.secondBarcodeX * MM_TO_PX, 
        previewSettings.secondBarcodeY * MM_TO_PX, 
        moduleWidth, 
        previewSettings.barcodeHeight
      );

      // Render text labels centered below each barcode
      if (previewSettings.showTextLabels) {
        ctx.fillStyle = 'black';
        ctx.font = `${previewSettings.fontSize}pt ${previewSettings.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        // First text label - centered below first barcode
        const text1X = previewSettings.firstBarcodeX * MM_TO_PX + barcode1Width / 2;
        const text1Y = previewSettings.firstTextY * MM_TO_PX;
        ctx.fillText(sampleText1, text1X, text1Y);
        
        // Second text label - centered below second barcode
        const text2X = previewSettings.secondBarcodeX * MM_TO_PX + barcode2Width / 2;
        const text2Y = previewSettings.secondTextY * MM_TO_PX;
        ctx.fillText(sampleText2, text2X, text2Y);
      }
    } else if (previewSettings.showTextLabels) {
      // If only text labels are shown (no barcodes)
      ctx.fillStyle = 'black';
      ctx.font = `${previewSettings.fontSize}pt ${previewSettings.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      ctx.fillText(sampleText1, previewSettings.firstTextX * MM_TO_PX, previewSettings.firstTextY * MM_TO_PX);
      ctx.fillText(sampleText2, previewSettings.secondTextX * MM_TO_PX, previewSettings.secondTextY * MM_TO_PX);
    }
  }, [
    previewSettings,
  ]);

  const renderBarcode = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    moduleWidth: number,
    height: number
  ): number => {
    const codes = encodeCode128B(text);
    let currentX = x;

    ctx.fillStyle = 'black';

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const pattern = CODE128_PATTERNS[code];
      
      if (!pattern) continue;

      for (let j = 0; j < pattern.length; j++) {
        const barWidth = pattern[j] * moduleWidth;
        
        if (j % 2 === 0) {
          ctx.fillRect(currentX, y, barWidth, height);
        }
        
        currentX += barWidth;
      }
    }

    // Add stop bar
    ctx.fillRect(currentX, y, 2 * moduleWidth, height);
    currentX += 2 * moduleWidth;

    // Return total barcode width for text centering
    return currentX - x;
  };

  const handleSaveConfiguration = async () => {
    try {
      // Save label config with all layout parameters
      await saveMutation.mutateAsync({
        name: 'default',
        config: {
          width: BigInt(mmToDots(width)),
          height: BigInt(mmToDots(height)),
          margin: BigInt(0),
          barcodeType,
          customText: '',
          textSize: BigInt(fontSize),
          font: fontFamily,
          barcodePositionX: BigInt(mmToDots(firstBarcodeX)),
          barcodePositionY: BigInt(mmToDots(firstBarcodeY)),
          textPositionX: BigInt(mmToDots(firstTextX)),
          textPositionY: BigInt(mmToDots(firstTextY)),
          barcodeHeight: BigInt(mmToDots(barcodeHeight)),
          barcodeWidthScale: BigInt(barcodeWidthScale),
          horizontalSpacing: BigInt(mmToDots(secondBarcodeY - firstBarcodeY)),
          centerContents: true,
        },
      });

      // Save prefixes
      if (requiredPrefixes.trim()) {
        await addPrefixesMutation.mutateAsync(requiredPrefixes);
      }

      toast.success('Configuration saved!');
    } catch (error) {
      toast.error('Failed to save configuration', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleExportConfig = () => {
    const config = {
      width,
      height,
      orientation,
      showBarcodes,
      barcodeType,
      barcodeHeight,
      barcodeWidthScale,
      firstBarcodeX,
      firstBarcodeY,
      secondBarcodeX,
      secondBarcodeY,
      showTextLabels,
      fontFamily,
      fontSize,
      firstTextX,
      firstTextY,
      secondTextX,
      secondTextY,
      requiredPrefixes,
      successVolume,
      errorVolume,
      printVolume,
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'label-config.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Configuration exported!');
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const config = JSON.parse(event.target?.result as string);
            setWidth(config.width);
            setHeight(config.height);
            setOrientation(config.orientation);
            setShowBarcodes(config.showBarcodes);
            setBarcodeType(config.barcodeType);
            setBarcodeHeight(config.barcodeHeight);
            setBarcodeWidthScale(config.barcodeWidthScale);
            setFirstBarcodeX(config.firstBarcodeX);
            setFirstBarcodeY(config.firstBarcodeY);
            setSecondBarcodeX(config.secondBarcodeX);
            setSecondBarcodeY(config.secondBarcodeY);
            setShowTextLabels(config.showTextLabels);
            setFontFamily(config.fontFamily);
            setFontSize(config.fontSize);
            setFirstTextX(config.firstTextX);
            setFirstTextY(config.firstTextY);
            setSecondTextX(config.secondTextX);
            setSecondTextY(config.secondTextY);
            // Handle both old single prefix and new multi-prefix format
            setRequiredPrefixes(config.requiredPrefixes || config.requiredPrefix || '');
            setSuccessVolume(config.successVolume);
            setErrorVolume(config.errorVolume);
            setPrintVolume(config.printVolume);
            toast.success('Configuration imported!');
          } catch (error) {
            toast.error('Invalid configuration file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-120px)] pr-2">
        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-xl">Label Dimensions</CardTitle>
            <CardDescription className="text-zinc-400 text-base">
              Configure the physical size of your labels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width" className="text-white text-base">
                  Width (mm)
                </Label>
                <Input
                  id="width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-white text-base">
                  Height (mm)
                </Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orientation" className="text-white text-base">
                Orientation
              </Label>
              <Select value={orientation} onValueChange={setOrientation}>
                <SelectTrigger id="orientation" className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-zinc-700">
                  <SelectItem value="Portrait" className="text-base">Portrait</SelectItem>
                  <SelectItem value="Landscape" className="text-base">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-xl">Barcode Settings</CardTitle>
            <CardDescription className="text-zinc-400 text-base">
              Adjust barcode appearance and position
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="show-barcodes" className="text-white text-base">
                Show Barcodes
              </Label>
              <Switch
                id="show-barcodes"
                checked={showBarcodes}
                onCheckedChange={setShowBarcodes}
                className="data-[state=checked]:bg-blue-600 scale-125"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="barcode-type" className="text-white text-base">
                Barcode Type
              </Label>
              <Select value={barcodeType} onValueChange={setBarcodeType}>
                <SelectTrigger id="barcode-type" className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-zinc-700">
                  <SelectItem value="CODE128" className="text-base">CODE128</SelectItem>
                  <SelectItem value="QR" className="text-base">QR Code</SelectItem>
                  <SelectItem value="EAN13" className="text-base">EAN-13</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-base">Barcode Size</Label>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Height: {barcodeHeight}mm</span>
                  </div>
                  <Slider
                    value={[barcodeHeight]}
                    onValueChange={(v) => setBarcodeHeight(v[0])}
                    min={3}
                    max={15}
                    step={0.5}
                    className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Width Scale: {barcodeWidthScale}x</span>
                  </div>
                  <Slider
                    value={[barcodeWidthScale]}
                    onValueChange={(v) => setBarcodeWidthScale(v[0])}
                    min={1}
                    max={4}
                    step={0.5}
                    className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-base">First Barcode Position</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-zinc-400">X Position: {firstBarcodeX}mm</Label>
                  <Input
                    type="number"
                    value={firstBarcodeX}
                    onChange={(e) => setFirstBarcodeX(Number(e.target.value))}
                    className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-zinc-400">Y Position: {firstBarcodeY}mm</Label>
                  <Input
                    type="number"
                    value={firstBarcodeY}
                    onChange={(e) => setFirstBarcodeY(Number(e.target.value))}
                    className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">X Position Slider</Label>
                <Slider
                  value={[firstBarcodeX]}
                  onValueChange={(v) => setFirstBarcodeX(v[0])}
                  min={0}
                  max={width}
                  step={0.5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">Y Position Slider</Label>
                <Slider
                  value={[firstBarcodeY]}
                  onValueChange={(v) => setFirstBarcodeY(v[0])}
                  min={0}
                  max={height}
                  step={0.5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-base">Second Barcode Position</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-zinc-400">X Position: {secondBarcodeX}mm</Label>
                  <Input
                    type="number"
                    value={secondBarcodeX}
                    onChange={(e) => setSecondBarcodeX(Number(e.target.value))}
                    className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-zinc-400">Y Position: {secondBarcodeY}mm</Label>
                  <Input
                    type="number"
                    value={secondBarcodeY}
                    onChange={(e) => setSecondBarcodeY(Number(e.target.value))}
                    className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">X Position Slider</Label>
                <Slider
                  value={[secondBarcodeX]}
                  onValueChange={(v) => setSecondBarcodeX(v[0])}
                  min={0}
                  max={width}
                  step={0.5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">Y Position Slider</Label>
                <Slider
                  value={[secondBarcodeY]}
                  onValueChange={(v) => setSecondBarcodeY(v[0])}
                  min={0}
                  max={height}
                  step={0.5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-xl">Text Label Settings</CardTitle>
            <CardDescription className="text-zinc-400 text-base">
              Configure text labels that appear beneath each barcode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="show-text" className="text-white text-base">
                Show Text Labels
              </Label>
              <Switch
                id="show-text"
                checked={showTextLabels}
                onCheckedChange={setShowTextLabels}
                className="data-[state=checked]:bg-blue-600 scale-125"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="font-family" className="text-white text-base">
                Font Family
              </Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger id="font-family" className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a1a] border-zinc-700">
                  <SelectItem value="Monospace" className="text-base">Monospace</SelectItem>
                  <SelectItem value="Arial" className="text-base">Arial</SelectItem>
                  <SelectItem value="Helvetica" className="text-base">Helvetica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-base">Font Size: {fontSize}pt</Label>
              <Slider
                value={[fontSize]}
                onValueChange={(v) => setFontSize(v[0])}
                min={6}
                max={16}
                step={1}
                className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-white text-base">First Text Label Position</Label>
              <p className="text-sm text-zinc-400">
                Text is centered horizontally below the barcode. Adjust Y position for vertical spacing.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-zinc-400">X Position: {firstTextX}mm</Label>
                  <Input
                    type="number"
                    value={firstTextX}
                    onChange={(e) => setFirstTextX(Number(e.target.value))}
                    className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-zinc-400">Y Position: {firstTextY}mm</Label>
                  <Input
                    type="number"
                    value={firstTextY}
                    onChange={(e) => setFirstTextY(Number(e.target.value))}
                    className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">Y Position Slider</Label>
                <Slider
                  value={[firstTextY]}
                  onValueChange={(v) => setFirstTextY(v[0])}
                  min={0}
                  max={height}
                  step={0.5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-base">Second Text Label Position</Label>
              <p className="text-sm text-zinc-400">
                Text is centered horizontally below the barcode. Adjust Y position for vertical spacing.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-zinc-400">X Position: {secondTextX}mm</Label>
                  <Input
                    type="number"
                    value={secondTextX}
                    onChange={(e) => setSecondTextX(Number(e.target.value))}
                    className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-zinc-400">Y Position: {secondTextY}mm</Label>
                  <Input
                    type="number"
                    value={secondTextY}
                    onChange={(e) => setSecondTextY(Number(e.target.value))}
                    className="bg-[#1a1a1a] border-zinc-700 text-white h-12 text-base"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-zinc-400">Y Position Slider</Label>
                <Slider
                  value={[secondTextY]}
                  onValueChange={(v) => setSecondTextY(v[0])}
                  min={0}
                  max={height}
                  step={0.5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-xl">Validation Settings</CardTitle>
            <CardDescription className="text-zinc-400 text-base">
              Configure barcode validation rules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prefixes" className="text-white text-base">
                Required Prefix (optional)
              </Label>
              <Textarea
                id="prefixes"
                value={requiredPrefixes}
                onChange={(e) => setRequiredPrefixes(e.target.value)}
                placeholder="e.g., 55V, 72V, 55Y"
                rows={3}
                className="bg-[#1a1a1a] border-zinc-700 text-white placeholder:text-zinc-500 resize-none text-base"
              />
              <p className="text-sm text-zinc-400">
                Scanned barcodes must start with one of these prefixes. Enter multiple prefixes separated by commas or on separate lines (e.g., "55V, 72V, 55Y").
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-xl">Sound Settings</CardTitle>
            <CardDescription className="text-zinc-400 text-base">
              Configure audio feedback for scanning and printing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label className="text-white text-base">Success Beep</Label>
              <Button variant="outline" className="w-full bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-12 text-base active:scale-95 transition-transform">
                <Upload className="w-5 h-5 mr-2" />
                Upload Custom
              </Button>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Volume: {successVolume}%</span>
                </div>
                <Slider
                  value={[successVolume]}
                  onValueChange={(v) => setSuccessVolume(v[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-base">Error Tone</Label>
              <Button variant="outline" className="w-full bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-12 text-base active:scale-95 transition-transform">
                <Upload className="w-5 h-5 mr-2" />
                Upload Custom
              </Button>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Volume: {errorVolume}%</span>
                </div>
                <Slider
                  value={[errorVolume]}
                  onValueChange={(v) => setErrorVolume(v[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-base">Print Completion</Label>
              <Button variant="outline" className="w-full bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-12 text-base active:scale-95 transition-transform">
                <Upload className="w-5 h-5 mr-2" />
                Upload Custom
              </Button>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Volume: {printVolume}%</span>
                </div>
                <Slider
                  value={[printVolume]}
                  onValueChange={(v) => setPrintVolume(v[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="[&_[role=slider]]:bg-blue-600 [&_[role=slider]]:w-6 [&_[role=slider]]:h-6"
                />
              </div>
            </div>

            <p className="text-sm text-zinc-400">
              Supported formats: MP3, WAV. Custom sounds are stored locally in your browser.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-xl">Configuration Management</CardTitle>
            <CardDescription className="text-zinc-400 text-base">
              Save, export, or import label settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleSaveConfiguration}
              disabled={saveMutation.isPending || addPrefixesMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-base active:scale-95 transition-transform"
            >
              <Save className="w-5 h-5 mr-2" />
              {saveMutation.isPending || addPrefixesMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
            <Button
              onClick={handleExportConfig}
              variant="outline"
              className="w-full bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-14 text-base active:scale-95 transition-transform"
            >
              <Download className="w-5 h-5 mr-2" />
              Export to File
            </Button>
            <Button
              onClick={handleImportConfig}
              variant="outline"
              className="w-full bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-14 text-base active:scale-95 transition-transform"
            >
              <Upload className="w-5 h-5 mr-2" />
              Import from File
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="sticky top-6 self-start">
        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-xl">Label Preview</CardTitle>
            <CardDescription className="text-zinc-400 text-base">
              Live preview of your label design with centered text labels below each barcode (zoomable)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
              <div className="flex items-center gap-3">
                <Label htmlFor="live-preview" className="text-white text-base font-medium">
                  Live Preview
                </Label>
                <Switch
                  id="live-preview"
                  checked={livePreview}
                  onCheckedChange={setLivePreview}
                  className="data-[state=checked]:bg-blue-600 scale-125"
                />
              </div>
              {!livePreview && (
                <Button
                  onClick={handleUpdatePreview}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-4 active:scale-95 transition-transform"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Update Preview
                </Button>
              )}
            </div>

            <div className="flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(Math.max(50, zoom - 10))}
                className="bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-12 px-4 active:scale-95 transition-transform"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
              <span className="text-white font-medium text-lg min-w-[60px] text-center">{zoom}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(Math.min(200, zoom + 10))}
                className="bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-12 px-4 active:scale-95 transition-transform"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setZoom(100)}
                className="bg-[#1a1a1a] border-zinc-700 text-white hover:bg-zinc-800 h-12 px-4 active:scale-95 transition-transform"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>

            <div 
              ref={containerRef}
              className="bg-zinc-900 rounded-lg p-8 flex items-center justify-center overflow-auto"
              style={{ maxHeight: 'calc(100vh - 400px)', minHeight: '500px' }}
            >
              <div
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.2s ease-out',
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="bg-white rounded shadow-lg"
                  style={{
                    width: `${previewSettings.width * 8}px`,
                    height: `${previewSettings.height * 8}px`,
                    imageRendering: 'crisp-edges',
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
