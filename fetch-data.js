// ==========================================
// LIVE TRADING SCANNER DATA FETCHER
// CoinGecko + Yahoo Finance APIs (No API Keys Required)
// GitHub Actions Compatible
// ==========================================

const axios = require('axios');
const fs = require('fs');

// Configuration
const CONFIG = {
  COINGECKO_BASE: 'https://api.coingecko.com/api/v3',
  YAHOO_BASE: 'https://query1.finance.yahoo.com/v8/finance/chart',
  YAHOO_SCREENER: 'https://query1.finance.yahoo.com/v1/finance/screener',
  YAHOO_TRENDING: 'https://query1.finance.yahoo.com/v1/finance/trending/US',
  MAX_CRYPTO_RESULTS: 20,
  MAX_STOCK_RESULTS: 15,
  MIN_CRYPTO_VOLUME: 10000000, // $10M minimum volume
  MIN_STOCK_VOLUME: 100000,    // 100K minimum volume
  REQUEST_TIMEOUT: 10000,      // 10 seconds
  REQUEST_DELAY: 250           // 250ms between requests
};

// Create data directory if it doesn't exist
function ensureDataDirectory() {
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
    console.log('📁 Created data directory');
  }
}

// Helper function to add delay between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to calculate RSI
function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) return 50;
  
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
  if (!highs || !lows || !closes || highs.length < 2) {
    return 2 + Math.random() * 4; // Fallback 2-6%
  }
  
  const trueRanges = [];
  for (let i = 1; i < Math.min(highs.length, 14); i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  if (trueRanges.length === 0) return 3; // Fallback
  
  const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  return Math.max(1, (atr / currentPrice) * 100);
}

// Fetch cryptocurrency data from CoinGecko (No API key required)
async function fetchCryptoData() {
  try {
    console.log('🪙 Fetching live crypto data from CoinGecko...');
    
    // Get cryptocurrencies with comprehensive data
    const response = await axios.get(`${CONFIG.COINGECKO_BASE}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        order: 'volume_desc', // Order by volume for liquidity
        per_page: 100,        // Increased to get more options
        page: 1,
        sparkline: true,      // Get 7-day price history
        price_change_percentage: '1h,24h,7d' // Multiple timeframes
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingScanner/2.0)'
      },
      timeout: CONFIG.REQUEST_TIMEOUT
    });
    
    const coins = response.data;
    console.log(`📊 Retrieved ${coins.length} coins from CoinGecko`);
    
    const cryptoResults = [];
    
    for (const coin of coins) {
      try {
        // Validate essential data
        if (!coin.current_price || !coin.total_volume || coin.current_price <= 0) {
          continue;
        }
        
        const currentPrice = parseFloat(coin.current_price);
        const change1h = parseFloat(coin.price_change_percentage_1h_in_currency) || 0;
        const change24h = parseFloat(coin.price_change_percentage_24h) || 0;
        const change7d = parseFloat(coin.price_change_percentage_7d_in_currency) || 0;
        const volume24h = parseFloat(coin.total_volume) || 0;
        const marketCap = parseFloat(coin.market_cap) || 0;
        
        // Apply quality filters
        if (volume24h < CONFIG.MIN_CRYPTO_VOLUME) continue;  // Min $10M volume
        if (Math.abs(change24h) < 1) continue;               // Min 1% daily movement
        if (Math.abs(change24h) > 50) continue;              // Max 50% daily movement (avoid extreme pumps)
        if (marketCap < 50000000) continue;                  // Min $50M market cap
        if (currentPrice < 0.000001) continue;               // Avoid ultra-micro cap coins
        
        // Technical analysis from sparkline data
        const sparklineData = coin.sparkline_in_7d?.price || [];
        const recentPrices = sparklineData.length >= 24 ? sparklineData.slice(-24) : [currentPrice];
        
        const rsi = calculateRSI(recentPrices);
        const atrPercent = sparklineData.length >= 14 ? 
          calculateATRPercent(
            sparklineData.map(p => p * 1.015), // Approximate highs (1.5% above)
            sparklineData.map(p => p * 0.985), // Approximate lows (1.5% below)
            sparklineData,
            currentPrice
          ) : 3 + Math.random() * 3; // Fallback 3-6%
        
        // Calculate relative volume (estimated)
        const avgVolume = volume24h * (0.7 + Math.random() * 0.3); // Rough estimate
        const rvol = avgVolume > 0 ? volume24h / avgVolume : 1.0;
        
        // AI Score calculation
        let aiScore = 6.0; // Base score
        
        // Volume scoring
        if (volume24h > 500000000) aiScore += 2.0;      // >$500M volume
        else if (volume24h > 200000000) aiScore += 1.5; // >$200M volume
        else if (volume24h > 100000000) aiScore += 1.0; // >$100M volume
        else if (volume24h > 50000000) aiScore += 0.5;  // >$50M volume
        
        // Price movement scoring
        if (Math.abs(change24h) > 15) aiScore += 1.5;
        else if (Math.abs(change24h) > 8) aiScore += 1.0;
        else if (Math.abs(change24h) > 4) aiScore += 0.5;
        
        // Technical indicators scoring
        if (rsi >= 45 && rsi <= 75) aiScore += 1.0;  // Good RSI range
        if (atrPercent >= 3 && atrPercent <= 8) aiScore += 0.8; // Good volatility
        
        // Market cap scoring
        if (marketCap > 10000000000) aiScore += 1.0;    // >$10B (blue chip)
        else if (marketCap > 1000000000) aiScore += 0.5; // >$1B
        
        // Momentum scoring
        if (Math.abs(change1h) > 3) aiScore += 1.0;
        if (change24h > 0 && change7d > 0) aiScore += 0.5; // Positive multi-timeframe trend
        
        // Relative volume bonus
        if (rvol > 3.0) aiScore += 0.8;
        else if (rvol > 2.0) aiScore += 0.4;
        
        aiScore = Math.min(aiScore, 10.0); // Cap at 10
        
        // Skip if AI score is too low (quality filter)
        if (aiScore < 6.5) continue;
        
        // Determine momentum classification
        let momentum = 'Moderate';
        if (Math.abs(change24h) > 20 && volume24h > 300000000) momentum = 'Very Strong';
        else if (Math.abs(change24h) > 10 && volume24h > 100000000) momentum = 'Strong';
        
        // Determine market catalyst
        let catalyst = 'Market Movement';
        if (Math.abs(change1h) > 6) catalyst = 'Breaking News';
        else if (Math.abs(change24h) > 25) catalyst = 'Major Event';
        else if (volume24h > 1000000000) catalyst = 'Institutional Activity';
        else if (rvol > 4.0) catalyst = 'Volume Surge';
        
        // Risk assessment
        const pumpCheck = Math.abs(change24h) > 30 ? 'High Risk' : 
                         Math.abs(change24h) > 20 ? 'Caution' : 'Clean';
        
        // Create comprehensive crypto data object
        const cryptoSignal = {
          id: `${coin.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          coin: coin.symbol.toUpperCase(),
          symbol: `${coin.symbol.toUpperCase()}USDT`,
          name: coin.name,
          price: currentPrice,
          change1h: parseFloat(change1h.toFixed(3)),
          change24h: parseFloat(change24h.toFixed(3)),
          change7d: parseFloat(change7d.toFixed(3)),
          volume24h: volume24h,
          marketCap: marketCap,
          marketCapRank: coin.market_cap_rank || 999,
          rvol: parseFloat(rvol.toFixed(2)),
          rsi: parseFloat(rsi.toFixed(1)),
          atr: parseFloat(atrPercent.toFixed(1)),
          aiScore: parseFloat(aiScore.toFixed(1)),
          momentum: momentum,
          catalyst: catalyst,
          pumpCheck: pumpCheck,
          stopLoss: parseFloat((currentPrice * 0.92).toFixed(8)), // 8% stop loss
          takeProfit: parseFloat((currentPrice * 1.25).toFixed(8)), // 25% take profit
          riskReward: '1:3.1',
          lastUpdated: new Date().toISOString(),
          dataSource: '🆓 CoinGecko API (Free)',
          image: coin.image,
          // Additional metadata
          circulatingSupply: coin.circulating_supply,
          totalSupply: coin.total_supply,
          maxSupply: coin.max_supply,
          allTimeHigh: coin.ath,
          allTimeLow: coin.atl
        };
        
        cryptoResults.push(cryptoSignal);
        
        console.log(`✅ ${coin.symbol.toUpperCase()}: $${formatPrice(currentPrice)}, ${change24h.toFixed(1)}%, Vol: $${formatVolume(volume24h)}, Score: ${aiScore.toFixed(1)}`);
        
      } catch (error) {
        console.warn(`⚠️ Error processing ${coin.id}:`, error.message);
      }
    }
    
    // Sort by AI score (highest first) and limit results
    const finalCryptoData = cryptoResults
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, CONFIG.MAX_CRYPTO_RESULTS);
    
    console.log(`🎯 Selected top ${finalCryptoData.length} crypto signals`);
    
    return {
      success: true,
      count: finalCryptoData.length,
      data: finalCryptoData,
      timestamp: new Date().toISOString(),
      source: 'CoinGecko Free API',
      nextUpdate: new Date(Date.now() + 10 * 60 * 1000).toISOString()
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

// Fetch trending stocks from Yahoo Finance
async function fetchTrendingStocks() {
  try {
    console.log('📈 Fetching trending stocks from Yahoo Finance...');
    
    const response = await axios.get(CONFIG.YAHOO_TRENDING, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: CONFIG.REQUEST_TIMEOUT
    });
    
    const quotes = response.data?.finance?.result?.[0]?.quotes || [];
    return quotes.map(q => q.symbol).filter(Boolean);
    
  } catch (error) {
    console.warn('⚠️ Trending stocks fetch failed:', error.message);
    return [];
  }
}

// Fetch stock movers using screener
async function fetchStockMovers() {
  try {
    console.log('📊 Fetching stock movers...');
    
    // Multiple screener queries for different types of movers
    const queries = [
      // Top gainers with volume
      {
        "offset": 0,
        "size": 30,
        "sortField": "percentchange",
        "sortType": "DESC",
        "quoteType": "EQUITY",
        "query": {
          "operator": "AND",
          "operands": [
            {"operator": "GT", "operands": ["percentchange", 2]},
            {"operator": "GT", "operands": ["dayvolume", 200000]},
            {"operator": "GT", "operands": ["intradayprice", 0.5]}
          ]
        }
      },
      // High volume stocks
      {
        "offset": 0,
        "size": 30,
        "sortField": "dayvolume",
        "sortType": "DESC",
        "quoteType": "EQUITY",
        "query": {
          "operator": "AND",
          "operands": [
            {"operator": "GT", "operands": ["dayvolume", 2000000]},
            {"operator": "GT", "operands": ["intradayprice", 1]}
          ]
        }
      }
    ];
    
    let allStocks = [];
    
    for (const query of queries) {
      try {
        await delay(CONFIG.REQUEST_DELAY);
        
        const response = await axios.post(CONFIG.YAHOO_SCREENER, query, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/json'
          },
          timeout: CONFIG.REQUEST_TIMEOUT
        });
        
        const stocks = response.data?.finance?.result?.[0]?.quotes || [];
        allStocks = [...allStocks, ...stocks];
        console.log(`📊 Found ${stocks.length} stocks from screener`);
        
      } catch (error) {
        console.warn('⚠️ Screener query failed:', error.message);
      }
    }
    
    // Remove duplicates and return symbols
    const uniqueStocks = allStocks
      .filter((stock, index, self) => 
        index === self.findIndex(s => s.symbol === stock.symbol))
      .map(stock => stock.symbol)
      .filter(Boolean);
    
    return uniqueStocks;
    
  } catch (error) {
    console.warn('⚠️ Stock movers fetch failed:', error.message);
    return [];
  }
}

// Fetch detailed stock data from Yahoo Finance
async function fetchStockData() {
  try {
    console.log('📈 Fetching live stock data from Yahoo Finance...');
    
    // Get live stock symbols from multiple sources
    const [trendingStocks, movingStocks] = await Promise.all([
      fetchTrendingStocks(),
      fetchStockMovers()
    ]);
    
    // Combine and deduplicate symbols
    const allSymbols = [...new Set([...trendingStocks, ...movingStocks])];
    
    if (allSymbols.length === 0) {
      console.warn('⚠️ No live stocks found, using fallback symbols');
      // Fallback to popular stocks
      allSymbols.push('AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'META', 'AMZN', 'SPY', 'QQQ');
    }
    
    console.log(`📊 Processing ${allSymbols.length} stock symbols`);
    
    const stockResults = [];
    
    // Process stocks with rate limiting
    for (let i = 0; i < Math.min(allSymbols.length, 60); i++) {
      const symbol = allSymbols[i];
      
      if (!symbol || symbol.length > 5) continue; // Skip invalid symbols
      
      try {
        await delay(CONFIG.REQUEST_DELAY); // Rate limiting
        
        console.log(`📊 Fetching ${symbol}... (${i + 1}/${Math.min(allSymbols.length, 60)})`);
        
        // Fetch detailed stock chart data
        const response = await axios.get(`${CONFIG.YAHOO_BASE}/${symbol}`, {
          params: {
            interval: '5m',
            range: '5d',
            includePrePost: true
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: CONFIG.REQUEST_TIMEOUT
        });
        
        const result = response.data.chart?.result?.[0];
        if (!result || !result.meta) {
          console.warn(`⚠️ No data for ${symbol}`);
          continue;
        }
        
        const meta = result.meta;
        const currentPrice = meta.regularMarketPrice || meta.previousClose;
        const previousClose = meta.previousClose || meta.chartPreviousClose;
        const volume = meta.regularMarketVolume || 0;
        const dayHigh = meta.regularMarketDayHigh || currentPrice;
        const dayLow = meta.regularMarketDayLow || currentPrice;
        
        if (!currentPrice || currentPrice <= 0 || !previousClose) {
          console.warn(`⚠️ Invalid data for ${symbol}`);
          continue;
        }
        
        // Calculate price changes
        const change24h = ((currentPrice - previousClose) / previousClose) * 100;
        
        // Process intraday data
        const quote = result.indicators?.quote?.[0];
        const timestamps = result.timestamp || [];
        const closes = quote?.close?.filter(Boolean) || [currentPrice];
        const highs = quote?.high?.filter(Boolean) || [currentPrice];
        const lows = quote?.low?.filter(Boolean) || [currentPrice];
        const volumes = quote?.volume?.filter(v => v && v > 0) || [volume];
        
        // Calculate 1-hour change (approximate from 5min data)
        const change1h = closes.length >= 12 ? 
          ((closes[closes.length - 1] - closes[closes.length - 12]) / closes[closes.length - 12]) * 100 : 0;
        
        // Apply filters
        if (volume < CONFIG.MIN_STOCK_VOLUME) continue;     // Min volume
        if (Math.abs(change24h) < 0.5) continue;           // Min 0.5% movement
        if (currentPrice < 0.10) continue;                 // Avoid sub-penny stocks
        
        // Calculate technical indicators
        const rsi = calculateRSI(closes.slice(-20)); // Use last 20 data points
        const atrPercent = calculateATRPercent(highs, lows, closes, currentPrice);
        
        // Calculate relative volume
        const avgVolume = volumes.length > 10 ? 
          volumes.slice(-20).reduce((sum, v) => sum + v, 0) / Math.min(volumes.length, 20) : volume;
        const rvol = avgVolume > 0 ? volume / avgVolume : 1.0;
        
        // Determine stock characteristics
        const isPennyStock = currentPrice < 5.0;
        const isVolatile = Math.abs(change24h) > 5;
        
        // Calculate AI score
        let aiScore = 6.0; // Base score
        
        // Volume scoring
        if (rvol > 5.0) aiScore += 2.0;       // Exceptional volume
        else if (rvol > 3.0) aiScore += 1.5;  // Very high volume
        else if (rvol > 2.0) aiScore += 1.0;  // High volume
        else if (rvol > 1.5) aiScore += 0.5;  // Above average volume
        
        // Price movement scoring
        if (Math.abs(change24h) > 10) aiScore += 1.5;      // Major moves
        else if (Math.abs(change24h) > 5) aiScore += 1.0;   // Strong moves
        else if (Math.abs(change24h) > 2) aiScore += 0.5;   // Moderate moves
        
        // Technical indicators scoring
        if (rsi >= 35 && rsi <= 80) aiScore += 0.8;        // Good RSI range
        if (atrPercent >= 2 && atrPercent <= 10) aiScore += 0.6; // Good volatility
        
        // Volume absolute scoring
        if (volume > 10000000) aiScore += 1.0;      // >10M volume
        else if (volume > 5000000) aiScore += 0.8;  // >5M volume
        else if (volume > 1000000) aiScore += 0.6;  // >1M volume
        
        // Special bonuses
        if (isPennyStock && Math.abs(change24h) > 15) aiScore += 1.0; // Penny stock momentum
        if (Math.abs(change1h) > 3) aiScore += 0.7; // Intraday momentum
        
        aiScore = Math.min(aiScore, 10.0); // Cap at 10
        
        // Skip if AI score is too low
        if (aiScore < 6.0) continue;
        
        // Determine momentum classification
        let momentum = 'Moderate';
        if (rvol > 5.0 && Math.abs(change24h) > 10) momentum = 'Very Strong';
        else if (rvol > 3.0 && Math.abs(change24h) > 5) momentum = 'Strong';
        
        // Determine catalyst
        let catalyst = 'Market Movement';
        if (Math.abs(change1h) > 5) catalyst = 'Intraday Breakout';
        else if (rvol > 8) catalyst = 'Massive Volume';
        else if (Math.abs(change24h) > 15) catalyst = 'Major News';
        else if (rvol > 4) catalyst = 'Volume Surge';
        
        // Risk assessment
        const pumpCheck = rvol > 10 ? 'Extreme Volume' : 
                         Math.abs(change24h) > 20 ? 'High Volatility' : 'Clean';
        
        // Sector classification (basic)
        const getSector = (symbol) => {
          const sectors = {
            'AAPL': 'Technology', 'MSFT': 'Technology', 'GOOGL': 'Technology', 'META': 'Technology',
            'TSLA': 'Automotive', 'NVDA': 'Semiconductors', 'AMD': 'Semiconductors',
            'SPY': 'ETF - S&P 500', 'QQQ': 'ETF - NASDAQ', 'IWM': 'ETF - Small Cap',
            'PLTR': 'Software', 'COIN': 'Cryptocurrency', 'HOOD': 'Fintech'
          };
          return sectors[symbol] || 'Stock';
        };
        
        // Create comprehensive stock data object
        const stockSignal = {
          id: `${symbol}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          symbol: symbol,
          name: meta.longName || meta.shortName || symbol,
          price: parseFloat(currentPrice.toFixed(2)),
          change1h: parseFloat(change1h.toFixed(3)),
          change24h: parseFloat(change24h.toFixed(3)),
          gap: Math.abs(parseFloat(change24h.toFixed(3))),
          dayHigh: parseFloat(dayHigh.toFixed(2)),
          dayLow: parseFloat(dayLow.toFixed(2)),
          volume: volume,
          avgVolume: Math.round(avgVolume),
          rvol: parseFloat(rvol.toFixed(1)),
          rsi: parseFloat(rsi.toFixed(1)),
          atr: parseFloat(atrPercent.toFixed(1)),
          aiScore: parseFloat(aiScore.toFixed(1)),
          momentum: momentum,
          isPennyStock: isPennyStock,
          sector: getSector(symbol),
          catalyst: catalyst,
          pumpCheck: pumpCheck,
          stopLoss: parseFloat((currentPrice * (isPennyStock ? 0.85 : 0.92)).toFixed(2)), // Wider stops for penny stocks
          takeProfit: parseFloat((currentPrice * (isPennyStock ? 1.35 : 1.18)).toFixed(2)), // Higher targets for penny stocks
          riskReward: isPennyStock ? '1:3.3' : '1:2.2',
          lastUpdated: new Date().toISOString(),
          dataSource: '🆓 Yahoo Finance API (Free)',
          // Additional metadata
          marketCap: meta.marketCap,
          previousClose: parseFloat(previousClose.toFixed(2)),
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow
        };
        
        stockResults.push(stockSignal);
        
        console.log(`✅ ${symbol}: ${currentPrice.toFixed(2)}, ${change24h.toFixed(1)}%, Vol: ${formatVolume(volume)}, Score: ${aiScore.toFixed(1)}`);
        
      } catch (error) {
        console.warn(`⚠️ Error fetching ${symbol}:`, error.message);
      }
    }
    
    // Sort by AI score and limit results
    const finalStockData = stockResults
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, CONFIG.MAX_STOCK_RESULTS);
    
    console.log(`🎯 Selected top ${finalStockData.length} stock signals from live data`);
    
    return {
      success: true,
      count: finalStockData.length,
      data: finalStockData,
      timestamp: new Date().toISOString(),
      source: 'Yahoo Finance Live Data',
      nextUpdate: new Date(Date.now() + 10 * 60 * 1000).toISOString()
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

// Helper functions
function formatPrice(price) {
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 100) return price.toFixed(2);
  return price.toFixed(0);
}

function formatVolume(volume) {
  if (volume >= 1000000000) return (volume / 1000000000).toFixed(1) + 'B';
  if (volume >= 1000000) return (volume / 1000000).toFixed(1) + 'M';
  if (volume >= 1000) return (volume / 1000).toFixed(1) + 'K';
  return volume.toString();
}

// Main execution function
async function main() {
  console.log('🚀 Starting Live Trading Scanner Data Fetch...');
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🔧 Config: Crypto(${CONFIG.MAX_CRYPTO_RESULTS}) | Stocks(${CONFIG.MAX_STOCK_RESULTS})`);
  
  // Ensure data directory exists
  ensureDataDirectory();
  
  try {
    const startTime = Date.now();
    
    // Fetch data in parallel for speed
    console.log('🔄 Fetching crypto and stock data in parallel...');
    const [cryptoResult, stockResult] = await Promise.all([
      fetchCryptoData(),
      fetchStockData()
    ]);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    // Save crypto data
    const cryptoFile = 'data/crypto.json';
    fs.writeFileSync(cryptoFile, JSON.stringify(cryptoResult, null, 2));
    console.log(`💾 Saved crypto data: ${cryptoResult.count} signals → ${cryptoFile}`);
    
    // Save stock data
    const stockFile = 'data/stocks.json';
    fs.writeFileSync(stockFile, JSON.stringify(stockResult, null, 2));
    console.log(`💾 Saved stock data: ${stockResult.count} signals → ${stockFile}`);
    
    // Create comprehensive status file
    const status = {
      lastUpdated: new Date().toISOString(),
      executionTime: `${duration}s`,
      cryptoSignals: {
        count: cryptoResult.count,
        success: cryptoResult.success,
        source: 'CoinGecko API',
        nextUpdate: cryptoResult.nextUpdate
      },
      stockSignals: {
        count: stockResult.count,
        success: stockResult.success,
        source: 'Yahoo Finance API',
        nextUpdate: stockResult.nextUpdate
      },
      totalSignals: cryptoResult.count + stockResult.count,
      systemStatus: (cryptoResult.success || stockResult.success) ? 'healthy' : 'degraded',
      apiHealth: {
        coingecko: cryptoResult.success,
        yahoo: stockResult.success
      },
      performance: {
        executionTimeSeconds: parseFloat(duration),
        averageSignalScore: {
          crypto: cryptoResult.data?.length > 0 ? 
            (cryptoResult.data.reduce((sum, s) => sum + s.aiScore, 0) / cryptoResult.data.length).toFixed(1) : 0,
          stocks: stockResult.data?.length > 0 ? 
            (stockResult.data.reduce((sum, s) => sum + s.aiScore, 0) / stockResult.data.length).toFixed(1) : 0
        }
      }
    };
    
    fs.writeFileSync('data/status.json', JSON.stringify(status, null, 2));
    console.log(`📊 Saved system status → data/status.json`);
    
    // Create health check for monitoring
    const health = {
      status: status.systemStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        coingecko: cryptoResult.success ? 'up' : 'down',
        yahoo: stockResult.success ? 'up' : 'down'
      },
      metrics: {
        totalSignals: status.totalSignals,
        executionTime: duration
      }
    };
    
    fs.writeFileSync('data/health.json', JSON.stringify(health, null, 2));
    
    // Success summary
    console.log('\n🎉 ===== EXECUTION SUMMARY =====');
    console.log(`⏱️  Total execution time: ${duration}s`);
    console.log(`🪙 Crypto signals: ${cryptoResult.count} (${cryptoResult.success ? '✅' : '❌'})`);
    console.log(`📈 Stock signals: ${stockResult.count} (${stockResult.success ? '✅' : '❌'})`);
    console.log(`📊 Total signals: ${status.totalSignals}`);
    console.log(`🔗 Dashboard: https://libranxp.github.io/trading-scanner/`);
    console.log('===============================\n');
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Fatal execution error:', error);
    
    // Save error status for debugging
    const errorStatus = {
      lastUpdated: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      success: false,
      systemStatus: 'error'
    };
    
    fs.writeFileSync('data/error.json', JSON.stringify(errorStatus, null, 2));
    
    // Exit with error code
    process.exit(1);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  fetchCryptoData,
  fetchStockData,
  main
};
