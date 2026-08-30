import { useState, useRef } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { motion } from 'framer-motion';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Download } from 'lucide-react';
import Button from '../shared/Button';
import { csvParser, type CSVTrade } from '../../services/csvParser';

interface CSVUploadProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CSVUpload({ onClose, onSuccess }: CSVUploadProps) {
  // Mounted only while showing, by both of its parents.
  useBodyScrollLock(true);
  const [file, setFile] = useState<File | null>(null);
  const [trades, setTrades] = useState<CSVTrade[]>([]);
  const [format, setFormat] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setErrors([]);
    setTrades([]);
    setImportResult(null);

    try {
      const result = await csvParser.parseCSV(selectedFile);
      setTrades(result.trades);
      setFormat(result.format);
      setErrors(result.errors);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to parse CSV file']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (trades.length === 0) return;

    setIsImporting(true);
    try {
      const result = await csvParser.importTrades(trades);
      setImportResult(result);

      if (result.imported > 0) {
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to import trades']);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      'Ticket,Symbol,Type,Volume,Open Price,Close Price,Open Time,Close Time,Profit,Commission,Swap,Comment',
      '12345,EURUSD,buy,0.10,1.1000,1.1050,2024-01-01 10:00:00,2024-01-01 12:00:00,50.00,-0.50,0.00,Test trade',
      '12346,GBPUSD,sell,0.05,1.2500,1.2450,2024-01-02 14:00:00,2024-01-02 16:00:00,25.00,-0.25,0.00,Another trade',
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trading-history-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-black/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <div className="p-6 border-b border-white/10 bg-black/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-400/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium">Import Trading History</h2>
              <p className="text-sm text-gray-400">Upload your trading history from any broker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="p-6 bg-black/40">
        {!file ? (
          <div className="space-y-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-lg p-12 text-center hover:border-gold-400/50 hover:bg-white/5 transition-all cursor-pointer"
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">Drop your CSV file here</h3>
              <p className="text-sm text-gray-400 mb-4">or click to browse</p>
              <p className="text-xs text-gray-500">Supports MT4, MT5, and generic trading history formats</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
              />
            </div>

            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-blue-400 font-medium">How to export from your broker:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• MT4/MT5: Account History → Right-click → Save as Report → Detailed Statement (CSV)</li>
                  <li>• Most brokers: Look for "Export" or "Download History" in your account dashboard</li>
                  <li>• Ensure the export includes: Symbol, Type, Volume, Prices, Times, and Profit</li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 text-xs text-gold-400 hover:text-gold-300 transition-colors mt-2"
                >
                  <Download size={14} />
                  Download Template CSV
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-gold-400" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(2)} KB
                    {format && ` • ${format.toUpperCase()} format detected`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setTrades([]);
                  setErrors([]);
                  setImportResult(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {isProcessing && (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-gold-400/20 border-t-gold-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Processing CSV file...</p>
              </div>
            )}

            {!isProcessing && trades.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-400">
                  <CheckCircle2 size={20} />
                  <span>Found {trades.length} trades ready to import</span>
                </div>

                <div className="max-h-64 overflow-y-auto border border-white/10 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Symbol</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-right">Volume</th>
                        <th className="px-4 py-2 text-right">Open Price</th>
                        <th className="px-4 py-2 text-left">Open Time</th>
                        <th className="px-4 py-2 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.slice(0, 50).map((trade, index) => (
                        <tr key={index} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-4 py-2">{trade.symbol}</td>
                          <td className="px-4 py-2">
                            <span className={trade.type === 'buy' ? 'text-blue-400' : 'text-gray-400'}>
                              {trade.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">{trade.volume.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{trade.open_price.toFixed(5)}</td>
                          <td className="px-4 py-2">{new Date(trade.open_time).toLocaleString()}</td>
                          <td className={`px-4 py-2 text-right ${trade.profit && trade.profit > 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                            {trade.profit ? `$${trade.profit.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {trades.length > 50 && (
                    <div className="p-2 text-center text-xs text-gray-500 bg-white/5">
                      Showing first 50 of {trades.length} trades
                    </div>
                  )}
                </div>

                {errors.length > 0 && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-xs text-yellow-400 mb-2">⚠️ Skipped {errors.length} rows:</p>
                    <div className="text-xs text-gray-400 space-y-1 max-h-24 overflow-y-auto">
                      {errors.slice(0, 5).map((error, i) => (
                        <p key={i}>{error}</p>
                      ))}
                      {errors.length > 5 && <p>...and {errors.length - 5} more</p>}
                    </div>
                  </div>
                )}

                {importResult && (
                  <div className={`p-4 rounded-lg ${importResult.imported > 0 ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {importResult.imported > 0 ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-blue-400" />
                          <span className="text-blue-400 font-medium">
                            Successfully imported {importResult.imported} trades!
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 font-medium">Import failed</span>
                        </>
                      )}
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="text-xs text-gray-400 space-y-1">
                        {importResult.errors.slice(0, 3).map((error, i) => (
                          <p key={i}>{error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isProcessing && trades.length === 0 && errors.length > 0 && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 font-medium">Failed to parse CSV</span>
                </div>
                <div className="text-sm text-gray-400 space-y-1">
                  {errors.map((error, i) => (
                    <p key={i}>{error}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null);
                  setTrades([]);
                  setErrors([]);
                  setImportResult(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                isLoading={isImporting}
                disabled={trades.length === 0 || isProcessing}
              >
                Import {trades.length} Trades
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
