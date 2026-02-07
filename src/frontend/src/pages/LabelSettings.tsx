import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ZoomIn, ZoomOut, RotateCcw, Save } from 'lucide-react';
import { useSaveLabelConfig, useGetValidPrefixes, useAddMultiplePrefixes, useGetTitleMappings, useInitializeDefaultTitles, useLabelConfigs } from '../hooks/useQueries';
import { toast } from 'sonner';
import { computeDualSerialLayout, dotsToMm, mmToDots, LABEL_DOTS, DEFAULT_LAYOUT } from '../utils/labelLayoutModel';
import { renderLabelPreview } from '../utils/labelPreviewRenderer';
import { LabelConfig } from '../backend';

const DEFAULT_TEXT_SIZE = 10;

export function LabelSettings() {
  // Sample serials for preview
  const sampleText1 = '55V10M29F04381';
  const sampleText2 = '55V10M29F04362';
  const sampleTitle = 'Dual Band';

  // Load existing config
  const { data: labelConfigs = [], isLoading: configsLoading } = useLabelConfigs();
  const existingConfig = labelConfigs.find(() => true); // Get first config (default)

  // Draft settings (editable form inputs) - initialized from existing config or defaults
  const [barcodeHeight, setBarcodeHeight] = useState(
    existingConfig ? dotsToMm(Number(existingConfig.barcodeHeight)) : dotsToMm(DEFAULT_LAYOUT.BARCODE_HEIGHT)
  );
  const [barcodeWidthScale, setBarcodeWidthScale] = useState(
    existingConfig ? Number(existingConfig.barcodeWidthScale) : DEFAULT_LAYOUT.NARROW_BAR
  );
  const [textGap, setTextGap] = useState(
    existingConfig 
      ? dotsToMm(Number(existingConfig.textPositionY) - Number(existingConfig.barcodePositionY) - Number(existingConfig.barcodeHeight))
      : dotsToMm(DEFAULT_LAYOUT.TEXT_GAP)
  );
  const [blockSpacing, setBlockSpacing] = useState(
    existingConfig ? dotsToMm(Number(existingConfig.horizontalSpacing)) : dotsToMm(DEFAULT_LAYOUT.BLOCK_SPACING)
  );
  const [centerContents, setCenterContents] = useState(
    existingConfig ? existingConfig.centerContents : true
  );
  const [serialTextSize, setSerialTextSize] = useState(
    existingConfig && Number(existingConfig.textSize) > 0 ? Number(existingConfig.textSize) : DEFAULT_TEXT_SIZE
  );
  
  const [zoom, setZoom] = useState(100);
  const [requiredPrefixes, setRequiredPrefixes] = useState('55V, 72V, 55Y');

  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Update form values when config loads
  useEffect(() => {
    if (existingConfig && !configsLoading) {
      setBarcodeHeight(dotsToMm(Number(existingConfig.barcodeHeight)));
      setBarcodeWidthScale(Number(existingConfig.barcodeWidthScale));
      setTextGap(dotsToMm(Number(existingConfig.textPositionY) - Number(existingConfig.barcodePositionY) - Number(existingConfig.barcodeHeight)));
      setBlockSpacing(dotsToMm(Number(existingConfig.horizontalSpacing)));
      setCenterContents(existingConfig.centerContents);
      setSerialTextSize(Number(existingConfig.textSize) > 0 ? Number(existingConfig.textSize) : DEFAULT_TEXT_SIZE);
    }
  }, [existingConfig, configsLoading]);

  // Build config object for layout computation
  const buildConfigForPreview = (): LabelConfig => {
    const barcodeHeightDots = mmToDots(barcodeHeight);
    const textGapDots = mmToDots(textGap);
    const blockSpacingDots = mmToDots(blockSpacing);
    
    return {
      width: BigInt(LABEL_DOTS.WIDTH),
      height: BigInt(LABEL_DOTS.HEIGHT),
      margin: BigInt(0),
      barcodeType: 'CODE128',
      customText: '',
      textSize: BigInt(serialTextSize),
      font: 'Monospace',
      barcodePositionX: BigInt(DEFAULT_LAYOUT.LEFT_MARGIN),
      barcodePositionY: BigInt(DEFAULT_LAYOUT.TOP_MARGIN),
      textPositionX: BigInt(DEFAULT_LAYOUT.LEFT_MARGIN),
      textPositionY: BigInt(DEFAULT_LAYOUT.TOP_MARGIN + barcodeHeightDots + textGapDots),
      barcodeHeight: BigInt(barcodeHeightDots),
      barcodeWidthScale: BigInt(barcodeWidthScale),
      horizontalSpacing: BigInt(blockSpacingDots),
      centerContents,
    };
  };

  // Render preview using unified layout model and shared renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Compute layout using unified model
    const config = buildConfigForPreview();
    const layout = computeDualSerialLayout(sampleText1, sampleText2, sampleTitle, config);

    // Render using shared preview renderer
    renderLabelPreview(canvas, layout, sampleText1, sampleText2, sampleTitle, zoom, serialTextSize);
  }, [barcodeHeight, barcodeWidthScale, textGap, blockSpacing, centerContents, serialTextSize, zoom]);

  const handleSaveConfiguration = async () => {
    try {
      const config = buildConfigForPreview();
      
      await saveMutation.mutateAsync({
        name: 'default',
        config,
      });

      toast.success('Configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error('Failed to save configuration');
    }
  };

  const handleSavePrefixes = async () => {
    try {
      const prefixArray = requiredPrefixes
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      await addPrefixesMutation.mutateAsync(prefixArray);
      toast.success('Prefixes saved successfully!');
    } catch (error) {
      console.error('Failed to save prefixes:', error);
      toast.error('Failed to save prefixes');
    }
  };

  const handleResetToDefaults = () => {
    setBarcodeHeight(dotsToMm(DEFAULT_LAYOUT.BARCODE_HEIGHT));
    setBarcodeWidthScale(DEFAULT_LAYOUT.NARROW_BAR);
    setTextGap(dotsToMm(DEFAULT_LAYOUT.TEXT_GAP));
    setBlockSpacing(dotsToMm(DEFAULT_LAYOUT.BLOCK_SPACING));
    setCenterContents(true);
    setSerialTextSize(DEFAULT_TEXT_SIZE);
    setZoom(100);
    toast.info('Reset to default values');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview Card */}
        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Label Preview</CardTitle>
            <CardDescription className="text-zinc-400">
              Live preview of your label design (matches printed output exactly)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setZoom(Math.max(50, zoom - 10))}
                  className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-white text-sm min-w-[60px] text-center">{zoom}%</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setZoom(Math.min(200, zoom + 10))}
                  className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToDefaults}
                className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>

            <div className="bg-zinc-900 rounded-lg p-6 flex items-center justify-center min-h-[300px]">
              <canvas
                ref={canvasRef}
                className="border border-zinc-700 rounded shadow-lg"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            <div className="text-xs text-zinc-500 space-y-1">
              <p>• Preview shows exactly how the label will print</p>
              <p>• Adjust settings below to customize layout</p>
              <p>• Changes apply to both preview and printed labels</p>
            </div>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card className="bg-[#0f0f0f] border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Label Configuration</CardTitle>
            <CardDescription className="text-zinc-400">
              Customize barcode size, spacing, and positioning
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Centering Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="center-contents" className="text-white">
                  Center Contents
                </Label>
                <Switch
                  id="center-contents"
                  checked={centerContents}
                  onCheckedChange={setCenterContents}
                />
              </div>
              <p className="text-xs text-zinc-500">
                Automatically center barcodes and text horizontally
              </p>
            </div>

            {/* Barcode Height */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="barcode-height" className="text-white">
                  Barcode Height
                </Label>
                <span className="text-sm text-zinc-400">{barcodeHeight.toFixed(1)} mm</span>
              </div>
              <Slider
                id="barcode-height"
                min={5}
                max={15}
                step={0.5}
                value={[barcodeHeight]}
                onValueChange={([value]) => setBarcodeHeight(value)}
                className="w-full"
              />
            </div>

            {/* Barcode Width Scale */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="barcode-width" className="text-white">
                  Barcode Width Scale
                </Label>
                <span className="text-sm text-zinc-400">{barcodeWidthScale}x</span>
              </div>
              <Slider
                id="barcode-width"
                min={1}
                max={3}
                step={1}
                value={[barcodeWidthScale]}
                onValueChange={([value]) => setBarcodeWidthScale(value)}
                className="w-full"
              />
            </div>

            {/* Text Gap */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="text-gap" className="text-white">
                  Barcode-to-Text Gap
                </Label>
                <span className="text-sm text-zinc-400">{textGap.toFixed(1)} mm</span>
              </div>
              <Slider
                id="text-gap"
                min={0.5}
                max={5}
                step={0.5}
                value={[textGap]}
                onValueChange={([value]) => setTextGap(value)}
                className="w-full"
              />
              <p className="text-xs text-zinc-500">
                Space between barcode bottom and serial number text
              </p>
            </div>

            {/* Block Spacing */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="block-spacing" className="text-white">
                  Block Spacing
                </Label>
                <span className="text-sm text-zinc-400">{blockSpacing.toFixed(1)} mm</span>
              </div>
              <Slider
                id="block-spacing"
                min={8}
                max={20}
                step={0.5}
                value={[blockSpacing]}
                onValueChange={([value]) => setBlockSpacing(value)}
                className="w-full"
              />
              <p className="text-xs text-zinc-500">
                Vertical space between first and second barcode blocks
              </p>
            </div>

            {/* Serial Text Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="serial-text-size" className="text-white">
                  Serial Text Size
                </Label>
                <span className="text-sm text-zinc-400">{serialTextSize}</span>
              </div>
              <Slider
                id="serial-text-size"
                min={6}
                max={16}
                step={1}
                value={[serialTextSize]}
                onValueChange={([value]) => setSerialTextSize(value)}
                className="w-full"
              />
              <p className="text-xs text-zinc-500">
                Font size for serial number text (affects both preview and print)
              </p>
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSaveConfiguration}
              disabled={saveMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Prefix Configuration Card */}
      <Card className="bg-[#0f0f0f] border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Barcode Prefix Validation</CardTitle>
          <CardDescription className="text-zinc-400">
            Configure valid barcode prefixes for scanning validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prefixes" className="text-white">
              Required Prefixes (comma-separated)
            </Label>
            <Textarea
              id="prefixes"
              value={requiredPrefixes}
              onChange={(e) => setRequiredPrefixes(e.target.value)}
              placeholder="55V, 72V, 55Y"
              className="bg-zinc-900 border-zinc-700 text-white min-h-[100px]"
            />
            <p className="text-xs text-zinc-500">
              Only barcodes starting with these prefixes will be accepted during scanning
            </p>
          </div>

          <Button
            onClick={handleSavePrefixes}
            disabled={addPrefixesMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {addPrefixesMutation.isPending ? 'Saving...' : 'Save Prefixes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
