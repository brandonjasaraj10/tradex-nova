import { supabase } from '../lib/supabase';

export interface CSVTrade {
  ticket?: string;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  open_price: number;
  close_price?: number;
  open_time: string;
  close_time?: string;
  profit?: number;
  commission?: number;
  swap?: number;
  comment?: string;
}

export class CSVParser {
  private static detectFormat(headers: string[]): 'mt4' | 'mt5' | 'generic' | null {
    const headerStr = headers.join(',').toLowerCase();

    if (headerStr.includes('ticket') && headerStr.includes('open time') && headerStr.includes('type')) {
      return headerStr.includes('magic') ? 'mt5' : 'mt4';
    }

    if (headerStr.includes('symbol') && headerStr.includes('profit')) {
      return 'generic';
    }

    return null;
  }

  private static parseDate(dateStr: string): string {
    const formats = [
      /(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
      /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
      /(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/,
      /(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/,
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0] || format === formats[1]) {
          const [, year, month, day, hour, minute, second] = match;
          return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        } else {
          const [, day, month, year, hour, minute, second] = match;
          return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
        }
      }
    }

    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    return dateStr;
  }

  private static parseMT4Row(row: any): CSVTrade | null {
    try {
      const type = row['Type']?.toLowerCase();
      if (!type || (!type.includes('buy') && !type.includes('sell'))) {
        return null;
      }

      return {
        ticket: row['Ticket'] || row['Order'],
        symbol: row['Symbol'],
        type: type.includes('buy') ? 'buy' : 'sell',
        volume: parseFloat(row['Volume'] || row['Lots'] || '0'),
        open_price: parseFloat(row['Price'] || row['Open Price'] || '0'),
        close_price: row['Close Price'] ? parseFloat(row['Close Price']) : undefined,
        open_time: this.parseDate(row['Open Time'] || row['Time']),
        close_time: row['Close Time'] ? this.parseDate(row['Close Time']) : undefined,
        profit: row['Profit'] ? parseFloat(row['Profit']) : undefined,
        commission: row['Commission'] ? parseFloat(row['Commission']) : undefined,
        swap: row['Swap'] ? parseFloat(row['Swap']) : undefined,
        comment: row['Comment'],
      };
    } catch (error) {
      console.error('Error parsing MT4 row:', error);
      return null;
    }
  }

  private static parseMT5Row(row: any): CSVTrade | null {
    try {
      const type = row['Type']?.toLowerCase();
      if (!type || (!type.includes('buy') && !type.includes('sell'))) {
        return null;
      }

      return {
        ticket: row['Ticket'] || row['Order'] || row['Deal'],
        symbol: row['Symbol'],
        type: type.includes('buy') ? 'buy' : 'sell',
        volume: parseFloat(row['Volume'] || row['Lots'] || '0'),
        open_price: parseFloat(row['Price'] || row['Open Price'] || '0'),
        close_price: row['Close Price'] ? parseFloat(row['Close Price']) : undefined,
        open_time: this.parseDate(row['Open Time'] || row['Time']),
        close_time: row['Close Time'] ? this.parseDate(row['Close Time']) : undefined,
        profit: row['Profit'] ? parseFloat(row['Profit']) : undefined,
        commission: row['Commission'] ? parseFloat(row['Commission']) : undefined,
        swap: row['Swap'] ? parseFloat(row['Swap']) : undefined,
        comment: row['Comment'],
      };
    } catch (error) {
      console.error('Error parsing MT5 row:', error);
      return null;
    }
  }

  private static parseGenericRow(row: any): CSVTrade | null {
    try {
      const symbolKey = Object.keys(row).find(k => k.toLowerCase().includes('symbol'));
      const typeKey = Object.keys(row).find(k => k.toLowerCase().includes('type') || k.toLowerCase().includes('side'));
      const volumeKey = Object.keys(row).find(k => k.toLowerCase().includes('volume') || k.toLowerCase().includes('lots') || k.toLowerCase().includes('size'));
      const priceKey = Object.keys(row).find(k => k.toLowerCase().includes('price') || k.toLowerCase().includes('entry'));
      const profitKey = Object.keys(row).find(k => k.toLowerCase().includes('profit') || k.toLowerCase().includes('pnl'));
      const timeKey = Object.keys(row).find(k => k.toLowerCase().includes('time') || k.toLowerCase().includes('date'));

      if (!symbolKey || !typeKey || !priceKey || !timeKey) {
        return null;
      }

      const type = row[typeKey]?.toLowerCase();
      if (!type || (!type.includes('buy') && !type.includes('sell') && !type.includes('long') && !type.includes('short'))) {
        return null;
      }

      return {
        symbol: row[symbolKey],
        type: (type.includes('buy') || type.includes('long')) ? 'buy' : 'sell',
        volume: volumeKey ? parseFloat(row[volumeKey] || '0') : 0.01,
        open_price: parseFloat(row[priceKey] || '0'),
        open_time: this.parseDate(row[timeKey]),
        profit: profitKey ? parseFloat(row[profitKey]) : undefined,
      };
    } catch (error) {
      console.error('Error parsing generic row:', error);
      return null;
    }
  }

  static async parseCSV(file: File): Promise<{ trades: CSVTrade[], format: string, errors: string[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());

          if (lines.length < 2) {
            reject(new Error('CSV file is empty or has no data rows'));
            return;
          }

          const headers = lines[0].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => h.trim().replace(/^"|"$/g, ''));
          const format = this.detectFormat(headers);

          if (!format) {
            reject(new Error('Unsupported CSV format. Please use MT4, MT5, or a generic trading history export.'));
            return;
          }

          const trades: CSVTrade[] = [];
          const errors: string[] = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
            const row: any = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            let trade: CSVTrade | null = null;

            switch (format) {
              case 'mt4':
                trade = this.parseMT4Row(row);
                break;
              case 'mt5':
                trade = this.parseMT5Row(row);
                break;
              case 'generic':
                trade = this.parseGenericRow(row);
                break;
            }

            if (trade) {
              trades.push(trade);
            } else {
              errors.push(`Row ${i + 1}: Could not parse trade data`);
            }
          }

          resolve({ trades, format, errors });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  static async importTrades(trades: CSVTrade[], connectionId?: string): Promise<{ imported: number, updated: number, errors: string[] }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const trade of trades) {
      try {
        const tradeData: any = {
          user_id: user.id,
          broker_id: connectionId || null,
          external_id: trade.ticket || `manual_${Date.now()}_${Math.random()}`,
          symbol: trade.symbol,
          type: trade.type,
          volume: trade.volume,
          open_price: trade.open_price,
          close_price: trade.close_price,
          open_time: trade.open_time,
          close_time: trade.close_time,
          profit: trade.profit,
          commission: trade.commission || 0,
          swap: trade.swap || 0,
          comment: trade.comment,
          status: trade.close_time ? 'closed' : 'open',
        };

        const { error } = await supabase
          .from('trades')
          .upsert(tradeData, {
            onConflict: 'external_id,user_id',
            ignoreDuplicates: false,
          });

        if (error) {
          errors.push(`Failed to import ${trade.symbol}: ${error.message}`);
        } else {
          imported++;
        }
      } catch (error) {
        errors.push(`Failed to import ${trade.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, updated, errors };
  }
}

export const csvParser = CSVParser;
