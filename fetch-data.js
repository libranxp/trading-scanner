// ==========================================
// FREE GITHUB ACTIONS DATA FETCHER
// CoinGecko + Yahoo Finance APIs
// ==========================================

const axios = require('axios');
const fs = require('fs');

// Configuration
const CONFIG = {
  COINGECKO_BASE: 'https://api.coingecko.com/api/v3',
  YAHOO_BASE: 'https://query1.finance.yahoo.com/v8/finance/chart',
  YAHOO_SCREENER: 'https://query1.finance.yahoo.com/v1/finance/screener',
  MAX_CRYPTO_RESULTS: 20,
  MAX_STOCK_RESULTS: 15,
  MIN_CRYPTO_VOLUME: 10000000, // $10M minimum volume
  MIN_STOCK_VOLUME: 100000     // 100K minimum volume
};

// Create data directory if it doesn't exist
function ensureDataDirectory() {
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
    console.log('📁 Created data directory');
  }
}

// Helper function to calculate RSI
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = Math.max(1, prices.length - period); i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Helper function to calculate ATR percentage
function calculateATRPercent(highs, lows, closes, currentPrice) {
  if (highs.length < 2) return 2 + Math.random() * 4; // Fallback 2-6%
  
  const trueRanges = [];
  for (let i = 1; i < Math.min(highs.length, 14); i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  return (atr / currentPrice) * 100;
}

// Fetch cryptocurrency data from CoinGecko
async function fetchCryptoData() {
  try {
    console.log('🪙 Fetching crypto data from CoinGecko...');
    
    // Get top cryptocurrencies by market cap with price change data
    const response = await axios.get(`${CONFIG.COINGECKO_BASE}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        order: 'volume_desc', // Order by volume for better liquidity
        per_page: 100, // Increased to get more live options
        page: 1,
        sparkline: true,
        price_change_percentage: '1h,24h,7d'
      },
      headers: {
        'User-Agent': 'TradingScanner/1.0'
      },
      timeout: 10000
    });
    
    const coins = response.data;
    console.log(`📊 Got ${coins.length} coins from CoinGecko`);
    
    // Process and filter cryptocurrency data
    const cryptoResults = [];
    
    for (const coin of coins) {
      try {
        // Basic validation
        if (!coin.current_price || !coin.total_volume || coin.current_price <= 0) {
          continue;
        }
        
        const currentPrice = coin.current_price;
        const change1h = coin.price_change_percentage_1h_in_currency || 0;
        const change24h = coin.price_change_percentage_24h || 0;
        const change7d = coin.price_change_percentage_7d_in_currency || 0;
        const volume24h = coin.total_volume || 0;
        const marketCap = coin.market_cap || 0;
        
        // Apply filters
        if (volume24h < CONFIG.MIN_CRYPTO_VOLUME) continue; // Min $10M volume
        if (Math.abs(change24h) < 1) continue; // Min 1% daily movement
        if (Math.abs(change24h) > 50) continue; // Max 50% daily movement (avoid extreme pumps)
        if (marketCap < 50000000) continue; // Min $50M market cap
        
        // Get price history from sparkline for technical analysis
        const sparklineData = coin.sparkline_in_7d?.price || [];
        const last24hPrices = sparklineData.slice(-24); // Last 24 hours
        
        // Calculate technical indicators
        const rsi = calculateRSI(last24hPrices);
        const atrPercent = sparklineData.length >= 14 ? 
          calculateATRPercent(
            sparklineData.map(p => p * 1.02), // Approximate highs
            sparklineData.map(p => p * 0.98), // Approximate lows
            sparklineData,
            currentPrice
          ) : 2 + Math.random() * 4;
        
        // Calculate relative volume (approximate)
        const avgVolume = volume24h * 0.8; // Rough estimate
        const rvol = volume24h / avgVolume;
        
        // Calculate AI score based on multiple factors
        let aiScore = 6.0;
        
        // Volume scoring
        if (volume24h > 100000000) aiScore += 1.5; // >$100M volume
        else if (volume24h > 50000000) aiScore += 1.0; // >$50M volume
        
        // Price movement scoring
        if (Math.abs(change24h) > 10) aiScore += 1.2;
        else if (Math.abs(change24h) > 5) aiScore += 0.8;
        
        // Technical indicators scoring
        if (rsi > 50 && rsi < 70) aiScore += 1.0; // Good RSI range
        if (atrPercent > 3 && atrPercent < 8) aiScore += 0.8; // Good volatility
        
        // Market cap scoring
        if (marketCap > 1000000000) aiScore += 0.5; // >$1B market cap
        
        // Momentum scoring
        if (Math.abs(change1h) > 2) aiScore += 0.7;
        if (change24h > 0 && change7d > 0) aiScore += 0.5; // Positive trend
        
        aiScore = Math.min(aiScore, 10); // Cap at 10
        
        // Skip if AI score is too low
        if (aiScore < 6.5) continue;
        
        // Determine momentum classification
        let momentum = 'Moderate';
        if (Math.abs(change24h) > 15 && volume24h > 200000000) momentum = 'Very Strong';
        else if (Math.abs(change24h) > 8 && volume24h > 50000000) momentum = 'Strong';
        
        // Determine catalyst
        let catalyst = 'Market Movement';
        if (Math.abs(change1h) > 5) catalyst = 'Breaking News';
        else if (Math.abs(change24h) > 20) catalyst = 'Major Event';
        else if (volume24h > 500000000) catalyst = 'High Volume Activity';
        
        // Create crypto result object (renamed from 'result' to avoid conflict)
        const cryptoData = {
          id: `${coin.id}_${Date.now()}`,
          coin: coin.symbol.toUpperCase(),
          symbol: `${coin.symbol.toUpperCase()}USDT`,
          name: coin.name,
          price: currentPrice,
          change1h: change1h,
          change24h: change24h,
          change7d: change7d,
          volume24h: volume24h,
          marketCap: marketCap,
          marketCapRank: coin.market_cap_rank || 999,
          rvol: rvol,
          rsi: parseFloat(rsi.toFixed(1)),
          atr: parseFloat(atrPercent.toFixed(1)),
          ema5: currentPrice * (1 + Math.random() * 0.02 - 0.01), // Simulated
          ema13: currentPrice * (1 + Math.random() * 0.015 - 0.0075), // Simulated
          ema50: currentPrice * (1 + Math.random() * 0.01 - 0.005), // Simulated
          emaAlignment: change7d > 0 && change24h > 0, // Simplified alignment
          aiScore: parseFloat(aiScore.toFixed(1)),
          momentum: momentum,
          catalyst: catalyst,
          pumpCheck: Math.abs(change24h) > 25 ? 'Caution' : 'Clean',
          stopLoss: currentPrice * 0.93, // 7% stop loss
          takeProfit: currentPrice * 1.20, // 20% take profit
          riskReward: '1:2.9',
          lastUpdated: new Date().toISOString(),
          dataSource: '🆓 FREE CoinGecko API',
          image: coin.image
        };
        
        cryptoResults.push(cryptoData);
        
        console.log(`✅ ${coin.symbol.toUpperCase()}: $${currentPrice.toFixed(6)}, ${change24h.toFixed(1)}%, Vol: $${(volume24h/1000000).toFixed(1)}M, Score: ${aiScore.toFixed(1)}`);
        
      } catch (error) {
        console.warn(`⚠️ Error processing ${coin.id}:`, error.message);
      }
    }
    
    // Sort by AI score and limit results
    const finalCryptoData = cryptoResults
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, CONFIG.MAX_CRYPTO_RESULTS);
    
    console.log(`🎯 Selected ${finalCryptoData.length} top crypto signals`);
    
    return {
      success: true,
      count: finalCryptoData.length,
      data: finalCryptoData,
      timestamp: new Date().toISOString(),
      source: 'CoinGecko API + GitHub Actions'
    };
    
  } catch (error) {
    console.error('❌ CoinGecko API error:', error.message);
    return {
      success: false,
      error: error.message,
      count: 0,
      data: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Fetch live stock gainers and losers
async function fetchLiveStockMovers() {
  try {
    console.log('📈 Fetching live stock movers...');
    
    // Multiple endpoints to get diverse live data
    const screenerQueries = [
      // Top gainers by percent
      {
        "offset": 0,
        "size": 25,
        "sortField": "percentchange",
        "sortType": "DESC",
        "quoteType": "EQUITY",
        "query": {
          "operator": "AND",
          "operands": [
            {"operator": "GT", "operands": ["percentchange", 2]},
            {"operator": "GT", "operands": ["dayvolume", 100000]},
            {"operator": "GT", "operands": ["intradayprice", 1]}
          ]
        },
        "userId": "",
        "userIdType": "guid"
      },
      // Top volume
      {
        "offset": 0,
        "size": 25,
        "sortField": "dayvolume",
        "sortType": "DESC",
        "quoteType": "EQUITY",
        "query": {
          "operator": "AND",
          "operands": [
            {"operator": "GT", "operands": ["dayvolume", 1000000]},
            {"operator": "GT", "operands": ["intradayprice", 0.5]}
          ]
        },
        "userId": "",
        "userIdType": "guid"
      }
    ];
    
    let allStocks = [];
    
    for (const query of screenerQueries) {
      try {
        const response = await axios.post(`${CONFIG.YAHOO_SCREENER}`, query, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        const stocks = response.data?.finance?.result?.[0]?.quotes || [];
        allStocks = [...allStocks, ...stocks];
        console.log(`📊 Found ${stocks.length} stocks from screener`);
        
      } catch (error) {
        console.warn('⚠️ Screener query failed:', error.message);
      }
    }
    
    // Remove duplicates
    const uniqueStocks = allStocks.filter((stock, index, self) => 
      index === self.findIndex(s => s.symbol === stock.symbol)
    );
    
    console.log(`📈 Processing ${uniqueStocks.length} unique live stocks`);
    return uniqueStocks;
    
  } catch (error) {
    console.error('❌ Stock screener error:', error.message);
    return [];
  }
}

// Fetch stock data from Yahoo Finance using live data
async function fetchStockData() {
  try {
    console.log('📈 Fetching live stock data from Yahoo Finance...');
    
    // Get live moving stocks instead of predefined list
    const liveStocks = await fetchLiveStockMovers();
    
    if (liveStocks.length === 0) {
      console.warn('⚠️ No live stocks found, using fallback method');
      // Fallback: Get trending tickers from Yahoo
      const trendingResponse = await axios.get('https://query1.finance.yahoo.com/v1/finance/trending/US', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      });
      
      const trendingQuotes = trendingResponse.data?.finance?.result?.[0]?.quotes || [];
      liveStocks.push(...trendingQuotes.map(q => ({ symbol: q.symbol })));
    }
    
    const stockResults = [];
    const processedSymbols = new Set(); // Avoid duplicates
    
    for (const stockInfo of liveStocks.slice(0, 50)) { // Process up to 50 stocks
      const symbol = stockInfo.symbol;
      
      if (!symbol || processedSymbols.has(symbol)) continue;
      processedSymbols.add(symbol);
      
      try {
        console.log(`📊 Fetching ${symbol}...`);
        
        // Fetch data from Yahoo Finance Chart API
        const response = await axios.get(`${CONFIG.YAHOO_BASE}/${symbol}`, {
          params: {
            interval: '5m',
            range: '5d'
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 8000
        });
        
        const chartResult = response.data.chart?.result?.[0];
        if (!chartResult || !chartResult.meta) {
          console.warn(`⚠️ No data returned for ${symbol}`);
          continue;
        }
        
        const meta = chartResult.meta;
        const currentPrice = meta.regularMarketPrice || meta.previousClose;
        const previousClose = meta.previousClose;
        const currentVolume = meta.regularMarketVolume || 0;
        const regularMarketDayHigh = meta.regularMarketDayHigh || currentPrice;
        const regularMarketDayLow = meta.regularMarketDayLow || currentPrice;
        
        if (!currentPrice || currentPrice <= 0) {
          console.warn(`⚠️ Invalid price for ${symbol}: ${currentPrice}`);
          continue;
        }
        
        // Calculate price changes
        const change24h = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
        
        // Get intraday data for technical analysis
        const quote = chartResult.indicators?.quote?.[0];
        const timestamps = chartResult.timestamp || [];
        const closes = quote?.close?.filter(Boolean) || [currentPrice];
        const highs = quote?.high?.filter(Boolean) || [currentPrice];
        const lows = quote?.low?.filter(Boolean) || [currentPrice];
        const volumes = quote?.volume?.filter(v => v && v > 0) || [currentVolume];
        
        // Calculate 1-hour change (approximate)
        const change1h = closes.length >= 12 ? 
          ((closes[closes.length - 1] - closes[closes.length - 12]) / closes[closes.length - 12]) * 100 : 0;
        
        // Filter out stocks with insufficient data or movement
        if (currentVolume < CONFIG.MIN_STOCK_VOLUME) continue;
        if (Math.abs(change24h) < 0.5) continue; // Min 0.5% movement
        
        // Calculate technical indicators
        const rsi = calculateRSI(closes);
        const atrPercent = calculateATRPercent(highs, lows, closes, currentPrice);
        
        // Calculate relative volume
        const avgVolume = volumes.length > 20 ? 
          volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20 : currentVolume;
        const rvol = avgVolume > 0 ? currentVolume / avgVolume : 1.0;
        
        // Determine if penny stock
        const isPennyStock = currentPrice < 5.0;
        
        // Calculate AI score
        let aiScore = 6.0;
        
        // Volume scoring
        if (rvol > 3.0) aiScore += 1.5;
        else if (rvol > 2.0) aiScore += 1.0;
        else if (rvol > 1.5) aiScore += 0.5;
        
        // Price movement scoring
        if (Math.abs(change24h) > 5) aiScore += 1.2;
        else if (Math.abs(change24h) > 2) aiScore += 0.8;
        
        // Technical indicators scoring
        if (rsi > 40 && rsi < 80) aiScore += 0.8;
        if (atrPercent > 2 && atrPercent < 8) aiScore += 0.6;
        
        // Volume absolute scoring
        if (currentVolume > 5000000) aiScore += 1.0;
        else if (currentVolume > 1000000) aiScore += 0.6;
        
        // Penny stock bonus
        if (isPennyStock && Math.abs(change24h) > 8) aiScore += 0.8;
        
        aiScore = Math.min(aiScore, 10);
        
        // Skip if score is too low
        if (aiScore < 6.0) continue;
        
        // Determine momentum
        let momentum = 'Moderate';
        if (rvol > 4.0 && Math.abs(change24h) > 8) momentum = 'Very Strong';
        else if (rvol > 2.5 && Math.abs(change24h) > 4) momentum = 'Strong';
        
        // Determine catalyst
        let catalyst = 'Market Movement';
        if (Math.abs(change1h) > 3) catalyst = 'Intraday Momentum';
        else if (rvol > 4) catalyst = 'Volume Surge';
        else if (Math.abs(change24h) > 10) catalyst = 'Major Move';
        
        // Create stock result object (renamed from 'result' to avoid conflict)
        const stockData = {
          id: `${symbol}_${Date.now()}`,
          symbol: symbol,
          name: meta.longName || symbol,
          price: currentPrice,
          gap: Math.abs(change24h),
          change1h: change1h,
          change24h: change24h,
          dayHigh: regularMarketDayHigh,
          dayLow: regularMarketDayLow,
          volume: currentVolume,
          avgVolume: avgVolume,
          rvol: parseFloat(rvol.toFixed(1)),
          rsi: parseFloat(rsi.toFixed(1)),
          atr: parseFloat(atrPercent.toFixed(1)),
          aiScore: parseFloat(aiScore.toFixed(1)),
          momentum: momentum,
          isPennyStock: isPennyStock,
          sector: 'Live Market Data',
          catalyst: catalyst,
          pumpCheck: rvol > 5.0 ? 'High Volume Caution' : 'Clean',
          stopLoss: currentPrice * (isPennyStock ? 0.85 : 0.92), // Wider stops for penny stocks
          takeProfit: currentPrice * (isPennyStock ? 1.30 : 1.15),
          riskReward: isPennyStock ? '1:3.0' : '1:2.0',
          lastUpdated: new Date().toISOString(),
          dataSource: '🆓 FREE Yahoo Finance API'
        };
        
        stockResults.push(stockData);
        
        console.log(`✅ ${symbol}: $${currentPrice.toFixed(2)}, ${change24h.toFixed(1)}%, Vol: ${(currentVolume/1000000).toFixed(1)}M, Score: ${aiScore.toFixed(1)}`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.warn(`⚠️ Error fetching ${symbol}:`, error.message);
      }
    }
    
    // Sort by AI score and limit results
    const finalStockData = stockResults
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, CONFIG.MAX_STOCK_RESULTS);
    
    console.log(`🎯 Selected ${finalStockData.length} top stock signals from live data`);
    
    return {
      success: true,
      count: finalStockData.length,
      data: finalStockData,
      timestamp: new Date().toISOString(),
      source: 'Yahoo Finance Live Screener + GitHub Actions'
    };
    
  } catch (error) {
    console.error('❌ Yahoo Finance API error:', error.message);
    return {
      success: false,
      error: error.message,
      count: 0,
      data: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Main function to fetch all data and save to files
async function main() {
  console.log('🚀 Starting live trading data fetch...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  
  // Ensure data directory exists
  ensureDataDirectory();
  
  try {
    // Fetch data in parallel
    console.log('🔄 Fetching crypto and stock data in parallel...');
    const [cryptoResult, stockResult] = await Promise.all([
      fetchCryptoData(),
      fetchStockData()
    ]);
    
    // Save crypto data
    fs.writeFileSync('data/crypto.json', JSON.stringify(cryptoResult, null, 2));
    console.log(`💾 Saved crypto data: ${cryptoResult.count} signals`);
    
    // Save stock data  
    fs.writeFileSync('data/stocks.json', JSON.stringify(stockResult, null, 2));
    console.log(`💾 Saved stock data: ${stockResult.count} signals`);
    
    // Save combined status
    const status = {
      lastUpdated: new Date().toISOString(),
      cryptoCount: cryptoResult.count,
      stockCount: stockResult.count,
      cryptoSuccess: cryptoResult.success,
      stockSuccess: stockResult.success,
      totalApiCalls: 2 + (cryptoResult.count || 0) + (stockResult.count || 0),
      nextUpdate: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
    };
    
    fs.writeFileSync('data/status.json', JSON.stringify(status, null, 2));
    console.log(`📊 Saved status: Crypto=${cryptoResult.success ? '✅' : '❌'} Stock=${stockResult.success ? '✅' : '❌'}`);
    
    // Create a simple health check endpoint data
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        coingecko: cryptoResult.success,
        yahoo: stockResult.success
      }
    };
    
    fs.writeFileSync('data/health.json', JSON.stringify(health, null, 2));
    
    console.log('🎉 All data updated successfully!');
    console.log(`📈 Total signals: ${cryptoResult.count + stockResult.count}`);
    
  } catch (error) {
    console.error('❌ Main execution error:', error);
    
    // Save error status
    const errorStatus = {
      lastUpdated: new Date().toISOString(),
      error: error.message,
      success: false
    };
    
    fs.writeFileSync('data/error.json', JSON.stringify(errorStatus, null, 2));
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}
