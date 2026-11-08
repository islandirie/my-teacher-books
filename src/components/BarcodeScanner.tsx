import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { audioService } from '../services/AudioService';

interface BarcodeScannerProps {
  onScan: (isbn: string) => void | Promise<unknown>;
  continuous?: boolean;
  instructionText?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  continuous = false,
  instructionText = 'Align the book barcode within the frame'
}) => {
  const scannerContainerId = useRef(`barcode-scanner-${Math.random().toString(36).substring(2, 9)}`);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualIsbn, setManualIsbn] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const isHandlingScanRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let isMounted = true;
    const elementId = scannerContainerId.current;

    async function startScanner() {
      try {
        setCameraError(null);
        const scanner = new Html5Qrcode(elementId);
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 160 },
            aspectRatio: 1.333333
          },
          (decodedText) => {
            if (!isMounted) return;
            if (isHandlingScanRef.current) return;

            isHandlingScanRef.current = true;
            audioService.playScanBeep();
            const result = onScanRef.current(decodedText);

            if (continuous) {
              // Re-arm only after the scan finishes processing plus a cooldown
              Promise.resolve(result)
                .catch(() => {})
                .then(() => {
                  setTimeout(() => {
                    isHandlingScanRef.current = false;
                  }, 1200);
                });
            } else {
              // In single scan mode, stop scanner immediately
              scanner.stop().catch(() => {}).finally(() => {
                setIsScanning(false);
              });
            }
          },
          () => {
            // Frame scan failure is normal during scanning
          }
        );

        if (isMounted) {
          setIsScanning(true);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        console.warn('[BarcodeScanner] Camera init error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setCameraError('Camera access was blocked. Please enable camera permissions in your browser.');
        } else {
          setCameraError('Unable to access camera on this device. You can enter the ISBN manually below.');
        }
        setIsScanning(false);
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(() => {}).finally(() => {
            html5QrCodeRef.current?.clear();
          });
        } else {
          html5QrCodeRef.current.clear();
        }
      }
    };
  }, [continuous]); // onScan is read via ref so parent re-renders never restart the camera

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualIsbn.trim();
    if (!clean) return;
    audioService.playScanBeep();
    onScan(clean);
    setManualIsbn('');
  };

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      {/* Scanner Viewport */}
      <div className="relative w-full max-w-md bg-slate-900 rounded-2xl overflow-hidden aspect-4/3 flex items-center justify-center border-2 border-slate-700 dark:border-[#2a2f5a] shadow-md">
        <div id={scannerContainerId.current} className="w-full h-full" />

        {/* Framing Reticle */}
        {isScanning && !cameraError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-64 h-36 border-2 border-dashed border-amber-400 rounded-xl relative shadow-lg">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/80 -translate-y-1/2 animate-pulse" />
            </div>
            <p className="mt-4 px-3 py-1 bg-black/70 text-white text-xs font-medium rounded-full backdrop-blur-sm shadow">
              {instructionText}
            </p>
          </div>
        )}

        {/* Camera Error Banner */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-900/95 p-6 flex flex-col items-center justify-center text-center text-white space-y-3">
            <AlertCircle className="w-10 h-10 text-amber-400" />
            <p className="text-sm text-slate-300 max-w-xs">{cameraError}</p>
          </div>
        )}

        {/* Loading Spinner */}
        {!isScanning && !cameraError && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white space-y-2">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-xs text-slate-400">Starting camera...</p>
          </div>
        )}
      </div>

      {/* Manual Input Fallback */}
      <form onSubmit={handleManualSubmit} className="w-full max-w-md flex items-center space-x-2">
        <div className="relative flex-1">
          <input
            id="barcodeScannerManualIsbn"
            name="isbn"
            autoComplete="off"
            type="text"
            placeholder="Or type ISBN barcode..."
            value={manualIsbn}
            onChange={(e) => setManualIsbn(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#0c0e1e] border border-slate-300 dark:border-[#2a2f5a] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Camera className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
        <button
          type="submit"
          disabled={!manualIsbn.trim()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium flex items-center space-x-1 transition shadow-sm cursor-pointer"
        >
          <span>Submit</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
